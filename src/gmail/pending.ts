import { randomBytes } from 'node:crypto';

/*
 * What a connection remembers between leaving for Google and coming back: the
 * PKCE verifier, kept against the `state` it was sent with and the person who
 * began it (ADR 0071). In the dashboard's memory, like `import-stash.ts`: an
 * install without sign-in has no secret to sign a cookie with, and one process
 * serves the redirect and its return. A restart drops the entry and the person
 * starts again. Pure but for the clock and the random state.
 */

export const PENDING_TTL_MS = 600_000;
/** More connections than this at once is not a person, and the oldest are dropped. */
export const MAX_PENDING = 200;

interface Entry {
  userId: number;
  verifier: string;
  expiresAt: number;
}

export class PendingStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Remembers the verifier for this person and returns the state to send to Google. */
  begin(userId: number, verifier: string): string {
    this.sweep();
    const state = randomBytes(24).toString('base64url');
    this.entries.set(state, { userId, verifier, expiresAt: this.now() + PENDING_TTL_MS });
    while (this.entries.size > MAX_PENDING) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return state;
  }

  /**
   * The verifier for a returning state, once. Another person's state is
   * refused without being used up, so a state replayed in a different session
   * cannot spend the owner's.
   */
  take(state: string, userId: number): string | null {
    const entry = this.entries.get(state);
    if (!entry || entry.expiresAt <= this.now()) {
      this.entries.delete(state);
      return null;
    }
    if (entry.userId !== userId) return null;
    this.entries.delete(state);
    return entry.verifier;
  }

  size(): number {
    return this.entries.size;
  }

  private sweep(): void {
    const at = this.now();
    for (const [state, entry] of this.entries) if (entry.expiresAt <= at) this.entries.delete(state);
  }
}
