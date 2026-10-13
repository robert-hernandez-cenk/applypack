import { AsyncLocalStorage } from 'node:async_hooks';
import type { MiddlewareHandler } from 'hono';
import { t } from '../i18n/t';
import { FALLBACK_USER, DEFAULT_USER_ID, type CurrentUser } from '../users/identity';

/*
 * Who the request acts as (ADR 0065). The middleware below sets it for the
 * whole request, as display-zone.ts does for the time zone; a page or a route
 * reads `currentUser()`. A sign-in puts its `users` id on the session; a
 * dashboard without sign-in is the default user.
 */
const store = new AsyncLocalStorage<CurrentUser>();

/** Outside a request (a script, a test) the default user, which is everyone's user on an install without sign-in. */
export function currentUser(): CurrentUser {
  return store.getStore() ?? FALLBACK_USER;
}

/** Paths that answer without a person: nothing here may need the database. */
export function isUserless(path: string): boolean {
  return path === '/health' || path.startsWith('/auth/') || path.startsWith('/static/');
}

/**
 * `load` reads a `users` row. With a session its `uid` names the row, and a
 * row that is gone ends the sign-in (a 401, then the gate sends the person to
 * sign in again). Without a session the default user answers; if the table
 * cannot be read then, the built-in default keeps the page up.
 */
export function withCurrentUser(load: (id: number) => Promise<CurrentUser | null>): MiddlewareHandler {
  return async (c, next) => {
    if (isUserless(c.req.path)) return next();
    const session = c.get('session');
    if (session) {
      const user = await load(session.uid);
      if (!user) return c.text(t('oidc.unauthorized'), 401);
      return store.run(user, next);
    }
    let user: CurrentUser | null = FALLBACK_USER;
    try {
      user = await load(DEFAULT_USER_ID);
    } catch {
      // The employer-mode lookup in app.ts has already logged the database being down.
    }
    return store.run(user ?? FALLBACK_USER, next);
  };
}
