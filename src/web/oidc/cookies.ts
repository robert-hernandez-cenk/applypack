import type { CookieOptions } from 'hono/utils/cookie';
import type { OidcSettings } from './settings';

export const SESSION_COOKIE = 'ap_session';
export const PENDING_COOKIE = 'ap_oidc';

/** How long a person has to come back from the provider. */
export const PENDING_SECONDS = 600;

/** The same for both cookies: out of reach of page scripts, kept on the top-level return from the provider. */
export function cookieOptions(settings: OidcSettings, maxAge: number): CookieOptions {
  return { path: '/', httpOnly: true, sameSite: 'Lax', secure: settings.secureCookies, maxAge };
}

/** To clear one. A Secure cookie is only reliably replaced by a Set-Cookie that is Secure as well. */
export function clearOptions(settings: OidcSettings): CookieOptions {
  return { path: '/', secure: settings.secureCookies };
}
