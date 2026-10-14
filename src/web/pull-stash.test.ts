import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PULL_TTL_MS, peekPull, stashPull, takePull } from './pull-stash';

const entry = (userId = 1, key = 'rr_secret_key') => ({ userId, base: 'https://rr.example.com/', key });

test('a stashed pull is taken once, by its owner', () => {
  const id = stashPull(entry(1));
  assert.equal(takePull(id, 2), null, 'another person cannot take it');
  const got = takePull(id, 1);
  assert.equal(got?.key, 'rr_secret_key');
  assert.equal(got?.base, 'https://rr.example.com/');
  assert.equal(takePull(id, 1), null, 'and it is gone after');
});

test('another person asking does not use it up', () => {
  const id = stashPull(entry(1));
  takePull(id, 2);
  assert.ok(takePull(id, 1));
});

test('an unknown id is nothing', () => {
  assert.equal(takePull('nope', 1), null);
  assert.equal(peekPull('nope', 1), null);
});

test('a pull expires', () => {
  const t0 = 1_000_000;
  const id = stashPull(entry(1), t0);
  assert.ok(peekPull(id, 1, t0 + PULL_TTL_MS - 1));
  assert.equal(peekPull(id, 1, t0 + PULL_TTL_MS + 1), null);
  assert.equal(takePull(id, 1, t0 + PULL_TTL_MS + 1), null);
});

test('a full stash lets the oldest go', () => {
  const t0 = 2_000_000;
  const first = stashPull(entry(1), t0);
  const rest = Array.from({ length: 8 }, (_, i) => stashPull(entry(1), t0 + 1 + i));
  assert.equal(peekPull(first, 1, t0 + 10), null);
  assert.ok(peekPull(rest[7]!, 1, t0 + 10));
});

test('peeking shows the instance and never the key', () => {
  const id = stashPull(entry(1));
  const seen = peekPull(id, 1);
  assert.ok(seen);
  assert.ok(!JSON.stringify(seen).includes('rr_secret_key'));
  assert.equal(seen.base, 'https://rr.example.com/');
  takePull(id, 1);
});
