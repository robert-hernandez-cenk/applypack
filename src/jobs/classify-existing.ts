import { JobStatus, type AtsType, type Job } from '@prisma/client';
import { prisma } from '../db';
import { logger } from '../logger';
import { classifyJob } from '../classifier';
import { companyForPrompt } from '../employer';
import { listAllActiveProfiles } from '../profiles';
import { isBlankProfile } from '../profile-guards';
import { getSettings } from '../settings';
import { buildVerdicts, mergeVerdicts, mergeVerdictsByUser } from './verdict-merge';
import { givesRowToOthers, type UserOutcome } from './user-job';
import { statusesOf } from './user-job-store';
import { saveJobScores } from './score-store';
import { mergeAiLocation, type StoredPlace } from './location-merge';
import { handPickedSource, statusAfterRescore } from './rescore-status';

/** `sourceConfig` rides along because a folder of saved postings is told from a folder of rows by it (rescore-status.ts). */
export type ClassifiableJob = Job & { company: { name: string; atsType: AtsType; sourceConfig: unknown } };

/** What became of one re-score: the caller says it, so a press that changed nothing is not silent. */
export type Rescored =
  /** A verdict was formed and stored; `status` is the job's status after it. */
  | { kind: 'scored'; status: JobStatus }
  /** Two-stage scoring: the prefilter turned the posting away, so no verdict was formed. `status` as above. */
  | { kind: 'prefiltered'; status: JobStatus }
  /** No running search has a stack or role types to score against. */
  | { kind: 'no-search' }
  /** No engine answered; `reason` is the provider's one line, '' when it gave none. */
  | { kind: 'failed'; reason: string };

/**
 * Classifies one stored job against every active search and writes the scores
 * back (ADR 0028, 0067). Used by the per-job "Re-classify" button and by manual
 * job entry. Every person with a verdict gets their own row updated; with
 * `keepStatus` the rows' statuses are left alone (and nobody new gets one);
 * otherwise `statusAfterRescore` decides per person: a job is dismissed for
 * someone only when EVERY search of theirs rejects it, and never when it is
 * Applied, Saved, or a posting they pasted or saved as a file — a dismissed
 * row is deleted a month on. A posting the two-stage prefilter turns away is
 * no search's, as in "Save & re-classify" (reclassify-job.ts): the statuses
 * follow the same rule and the stored verdicts stay as the last reading.
 * `userId` is the person asking: the status in the answer is theirs.
 */
export async function classifyExistingJob(
  job: ClassifiableJob,
  opts: { keepStatus: boolean; userId: number },
): Promise<Rescored> {
  const started = Date.now();
  // Blank searches are dropped here exactly as in the tick and in
  // "Re-classify all" (issue #50) — otherwise this path, and only this path,
  // would store a vibes-based verdict next to the real ones.
  const profiles = (await listAllActiveProfiles()).filter((p) => !isBlankProfile(p));
  if (profiles.length === 0) {
    logger.warn({ jobId: job.id }, 'classify-existing: no usable active search');
    return { kind: 'no-search' };
  }
  const { classifierMode } = await getSettings();
  let reason = '';
  const outcome = await classifyJob(
    {
      title: job.title,
      companyName: companyForPrompt(job.employer, job.company),
      location: job.location,
      place: { workplace: job.workplace, countries: job.countries, regions: job.regions },
      description: job.description,
      postedAt: job.postedAt,
    },
    profiles,
    classifierMode,
    (why) => {
      reason = why;
    },
  );
  const states = (await statusesOf([job.id])).get(job.id) ?? new Map<number, JobStatus>();
  const handPicked = handPickedSource(job.company);
  const statusOf = (userId: number): JobStatus => states.get(userId) ?? JobStatus.NEW;
  if (outcome.preFiltered) {
    for (const [userId, current] of states) {
      const status = opts.keepStatus ? current : statusAfterRescore(current, false, handPicked);
      if (status !== current) await prisma.userJob.updateMany({ where: { userId, jobId: job.id }, data: { status } });
    }
    const status = opts.keepStatus ? statusOf(opts.userId) : statusAfterRescore(statusOf(opts.userId), false, handPicked);
    logger.info({ jobId: job.id, status }, 'classify-existing: the prefilter turned it away');
    return { kind: 'prefiltered', status };
  }
  if (outcome.results.size === 0) return { kind: 'failed', reason };

  const { verdicts } = buildVerdicts(outcome.results, profiles, job);
  const merged = mergeVerdicts(verdicts);
  if (!merged) return { kind: 'failed', reason };

  const outcomes: UserOutcome[] = [...mergeVerdictsByUser(verdicts)].map(([userId, m]) => ({
    userId,
    merged: m,
    status: opts.keepStatus ? statusOf(userId) : statusAfterRescore(statusOf(userId), m.kept, handPicked),
  }));
  await saveJobScores(job, merged, verdicts, outcomes, givesRowToOthers(handPicked, opts.keepStatus), mergeAiLocation(storedPlace(job), outcome.location));
  const status = outcomes.find((o) => o.userId === opts.userId)?.status ?? statusOf(opts.userId);
  logger.info(
    { jobId: job.id, searches: profiles.length, kept: merged.kept, ms: Date.now() - started },
    'classify-existing: scored',
  );
  return { kind: 'scored', status };
}

/** The row's own columns as the merge's starting point (ADR 0031 wrote them). */
export function storedPlace(job: Pick<Job, 'workplace' | 'countries' | 'regions' | 'locationSource'>): StoredPlace {
  return {
    workplace: job.workplace,
    countries: job.countries,
    regions: job.regions,
    source: job.locationSource as StoredPlace['source'],
  };
}

/**
 * The same call with nobody waiting on it — for a pasted posting whose
 * reader wants the comparison, not the fit score. The score lands on the job
 * page whenever the classifier answers; a failure is logged, never surfaced.
 */
export function classifyInBackground(job: ClassifiableJob, userId: number): void {
  void classifyExistingJob(job, { keepStatus: true, userId }).catch((err) => {
    logger.error({ err, jobId: job.id }, 'classify-existing: background run failed');
  });
}
