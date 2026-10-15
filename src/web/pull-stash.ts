import { randomUUID } from 'node:crypto';

/*
 * A Reactive Resume pull between listing the person's resumes and importing the
 * one they pick (ADR 0073, 0075). In memory only, ten minutes, a few per
 * person, taken once and by its owner. It holds no address and no key — the
 * import reads those from the saved connection. The ids of the resumes that
 * were listed ride with it: the import may only ask for one of those.
 */

/** Where the picked resume goes: a new resume, or the next version of one the person owns. */
export type PullTarget = { kind: 'new' } | { kind: 'version'; resumeId: number };

export interface Pull {
  userId: number;
  /** What the list showed; nothing else can be imported with this pull. */
  ids: string[];
  target: PullTarget;
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
  return { userId: found.userId, ids: found.ids, target: found.target };
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
