/*
 * What a signed-in browser carries (ADR 0064): who, for display and the log,
 * and when the sign-in stops counting. The cookie's signature is Hono's; this
 * file only decides what goes inside and whether what came back is still good.
 */

export interface Session {
  /** The provider's stable id for the person. */
  sub: string;
  /** A name to show, never used to decide anything. */
  name: string | null;
  /** Epoch seconds; the session is over from this second on. */
  exp: number;
}

export interface IdentityClaims {
  sub?: unknown;
  name?: unknown;
  preferred_username?: unknown;
  email?: unknown;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function newSession(claims: IdentityClaims, nowSec: number, ttlSec: number): Session | null {
  const sub = text(claims.sub);
  if (!sub) return null;
  return { sub, name: text(claims.name) ?? text(claims.preferred_username) ?? text(claims.email), exp: nowSec + ttlSec };
}

export function readSession(json: string, nowSec: number): Session | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { sub, name, exp } = value as Record<string, unknown>;
  if (!text(sub) || typeof exp !== 'number' || !Number.isFinite(exp) || nowSec >= exp) return null;
  return { sub: sub as string, name: text(name), exp };
}
