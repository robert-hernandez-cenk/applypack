import { randomUUID } from 'node:crypto';

/*
 * The API key of a Reactive Resume pull between listing the person's resumes
 * and importing the one they pick (ADR 0073). In memory only, ten minutes, a
 * few per person, taken once and by its owner — the key is in no page, link,
 * log line or row. The ids of the resumes that were listed ride with it: the
 * import may only ask for one of those.
 */

export interface Pull {
  userId: number;
  /** The instance, as `parseInstanceUrl` wrote it. */
  base: string;
  key: string;
  /** What the list showed; nothing else can be imported with this key. */
  ids: string[];
}

/** Ten minutes: long enough to pick, short enough that a forgotten page keeps nothing. */
export const PULL_TTL_MS = 10 * 60_000;
/** One person's open lists: another person cannot push them out. */
const MAX_PULLS_PER_USER = 4;
const MAX_PULLS = 64;
const pulls = new Map<string, Pull & { createdAt: number }>();

export function stashPull(pull: Pull, now = Date.now()): string {
  prune(now);
  evictOldest((p) => p.userId === pull.userId, MAX_PULLS_PER_USER);
  evictOldest(() => true, MAX_PULLS);
  const id = randomUUID();
  pulls.set(id, { ...pull, createdAt: now });
  return id;
}

/** The entry, gone from the stash — or null when it is not this person's, or has expired. */
export function takePull(id: string, userId: number, now = Date.now()): Pull | null {
  prune(now);
  const found = pulls.get(id);
  if (!found || found.userId !== userId) return null;
  pulls.delete(id);
  return { userId: found.userId, base: found.base, key: found.key, ids: found.ids };
}

/** Room for one more among the entries `which` picks out: the oldest go (a Map keeps insertion order). */
function evictOldest(which: (p: Pull) => boolean, cap: number): void {
  const mine = [...pulls].filter(([, p]) => which(p));
  for (const [id] of mine.slice(0, Math.max(0, mine.length - cap + 1))) pulls.delete(id);
}

function prune(now: number): void {
  for (const [id, pull] of pulls) {
    if (now - pull.createdAt > PULL_TTL_MS) pulls.delete(id);
  }
}
