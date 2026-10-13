import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { originGuard } from '../origin-guard';
import { signInGate } from './gate';
import { signInRoutes } from './routes';
import type { SignInRuntime } from './runtime';
import type { OidcClient, SignInSecrets } from './client';
import type { IdentityClaims } from './session';
import { readOidcSettings, type OidcEnv } from './settings';

const ENV: OidcEnv = {
  OIDC_ISSUER: 'https://idp.example.test',
  OIDC_CLIENT_ID: 'applypack',
  OIDC_CLIENT_SECRET: 'shh',
  OIDC_SESSION_SECRET: 'k'.repeat(32),
  WEB_PUBLIC_URL: 'https://jobs.example.test',
};
const START_MS = 1_800_000_000_000;

interface Rig {
  app: Hono;
  advance(seconds: number): void;
  /** What the fake provider answers the next exchange with; `null` makes it refuse. */
  answer: { claims: IdentityClaims | null };
}

function rig(env: OidcEnv = ENV): Rig {
  const reading = readOidcSettings(env);
  if (reading.kind !== 'on') throw new Error('test settings must be valid');
  let nowMs = START_MS;
  const answer: Rig['answer'] = { claims: { sub: 'u1', name: 'Ada' } };
  // Honest about what the real library does: it refuses an answer whose state is not the one it was told to expect.
  const client: OidcClient = {
    async begin() {
      return { state: 'S1', nonce: 'N1', verifier: 'V1', url: 'https://idp.example.test/authorize?state=S1' };
    },
    async exchange(callbackUrl: URL, secrets: SignInSecrets) {
      if (callbackUrl.searchParams.get('state') !== secrets.state) throw new Error('state mismatch');
      if (!answer.claims) throw new Error('the provider refused');
      return answer.claims;
    },
  };
  const runtime: SignInRuntime = { settings: reading.settings, client: () => client };
  const now = () => nowMs;
  const app = new Hono();
  app.use('*', signInGate(runtime, now));
  app.route('/', signInRoutes(runtime, async () => 7, now));
  app.all('*', (c) => c.text('reached'));
  return { app, advance: (s) => void (nowMs += s * 1000), answer };
}

/** The `name=value` pairs a browser would send back: the last Set-Cookie per name, deleted ones dropped. */
function jar(...responses: Response[]): string {
  const cookies = new Map<string, string>();
  for (const res of responses) {
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (value === '' || /max-age=0/i.test(line)) cookies.delete(name);
      else cookies.set(name, value);
    }
  }
  return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
}

const html = { accept: 'text/html,application/xhtml+xml' };

async function signIn(r: Rig, next = '/jobs'): Promise<{ login: Response; callback: Response; cookies: string }> {
  const login = await r.app.request(`/auth/login?next=${encodeURIComponent(next)}`, { headers: html });
  const callback = await r.app.request('/auth/callback?code=abc&state=S1', { headers: { ...html, cookie: jar(login) } });
  return { login, callback, cookies: jar(login, callback) };
}

test('a browser with no session is sent to sign in, carrying the page it asked for', async () => {
  const res = await rig().app.request('/jobs?status=NEW&page=2', { headers: html });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), `/auth/login?next=${encodeURIComponent('/jobs?status=NEW&page=2')}`);
});

test('a request that is not a page load is refused, not redirected', async () => {
  const r = rig();
  const poll = await r.app.request('/jobs/1/state', { headers: { accept: 'application/json' } });
  assert.equal(poll.status, 401);
  assert.match(poll.headers.get('content-type') ?? '', /text\/plain/);
  const post = await r.app.request('/settings', { method: 'POST', headers: html });
  assert.equal(post.status, 401);
  assert.equal(await (await r.app.request('/jobs')).text(), 'Sign in required.');
});

test('static files, /health and the sign-in routes are not gated', async () => {
  const r = rig();
  assert.equal(await (await r.app.request('/static/tailwind.css')).text(), 'reached');
  assert.equal(await (await r.app.request('/health')).text(), 'reached');
  assert.equal((await r.app.request('/auth/login', { headers: html })).status, 302);
});

test('sign-in sends the browser to the provider and remembers the round trip in a signed cookie', async () => {
  const res = await rig().app.request('/auth/login?next=/jobs', { headers: html });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://idp.example.test/authorize?state=S1');
  const [pending = ''] = res.headers.getSetCookie();
  assert.match(pending, /^ap_oidc=/);
  assert.match(pending, /HttpOnly/i);
  assert.match(pending, /SameSite=Lax/i);
  assert.match(pending, /Secure/i);
  assert.match(pending, /Max-Age=600/i);
});

test('coming back signed in sets the session and lands on the page asked for', async () => {
  const r = rig();
  const { callback, cookies } = await signIn(r, '/jobs?status=NEW');
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/jobs?status=NEW');
  const session = callback.headers.getSetCookie().find((c) => c.startsWith('ap_session='));
  assert.ok(session, 'a session cookie is set');
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  assert.match(session, /Max-Age=28800/i);
  assert.ok(callback.headers.getSetCookie().some((c) => c.startsWith('ap_oidc=') && /Max-Age=0/i.test(c)), 'the pending cookie is cleared');
  assert.equal(await (await r.app.request('/jobs', { headers: { ...html, cookie: cookies } })).text(), 'reached');
});

test('a destination off this dashboard is replaced by the front page', async () => {
  const r = rig();
  const { callback } = await signIn(r, '//evil.test/steal');
  assert.equal(callback.headers.get('location'), '/');
});

async function refusedWith(r: Rig, request: (login: Response) => Response | Promise<Response>): Promise<void> {
  const login = await r.app.request('/auth/login?next=/jobs', { headers: html });
  const res = await request(login);
  assert.equal(res.status, 401);
  assert.ok(!res.headers.getSetCookie().some((c) => c.startsWith('ap_session=') && !/Max-Age=0/i.test(c)), 'no session is given');
  const body = await res.text();
  assert.match(body, /href="\/auth\/login"/);
  assert.match(body, /Sign-in did not complete/);
}

test('a return that does not match the sign-in this browser started is refused', async () => {
  const r = rig();
  await refusedWith(r, (login) => r.app.request('/auth/callback?code=abc&state=OTHER', { headers: { ...html, cookie: jar(login) } }));
});

test('a return with no pending sign-in is refused', async () => {
  const r = rig();
  await refusedWith(r, () => r.app.request('/auth/callback?code=abc&state=S1', { headers: html }));
});

test('a pending cookie that was tampered with is refused', async () => {
  const r = rig();
  await refusedWith(r, (login) => r.app.request('/auth/callback?code=abc&state=S1', { headers: { ...html, cookie: jar(login).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) } }));
});

test('the provider reporting an error is refused', async () => {
  const r = rig();
  await refusedWith(r, (login) => r.app.request('/auth/callback?error=access_denied&state=S1', { headers: { ...html, cookie: jar(login) } }));
});

test('an answer the provider library rejects is refused', async () => {
  const r = rig();
  r.answer.claims = null;
  await refusedWith(r, (login) => r.app.request('/auth/callback?code=abc&state=S1', { headers: { ...html, cookie: jar(login) } }));
});

test('an identity with no usable id is refused', async () => {
  const r = rig();
  r.answer.claims = { name: 'Nobody' };
  await refusedWith(r, (login) => r.app.request('/auth/callback?code=abc&state=S1', { headers: { ...html, cookie: jar(login) } }));
});

test('a session cookie that was altered is treated as none', async () => {
  const r = rig();
  const { cookies } = await signIn(r);
  const forged = cookies.replace(/(ap_session=)(.)/, (_, head: string, c: string) => `${head}${c === 'e' ? 'f' : 'e'}`);
  assert.equal((await r.app.request('/jobs', { headers: { ...html, cookie: forged } })).status, 302);
});

test('a session signed with another key is treated as none', async () => {
  const { cookies } = await signIn(rig());
  const other = rig({ ...ENV, OIDC_SESSION_SECRET: 'z'.repeat(32) });
  assert.equal((await other.app.request('/jobs', { headers: { ...html, cookie: cookies } })).status, 302);
});

test('a session past its lifetime is treated as none', async () => {
  const r = rig();
  const { cookies } = await signIn(r);
  r.advance(8 * 3600 - 1);
  assert.equal((await r.app.request('/jobs', { headers: { ...html, cookie: cookies } })).status, 200);
  r.advance(1);
  assert.equal((await r.app.request('/jobs', { headers: { ...html, cookie: cookies } })).status, 302);
});

test('signing out ends the session and offers a way back in', async () => {
  const r = rig();
  const { cookies } = await signIn(r);
  const res = await r.app.request('/auth/logout', { method: 'POST', headers: { cookie: cookies } });
  assert.equal(res.status, 200);
  assert.ok(res.headers.getSetCookie().some((c) => c.startsWith('ap_session=') && /Max-Age=0/i.test(c)), 'the session cookie is cleared');
  const body = await res.text();
  assert.match(body, /Signed out/);
  assert.match(body, /href="\/auth\/login"/);
  assert.equal((await r.app.request('/jobs', { headers: { ...html, cookie: jar(res) } })).status, 302);
});

test('signing out with no session is harmless', async () => {
  const res = await rig().app.request('/auth/logout', { method: 'POST' });
  assert.equal(res.status, 200);
});

test('signing out is a POST only', async () => {
  const res = await rig().app.request('/auth/logout', { headers: html });
  assert.doesNotMatch(await res.text(), /Signed out/);
  assert.equal(res.headers.getSetCookie().length, 0);
});

test('a cross-site page cannot sign the person out', async () => {
  const r = rig();
  const guarded = new Hono();
  guarded.use('*', originGuard());
  guarded.route('/', r.app);
  const res = await guarded.request('https://jobs.example.test/auth/logout', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'sec-fetch-site': 'cross-site', host: 'jobs.example.test' },
  });
  assert.equal(res.status, 403);
});

test('the cookies it clears carry Secure too, so a browser lets the deletion through', async () => {
  const r = rig();
  const { cookies } = await signIn(r);
  const out = await r.app.request('/auth/logout', { method: 'POST', headers: { cookie: cookies } });
  const cleared = out.headers.getSetCookie().find((c) => c.startsWith('ap_session='));
  assert.match(cleared ?? '', /Secure/i);
  const login = await r.app.request('/auth/login', { headers: html });
  const failed = await r.app.request('/auth/callback?code=a&state=WRONG', { headers: { ...html, cookie: jar(login) } });
  assert.match(failed.headers.getSetCookie().find((c) => c.startsWith('ap_oidc=')) ?? '', /Secure/i);
});
