import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSession, readSession } from './session';

const NOW = 1_800_000_000;

test('a session takes the provider id and the best display name', () => {
  assert.deepEqual(newSession({ sub: 'u1', name: 'Ada', email: 'a@x.test' }, NOW, 3600), {
    sub: 'u1',
    name: 'Ada',
    exp: NOW + 3600,
  });
  assert.equal(newSession({ sub: 'u1', preferred_username: 'ada', email: 'a@x.test' }, NOW, 60)?.name, 'ada');
  assert.equal(newSession({ sub: 'u1', email: 'a@x.test' }, NOW, 60)?.name, 'a@x.test');
  assert.equal(newSession({ sub: 'u1' }, NOW, 60)?.name, null);
});

test('no usable id, no session', () => {
  for (const sub of [undefined, null, '', '   ', 42, {}]) {
    assert.equal(newSession({ sub }, NOW, 60), null, String(sub));
  }
});

test('a session is read back until its expiry second', () => {
  const stored = JSON.stringify({ sub: 'u1', name: null, exp: NOW + 10 });
  assert.deepEqual(readSession(stored, NOW), { sub: 'u1', name: null, exp: NOW + 10 });
  assert.deepEqual(readSession(stored, NOW + 9)?.sub, 'u1');
  assert.equal(readSession(stored, NOW + 10), null);
  assert.equal(readSession(stored, NOW + 11), null);
});

test('anything that is not a session reads as none', () => {
  for (const bad of ['', 'not json', 'null', '[]', '{}', '{"sub":"u1"}', '{"sub":"","exp":9999999999}', '{"sub":"u1","exp":"9999999999"}', '{"sub":1,"exp":9999999999}']) {
    assert.equal(readSession(bad, NOW), null, bad);
  }
});
