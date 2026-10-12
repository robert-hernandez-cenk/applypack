import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import { logger } from '../../logger';
import { PENDING_COOKIE, PENDING_SECONDS, SESSION_COOKIE, cookieOptions } from './cookies';
import { safeNext } from './next-path';
import { signInFailedPage, signedOutPage } from './pages';
import type { SignInRuntime } from './runtime';
import { newSession } from './session';

/*
 * Signing in and out (ADR 0064). The round trip to the provider is carried in a signed
 * cookie, so nothing is stored here: it holds what the provider's answer is
 * checked against, and where to land afterwards.
 */

export const LOGIN_PATH = '/auth/login';

const PendingSchema = z.object({ state: z.string(), nonce: z.string(), verifier: z.string(), next: z.string() });

export function signInRoutes(runtime: SignInRuntime, now: () => number = Date.now): Hono {
  const { settings } = runtime;
  const secret = settings.sessionSecret;
  const routes = new Hono();

  const refuse = async (c: Context, reason: string): Promise<Response> => {
    // The reason is for the log; the person gets the same page whatever it was.
    logger.warn({ reason }, 'web: sign-in did not complete');
    return c.html(await signInFailedPage(LOGIN_PATH), 401);
  };

  routes.get(LOGIN_PATH, async (c) => {
    const begun = await runtime.client().begin();
    const pending = { state: begun.state, nonce: begun.nonce, verifier: begun.verifier, next: safeNext(c.req.query('next')) };
    await setSignedCookie(c, PENDING_COOKIE, JSON.stringify(pending), secret, cookieOptions(settings, PENDING_SECONDS));
    return c.redirect(begun.url);
  });

  routes.get('/auth/callback', async (c) => {
    const stored = await getSignedCookie(c, secret, PENDING_COOKIE);
    deleteCookie(c, PENDING_COOKIE, { path: '/' });
    if (!stored) return refuse(c, 'no pending sign-in');
    let json: unknown;
    try {
      json = JSON.parse(stored);
    } catch {
      return refuse(c, 'unreadable pending sign-in');
    }
    const pending = PendingSchema.safeParse(json);
    if (!pending.success) return refuse(c, 'malformed pending sign-in');
    const providerError = c.req.query('error');
    if (providerError) return refuse(c, `provider answered ${providerError}`);
    if (c.req.query('state') !== pending.data.state) return refuse(c, 'state does not match');

    // The provider checks the answer against the address it was sent to, which is the public one, not a proxy's.
    const callbackUrl = new URL(settings.redirectUri);
    callbackUrl.search = new URL(c.req.url).search;
    let claims;
    try {
      claims = await runtime.client().exchange(callbackUrl, pending.data);
    } catch (err) {
      return refuse(c, err instanceof Error ? err.message : 'the provider rejected the answer');
    }
    const session = newSession(claims, Math.floor(now() / 1000), settings.sessionSeconds);
    if (!session) return refuse(c, 'the identity has no id');
    await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(session), secret, cookieOptions(settings, settings.sessionSeconds));
    logger.info({ sub: session.sub, name: session.name }, 'web: signed in');
    return c.redirect(pending.data.next);
  });

  // A POST, so the origin guard that covers every write covers this too: another site cannot sign the person out.
  routes.post('/auth/logout', async (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.html(await signedOutPage(LOGIN_PATH));
  });

  return routes;
}
