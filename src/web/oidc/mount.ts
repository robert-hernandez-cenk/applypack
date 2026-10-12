import type { MiddlewareHandler } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { createOidcClient, type OidcClient } from './client';
import { signInGate } from './gate';
import type { SignInRuntime } from './runtime';
import { readOidcSettings, type OidcEnv, type OidcSettings } from './settings';

/*
 * How the dashboard is locked, decided once from the environment (ADR 0064):
 * open, the shared password on every path (what it always was), or sign-in
 * through the provider with the shared password kept for /health alone. A
 * setting that cannot work is an error, never an open door.
 */

const BASIC_REALM = 'applypack';

export interface AuthEnv extends OidcEnv {
  WEB_BASIC_AUTH?: string;
}

interface Credentials {
  username: string;
  password: string;
}

export type AuthPlan =
  | { kind: 'open' }
  | ({ kind: 'basic' } & Credentials)
  | { kind: 'oidc'; settings: OidcSettings; healthBasic: Credentials | null }
  | { kind: 'error'; message: string };

/** `user:password`; the password may hold colons. Null when either half is missing. */
function parseCredentials(text: string): Credentials | null {
  const at = text.indexOf(':');
  const username = text.slice(0, at);
  const password = text.slice(at + 1);
  return at > 0 && password !== '' ? { username, password } : null;
}

export function planAuth(env: AuthEnv): AuthPlan {
  let basic: Credentials | null = null;
  if (env.WEB_BASIC_AUTH) {
    basic = parseCredentials(env.WEB_BASIC_AUTH);
    if (!basic) return { kind: 'error', message: 'WEB_BASIC_AUTH is set but not user:password' };
  }
  const reading = readOidcSettings({
    OIDC_ISSUER: env.OIDC_ISSUER,
    OIDC_CLIENT_ID: env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: env.OIDC_CLIENT_SECRET,
    OIDC_SESSION_SECRET: env.OIDC_SESSION_SECRET,
    OIDC_SESSION_HOURS: env.OIDC_SESSION_HOURS,
    WEB_PUBLIC_URL: env.WEB_PUBLIC_URL,
  });
  if (reading.kind === 'error') return { kind: 'error', message: reading.message };
  if (reading.kind === 'on') return { kind: 'oidc', settings: reading.settings, healthBasic: basic };
  return basic ? { kind: 'basic', ...basic } : { kind: 'open' };
}

function basicLock({ username, password }: Credentials): MiddlewareHandler {
  return basicAuth({ username, password, realm: BASIC_REALM });
}

/** The middleware that holds the door for a plan, or null when there is none. */
export function authLock(plan: AuthPlan, runtime: SignInRuntime | null, now?: () => number): MiddlewareHandler | null {
  if (plan.kind === 'basic') return basicLock(plan);
  if (plan.kind !== 'oidc' || !runtime) return null;
  const gate = signInGate(runtime, now);
  const health = plan.healthBasic ? basicLock(plan.healthBasic) : null;
  return (c, next) => (c.req.path === '/health' ? (health ? health(c, next) : next()) : gate(c, next));
}

/**
 * The provider is asked about itself once, as the server starts: `connect`
 * rejects when it cannot be reached or does not describe itself, and the
 * caller stops there rather than serving a lock that cannot open.
 */
export function signInRuntime(
  settings: OidcSettings | undefined,
  create: (settings: OidcSettings) => Promise<OidcClient> = createOidcClient,
): { runtime: SignInRuntime | null; connect(): Promise<void> } {
  if (!settings) return { runtime: null, connect: async () => undefined };
  let client: OidcClient | null = null;
  return {
    runtime: {
      settings,
      client() {
        if (!client) throw new Error('sign-in is not connected to the provider yet');
        return client;
      },
    },
    async connect() {
      client = await create(settings);
    },
  };
}
