import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_RUN_DAYS, LEDGER_KEEP_DAYS, MAX_MAILS_PER_RUN, OVERLAP_DAYS, ledgerCutoff, pickMessages, searchQuery, windowStart } from './query';

const DAY = 86_400_000;
const NOW = new Date('2026-10-14T12:00:00Z');
const ago = (days: number): Date => new Date(NOW.getTime() - days * DAY);

test('the numbers the reader runs on', () => {
  assert.deepEqual([FIRST_RUN_DAYS, OVERLAP_DAYS, MAX_MAILS_PER_RUN, LEDGER_KEEP_DAYS], [14, 2, 20, 60]);
});

test('a first check looks back two weeks', () => {
  assert.deepEqual(windowStart(NOW, null), ago(14));
});

test('a later check starts a little before the last one, so a mail that landed mid-check is not missed', () => {
  assert.deepEqual(windowStart(NOW, ago(1)), ago(3));
});

test('a check after a long silence still looks back only two weeks', () => {
  assert.deepEqual(windowStart(NOW, ago(40)), ago(14));
});

test('the search asks Gmail for mail after that second, in whole seconds', () => {
  assert.equal(searchQuery(new Date('2026-10-14T12:00:00.900Z')), `after:${Date.parse('2026-10-14T12:00:00Z') / 1000}`);
});

test('mails already read are not taken again, and the newest come first', () => {
  const picked = pickMessages(['d', 'c', 'b', 'a'], new Set(['c']), 20);
  assert.deepEqual(picked, { take: ['d', 'b', 'a'], left: 0 });
});

test('a run takes at most its share and says how many wait for the next', () => {
  const ids = Array.from({ length: 25 }, (_, i) => `m${i}`);
  const picked = pickMessages(ids, new Set(), MAX_MAILS_PER_RUN);
  assert.equal(picked.take.length, 20);
  assert.equal(picked.take[0], 'm0');
  assert.equal(picked.left, 5);
});

test('the ledger forgets mails older than two months', () => {
  assert.deepEqual(ledgerCutoff(NOW), ago(60));
});
