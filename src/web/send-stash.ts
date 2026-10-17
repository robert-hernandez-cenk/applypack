import { randomUUID } from 'node:crypto';
import type { SendBack, SendOutcome } from './pages/reactive-send';

/*
 * What a send to Reactive Resume came to, kept for the page its POST redirects
 * to (ADR 0079): the POST only ever writes, so a reload of the result is a GET
 * and cannot make a second copy. In memory only, ten minutes, a few per person,
 * its owner's alone — and as often as they look, since it holds no secret: the
 * names of edits and a link, never the key or the address.
 */

export interface Sent {
  userId: number;
  jobTitle: string;
  back: SendBack;
  outcome: SendOutcome;
}

/** Long enough to read and come back to; short enough that a forgotten page keeps nothing. */
export const SEND_TTL_MS = 10 * 60_000;
const MAX_PER_USER = 4;
const MAX_ALL = 64;
const sends = new Map<string, Sent & { createdAt: number }>();

export function stashSend(sent: Sent, now = Date.now()): string {
  prune(now);
  evictOldest((s) => s.userId === sent.userId, MAX_PER_USER);
  evictOldest(() => true, MAX_ALL);
  const id = randomUUID();
  sends.set(id, { ...sent, createdAt: now });
  return id;
}

/** The result, or null when it is not this person's or has expired. */
export function readSend(id: string, userId: number, now = Date.now()): Sent | null {
  prune(now);
  const found = sends.get(id);
  if (!found || found.userId !== userId) return null;
  return { userId: found.userId, jobTitle: found.jobTitle, back: found.back, outcome: found.outcome };
}

/** Room for one more among the entries `which` picks out: the oldest go (a Map keeps insertion order). */
function evictOldest(which: (s: Sent) => boolean, cap: number): void {
  const mine = [...sends].filter(([, s]) => which(s));
  for (const [id] of mine.slice(0, Math.max(0, mine.length - cap + 1))) sends.delete(id);
}

function prune(now: number): void {
  for (const [id, s] of sends) {
    if (now - s.createdAt > SEND_TTL_MS) sends.delete(id);
  }
}
