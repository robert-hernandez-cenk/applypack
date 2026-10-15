import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PULL_TTL_MS, stashPull, takePull, type PullTarget } from './pull-stash';

const entry = (userId = 1, target: PullTarget = { kind: 'new' }) => ({ userId, ids: ['a1', 'b2'], target });

test('a stashed pull is taken once, by its owner', () => {
  const id = stashPull(entry(1));
  assert.equal(takePull(id, 2), null, 'another person cannot take it');
  const got = takePull(id, 1);
  assert.deepEqual(got?.target, { kind: 'new' });
  assert.deepEqual(got?.ids, ['a1', 'b2']);
  assert.equal(takePull(id, 1), null, 'and it is gone after');
});

test('a pull remembers the resume a new version is for', () => {
  const id = stashPull(entry(1, { kind: 'version', resumeId: 7 }));
  assert.deepEqual(takePull(id, 1)?.target, { kind: 'version', resumeId: 7 });
});

test('a pull holds no address and no key', () => {
  const id = stashPull(entry(1));
  assert.deepEqual(Object.keys(takePull(id, 1) ?? {}).sort(), ['ids', 'target', 'userId']);
});

test('another person asking does not use it up', () => {
  const id = stashPull(entry(1));
  takePull(id, 2);
  assert.ok(takePull(id, 1));
});

test('an unknown id is nothing', () => {
  assert.equal(takePull('nope', 1), null);
});

test('a pull expires', () => {
  const t0 = 1_000_000;
  const id = stashPull(entry(1), t0);
  assert.equal(takePull(id, 1, t0 + PULL_TTL_MS + 1), null);
});

test('a person with too many open lists loses their own oldest, not anyone else\'s', () => {
  const t0 = 2_000_000;
  const other = stashPull(entry(2), t0);
  const mine = Array.from({ length: 5 }, (_, i) => stashPull(entry(1), t0 + 1 + i));
  assert.equal(takePull(mine[0]!, 1, t0 + 10), null, 'the oldest of the five went');
  assert.ok(takePull(mine[4]!, 1, t0 + 10));
  assert.ok(takePull(other, 2, t0 + 10), 'the other person kept theirs');
});
