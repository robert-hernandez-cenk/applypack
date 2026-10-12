import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { currentUser, withCurrentUser } from './current-user';
import { FALLBACK_USER, type CurrentUser } from '../users/identity';
import type { Session } from './oidc/session';

const ADA: CurrentUser = { id: 4, name: 'Ada', role: 'MEMBER' };
const DEFAULT: CurrentUser = { id: 1, name: 'Owner', role: 'ADMIN' };

function rig(load: (id: number) => Promise<CurrentUser | null>, session?: Session) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (session) c.set('session', session);
    return next();
  });
  app.use('*', withCurrentUser(load));
  app.get('/who', (c) => c.json(currentUser()));
  app.get('/health', (c) => c.json(currentUser()));
  return app;
}

const SESSION: Session = { sub: 's', name: 'Ada', uid: 4, exp: 9_999_999_999 };

test('a session acts as the user it names', async () => {
  const res = await rig(async (id) => (id === 4 ? ADA : null), SESSION).request('/who');
  assert.deepEqual(await res.json(), ADA);
});

test('a session whose user is gone is refused', async () => {
  const res = await rig(async () => null, SESSION).request('/who');
  assert.equal(res.status, 401);
});

test('without a session the default user answers', async () => {
  const res = await rig(async (id) => (id === 1 ? DEFAULT : null)).request('/who');
  assert.deepEqual(await res.json(), DEFAULT);
});

test('without a session and without a readable table the built-in default answers', async () => {
  const res = await rig(async () => {
    throw new Error('database down');
  }).request('/who');
  assert.deepEqual(await res.json(), FALLBACK_USER);
});

test('the health check never asks the database for a user', async () => {
  const res = await rig(async () => {
    throw new Error('must not be called');
  }).request('/health');
  assert.deepEqual(await res.json(), FALLBACK_USER);
});
