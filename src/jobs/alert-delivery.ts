import { JobStatus } from '@prisma/client';
import { companyForMessage } from '../employer';
import { prisma } from '../db';
import { logger } from '../logger';
import { alertChannel, sendDigest, type Delivery } from '../notifier';
import { sourceLine } from '../web/pages/attribution';
import { shouldDeliverHeld } from '../user-schedule';
import { getAlertSchedule } from '../settings';
import { inRunLocale } from '../run-locale';
import { starred, watchRules } from '../watchlist/interval';
import { groupHeldByTarget, heldTitle, type HeldRow } from './held-alerts';
import type { AlertJob } from '../types';

/**
 * Delivery of the matches that could not be sent when they were scored: found
 * outside the alert window (TASKS §16), found while Alerts were switched off,
 * or refused by every chat. Held rows stay NEW with `alertHeldAt` set and
 * their verdicts already in job_score; this sends them as one grouped message
 * per person and chat on the first heartbeat THAT PERSON'S schedule allows —
 * with their Alerts on and a chat of theirs to send to (ADR 0069) — and only
 * then marks them ALERTED.
 *
 * It is called from the top of the fetch tick, above the pause and above the
 * schedule gate: these are matches this app has already found and already
 * scored. Nothing about "pause fetching" or "don't search at night" says the
 * user should not hear about them.
 *
 * An import sends its own matches the same way when it ends (#402): `only`
 * narrows the delivery to one source's rows and names the message after it.
 * What the schedule or the switch keeps back stays held, and leaves with the
 * next heartbeat's delivery like any other held match.
 */
export interface HeldDelivery {
  /** Listed in a message and marked ALERTED. */
  delivered: number;
  messages: number;
  /** Counted in a message's header, not listed: left New. */
  counted: number;
  /** In a message every chat refused: still held, for the next heartbeat. */
  failed: number;
}

export async function deliverHeldAlerts(
  now: Date,
  only?: { companyId: number; title: string },
  /** One person's rows only (an import is its adder's alone); absent = everyone's. */
  forUser?: number,
): Promise<HeldDelivery> {
  const nothing: HeldDelivery = { delivered: 0, messages: 0, counted: 0, failed: 0 };

  // A match can be dismissed, saved or applied to from the dashboard while it
  // waits — the row is on /jobs the whole time. Acting on it settles it: the
  // hold is moot, and delivering it would both pester the user about a
  // posting they have answered and overwrite their status with ALERTED.
  await prisma.userJob.updateMany({
    where: { alertHeldAt: { not: null }, status: { not: JobStatus.NEW } },
    data: { alertHeldAt: null },
  });

  // Whose rows may leave now: their schedule lets a held message out, their
  // Alerts are on and they have a chat. Asked before the rows are read, so an
  // install with Alerts off does not build the messages every hour to discard them.
  const holders = await prisma.userJob.findMany({
    where: { alertHeldAt: { not: null }, status: JobStatus.NEW, ...(forUser !== undefined && { userId: forUser }), ...(only && { job: { companyId: only.companyId } }) },
    distinct: ['userId'],
    select: { userId: true },
  });
  const mayDeliver: number[] = [];
  for (const { userId } of holders) {
    if (!shouldDeliverHeld(now, await getAlertSchedule(userId))) continue;
    if ((await alertChannel(userId)) !== 'open') continue;
    mayDeliver.push(userId);
  }
  if (mayDeliver.length === 0) return nothing;

  // Those people's held rows; a row waits for its owner's own verdicts, so the
  // search that routes it is read among theirs.
  const userJobs = await prisma.userJob.findMany({
    where: { userId: { in: mayDeliver }, alertHeldAt: { not: null }, status: JobStatus.NEW, ...(only && { job: { companyId: only.companyId } }) },
    // The message's fields only (DATA-5).
    select: {
      id: true,
      userId: true,
      fitScore: true,
      techMatch: true,
      redFlags: true,
      summary: true,
      job: {
        select: {
          id: true,
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
          company: { select: { name: true, atsType: true, atsToken: true, watched: true, alertPolicy: true } },
          scores: {
            select: { fitScore: true, profile: { select: { name: true, userId: true, notificationTargetId: true } } },
            orderBy: { fitScore: 'desc' },
          },
        },
      },
    },
    orderBy: [{ fitScore: { sort: 'desc', nulls: 'last' } }, { job: { fetchedAt: 'desc' } }],
  });
  if (userJobs.length === 0) return nothing;

  const held: HeldRow[] = userJobs.map((u) => {
    const j = u.job;
    // The owner's searches, best first — the same routing an instant alert takes.
    const scores = j.scores.filter((s) => s.profile.userId === u.userId);
    return {
    id: u.id,
    userId: u.userId,
    targetId: scores[0]?.profile.notificationTargetId ?? null,
    alert: {
      title: j.title,
      // The ★ is on the row, not on the send: a held posting from a watched
      // company must read the same as one sent on the spot (ADR 0036).
      companyName: starred(companyForMessage(j.employer, j.company), watchRules(j.company)),
      watched: j.company.watched,
      attribution: sourceLine(j.sourceFile, j.company.name, j.company),
      location: j.location,
      countries: j.countries,
      workplace: j.workplace,
      url: j.url,
      fitScore: u.fitScore ?? 0,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      salaryCurrency: j.salaryCurrency,
      salaryPeriod: j.salaryPeriod,
      techMatch: u.techMatch,
      redFlags: u.redFlags,
      summary: u.summary ?? '',
      matchedProfile: scores.length > 1 ? (scores[0]?.profile.name ?? null) : null,
    } satisfies AlertJob,
    };
  });

  let delivered = 0;
  let messages = 0;
  let counted = 0;
  let failed = 0;
  const switchedOff = new Set<number>();
  for (const group of groupHeldByTarget(held)) {
    // A person whose switch went off or whose last chat went since the check above: the rest of their groups meet the same answer.
    if (switchedOff.has(group.userId)) continue;
    let delivery: Delivery;
    try {
      delivery = await inRunLocale(() => sendDigest(group.userId, group.alerts, group.targetId, [], only?.title ?? heldTitle(), group.unlisted.length), group.userId);
    } catch (err) {
      // Every chat refused it. The rows keep alertHeldAt, so the next
      // heartbeat tries again rather than leaving a match the user never
      // hears about.
      logger.error({ err, userId: group.userId, targetId: group.targetId, count: group.ids.length }, 'alert-delivery: send failed, keeping the rows held');
      failed += group.ids.length + group.unlisted.length;
      continue;
    }
    if (delivery.skipped !== null) {
      switchedOff.add(group.userId);
      continue;
    }
    const { count } = await prisma.userJob.updateMany({
      // Still NEW: the same guard again, because the send takes seconds and
      // the dashboard is open. A row settled in between keeps the user's
      // status and simply loses its stamp on the next pass.
      where: { id: { in: group.ids }, status: JobStatus.NEW },
      data: { status: JobStatus.ALERTED, alertedAt: now, alertHeldAt: null },
    });
    // Counted in the header and left New: no longer waiting, never listed.
    if (group.unlisted.length > 0) {
      await prisma.userJob.updateMany({ where: { id: { in: group.unlisted } }, data: { alertHeldAt: null } });
    }
    delivered += count;
    counted += group.unlisted.length;
    messages++;
  }
  if (delivered > 0) logger.info({ delivered, messages, counted }, 'alert-delivery: held matches sent');
  return { delivered, messages, counted, failed };
}

/** How many of a person's matches are waiting — for the overview line and the settings card. */
export async function countHeldAlerts(userId: number): Promise<number> {
  return prisma.userJob.count({ where: { userId, alertHeldAt: { not: null }, status: JobStatus.NEW } });
}
