import type { Context, MiddlewareHandler } from 'hono';
import { getSignedCookie } from 'hono/cookie';
import { t } from '../../i18n/t';
import { SESSION_COOKIE } from './cookies';
import type { SignInRuntime } from './runtime';
import { readSession, type Session } from './session';

declare module 'hono' {
  interface ContextVariableMap {
    /** Set by the gate for a request that carries a live session. */
    session: Session;
  }
}

/*
 * The lock (ADR 0064). A request with a live session passes. One without is
 * sent to sign in when it is a person opening a page, and refused when it is
 * anything else — a form post, a progress poll, curl — because following a
 * redirect to the provider's page would only fail somewhere less obvious.
 */

/** Served without a session: the sign-in routes themselves, the stylesheet they need, and the health check. */
function isOpen(path: string): boolean {
  return path === '/health' || path.startsWith('/auth/') || path.startsWith('/static/');
}

function opensAPage(c: Context): boolean {
  return c.req.method === 'GET' && (c.req.header('accept') ?? '').includes('text/html');
}

export function signInGate(runtime: SignInRuntime, now: () => number = Date.now): MiddlewareHandler {
  const { sessionSecret } = runtime.settings;
  return async (c, next) => {
    if (isOpen(c.req.path)) return next();
    const stored = await getSignedCookie(c, sessionSecret, SESSION_COOKIE);
    const session = stored ? readSession(stored, Math.floor(now() / 1000)) : null;
    if (session) {
      c.set('session', session);
      return next();
    }
    if (!opensAPage(c)) return c.text(t('oidc.unauthorized'), 401);
    const wanted = new URL(c.req.url);
    return c.redirect(`/auth/login?next=${encodeURIComponent(wanted.pathname + wanted.search)}`);
  };
}
