import { z } from 'zod';
import { extractJson, jsonFailure, type ParseResult } from '../text-utils';
import { fence, untrustedDirective } from '../prompt-fence';
import { CUTS_DEFAULT, CUTS_MAX, cutBudget, type LengthPlan } from './length';
import {
  ACTION_SECTIONS,
  MAX_RESUME_CHARS,
  REMOVALS_SCHEMA,
  RENDERING_NOTE,
  clip,
  postingBlock,
  readActions,
  type MatchAction,
  type MatchJobInput,
  type MatchKeyword,
  type MatchRemoval,
  type Prompt,
} from './prompts';

/*
 * Condense is a stage of its own (ADR 0078): cutting and tightening used to
 * share one request with the additions and the keywords, where they lost to
 * them. Step one finds cuts against the original text; the person accepts
 * some in the editor; step two shortens the wording of what is left, on the
 * text the editor holds then. The gates stay in code (replacement-gate.ts) -
 * a rule here only explains them. Pure: no I/O.
 */

/** The answer's size for either step; the thinking headroom is added by the provider (gotcha 16). */
export const CONDENSE_MAX_TOKENS = 6_000;
export const CONDENSE_TIMEOUT_MS = 180_000;
/** The most rewrites one reply may carry. */
const WORDS_MAX = 25;
const WORDS_DEFAULT = 12;
/** One rewrite saves about this many characters (a bullet loses a clause). */
const CHARS_PER_REWRITE = 60;

/* ---------- where a comparison stands ---------- */

const CONDENSE_STAGES = ['none', 'removals', 'rewrites'] as const;
/** The furthest step run: `removals` = the cuts exist, `rewrites` = the wording step ran too. */
export type CondenseStage = (typeof CONDENSE_STAGES)[number];

/** Stage of a stored row; no marker means Condense never ran on it. */
export function readCondenseStage(breakdown: unknown): CondenseStage {
  if (typeof breakdown !== 'object' || breakdown === null) return 'none';
  const v = (breakdown as { condense?: unknown }).condense;
  return v === 'removals' || v === 'rewrites' ? v : 'none';
}

export function withCondenseStage(breakdown: unknown, stage: Exclude<CondenseStage, 'none'>): Record<string, unknown> {
  const base = typeof breakdown === 'object' && breakdown !== null ? (breakdown as Record<string, unknown>) : {};
  return { ...base, condense: stage };
}

/** The wording step was asked for before the cuts step ran: the person's order is cuts, then wording. */
export class CondenseOrderError extends Error {
  constructor(readonly matchId: number) {
    super(`condense: wording asked for before cuts on comparison ${matchId}`);
    this.name = 'CondenseOrderError';
  }
}

export interface CondenseState {
  rewrites: MatchAction[];
  /** The editor text the rewrites were written against. */
  from: string;
  /** The editor text the actions were last refreshed against; '' while they still read the comparison's own text. */
  actionsOn: string;
}

/** The `condense` column of a stored row; `{}` is a row whose wording step never ran. */
export function readCondense(v: unknown): CondenseState {
  if (typeof v !== 'object' || v === null) return { rewrites: [], from: '', actionsOn: '' };
  const o = v as { rewrites?: unknown; from?: unknown; actionsOn?: unknown };
  return {
    rewrites: readActions(o.rewrites),
    from: typeof o.from === 'string' ? o.from : '',
    actionsOn: typeof o.actionsOn === 'string' ? o.actionsOn : '',
  };
}

/** The text a row's actions quote: the condensed text once suggestions were refreshed on it, else what the comparison judged. */
export function actionsText(row: { resumeText: string; condense: unknown }): string {
  return readCondense(row.condense).actionsOn || row.resumeText;
}

/** Open when the resume is over its target, or when a step already has something to review. */
export function condensePanel(plan: LengthPlan, stage: CondenseStage): { open: boolean } {
  return { open: !plan.met || stage !== 'none' };
}

/** How many cuts to ask for: the plan's budget when over the target, the default otherwise. */
export function cutsWanted(plan: LengthPlan): number {
  return plan.target === 'keep' || plan.met ? CUTS_DEFAULT : cutBudget(plan.overshootChars);
}

/** How many rewrites to ask for, by the same measure. */
function wordsWanted(plan: LengthPlan): number {
  if (plan.target === 'keep' || plan.met) return WORDS_DEFAULT;
  return Math.min(WORDS_MAX, Math.max(WORDS_DEFAULT, Math.ceil(plan.overshootChars / CHARS_PER_REWRITE)));
}

/* ---------- replies ---------- */

const CutsSchema = z.object({ removals: REMOVALS_SCHEMA });

const RewriteSchema = z.object({
  section: z.enum(ACTION_SECTIONS),
  where: z.string(),
  what: z.string(),
  why: z.string(),
  quote: z.string().trim().min(1),
  replacement: z.string().trim().min(1),
});
type Rewrite = z.infer<typeof RewriteSchema>;
const WordsSchema = z.object({ rewrites: z.array(RewriteSchema).max(WORDS_MAX).default([]) });

function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, text: string): ParseResult<T> {
  const json = extractJson(text);
  if (json === null) return jsonFailure(text);
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: JSON.stringify(parsed.error.flatten().fieldErrors) };
}

export function parseCutsResponse(text: string): ParseResult<{ removals: MatchRemoval[] }> {
  return parseWith(CutsSchema, text);
}

export function parseWordsResponse(text: string): ParseResult<{ rewrites: Rewrite[] }> {
  return parseWith(WordsSchema, text);
}

/** A rewrite is an ordinary change card: a quote and its new wording. */
export function wordsToActions(rewrites: Rewrite[]): MatchAction[] {
  return rewrites.map((r) => ({
    section: r.section,
    where: r.where,
    what: r.what,
    why: r.why,
    priority: 'medium',
    quote: r.quote,
    replacement: r.replacement,
    insert_after: null,
  }));
}

/** Tightening that does not shorten is not tightening: such a rewrite is dropped, never offered. */
export function shorterOnly(actions: MatchAction[]): { actions: MatchAction[]; dropped: number } {
  const kept = actions.filter((a) => a.quote && a.replacement && a.replacement.length < a.quote.length);
  return { actions: kept, dropped: actions.length - kept.length };
}

/* ---------- prompts ---------- */

/**
 * What to cut, and the two rules that protect the candidate. Moved here from
 * the comparison prompt (ADR 0078); the gate that enforces both is
 * replacement-gate.ts:gateRemovals, because a rule the user can lose data to
 * belongs in code (gotcha 11).
 */
const CUTS_RULES = `"removals" is the list of what to DELETE or SHORTEN so the resume reads cleaner for this posting: skills listed but never evidenced in a role; bullets with no number or no relevance to this posting (especially in roles older than two years); roles older than ~10 years condensed to one line — but age alone is not a reason, and an old role holding this posting's most relevant evidence (its own discipline, its CMS, its industry, the volume of work it names) is the LAST line to cut: condense the rest of that role around it; duplicated tech lists; filler sentences; anything a US recruiter does not want (photo, age, marital status, street-level home address); sections that add nothing (objective, references available on request). Each item: section, where, what to remove, why, and "quote" — the exact text to delete, copied verbatim (at most ~200 characters). Two hard rules:
   - PROTECTED: never remove the contact line or anything in it — name, email, phone, city/state/country, LinkedIn or GitHub links. Only a street-level home address may be trimmed, and then "quote" covers ONLY the street address and "what" says explicitly to keep email and phone.
   - KEEP WANTED KEYWORDS: never remove text containing a keyword marked "present" or "add" for THIS posting (Docker, CI/CD tools the posting wants, etc.). When a skills line mixes wanted items with noise, "quote" must cover only the contiguous noise span, and "what" must name exactly which items to drop and which to keep.`;

const OUTPUT_REMOVALS = `"removals": [{"section": "title"|"summary"|"skills"|"experience"|"education"|"format", "where": string, "what": string, "why": string, "quote": string|null}]`;
const OUTPUT_REWRITES = `"rewrites": [{"section": "title"|"summary"|"skills"|"experience"|"education"|"format", "where": string, "what": string, "why": string, "quote": string, "replacement": string}]`;

const VERDICTS_NOTE = `The KEYWORD VERDICTS block lists the posting's keywords with their requirement level, primary flag and status ("present" = already in the resume, "add" = evidenced but unwritten, "ask_user", "cannot_claim"). They are fixed: do not re-judge them.`;

const CUTS_SYSTEM = `You are cutting ONE resume down for ONE job posting. The comparison is already done; this call does only the cuts — nothing is added, reworded or scored here. Optimise for the recruiter's 6-10 second scan and the ATS parser. Return JSON only — no prose, no code fences.

${untrustedDirective()}

${RENDERING_NOTE}

${VERDICTS_NOTE}

METHOD
1. ${CUTS_RULES}

BE BRIEF: "why" in 12 words or fewer. Fewer, clear cuts beat a padded list; an empty list is a valid answer for a resume that is already tight.

OUTPUT (exactly this shape):
{
  ${OUTPUT_REMOVALS}
}`;

const WORDS_SYSTEM = `You are tightening the wording of ONE resume for ONE job posting. The comparison is done and the candidate has already cut what they chose to; the resume below is what is left. This call only makes lines SHORTER — nothing is added or scored here. Return JSON only — no prose, no code fences.

${untrustedDirective()}

${RENDERING_NOTE}

${VERDICTS_NOTE}

METHOD
1. "rewrites" is the list of lines to say in fewer words. Each: section, where, what changes, why, "quote" — the exact text, copied verbatim (at most ~200 characters) — and "replacement" — the complete new wording, ready to paste in place of the quote.
2. A "replacement" is STRICTLY SHORTER than its "quote": count the characters. Drop filler ("responsible for", "in order to", "various"), merge two clauses, keep the verb and the outcome.
3. A "replacement" keeps every number, figure, date, employer, job title and tool the quote names, and every keyword the verdicts mark "present" or "add". It never adds a claim, tool, number or outcome the quote does not already carry.
4. Never touch the contact line, a section heading, or a line that is already short. Skip a line rather than weaken it; start with the longest bullets of the oldest roles.

BE BRIEF: "why" in 12 words or fewer. An empty list is a valid answer.

OUTPUT (exactly this shape):
{
  ${OUTPUT_REWRITES}
}`;

export interface CondenseInput {
  /** The stored verdicts of the comparison: what the posting wants, what the resume shows. */
  keywords: Pick<MatchKeyword, 'term' | 'requirement' | 'primary' | 'status'>[];
  /** The page target against the text this step reads. */
  length: LengthPlan;
}

function verdictsBlock(keywords: CondenseInput['keywords']): string[] {
  // Model output derived from the posting: laundered untrusted text (ADR 0022 tier 2), so fenced.
  const lines = keywords.map((k) => `- ${k.term} | ${k.requirement}${k.primary ? ' | primary' : ''} | ${k.status}`);
  return [
    'KEYWORD VERDICTS of the comparison (term | requirement | status; fixed — do not re-judge):',
    fence('KEYWORD VERDICTS', lines.length > 0 ? lines.join('\n') : '(none)'),
    '',
  ];
}

/** Our own instruction about the budget, so it sits outside every fence. */
function lengthLines(plan: LengthPlan, noun: 'removals' | 'rewrites', count: number): string[] {
  if (plan.target === 'keep' || plan.met) {
    return [`No page target applies. Propose up to ${count} ${noun} — only those that clearly help this posting.`, ''];
  }
  return [
    `LENGTH TARGET: the candidate wants this resume to fit ${plan.target} ${plan.target === 1 ? 'page' : 'pages'}. It runs about ${plan.pages.toFixed(1)} pages, roughly ${plan.overshootChars} characters over. Propose up to ${count} ${noun}, the biggest savings first, toward that target.`,
    '',
  ];
}

export function buildRemovalsPrompt(resumeText: string, job: MatchJobInput, input: CondenseInput): Prompt {
  return {
    system: CUTS_SYSTEM,
    user: [
      fence('RESUME', clip(resumeText, MAX_RESUME_CHARS)),
      '',
      ...verdictsBlock(input.keywords),
      ...lengthLines(input.length, 'removals', Math.min(CUTS_MAX, cutsWanted(input.length))),
      postingBlock(job),
      '',
      'Return raw JSON only.',
    ].join('\n'),
  };
}

export function buildCondensePrompt(resumeText: string, job: MatchJobInput, input: CondenseInput): Prompt {
  return {
    system: WORDS_SYSTEM,
    user: [
      fence('RESUME', clip(resumeText, MAX_RESUME_CHARS)),
      '',
      ...verdictsBlock(input.keywords),
      ...lengthLines(input.length, 'rewrites', wordsWanted(input.length)),
      postingBlock(job),
      '',
      'Return raw JSON only.',
    ].join('\n'),
  };
}

/**
 * The cuts that still apply after a save: the ones the person accepted are out of the text and drop away
 * here, the ones left alone still quote words it holds, so the next comparison keeps offering them (#64).
 */
export function cutsStillApplicable(removals: MatchRemoval[], text: string): MatchRemoval[] {
  return removals.filter((r) => r.quote !== null && r.quote.trim() !== '' && text.includes(r.quote.trim()));
}
