import { AtsType, Prisma, type Job } from '@prisma/client';
import { prisma } from '../db';
import { withApplyLinkFlags } from '../apply-link';
import { outcomeData, type PostingLink, type UserOutcome } from './user-job';
import type { MergedVerdict, ProfileVerdict } from './verdict-merge';
import type { StoredPlace } from './location-merge';

/*
 * The one place a re-score is written (ADR 0028, 0067). New postings take the
 * nested create in process-jobs; everything that re-scores a row that already
 * exists — "Re-classify all", the per-job button, a pasted job — comes through
 * here, so each person's best-of and the per-search rows can never drift apart.
 */

/** Where the posting can be applied — the same context `UserJob.redFlags` gets. */
export type ApplyLinkContext = PostingLink;

/**
 * One search's verdict, as the row that keeps it. The apply-link flags are a
 * property of the posting rather than of a search, so every row carries them:
 * CLAUDE.md's invariant is that `withApplyLinkFlags` runs at every site that
 * persists `redFlags` (ADR 0023), and this is one.
 */
export function toScoreData(
  v: ProfileVerdict,
  link: ApplyLinkContext,
): Prisma.JobScoreCreateWithoutJobInput {
  return {
    profile: { connect: { id: v.profileId } },
    fitScore: v.classification.fit_score,
    locationMatch: v.classification.location_match,
    techMatch: v.classification.tech_match,
    redFlags: withApplyLinkFlags(v.classification.red_flags, link),
    summary: v.classification.summary,
    priorityRulesApplied: v.priorityRulesApplied,
  };
}

/**
 * Replace the job's per-search rows and write each person's row in one
 * transaction. `merged` is the best of every search: only the posting's own
 * facts (salary) come from it. `outcomes` are the people with a verdict;
 * `createMissing` says whether a person without a row gets one (a posting
 * someone pasted does not reach the others, user-job.ts:givesRowToOthers).
 *
 * The rows are deleted and re-created rather than upserted: a search that has
 * since been switched off must lose its verdict, or the job page would show a
 * score from a hunt that is no longer running. Only the searches in `verdicts`
 * survive, which is exactly the roster that produced this reply.
 */
export async function saveJobScores(
  job: Pick<Job, 'id' | 'url'> & { company: { atsType: AtsType } },
  merged: MergedVerdict,
  verdicts: ProfileVerdict[],
  outcomes: UserOutcome[],
  createMissing: boolean,
  /** The posting's place after the model's block was merged in (ADR 0032); omitted = untouched. */
  place?: StoredPlace,
): Promise<void> {
  const c = merged.winner.classification;
  const link = { url: job.url, pasted: job.company.atsType === AtsType.MANUAL };
  await prisma.$transaction([
    prisma.jobScore.deleteMany({ where: { jobId: job.id } }),
    prisma.job.update({
      where: { id: job.id },
      data: {
        ...(place && {
          workplace: place.workplace,
          countries: place.countries,
          regions: place.regions,
          locationSource: place.source,
        }),
        salaryMin: c.salary_min,
        salaryMax: c.salary_max,
        salaryCurrency: c.salary_currency,
        salaryPeriod: c.salary_period,
        scores: { create: verdicts.map((v) => toScoreData(v, link)) },
      },
    }),
    ...outcomes.map((o) => {
      const data = outcomeData(o, link);
      return createMissing
        ? prisma.userJob.upsert({
            where: { userId_jobId: { userId: o.userId, jobId: job.id } },
            create: { userId: o.userId, jobId: job.id, ...data },
            update: data,
          })
        : prisma.userJob.updateMany({ where: { userId: o.userId, jobId: job.id }, data });
    }),
  ]);
}
