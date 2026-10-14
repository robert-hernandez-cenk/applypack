import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlashCookie } from '../flash';
import { PendingStore } from '../../gmail/pending';
import type { GoogleIo } from '../../gmail/google-io';
import type { GoogleSettings } from '../../gmail/settings';
import { createGmailRoute, type GmailRouteStore } from './gmail';

const SETTINGS: GoogleSettings = { clientId: 'id.apps.example', clientSecret: 'secret', redirectUri: 'https://jobs.example.org/gmail/callback' };
const BACK = '/settings?tab=profile#gmail';

interface Conn {
  accountEmail: string;
  refreshToken: string;
  label: string;
  requested: boolean;
}

function harness(opts: { settings?: GoogleSettings | null; user?: number; exchange?: GoogleIo['exchangeCode']; revoke?: GoogleIo['revoke'] } = {}) {
  const conns = new Map<number, Conn>();
  const calls: string[] = [];
  const store: GmailRouteStore = {
    async saveConnection(userId, c) {
      calls.push(`save:${userId}`);
      conns.set(userId, { ...c, label: conns.get(userId)?.label ?? 'Job Leads', requested: true });
    },
    async setLabel(userId, label) {
      const c = conns.get(userId);
      if (!c) return false;
      c.label = label;
      return true;
    },
    async requestCheck(userId) {
      const c = conns.get(userId);
      if (!c) return 'none';
      if (c.requested) return 'already';
      c.requested = true;
      return 'queued';
    },
    async deleteConnection(userId) {
      calls.push(`delete:${userId}`);
      conns.delete(userId);
    },
    async readRefreshToken(userId) {
      return conns.get(userId)?.refreshToken ?? null;
    },
  };
  const io: GoogleIo = {
    pkce: async () => ({ verifier: 'verifier-1', challenge: 'challenge-1' }),
    exchangeCode: opts.exchange ?? (async () => ({ accessToken: 'at', refreshToken: 'rt-secret' })),
    refreshAccessToken: async () => 'at',
    accountEmail: async () => 'person@example.org',
    revoke: opts.revoke ?? (async (token) => { calls.push(`revoke:${token}`); }),
  };
  const pending = new PendingStore();
  let user = opts.user ?? 1;
  const app = createGmailRoute({ io, settings: () => (opts.settings === undefined ? SETTINGS : opts.settings), pending, store, userId: () => user });
  return { app, conns, calls, pending, as: (id: number) => { user = id; } };
}

const flashOf = (res: Response) => parseFlashCookie(res.headers.get('set-cookie')?.split(';')[0]);
const post = (app: ReturnType<typeof harness>['app'], path: string, body: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });

test('connect sends the person to Google with a state only they can return', async () => {
  const h = harness();
  const res = await h.app.request('/gmail/connect');
  assert.equal(res.status, 302);
  const url = new URL(res.headers.get('location')!);
  assert.equal(url.hostname, 'accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge-1');
  assert.equal(h.pending.take(url.searchParams.get('state')!, 1), 'verifier-1');
});

test('without a Google client connect says so and goes nowhere', async () => {
  const h = harness({ settings: null });
  const res = await h.app.request('/gmail/connect');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), BACK);
  assert.equal(flashOf(res)?.kind, 'err');
  assert.equal(h.pending.size(), 0);
});

test('a returning person is stored with their address and a first check queued', async () => {
  const h = harness();
  const state = h.pending.begin(1, 'verifier-1');
  const res = await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  assert.equal(res.headers.get('location'), BACK);
  assert.equal(flashOf(res)?.kind, 'ok');
  assert.deepEqual(h.conns.get(1), { accountEmail: 'person@example.org', refreshToken: 'rt-secret', label: 'Job Leads', requested: true });
});

test('the code is traded with the verifier kept for that state', async () => {
  let seen = '';
  const h = harness({ exchange: async (_s, code, verifier) => { seen = `${code}/${verifier}`; return { accessToken: 'at', refreshToken: 'rt' }; } });
  const state = h.pending.begin(1, 'verifier-1');
  await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  assert.equal(seen, 'abc/verifier-1');
});

test('a state begun by another person stores nothing', async () => {
  const h = harness({ user: 2 });
  const state = h.pending.begin(1, 'verifier-1');
  const res = await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  assert.equal(flashOf(res)?.kind, 'err');
  assert.equal(h.conns.size, 0);
});

test('an unknown or reused state stores nothing', async () => {
  const h = harness();
  assert.equal(flashOf(await h.app.request('/gmail/callback?code=abc&state=nope'))?.kind, 'err');
  const state = h.pending.begin(1, 'verifier-1');
  await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  h.conns.clear();
  assert.equal(flashOf(await h.app.request(`/gmail/callback?code=abc&state=${state}`))?.kind, 'err');
  assert.equal(h.conns.size, 0);
});

test('a person who refuses at Google stores nothing and is not sent into an exchange', async () => {
  let exchanged = false;
  const h = harness({ exchange: async () => { exchanged = true; return { accessToken: 'a', refreshToken: 'r' }; } });
  const state = h.pending.begin(1, 'verifier-1');
  const res = await h.app.request(`/gmail/callback?error=access_denied&state=${state}`);
  assert.equal(flashOf(res)?.kind, 'err');
  assert.equal(exchanged, false);
  assert.equal(h.conns.size, 0);
});

test('an exchange Google refuses stores nothing', async () => {
  const h = harness({ exchange: async () => { throw new Error('Google gave no refresh token'); } });
  const state = h.pending.begin(1, 'verifier-1');
  const res = await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  assert.equal(flashOf(res)?.kind, 'err');
  assert.equal(h.conns.size, 0);
});

test('the token never reaches a flash', async () => {
  const h = harness();
  const state = h.pending.begin(1, 'verifier-1');
  const res = await h.app.request(`/gmail/callback?code=abc&state=${state}`);
  assert.ok(!(res.headers.get('set-cookie') ?? '').includes('rt-secret'));
});

test('a label is saved trimmed, and an empty one is the default', async () => {
  const h = harness();
  h.conns.set(1, { accountEmail: 'p@example.org', refreshToken: 'rt', label: 'Job Leads', requested: false });
  assert.equal(flashOf(await post(h.app, '/gmail/label', { label: '  Leads / Indeed ' }))?.kind, 'ok');
  assert.equal(h.conns.get(1)?.label, 'Leads / Indeed');
  await post(h.app, '/gmail/label', { label: '   ' });
  assert.equal(h.conns.get(1)?.label, 'Job Leads');
});

test('a label Gmail could not hold is refused and the old one stays', async () => {
  const h = harness();
  h.conns.set(1, { accountEmail: 'p@example.org', refreshToken: 'rt', label: 'Job Leads', requested: false });
  const res = await post(h.app, '/gmail/label', { label: 'x'.repeat(226) });
  assert.equal(flashOf(res)?.kind, 'err');
  assert.equal(h.conns.get(1)?.label, 'Job Leads');
});

test('a label for a person who is not connected is refused', async () => {
  const h = harness();
  assert.equal(flashOf(await post(h.app, '/gmail/label', { label: 'Leads' }))?.kind, 'err');
});

test('disconnect revokes at Google, deletes the connection, and touches nobody else', async () => {
  const h = harness();
  h.conns.set(1, { accountEmail: 'a@example.org', refreshToken: 'rt-a', label: 'Job Leads', requested: false });
  h.conns.set(2, { accountEmail: 'b@example.org', refreshToken: 'rt-b', label: 'Job Leads', requested: false });
  const res = await post(h.app, '/gmail/disconnect');
  assert.equal(flashOf(res)?.kind, 'ok');
  assert.deepEqual(h.calls, ['revoke:rt-a', 'delete:1']);
  assert.equal(h.conns.has(1), false);
  assert.equal(h.conns.get(2)?.refreshToken, 'rt-b');
});

test('a revoke Google fails still deletes the connection', async () => {
  const h = harness({ revoke: async () => { throw new Error('unreachable'); } });
  h.conns.set(1, { accountEmail: 'a@example.org', refreshToken: 'rt-a', label: 'Job Leads', requested: false });
  await post(h.app, '/gmail/disconnect');
  assert.equal(h.conns.has(1), false);
});

test('disconnecting when not connected is a plain message', async () => {
  const h = harness();
  const res = await post(h.app, '/gmail/disconnect');
  assert.equal(res.headers.get('location'), BACK);
  assert.deepEqual(h.calls, []);
});

test('Check now queues a check once, and pressing it again changes nothing', async () => {
  const h = harness();
  h.conns.set(1, { accountEmail: 'a@example.org', refreshToken: 'rt-a', label: 'Job Leads', requested: false });
  assert.equal(flashOf(await post(h.app, '/gmail/check'))?.kind, 'ok');
  assert.equal(h.conns.get(1)?.requested, true);
  assert.equal(flashOf(await post(h.app, '/gmail/check'))?.kind, 'ok');
});

test('Check now for a person who is not connected is refused, and nobody else’s is queued', async () => {
  const h = harness();
  h.conns.set(2, { accountEmail: 'b@example.org', refreshToken: 'rt-b', label: 'Job Leads', requested: false });
  assert.equal(flashOf(await post(h.app, '/gmail/check'))?.kind, 'err');
  assert.equal(h.conns.get(2)?.requested, false);
});
