import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARS_PER_PAGE,
  CUTS_DEFAULT,
  CUTS_MAX,
  cutBudget,
  estimatePages,
  lengthExtraTokens,
  lengthLines,
  lengthPlan,
  parsePageTarget,
  readPageTarget,
} from './length';

const text = (chars: number) => 'x'.repeat(chars);

test('parsePageTarget: only 1, 2 or 3 pages set a target; everything else keeps the length', () => {
  assert.equal(parsePageTarget('1'), 1);
  assert.equal(parsePageTarget('2'), 2);
  assert.equal(parsePageTarget('3'), 3);
  assert.equal(parsePageTarget(2), 2);
  assert.equal(parsePageTarget('keep'), 'keep');
  assert.equal(parsePageTarget('4'), 'keep');
  assert.equal(parsePageTarget('0'), 'keep');
  assert.equal(parsePageTarget(undefined), 'keep');
  assert.equal(parsePageTarget(['2']), 'keep');
});

test('readPageTarget: a row from before the marker is "keep"', () => {
  assert.equal(readPageTarget(null), 'keep');
  assert.equal(readPageTarget('x'), 'keep');
  assert.equal(readPageTarget({}), 'keep');
  assert.equal(readPageTarget({ pages: 'keep' }), 'keep');
  assert.equal(readPageTarget({ pages: 4 }), 'keep');
  assert.equal(readPageTarget({ pages: '2' }), 'keep', 'the marker is a number, not a form string');
  assert.equal(readPageTarget({ pages: 2 }), 2);
});

test('estimatePages: characters over the one per-page constant', () => {
  assert.equal(estimatePages(text(CHARS_PER_PAGE)), 1);
  assert.equal(estimatePages(text(CHARS_PER_PAGE * 3.5)), 3.5);
  assert.equal(estimatePages(''), 0);
});

test('lengthPlan: "keep" has no budget and is always met', () => {
  const plan = lengthPlan(text(CHARS_PER_PAGE * 4), 'keep');
  assert.equal(plan.budgetChars, null);
  assert.equal(plan.overshootChars, 0);
  assert.equal(plan.met, true);
  assert.equal(plan.pages, 4);
});

test('lengthPlan: a 3-page resume against a 2-page target is one page over', () => {
  const plan = lengthPlan(text(CHARS_PER_PAGE * 3), 2);
  assert.equal(plan.budgetChars, CHARS_PER_PAGE * 2);
  assert.equal(plan.overshootChars, CHARS_PER_PAGE);
  assert.equal(plan.met, false);
});

test('lengthPlan: a resume already inside the target has no overshoot', () => {
  const plan = lengthPlan(text(CHARS_PER_PAGE * 1.5), 3);
  assert.equal(plan.overshootChars, 0);
  assert.equal(plan.met, true);
});

test('cutBudget: the default for a small overshoot, growing with it, capped', () => {
  assert.equal(cutBudget(0), CUTS_DEFAULT);
  assert.equal(cutBudget(100), CUTS_DEFAULT);
  assert.ok(cutBudget(CHARS_PER_PAGE * 2) > CUTS_DEFAULT);
  assert.ok(cutBudget(CHARS_PER_PAGE * 2) >= cutBudget(CHARS_PER_PAGE));
  assert.equal(cutBudget(1_000_000), CUTS_MAX);
});

test('lengthExtraTokens: no more room without a target or when it is met, more with each extra cut', () => {
  assert.equal(lengthExtraTokens(lengthPlan(text(CHARS_PER_PAGE * 4), 'keep')), 0);
  assert.equal(lengthExtraTokens(lengthPlan(text(CHARS_PER_PAGE), 2)), 0);
  const small = lengthExtraTokens(lengthPlan(text(CHARS_PER_PAGE * 2 + 700), 2));
  const mid = lengthExtraTokens(lengthPlan(text(CHARS_PER_PAGE * 6), 1));
  const big = lengthExtraTokens(lengthPlan(text(CHARS_PER_PAGE * 20), 1));
  assert.ok(small >= 0 && mid > small && big > mid);
  assert.equal(big, (CUTS_MAX - CUTS_DEFAULT) * 120, 'the cap of cuts is the cap of the extra room');
});

test('lengthLines: nothing for "keep" and nothing when the target is met', () => {
  assert.deepEqual(lengthLines(lengthPlan(text(CHARS_PER_PAGE * 4), 'keep')), []);
  assert.deepEqual(lengthLines(lengthPlan(text(CHARS_PER_PAGE), 2)), []);
});

test('lengthLines: states target, estimate, overshoot and the cap, and how to choose cuts', () => {
  const plan = lengthPlan(text(CHARS_PER_PAGE * 4), 2);
  const block = lengthLines(plan).join('\n');
  assert.match(block, /LENGTH TARGET/);
  assert.match(block, /2 pages/);
  assert.match(block, /about 4\.0 pages/);
  assert.match(block, new RegExp(`${plan.overshootChars} characters`));
  assert.match(block, new RegExp(`up to ${cutBudget(plan.overshootChars)} removals`));
  assert.match(block, /least relevant to THIS posting/);
  assert.match(block, /older roles/i);
  assert.match(block, /must-have/i);
  assert.match(block, /overrides the default/i);
  // Our own instruction: it sits outside every fence (ADR 0022).
  assert.doesNotMatch(block, /=== (BEGIN|END)/);
});

test('lengthLines: one page reads "1 page"', () => {
  assert.match(lengthLines(lengthPlan(text(CHARS_PER_PAGE * 3), 1)).join('\n'), /1 page\b/);
});
