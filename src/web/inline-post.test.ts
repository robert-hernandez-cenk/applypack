import { test } from 'node:test';
import assert from 'node:assert/strict';

interface Control {
  action: string;
  term: string;
  name: string;
}

// Served as a static ES module; node loads it the same way the browser does.
// @ts-expect-error — plain JS with no declaration file; the shape is asserted below.
const mod = import('./public/inline-post.mjs') as Promise<{
  planSwap: (
    currentIds: string[],
    incomingIds: string[],
    currentPath: string,
    finalPath: string,
  ) => { kind: 'swap'; ids: string[] } | { kind: 'navigate' };
  pickFocus: (candidates: Control[], wanted: Control) => Control | null;
  formBody: (entries: [string, string][]) => string;
  createQueue: () => { push: <T>(job: () => Promise<T>) => Promise<T | undefined> };
  foldStates: (folds: { fold: string; open: boolean }[]) => Record<string, boolean>;
  applyFolds: (folds: { fold: string; open: boolean }[], states: Record<string, boolean>) => void;
  wireInlinePosts: unknown;
}>;

const PAGE = '/jobs/7/target';

test('same page with every current region present: swap those regions', async () => {
  const { planSwap } = await mod;
  assert.deepEqual(planSwap(['flash-slot', 'keyword-table'], ['flash-slot', 'keyword-table', 'extra'], PAGE, PAGE), {
    kind: 'swap',
    ids: ['flash-slot', 'keyword-table'],
  });
});

test('a region the returned page lacks, or another path, means the page is not the one being edited', async () => {
  const { planSwap } = await mod;
  assert.deepEqual(planSwap(['flash-slot', 'keyword-table'], ['flash-slot'], PAGE, PAGE), { kind: 'navigate' });
  assert.deepEqual(planSwap(['flash-slot'], ['flash-slot'], PAGE, '/login'), { kind: 'navigate' });
  assert.deepEqual(planSwap([], [], PAGE, PAGE), { kind: 'navigate' });
});

const ROW = { action: '/jobs/7/matches/3/keywords', term: 'React', name: 'requirement' };
const OTHER_BUTTON = { action: '/jobs/7/matches/3/keywords', term: 'React', name: '' };
const ADD = { action: '/jobs/7/matches/3/keywords', term: '', name: 'term' };
const ELSEWHERE = { action: '/jobs/7/matches/3/keywords', term: 'Go', name: 'requirement' };

test('focus goes to the same control, else a control of the same keyword, else the add field', async () => {
  const { pickFocus } = await mod;
  assert.equal(pickFocus([ELSEWHERE, ROW, ADD], ROW), ROW);
  assert.equal(pickFocus([ELSEWHERE, OTHER_BUTTON, ADD], ROW), OTHER_BUTTON);
  assert.equal(pickFocus([ELSEWHERE, ADD], ROW), ADD);
  assert.equal(pickFocus([ELSEWHERE], ROW), null);
  assert.equal(pickFocus([], ROW), null);
});

test('the add field is found again by itself', async () => {
  const { pickFocus } = await mod;
  assert.equal(pickFocus([ROW, ADD], ADD), ADD);
});

test('the body keeps order and repeated names, and escapes values', async () => {
  const { formBody } = await mod;
  assert.equal(
    formBody([
      ['term', 'C++ & Go'],
      ['op', 'level'],
      ['requirement', 'must'],
      ['term', 'x y'],
    ]),
    'term=C%2B%2B+%26+Go&op=level&requirement=must&term=x+y',
  );
  assert.equal(formBody([]), '');
});

test('the queue runs one job at a time, in order, and keeps going after a failure', async () => {
  const { createQueue } = await mod;
  const queue = createQueue();
  const log: string[] = [];
  const job = (name: string, ms: number, fail = false) => async () => {
    log.push(`start ${name}`);
    await new Promise((r) => setTimeout(r, ms));
    log.push(`end ${name}`);
    if (fail) throw new Error(name);
    return name;
  };
  const a = queue.push(job('a', 15));
  const b = queue.push(job('b', 1, true));
  const c = queue.push(job('c', 1));
  assert.equal(await a, 'a');
  assert.equal(await b, undefined);
  assert.equal(await c, 'c');
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
});

test('open folds are carried over by name', async () => {
  const { foldStates, applyFolds } = await mod;
  const before = [
    { fold: 'matched', open: true },
    { fold: 'ignored', open: false },
  ];
  const states = foldStates(before);
  assert.deepEqual(states, { matched: true, ignored: false });
  const after = [
    { fold: 'matched', open: false },
    { fold: 'ignored', open: true },
    { fold: 'new', open: false },
  ];
  applyFolds(after, states);
  assert.deepEqual(
    after.map((f) => f.open),
    [true, false, false],
  );
});

test('the module imports without a DOM and exposes the wiring', async () => {
  assert.equal(typeof (await mod).wireInlinePosts, 'function');
});
