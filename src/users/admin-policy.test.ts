import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_ROUTES, PERSONAL_ROUTES, classesOf, isAdmin, mayRequest, routeAccess } from './admin-policy';

test('install-wide writes need an administrator', () => {
  for (const [method, path] of [
    ['POST', '/settings/ai/key'],
    ['POST', '/settings/ai/enable'],
    ['POST', '/settings/fetching-toggle'],
    ['POST', '/companies/7/delete'],
    ['POST', '/companies/new'],
    ['POST', '/runs/fetch-now'],
    ['GET', '/discovery'],
    ['GET', '/ai'],
    ['GET', '/jobs/import'],
    ['POST', '/screen/3/run-all'],
    ['GET', '/screen'],
    ['GET', '/users'],
    ['POST', '/users/2/role'],
    ['GET', '/welcome'],
    ['POST', '/welcome/ai/key'],
  ] as const) {
    assert.equal(routeAccess(method, path), 'admin', `${method} ${path}`);
  }
});

test('a person works in their own workspace', () => {
  for (const [method, path] of [
    ['GET', '/'],
    ['GET', '/jobs'],
    ['GET', '/jobs/12'],
    ['POST', '/jobs/12/status'],
    ['POST', '/resumes'],
    ['GET', '/resumes/4/download'],
    ['GET', '/companies'],
    ['POST', '/companies/mutes'],
    ['POST', '/companies/mutes/delete'],
    ['GET', '/runs'],
    ['GET', '/runs/fetch-now/abc'],
    ['GET', '/settings'],
    ['POST', '/settings/schedule'],
    ['POST', '/settings/targets/3/delete'],
    ['POST', '/settings/profiles/2/save'],
  ] as const) {
    assert.equal(routeAccess(method, path), 'personal', `${method} ${path}`);
  }
});

test('the most specific pattern wins', () => {
  assert.equal(routeAccess('GET', '/jobs/import'), 'admin');
  assert.equal(routeAccess('GET', '/jobs/import/abc'), 'admin');
  assert.equal(routeAccess('GET', '/jobs/import2'), 'personal');
  assert.equal(routeAccess('POST', '/companies/mutes'), 'personal');
  assert.equal(routeAccess('POST', '/companies/12/delete'), 'admin');
});

test('health, sign-in and static files answer without a person', () => {
  assert.equal(routeAccess('GET', '/health'), 'open');
  assert.equal(routeAccess('GET', '/auth/callback'), 'open');
  assert.equal(routeAccess('POST', '/auth/logout'), 'open');
  assert.equal(routeAccess('GET', '/static/tailwind.css'), 'open');
});

test('a route nobody classified is admin-only', () => {
  assert.equal(routeAccess('POST', '/something/new'), 'admin');
  assert.equal(routeAccess('DELETE', '/jobs/3'), 'admin');
});

test('HEAD reads as GET', () => {
  assert.equal(routeAccess('HEAD', '/jobs'), 'personal');
});

test('a member may make personal requests only, an administrator any', () => {
  const member = { role: 'MEMBER' } as const;
  const admin = { role: 'ADMIN' } as const;
  assert.equal(isAdmin(member), false);
  assert.equal(mayRequest(member, 'POST', '/settings/ai/key'), false);
  assert.equal(mayRequest(member, 'POST', '/settings/locale'), true);
  assert.equal(mayRequest(admin, 'POST', '/settings/ai/key'), true);
});

test('the two lists never name one route', () => {
  for (const spec of [...PERSONAL_ROUTES, ...ADMIN_ROUTES]) {
    const [method, path] = spec.split(' ') as [string, string];
    assert.equal(classesOf(method, path).length, 1, spec);
  }
});

test('classesOf finds a registered pattern whatever its parameter is called', () => {
  assert.deepEqual(classesOf('POST', '/jobs/:jobId/status'), ['personal']);
  assert.deepEqual(classesOf('POST', '/screen/:id/applicants/:aid/adjust'), ['admin']);
  assert.deepEqual(classesOf('POST', '/brand/new'), []);
});
