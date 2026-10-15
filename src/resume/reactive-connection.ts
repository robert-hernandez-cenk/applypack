/*
 * A person's saved Reactive Resume connection, as far as a page may know it
 * (ADR 0075). Pure: the key is checked here and read only through
 * `reactive-connection-store.ts`, so `ConnectionView` has no field for it.
 */

/** A pasted credential is one line; a longer paste is an accident (a whole file) and is refused, not cut. */
export const MAX_KEY_CHARS = 500;

export type KeyFailure = 'empty' | 'tooLong';

export function cleanKey(raw: unknown): { ok: true; key: string } | { ok: false; code: KeyFailure } {
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) return { ok: false, code: 'empty' };
  if (key.length > MAX_KEY_CHARS) return { ok: false, code: 'tooLong' };
  return { ok: true, key };
}

/** What a page may know of a connection: where it points. */
export interface ConnectionView {
  base: string;
  host: string;
}

export function viewOf(baseUrl: string): ConnectionView {
  return { base: baseUrl, host: new URL(baseUrl).host };
}
