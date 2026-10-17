import type { ResumeMatch } from '@prisma/client';
import { findCuts, tightenWording } from '../resume/condense-call';
import { readRemovals, type MatchJobInput } from '../resume/prompts';
import { readCondense } from '../resume/condense';
import { claimRun, startRun, updateRun } from './target-runs';
import { t } from '../i18n/t';

/** Condense's two steps as progress-page runs (ADR 0078), claimed per comparison and step like the suggestions run (issue #76). */
export type CondenseStep = 'cuts' | 'wording';

function condenseKey(step: CondenseStep, matchId: number): string {
  return `condense-${step}:${matchId}`;
}

interface CondenseRunInput {
  userId: number;
  match: ResumeMatch;
  job: MatchJobInput & { id: number };
  resumeName: string;
  /** The editor to come back to. */
  resultUrl: string;
  /** The editor's text, for the wording step. */
  text?: string;
}

/** Returns the run URL to redirect to; a second press while a run is in flight joins it. */
export function startCondenseRun(step: CondenseStep, input: CondenseRunInput): string {
  const { match, job } = input;
  const { run, joined } = claimRun(condenseKey(step, match.id), {
    steps: [step],
    jobTitle: job.title,
    resumeName: input.resumeName,
    jobId: job.id,
    backUrl: input.resultUrl,
    backLabel: t('condense.run.back'),
  });
  if (joined) return `/target/runs/${run.id}`;
  startRun(run.id, () => finishCondense(run.id, step, input));
  return `/target/runs/${run.id}`;
}

async function finishCondense(runId: string, step: CondenseStep, input: CondenseRunInput): Promise<void> {
  let reason = '';
  const onError = (r: string): void => {
    reason = r;
  };
  const row =
    step === 'cuts'
      ? await findCuts(input.userId, input.match, input.job, onError)
      : await tightenWording(input.userId, input.match, input.job, input.text ?? '', onError);
  updateRun(
    runId,
    row
      ? {
          stage: 'done',
          resultUrl: input.resultUrl,
          flash:
            step === 'cuts'
              ? t('condense.flash.cuts', { n: readRemovals(row.removals).length })
              : t('condense.flash.wording', { n: readCondense(row.condense).rewrites.length }),
        }
      : { stage: 'error', error: reason ? t('condense.failedWith', { reason }) : t('condense.failed') },
  );
}
