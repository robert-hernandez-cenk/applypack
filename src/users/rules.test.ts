import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeUserChange, type UserRoleRow } from './rules';

const two: UserRoleRow[] = [
  { id: 1, role: 'ADMIN' },
  { id: 2, role: 'ADMIN' },
  { id: 3, role: 'MEMBER' },
];
const only: UserRoleRow[] = [
  { id: 1, role: 'ADMIN' },
  { id: 3, role: 'MEMBER' },
];

test('an administrator promotes a member and demotes another administrator', () => {
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 3, change: 'promote' }), { ok: true });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 2, change: 'demote' }), { ok: true });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 3, change: 'remove' }), { ok: true });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 2, change: 'remove' }), { ok: true });
});

test('nobody demotes or removes themselves, even with another administrator', () => {
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 1, change: 'demote' }), { ok: false, reason: 'self' });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 1, change: 'remove' }), { ok: false, reason: 'self' });
});

test('the last administrator is never demoted or removed', () => {
  assert.deepEqual(judgeUserChange({ users: only, actorId: 3, targetId: 1, change: 'demote' }), { ok: false, reason: 'last-admin' });
  assert.deepEqual(judgeUserChange({ users: only, actorId: 3, targetId: 1, change: 'remove' }), { ok: false, reason: 'last-admin' });
  assert.deepEqual(judgeUserChange({ users: only, actorId: 1, targetId: 1, change: 'remove' }), { ok: false, reason: 'self' });
});

test('a change that changes nothing, or names nobody, is refused', () => {
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 2, change: 'promote' }), { ok: false, reason: 'no-change' });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 3, change: 'demote' }), { ok: false, reason: 'no-change' });
  assert.deepEqual(judgeUserChange({ users: two, actorId: 1, targetId: 99, change: 'remove' }), { ok: false, reason: 'not-found' });
});
