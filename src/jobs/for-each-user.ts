import { logger } from '../logger';
import { inRunLocale } from '../run-locale';
import { listUserIds } from '../users/store';
import { recordCronRun, type CronStats } from './cron-run';
import type { ReportProgress } from './run-progress';

/*
 * A job that is each person's own (the recap, the stale nudge — ADR 0069) runs
 * once per person: its own run row (`cron_run.userId`), in its own language,
 * and one person's failure does not stop the next person's message.
 */

/**
 * Runs `job` for each of `userIds`, recording a run per person. Returns how
 * many failed; the error of each is logged here and in the run row.
 */
export async function runForUsers(
  name: string,
  userIds: readonly number[],
  job: (userId: number, report: ReportProgress) => Promise<{ stats: CronStats }>,
): Promise<number> {
  let failed = 0;
  for (const userId of userIds) {
    try {
      await inRunLocale(() => recordCronRun(name, (report) => job(userId, report), userId), userId);
    } catch (err) {
      failed++;
      logger.error({ err, name, userId }, 'cron: a person\'s run failed; the others go on');
    }
  }
  return failed;
}

/** Every person, for the once-scripts that ask for the job now. */
export async function runForEveryUser(name: string, job: (userId: number) => Promise<{ stats: CronStats }>): Promise<number> {
  return runForUsers(name, await listUserIds(), job);
}
