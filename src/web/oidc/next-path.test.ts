import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from './next-path';

test('a path on this dashboard is kept, query included', () => {
  assert.equal(safeNext('/jobs'), '/jobs');
  assert.equal(safeNext('/jobs?status=NEW&page=2'), '/jobs?status=NEW&page=2');
});

test('anything that could leave the dashboard becomes /', () => {
  for (const bad of [
    undefined,
    null,
    '',
    'jobs',
    '//evil.test',
    '//evil.test/jobs',
    '/\\evil.test',
    '\\\\evil.test',
    'https://evil.test/x',
    'javascript:alert(1)',
    '/jobs\n/other',
    '/jobs\u0000',
    '/%2f/evil.test',
  ]) {
    assert.equal(safeNext(bad), '/', String(bad));
  }
});

test('the sign-in routes are never a destination', () => {
  assert.equal(safeNext('/auth/login'), '/');
  assert.equal(safeNext('/auth/callback?code=1'), '/');
  assert.equal(safeNext('/auth/logout'), '/');
});
