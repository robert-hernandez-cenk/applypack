/*
 * Where a visitor lands after signing in. The page asked for travels through
 * the provider and back in a query string, so it is untrusted: only a path on
 * this dashboard survives, anything else is the front page (no open redirect).
 */

const HOME = '/';
// Control characters and backslashes make browsers read a path as another host.
const UNSAFE = /[\u0000-\u001f\u007f\\]/;
const AUTH_ROUTES = /^\/auth(\/|$|\?)/;

export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return HOME;
  if (UNSAFE.test(raw) || raw.toLowerCase().startsWith('/%2f') || AUTH_ROUTES.test(raw)) return HOME;
  return raw;
}
