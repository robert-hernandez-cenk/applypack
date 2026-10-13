import { prisma } from '../db';
import { currentUser } from './current-user';
import { cronMinute } from '../schedule';
import { getAlertSchedule, getInstanceId, getSchedule } from '../settings';
import { alertChannel } from '../notifier';
import { countHeldAlerts } from '../jobs/alert-delivery';
import { heldReason } from '../jobs/held-alerts';
import { heldLine, type HeldLine } from './held-line';
import {
  describeNextFetch,
  isFetchDue,
  lastRealFetch,
  nextFetchAt,
  RUN_LOOKBACK,
  type Schedule,
} from '../user-schedule';

/**
 * What the Overview pill and the Schedule card both need to say (TASKS §16),
 * resolved once so the two pages cannot drift: the parsed schedule, whether
 * this hour would search, and the next heartbeat that will — named in the
 * user's own zone, at this install's own cron minute.
 */
export interface NextCheck {
  /**
   * The person's schedule (ADR 0069): their zone and alert timing, with the
   * install's fetch half — the whole of what the Schedule form shows.
   */
  schedule: Schedule;
  /** True when a heartbeat right now would search. */
  dueNow: boolean;
  /** "today at 14:05" — empty when the schedule reaches no heartbeat within a week. */
  next: string;
}

/** The waiting line both pages show, or null when nothing is held. */
export async function loadHeldLine(schedule: Schedule): Promise<HeldLine | null> {
  const count = await countHeldAlerts(currentUser().id);
  if (count === 0) return null;
  return heldLine(count, heldReason(await alertChannel(currentUser().id), schedule.alerts.mode));
}

export async function loadNextCheck(now = new Date()): Promise<NextCheck> {
  // Whether the install searches this hour is the install's schedule; the
  // person sees it named in their own zone.
  const fetchSchedule = await getSchedule();
  const schedule = await getAlertSchedule(currentUser().id);
  const runs = await prisma.cronRun.findMany({
    where: { name: 'fetch' },
    select: { startedAt: true, stats: true },
    orderBy: { startedAt: 'desc' },
    take: RUN_LOOKBACK,
  });
  const lastFetch = lastRealFetch(runs);
  const minute = cronMinute(await getInstanceId(), 'fetch');
  return {
    schedule,
    dueNow: isFetchDue(now, fetchSchedule, lastFetch),
    next: describeNextFetch(nextFetchAt(now, fetchSchedule, lastFetch, minute), now, schedule.timezone),
  };
}
