import type { ResumeMatch } from '@prisma/client';
import { logger } from '../logger';
import { getAiRuntime } from '../ai-runtime';
import { askForJson } from '../ai-json';
import { anthropicAnswerRoom } from '../ai-provider-parse';
import {
  CONDENSE_MAX_TOKENS,
  CONDENSE_TIMEOUT_MS,
  CondenseOrderError,
  buildCondensePrompt,
  buildRemovalsPrompt,
  parseCutsResponse,
  parseWordsResponse,
  readCondenseStage,
  shorterOnly,
  wordsToActions,
} from './condense';
import { lengthExtraTokens, lengthPlan, readPageTarget } from './length';
import { readMatchEvidence } from './match-mode';
import { readKeywords, type MatchJobInput } from './prompts';
import { effectiveKeywords } from './keyword-overrides';
import { loadKeywordMatcher } from './keyword-matcher';
import { gateActions, gateRemovals } from './replacement-gate';
import { listFacts, updateMatchCuts, updateMatchWords } from './store';

/*
 * Condense's two calls (ADR 0078). The pure half - rules, prompts, parsers - is
 * condense.ts; this is the part that spends AI and writes the row. Both read
 * the comparison's stored keyword verdicts and judge nothing again.
 */

/** What both steps read about the comparison, besides the text. */
async function sources(userId: number, match: ResumeMatch, job: MatchJobInput) {
  const [facts, matcher] = await Promise.all([
    // A comparison judged on its text alone keeps its cuts to it too (TASKS R1).
    readMatchEvidence(match.breakdown) === 'own' ? listFacts(userId) : [],
    loadKeywordMatcher(),
  ]);
  return { facts, matcher, keywords: readKeywords(match.keywords), posting: `${job.title}\n${job.description}` };
}

/**
 * Step one: what to cut from the text the comparison judged, sized to the
 * page target the comparison was made for. Every cut passes the removal gate
 * before it is stored. Null on AI failure.
 */
export async function findCuts(
  userId: number,
  match: ResumeMatch,
  job: MatchJobInput & { id: number },
  onError?: (reason: string) => void,
): Promise<ResumeMatch | null> {
  const known = await sources(userId, match, job);
  const length = lengthPlan(match.resumeText, readPageTarget(match.breakdown));
  const answer = await askForJson(
    await getAiRuntime(),
    {
      ...buildRemovalsPrompt(match.resumeText, job, { keywords: effectiveKeywords(known.keywords), length }),
      maxTokens: CONDENSE_MAX_TOKENS + Math.min(lengthExtraTokens(length), anthropicAnswerRoom(CONDENSE_MAX_TOKENS)),
      label: 'resume-condense-cuts',
      role: 'resume',
      timeoutMs: CONDENSE_TIMEOUT_MS,
      onError,
      subject: { jobId: job.id, resumeId: match.resumeId },
    },
    parseCutsResponse,
    { matchId: match.id },
  );
  if (!answer) return null;
  const cuts = gateRemovals(answer.data.removals, { resumeText: match.resumeText, ...known });
  const row = await updateMatchCuts(match.id, cuts.removals);
  logger.info(
    { matchId: match.id, jobId: job.id, asked: answer.data.removals.length, blocked: cuts.blocked, warned: cuts.warned, overshoot: length.overshootChars, model: answer.model, chars: answer.chars, ms: answer.ms },
    'resume: condense cuts found',
  );
  return row;
}

/**
 * Step two: shorter wording for what is left, written against `text` - the
 * editor's text after the cuts the person accepted. Refused (typed) before
 * step one ran. A wording the replacement gate refuses, or that is not
 * shorter than its quote, is dropped. Null on AI failure.
 */
export async function tightenWording(
  userId: number,
  match: ResumeMatch,
  job: MatchJobInput & { id: number },
  text: string,
  onError?: (reason: string) => void,
): Promise<ResumeMatch | null> {
  if (readCondenseStage(match.breakdown) === 'none') throw new CondenseOrderError(match.id);
  const known = await sources(userId, match, job);
  const length = lengthPlan(text, readPageTarget(match.breakdown));
  const answer = await askForJson(
    await getAiRuntime(),
    {
      ...buildCondensePrompt(text, job, { keywords: effectiveKeywords(known.keywords), length }),
      maxTokens: CONDENSE_MAX_TOKENS,
      label: 'resume-condense-words',
      role: 'resume',
      timeoutMs: CONDENSE_TIMEOUT_MS,
      onError,
      subject: { jobId: job.id, resumeId: match.resumeId },
    },
    parseWordsResponse,
    { matchId: match.id },
  );
  if (!answer) return null;
  const gate = gateActions(wordsToActions(answer.data.rewrites), { resumeText: text, ...known });
  const shorter = shorterOnly(gate.actions);
  const row = await updateMatchWords(match.id, shorter.actions, text);
  logger.info(
    { matchId: match.id, jobId: job.id, asked: answer.data.rewrites.length, blocked: gate.blocked, notShorter: shorter.dropped, kept: shorter.actions.length, model: answer.model, chars: answer.chars, ms: answer.ms },
    'resume: condense wording tightened',
  );
  return row;
}
