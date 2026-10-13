import { JobStatus } from '@prisma/client';
import { companyForMessage } from '../employer';
import { prisma } from '../db';
import { logger } from '../logger';
import { sendDigest, type QuietSourceAlert } from '../notifier';
import { sourceLine } from '../web/pages/attribution';
import { alertsOff } from '../datasets/map';
import { QUIET_STREAK } from '../fetchers/source-health';
import { getSettings, pausedFamilies } from '../settings';
import { lastSuccessfulRunAt, type CronStats } from './cron-run';
import type { AlertJob } from '../types';

/** The reach of the very first recap, before there is a previous one to measure from. */
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * One person's recap (ADR 0067). Chats belong to the install until
 * notifications do to a person (#11), so the worker asks for the default user's.
 */
export async function runDigestJob(userId: number): Promise<{ stats: CronStats }> {
  const started = Date.now();
  // The recap covers what arrived since the last recap, not a fixed day. The
  // digest hours are the user's now (TASKS §16) and there may be several: with
  // 09:00 and 19:00 a fixed 24-hour window would make the evening message
  // repeat the morning's in full. A failed run does not move the mark, so
  // nothing is skipped either; `digest-once.js` does move it, which is right —
  // asking for the recap now means the next one starts from here.
  const previous = await lastSuccessfulRunAt('digest');
  const since = previous ?? new Date(Date.now() - DIGEST_WINDOW_MS);
  logger.info({ since: since.toISOString(), firstEver: previous === null }, 'digest-job: start');

  const rows = await prisma.userJob.findMany({
    where: {
      userId,
      status: { in: [JobStatus.NEW, JobStatus.ALERTED] },
      job: { fetchedAt: { gte: since } },
      // A held match is delivered on its own a few minutes from now (TASKS
      // §16); listing it here too would show the user the same posting twice.
      alertHeldAt: null,
    },
    // The fields the message carries — not the description, the original or
    // the source payload the row also holds (DATA-5).
    select: {
      fitScore: true,
      techMatch: true,
      redFlags: true,
      summary: true,
      job: {
        select: {
          title: true,
          employer: true,
          location: true,
          countries: true,
          workplace: true,
          url: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          fetchedAt: true,
          sourceFile: true,
          company: { select: { name: true, atsType: true, atsToken: true, sourceConfig: true } },
          // The searches that scored each posting, so a reader running several
          // can tell the hunts apart in one list (ADR 0028).
          scores: {
            select: { profile: { select: { name: true, userId: true } } },
            orderBy: { fitScore: 'desc' },
          },
        },
      },
    },
    orderBy: [{ fitScore: { sort: 'desc', nulls: 'last' } }, { job: { fetchedAt: 'desc' } }],
  });
  // A folder set to "No alerts" is left out here as well: its match was never
  // sent and never held, which made it exactly the row this query finds (#391).
  const loud = rows.filter((r) => !alertsOff(r.job.company));
  // A row stored while fetching was paused has no score yet: it is news, in
  // one line, and not a match — the recap used to list each as "fit 0/100" (#392).
  const jobs = loud.filter((r) => r.fitScore !== null);
  const unscored = loud.length - jobs.length;

  const alerts: AlertJob[] = jobs.map(({ job: j, ...mine }) => {
    const searches = j.scores.filter((s) => s.profile.userId === userId);
    return {
    title: j.title,
    companyName: companyForMessage(j.employer, j.company),
    location: j.location,
    attribution: sourceLine(j.sourceFile, j.company.name, j.company),
    countries: j.countries,
    workplace: j.workplace,
    url: j.url,
    fitScore: mine.fitScore ?? 0,
    salaryMin: j.salaryMin,
    salaryCurrency: j.salaryCurrency,
    salaryPeriod: j.salaryPeriod,
    salaryMax: j.salaryMax,
    techMatch: mine.techMatch,
    redFlags: mine.redFlags,
    summary: mine.summary ?? '',
    // Named only when the person has more than one verdict on the posting —
    // with a single search the name is noise on every line.
    matchedProfile: searches.length > 1 ? (searches[0]?.profile.name ?? null) : null,
    };
  });

  // Broadcast, not routed: the digest spans every search, so it goes to every
  // active target rather than to any one search's chat. A send every chat
  // refused throws, and the failed run keeps the mark where it was.
  const delivery = await sendDigest(alerts, undefined, await quietSources(), undefined, 0, unscored);
  const durationMs = Date.now() - started;
  if (delivery.skipped !== null) {
    // Alerts off, or no chat: nothing to recap into. The matches found
    // meanwhile wait as held alerts and arrive on their own when they can.
    logger.info({ reason: delivery.skipped, durationMs }, 'digest-job: nothing sent');
    return { stats: { skipped: 1, reason: delivery.skipped, durationMs } };
  }
  logger.info({ count: alerts.length, unscored, durationMs }, 'digest-job: done');
  return { stats: { count: alerts.length, unscored, durationMs } };
}

/**
 * Sources that crossed the failure streak (ADR 0019), behind its toggle.
 * Only actively polled rows qualify — a disabled company, or one in a source
 * family the user switched off, is quiet by instruction.
 */
async function quietSources(): Promise<QuietSourceAlert[]> {
  const settings = await getSettings();
  if (!settings.sourceHealthAlerts) return [];
  const disabled = pausedFamilies(settings);
  const rows = await prisma.company.findMany({
    where: {
      active: true,
      consecutiveFailures: { gte: QUIET_STREAK },
      ...(disabled.length > 0 ? { atsType: { notIn: disabled } } : {}),
    },
    select: { name: true, atsType: true, lastFetchStatus: true, consecutiveFailures: true },
    orderBy: [{ consecutiveFailures: 'desc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    name: r.name,
    atsType: r.atsType,
    status: r.lastFetchStatus,
    streak: r.consecutiveFailures,
  }));
}
