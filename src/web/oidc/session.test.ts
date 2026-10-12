import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityOf, newSession, readSession } from './session';

const NOW = 1_800_000_000;

test('an identity takes the provider id and the best display name', () => {
  assert.deepEqual(identityOf({ sub: 'u1', name: 'Ada', email: 'a@x.test' }), { sub: 'u1', name: 'Ada' });
  assert.equal(identityOf({ sub: 'u1', preferred_username: 'ada', email: 'a@x.test' })?.name, 'ada');
  assert.equal(identityOf({ sub: 'u1', email: 'a@x.test' })?.name, 'a@x.test');
  assert.equal(identityOf({ sub: 'u1' })?.name, null);
});

test('no usable id, no identity', () => {
  for (const sub of [undefined, null, '', '   ', 42, {}]) {
    assert.equal(identityOf({ sub }), null, String(sub));
  }
});

test('a session carries the user it resolved to and ends at its expiry', () => {
  assert.deepEqual(newSession({ sub: 'u1', name: 'Ada' }, 3, NOW, 3600), { sub: 'u1', name: 'Ada', uid: 3, exp: NOW + 3600 });
});

test('a session is read back until its expiry second', () => {
  const stored = JSON.stringify({ sub: 'u1', name: null, uid: 2, exp: NOW + 10 });
  assert.deepEqual(readSession(stored, NOW), { sub: 'u1', name: null, uid: 2, exp: NOW + 10 });
  assert.deepEqual(readSession(stored, NOW + 9)?.sub, 'u1');
  assert.equal(readSession(stored, NOW + 10), null);
  assert.equal(readSession(stored, NOW + 11), null);
});

test('anything that is not a session reads as none', () => {
  for (const bad of ['', 'not json', 'null', '[]', '{}', '{"sub":"u1"}', '{"sub":"","exp":9999999999}', '{"sub":"u1","exp":"9999999999"}', '{"sub":1,"exp":9999999999}', '{"sub":"u1","exp":9999999999}', '{"sub":"u1","uid":0,"exp":9999999999}', '{"sub":"u1","uid":1.5,"exp":9999999999}']) {
    assert.equal(readSession(bad, NOW), null, bad);
  }
});
