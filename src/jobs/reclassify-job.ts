import { JobStatus } from '@prisma/client';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { createLimiter } from '../concurrency';
import { classifyJob } from '../classifier';
import { anyBaseFilterReason, passesAnyBaseFilter } from '../filter';
import { DISMISS_KEY, FILTER_KEY } from '../funnel';
import { getActiveProfile, listAllActiveProfiles } from '../profiles';
import { getSettings } from '../settings';
import { isBlankProfile } from '../profile-guards';
import { buildVerdicts, mergeVerdicts, mergeVerdictsByUser } from './verdict-merge';
import { givesRowToOthers, type UserOutcome } from './user-job';
import { statusesOf } from './user-job-store';
import { saveJobScores } from './score-store';
import { storedPlace } from './classify-existing';
import { mergeAiLocation } from './location-merge';
import { handPickedSource, statusAfterRescore } from './rescore-status';
import { rankByProfileFit, SCORE_BATCH, type ScorableJob } from './score-pick';
import type { CronStats } from './cron-run';
import { companyForPrompt, heldOnlyByMuters, withoutMuted } from '../employer';
import { allMutedKeys, mutedKeys } from './employer-store';

export { SCORE_BATCH };

const RECLASSIFY_BATCH_SIZE = 50;

export interface ReclassifyOptions {
  /** Restrict the pass to these ids; default: every job except APPLIED. */
  ids?: number[];
  onProgress?: (done: number, total: number) => void;
}

/**
 * Re-classifies all jobs (except those every holder has APPLIED to) against
 * every active search of every person (ADR 0028, 0067). Rewrites that job's
 * JobScore rows and each person's best-of, and may move a person's row between
 * NEW and DISMISSED — dismissed only when every search of theirs rejects it,
 * and never a Saved row or a posting they pasted or saved as a file
 * (rescore-status.ts). Counters count rows (a posting two people hold counts twice).
 */
export async function runReclassifyAll(): Promise<{ stats: CronStats }> {
  return reclassify({});
}

/**
 * The wizard's step 4: jobs a paused "Fetch now" stored unscored get their
 * score against the profile that now exists. Rows failing the base filter
 * are dismissed in one update — no AI spent on them (a saved posting is not
 * filtered here either, ADR 0062); of the rest, the
 * `limit` best matches by rankByProfileFit are classified (the wizard reads
 * the most promising ten, not the ten most recent), and `remaining` says
 * how many a second press would take.
 */
export async function runScoreUnscored(
  opts: Pick<ReclassifyOptions, 'onProgress'> & { limit?: number; userId: number },
): Promise<{ stats: CronStats }> {
  const profiles = (await listAllActiveProfiles()).filter((p) => !isBlankProfile(p));
  if (profiles.length === 0) return { stats: { aborted: 1, reason: 'no-active-profile' } };
  // The wizard reads the most promising ten, and "promising" needs one
  // yardstick — the primary's, falling back to the first running search.
  const primary = (await getActiveProfile(opts.userId)) ?? profiles[0]!;
  const ranker = isBlankProfile(primary) ? profiles[0]! : primary;

  const unscored = await prisma.job.findMany({
    // A muted company's rows are never scored: a mute promises no AI on them (ADR 0056).
    where: {
      userJobs: { some: { userId: opts.userId, fitScore: null, status: JobStatus.NEW } },
      ...withoutMuted(await mutedKeys(opts.userId)),
    },
    select: {
      id: true,
      title: true,
      location: true,
      workplace: true,
      countries: true,
      regions: true,
      description: true,
      fetchedAt: true,
      company: { select: { atsType: true, sourceConfig: true } },
    },
  });
  const rejectedIds: number[] = [];
  const rejectedBy = { rejectedTitle: 0, rejectedExcluded: 0, rejectedWorkplace: 0, rejectedPlace: 0 };
  const passing: ScorableJob[] = [];
  for (const j of unscored) {
    const rejected = handPickedSource(j.company) ? null : anyBaseFilterReason(j, profiles);
    if (rejected === null) {
      passing.push(j);
    } else {
      rejectedIds.push(j.id);
      rejectedBy[FILTER_KEY[rejected]]++;
    }
  }
  if (rejectedIds.length > 0) {
    await prisma.userJob.updateMany({
      where: { userId: opts.userId, jobId: { in: rejectedIds } },
      data: { status: JobStatus.DISMISSED },
    });
  }
  const ranked = rankByProfileFit(passing, ranker);
  const ids = ranked.slice(0, opts.limit ?? SCORE_BATCH).map((r) => r.id);
  const { stats } = await reclassify({ ids, onProgress: opts.onProgress });
  return {
    stats: {
      ...stats,
      unscored: unscored.length,
      filterDismissed: rejectedIds.length,
      ...rejectedBy,
      remaining: ranked.length - ids.length,
    },
  };
}

async function reclassify(opts: ReclassifyOptions): Promise<{ stats: CronStats }> {
  const started = Date.now();
  // Issue #50: re-scoring against a blank search would overwrite real scores
  // with vibes-based ones and demote most of the inbox, so blank rows are
  // dropped from the roster rather than aborting the pass.
  const profiles = (await listAllActiveProfiles()).filter((p) => !isBlankProfile(p));
  if (profiles.length === 0) {
    logger.warn('reclassify-all: no usable active search');
    return { stats: { aborted: 1, reason: 'no-active-profile' } };
  }

  const { classifierMode } = await getSettings();
  // A muted company's rows are not scored again: a mute promises no AI on them (ADR 0056).
  const scope = {
    // Nothing to score again for a posting every holder has applied to.
    NOT: { userJobs: { some: {}, every: { status: JobStatus.APPLIED } } },
    ...(opts.ids && { id: { in: opts.ids } }),
  };
  // A mute promises no AI on a company's postings for the person who muted it;
  // a posting is set aside only when every person who holds it did (ADR 0069).
  const mutes = await allMutedKeys();
  const total = await prisma.job.count({ where: scope });
  logger.info(
    {
      searches: profiles.map((p) => p.name),
      classifierMode,
      concurrency: config.AI_CONCURRENCY,
    },
    'reclassify-all: start',
  );

  let scanned = 0;
  let reclassified = 0;
  let preFiltered = 0;
  let promoted = 0; // moved DISMISSED → NEW
  let demoted = 0; // moved NEW/ALERTED → DISMISSED
  let keptSaved = 0; // a hand-picked posting no search wants: NEW/ALERTED → SAVED
  let unchanged = 0;
  let failed = 0;
  let filterRejected = 0;
  let priorityBoosted = 0;
  // Why a scored job was set aside, by the winning search's reason — the
  // wizard's "look like a match" line says why the rest did not (N2).
  const dismissedBy = { dismissedLowFit: 0, dismissedLocation: 0, dismissedSalary: 0 };
  // Why the last failed call failed — "no API key", "HTTP 401 …" — so the
  // flash and /runs can say it instead of leaving it to the container logs (#97).
  let lastError: string | null = null;

  const limit = createLimiter(config.AI_CONCURRENCY);
  let lastId = 0;
  while (true) {
    const batch = await prisma.job.findMany({
      where: {
        ...scope,
        id: { ...scope.id, gt: lastId },
      },
      include: { company: { select: { name: true, atsType: true, sourceConfig: true } } },
      orderBy: { id: 'asc' },
      take: RECLASSIFY_BATCH_SIZE,
    });
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1]?.id ?? lastId;
    const states = await statusesOf(batch.map((b) => b.id));
    const wanted = batch.filter((j) => !heldOnlyByMuters(j.employerKey, [...(states.get(j.id) ?? [])].map(([userId]) => userId), mutes));

    // Jobs no active search admits skip Claude entirely; the rest are
    // classified AI_CONCURRENCY at a time and persisted in id order as their
    // results come in. A posting the user chose is scored whatever the filter
    // says, as it was when it came in (ADR 0062).
    const pending = wanted.map((j) => {
      const chosen = handPickedSource(j.company);
      const scored = chosen || passesAnyBaseFilter(j, profiles);
      return {
        job: j,
        chosen,
        outcome: scored
          ? limit(() =>
              classifyJob(
                {
                  title: j.title,
                  companyName: companyForPrompt(j.employer, j.company),
                  location: j.location,
                  place: { workplace: j.workplace, countries: j.countries, regions: j.regions },
                  description: j.description,
                  postedAt: j.postedAt,
                },
                profiles,
                classifierMode,
                (reason) => {
                  lastError = reason;
                },
              ),
            )
          : null,
      };
    });

    // Rows the scoring never reached (the filter, the prefilter) are moved
    // once per batch (DATA-4): a "Re-classify all" over thousands of rows was
    // thousands of single-row updates, next to an updateMany the same file
    // already uses above.
    // Per person: userId -> the jobs to move.
    const demoteIds = new Map<number, number[]>();
    const saveIds = new Map<number, number[]>();
    const queue = (into: Map<number, number[]>, userId: number, jobId: number): void => {
      into.set(userId, [...(into.get(userId) ?? []), jobId]);
    };
    const turnDown = (j: { id: number }, chosen: boolean): void => {
      for (const [userId, current] of states.get(j.id) ?? []) {
        const target = statusAfterRescore(current, false, chosen);
        if (target === current) continue;
        if (target === JobStatus.SAVED) {
          queue(saveIds, userId, j.id);
          keptSaved++;
        } else {
          queue(demoteIds, userId, j.id);
          demoted++;
        }
      }
    };
    for (const { job: j, chosen, outcome } of pending) {
      scanned++;
      opts.onProgress?.(scanned, total);

      if (outcome === null) {
        turnDown(j, chosen);
        filterRejected++;
        continue;
      }

      const { results, location, preFiltered: wasPreFiltered } = await outcome;
      if (wasPreFiltered) {
        preFiltered++;
        // Reclassify treats pre-filtered jobs the same as base-filter rejects:
        // they leave the inbox.
        turnDown(j, chosen);
        continue;
      }
      if (results.size === 0) {
        failed++;
        continue;
      }

      const { verdicts, boosted } = buildVerdicts(results, profiles, j);
      const merged = mergeVerdicts(verdicts);
      if (!merged) {
        failed++;
        continue;
      }
      reclassified++;
      priorityBoosted += boosted;

      const held = states.get(j.id) ?? new Map<number, JobStatus>();
      const outcomes: UserOutcome[] = [];
      for (const [userId, m] of mergeVerdictsByUser(verdicts)) {
        const current = held.get(userId) ?? JobStatus.NEW;
        const target = statusAfterRescore(current, m.kept, chosen);
        outcomes.push({ userId, merged: m, status: target });
        if (!m.kept && m.winner.dismissReason) dismissedBy[DISMISS_KEY[m.winner.dismissReason]]++;
        if (target === current) unchanged++;
        else if (target === JobStatus.NEW) promoted++;
        else if (target === JobStatus.SAVED) keptSaved++;
        else demoted++;
      }

      await saveJobScores(j, merged, verdicts, outcomes, givesRowToOthers(chosen, false), mergeAiLocation(storedPlace(j), location));
    }
    for (const [userId, ids] of demoteIds) {
      await prisma.userJob.updateMany({ where: { userId, jobId: { in: ids } }, data: { status: JobStatus.DISMISSED } });
    }
    for (const [userId, ids] of saveIds) {
      await prisma.userJob.updateMany({ where: { userId, jobId: { in: ids } }, data: { status: JobStatus.SAVED } });
    }
  }

  const durationMs = Date.now() - started;
  const stats: CronStats = {
    profile: profiles.map((p) => p.name).join(' · '),
    classifierMode,
    concurrency: config.AI_CONCURRENCY,
    scanned,
    reclassified,
    preFiltered,
    promoted,
    demoted,
    keptSaved,
    unchanged,
    filterRejected,
    ...dismissedBy,
    priorityBoosted,
    failed,
    lastError,
    durationMs,
  };
  logger.info(stats, 'reclassify-all: done');
  return { stats };
}
