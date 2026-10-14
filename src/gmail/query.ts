/*
 * What a check reads (ADR 0071): the window of mail it looks at and how many
 * mails one run takes. A window and a ledger, not a history cursor: Gmail's
 * history ids expire, and the ledger is needed anyway so that a mail is never
 * paid for twice. Pure.
 */

/** A first check, or one after a long silence, looks this far back. */
export const FIRST_RUN_DAYS = 14;
/** A later check starts this far before the last one, so a mail that landed during it is not missed. */
export const OVERLAP_DAYS = 2;
/** Mails one run reads; the rest wait in the window for the next run. */
export const MAX_MAILS_PER_RUN = 20;
/** The ledger forgets mails older than this: well past the window, so none is read twice. */
export const LEDGER_KEEP_DAYS = 60;

const DAY_MS = 86_400_000;

export function windowStart(now: Date, lastCheckAt: Date | null): Date {
  const floor = now.getTime() - FIRST_RUN_DAYS * DAY_MS;
  if (!lastCheckAt) return new Date(floor);
  return new Date(Math.max(floor, lastCheckAt.getTime() - OVERLAP_DAYS * DAY_MS));
}

/** Gmail's search syntax: mail after this second. */
export function searchQuery(start: Date): string {
  return `after:${Math.floor(start.getTime() / 1000)}`;
}

/** The mails to read now, newest first as Gmail lists them, and how many more are waiting. */
export function pickMessages(listed: readonly string[], processed: ReadonlySet<string>, cap: number = MAX_MAILS_PER_RUN): { take: string[]; left: number } {
  const fresh = listed.filter((id) => !processed.has(id));
  const take = fresh.slice(0, cap);
  return { take, left: fresh.length - take.length };
}

export function ledgerCutoff(now: Date): Date {
  return new Date(now.getTime() - LEDGER_KEEP_DAYS * DAY_MS);
}
