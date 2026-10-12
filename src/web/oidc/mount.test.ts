import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { authLock, planAuth, signInRuntime, type AuthEnv, type AuthPlan } from './mount';
import type { OidcClient } from './client';
import { signInRoutes } from './routes';

const OIDC: AuthEnv = {
  OIDC_ISSUER: 'https://idp.example.test',
  OIDC_CLIENT_ID: 'applypack',
  OIDC_CLIENT_SECRET: 'shh',
  OIDC_SESSION_SECRET: 'k'.repeat(32),
  WEB_PUBLIC_URL: 'https://jobs.example.test',
};
const html = { accept: 'text/html' };
const basic = (credentials: string) => ({ authorization: `Basic ${Buffer.from(credentials).toString('base64')}` });

const FAKE_CLIENT: OidcClient = {
  begin: async () => ({ state: 's', nonce: 'n', verifier: 'v', url: 'https://idp.example.test/authorize' }),
  exchange: async () => ({ sub: 'u1' }),
};

function appFor(env: AuthEnv): Hono {
  const plan = planAuth(env);
  assert.notEqual(plan.kind, 'error');
  const app = new Hono();
  const { runtime } = signInRuntime(plan.kind === 'oidc' ? plan.settings : undefined, async () => FAKE_CLIENT);
  const lock = authLock(plan, runtime);
  if (lock) app.use('*', lock);
  if (runtime) app.route('/', signInRoutes(runtime));
  app.all('*', (c) => c.text('reached'));
  return app;
}

function problemOf(plan: AuthPlan): string {
  assert.equal(plan.kind, 'error');
  return plan.kind === 'error' ? plan.message : '';
}

test('with nothing configured the dashboard is open, as before', async () => {
  assert.deepEqual(planAuth({}), { kind: 'open' });
  const app = appFor({});
  assert.equal(await (await app.request('/jobs')).text(), 'reached');
  assert.equal(await (await app.request('/auth/login', { headers: html })).text(), 'reached', 'no sign-in route exists, the catch-all answers');
});

test('the shared password alone locks every path, as before', async () => {
  const plan = planAuth({ WEB_BASIC_AUTH: 'ada:p:w' });
  assert.deepEqual(plan, { kind: 'basic', username: 'ada', password: 'p:w' });
  const app = appFor({ WEB_BASIC_AUTH: 'ada:p:w' });
  assert.equal((await app.request('/jobs')).status, 401);
  assert.equal((await app.request('/health')).status, 401);
  assert.equal(await (await app.request('/jobs', { headers: basic('ada:p:w') })).text(), 'reached');
});

test('a shared password that is not user:password stops the start', () => {
  for (const bad of ['nocolon', ':secret', 'user:']) {
    assert.match(problemOf(planAuth({ WEB_BASIC_AUTH: bad })), /WEB_BASIC_AUTH/, bad);
  }
  assert.match(problemOf(planAuth({ ...OIDC, WEB_BASIC_AUTH: 'nocolon' })), /WEB_BASIC_AUTH/);
});

test('a half-written sign-in block stops the start and names what is missing', () => {
  const message = problemOf(planAuth({ OIDC_ISSUER: 'https://idp.example.test' }));
  for (const name of ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_SESSION_SECRET', 'WEB_PUBLIC_URL']) assert.match(message, new RegExp(name));
});

test('with sign-in on, pages go to the provider and the shared password does not open them', async () => {
  const app = appFor({ ...OIDC, WEB_BASIC_AUTH: 'ada:pw' });
  const res = await app.request('/jobs', { headers: { ...html, ...basic('ada:pw') } });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location') ?? '', /^\/auth\/login\?next=/);
  assert.equal((await app.request('/jobs', { headers: basic('ada:pw') })).status, 401);
});

test('with sign-in on, the shared password still guards /health, and only /health', async () => {
  const app = appFor({ ...OIDC, WEB_BASIC_AUTH: 'ada:pw' });
  const bare = await app.request('/health');
  assert.equal(bare.status, 401);
  assert.match(bare.headers.get('www-authenticate') ?? '', /Basic/);
  assert.equal(await (await app.request('/health', { headers: basic('ada:pw') })).text(), 'reached');
  assert.equal((await app.request('/health', { headers: basic('ada:wrong') })).status, 401);
});

test('with sign-in on and no shared password, /health stays open as it always was', async () => {
  const app = appFor(OIDC);
  assert.equal(await (await app.request('/health')).text(), 'reached');
});

test('the provider is asked about itself once, when the server connects', async () => {
  const plan = planAuth(OIDC);
  assert.equal(plan.kind, 'oidc');
  if (plan.kind !== 'oidc') return;
  let asked = 0;
  const { runtime, connect } = signInRuntime(plan.settings, async () => {
    asked += 1;
    return FAKE_CLIENT;
  });
  assert.ok(runtime);
  assert.throws(() => runtime.client(), /not connected/);
  await connect();
  assert.equal(asked, 1);
  assert.equal(runtime.client(), FAKE_CLIENT);
});

test('a provider that cannot be reached makes connecting fail, so the server does not start', async () => {
  const plan = planAuth(OIDC);
  if (plan.kind !== 'oidc') return assert.fail('expected an oidc plan');
  const { connect } = signInRuntime(plan.settings, async () => {
    throw new Error('getaddrinfo ENOTFOUND idp.example.test');
  });
  await assert.rejects(connect(), /ENOTFOUND/);
});

test('connecting with sign-in off does nothing', async () => {
  const { connect } = signInRuntime(undefined, async () => assert.fail('must not be asked'));
  await connect();
});

test('a sign-in plan with nothing to run it is an error, never an open dashboard', () => {
  const plan = planAuth(OIDC);
  assert.equal(plan.kind, 'oidc');
  assert.throws(() => authLock(plan, null), /sign-in/);
});
