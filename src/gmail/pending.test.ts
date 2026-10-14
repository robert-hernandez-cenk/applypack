import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PENDING, PENDING_TTL_MS, PendingStore } from './pending';

function clock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => { at += ms; } };
}

test('a begun connection gives back its verifier once, to the person who began it', () => {
  const c = clock();
  const store = new PendingStore(c.now);
  const state = store.begin(7, 'verifier-1');
  assert.equal(store.take(state, 7), 'verifier-1');
  assert.equal(store.take(state, 7), null);
});

test('two connections get different states', () => {
  const store = new PendingStore(clock().now);
  assert.notEqual(store.begin(1, 'a'), store.begin(1, 'b'));
});

test('another person presenting the state gets nothing, and does not use it up', () => {
  const store = new PendingStore(clock().now);
  const state = store.begin(7, 'verifier-1');
  assert.equal(store.take(state, 8), null);
  assert.equal(store.take(state, 7), 'verifier-1');
});

test('an unknown state gets nothing', () => {
  assert.equal(new PendingStore(clock().now).take('never-issued', 1), null);
});

test('a state is good for ten minutes', () => {
  assert.equal(PENDING_TTL_MS, 600_000);
  const c = clock();
  const store = new PendingStore(c.now);
  const kept = store.begin(1, 'kept');
  const late = store.begin(1, 'late');
  c.advance(PENDING_TTL_MS - 1);
  assert.equal(store.take(kept, 1), 'kept');
  c.advance(2);
  assert.equal(store.take(late, 1), null);
});

test('the store is bounded: past the cap the oldest go first', () => {
  const store = new PendingStore(clock().now);
  const first = store.begin(1, 'first');
  for (let i = 0; i < MAX_PENDING; i++) store.begin(1, `v${i}`);
  assert.equal(store.take(first, 1), null);
  assert.equal(store.size(), MAX_PENDING);
});
