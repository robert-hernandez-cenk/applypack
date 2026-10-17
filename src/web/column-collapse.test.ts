import { test } from 'node:test';
import assert from 'node:assert/strict';

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// @ts-expect-error — plain JS with no declaration file; the shape is asserted below.
const mod = import('./public/column-collapse.mjs') as Promise<{
  COLLAPSE_KEY: string;
  readCollapsed: (storage: Storage | null) => boolean;
  writeCollapsed: (storage: Storage | null, collapsed: boolean) => void;
  toggled: (collapsed: boolean) => boolean;
  initCollapse: (doc: unknown, storage?: Storage | null) => number;
}>;

const memory = (): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const broken: Storage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
};

test('nothing stored, no storage and garbage all read as expanded', async () => {
  const { readCollapsed, COLLAPSE_KEY } = await mod;
  assert.equal(readCollapsed(memory()), false);
  assert.equal(readCollapsed(null), false);
  const s = memory();
  s.setItem(COLLAPSE_KEY, 'maybe');
  assert.equal(readCollapsed(s), false);
});

test('a collapsed column reads back as collapsed', async () => {
  const { readCollapsed, writeCollapsed } = await mod;
  const s = memory();
  writeCollapsed(s, true);
  assert.equal(readCollapsed(s), true);
  writeCollapsed(s, false);
  assert.equal(readCollapsed(s), false);
  assert.equal(s.data.size, 0, 'expanded is the default, so nothing is kept');
});

test('blocked storage never throws: the column just starts expanded', async () => {
  const { readCollapsed, writeCollapsed } = await mod;
  assert.equal(readCollapsed(broken), false);
  assert.doesNotThrow(() => writeCollapsed(broken, true));
  assert.doesNotThrow(() => writeCollapsed(null, true));
});

test('toggled flips the state', async () => {
  const { toggled } = await mod;
  assert.equal(toggled(false), true);
  assert.equal(toggled(true), false);
});

test('a page without the column is left alone', async () => {
  const { initCollapse } = await mod;
  const doc = { querySelector: () => null };
  assert.equal(initCollapse(doc, memory()), 0);
});
