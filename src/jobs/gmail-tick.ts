import { connectedUserIds, requestedUserIds } from '../gmail/store';
import { getSettings } from '../settings';
import { tryFetchLock, waitForFetchLock } from './fetch-lock';
import { runForUsers } from './for-each-user';
import { runGmailJob } from './gmail-job';
import { liveGmailDeps } from './gmail-live';

/*
 * The two ways the worker reads Gmail (ADR 0071): an hourly look at every
 * connected person, and a beat a minute that takes the checks people asked for
 * ("Check now", a fresh connection). Both take the fetch lock once for
 * everyone, because they share the classifier with the fetch tick, and both
 * ask for it BEFORE a run is recorded, so meeting a fetch — or a pause, or
 * nobody to read for — leaves no row on /runs (jobs/fetch-tick.ts, #397).
 */

/** How often an hourly look that met a fetch asks for the lock again. */
const LOCK_RETRY_MS = 60_000;
/** How long it goes on asking: well inside the hour. */
const HOURLY_LOCK_WAIT_MS = 10 * 60_000;

export interface GmailTickOptions {
  stopping?: () => boolean;
  /** How long to go on asking for the lock; 0 asks once. */
  waitMs?: number;
}

export async function gmailTick(mode: 'all' | 'requested', opts: GmailTickOptions = {}): Promise<void> {
  const userIds = mode === 'all' ? await connectedUserIds() : await requestedUserIds();
  if (userIds.length === 0) return;
  if (opts.stopping?.() || !(await getSettings()).fetchingEnabled) return;
  const lock =
    mode === 'all'
      ? await waitForFetchLock({ everyMs: LOCK_RETRY_MS, waitMs: opts.waitMs ?? HOURLY_LOCK_WAIT_MS, stopping: opts.stopping })
      : await tryFetchLock();
  if (lock === null) return;
  try {
    // Each person is their own run, in their own language, and one failing does not stop the next.
    await runForUsers('gmail', userIds, (userId, report) => runGmailJob(userId, liveGmailDeps(), report));
  } finally {
    await lock.release();
  }
}
