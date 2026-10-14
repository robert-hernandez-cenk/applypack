import { randomUUID } from 'node:crypto';

/*
 * The API key of a Reactive Resume pull between listing the person's resumes
 * and importing the one they pick (ADR 0073). In memory only, ten minutes, a
 * handful at most, taken once and by its owner — the key is in no page, link,
 * log line or row. `peekPull` shows what a page may know of an entry.
 */

export interface Pull {
  userId: number;
  /** The instance, as `parseInstanceUrl` wrote it. */
  base: string;
  key: string;
}

/** Ten minutes: long enough to pick, short enough that a forgotten page keeps nothing. */
export const PULL_TTL_MS = 10 * 60_000;
const MAX_PULLS = 8;
const pulls = new Map<string, Pull & { createdAt: number }>();

export function stashPull(pull: Pull, now = Date.now()): string {
  prune(now);
  while (pulls.size >= MAX_PULLS) pulls.delete(pulls.keys().next().value!);
  const id = randomUUID();
  pulls.set(id, { ...pull, createdAt: now });
  return id;
}

/** The entry, gone from the stash — or null when it is not this person's, or has expired. */
export function takePull(id: string, userId: number, now = Date.now()): Pull | null {
  const found = find(id, userId, now);
  if (!found) return null;
  pulls.delete(id);
  return { userId: found.userId, base: found.base, key: found.key };
}

/** What a page may show of an entry: the instance, never the key. */
export function peekPull(id: string, userId: number, now = Date.now()): { base: string } | null {
  const found = find(id, userId, now);
  return found ? { base: found.base } : null;
}

function find(id: string, userId: number, now: number) {
  prune(now);
  const found = pulls.get(id);
  return found && found.userId === userId ? found : null;
}

function prune(now: number): void {
  for (const [id, pull] of pulls) {
    if (now - pull.createdAt > PULL_TTL_MS) pulls.delete(id);
  }
}
