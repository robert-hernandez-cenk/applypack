import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARS_PER_PAGE, estimatePages, lengthPlan, roundPages, type PageTarget } from '../resume/length';

/*
 * public/length.mjs is the browser copy of resume/length.ts (ADR 0073): the
 * meter under the editor is recomputed on every edit, the server computed the
 * first figure, and the two must never disagree about the same text.
 */

interface BrowserLength {
  CHARS_PER_PAGE: number;
  estimatePages: (text: string) => number;
  lengthPlan: (text: string, target: PageTarget) => ReturnType<typeof lengthPlan>;
  roundPages: (pages: number) => number;
}

// @ts-expect-error — plain JS with no declaration file; parity is asserted below.
const browser = import('./public/length.mjs') as Promise<BrowserLength>;

test('the browser mirror counts a CRLF document as the server does', async () => {
  const b = await browser;
  const crlf = 'line\r\n'.repeat(2000);
  assert.equal(b.estimatePages(crlf), estimatePages(crlf));
  assert.deepEqual(b.lengthPlan(crlf, 2), lengthPlan(crlf, 2));
});

const SIZES = [0, 1, 300, CHARS_PER_PAGE - 1, CHARS_PER_PAGE, CHARS_PER_PAGE + 1, CHARS_PER_PAGE * 2, CHARS_PER_PAGE * 3.5, CHARS_PER_PAGE * 4, 15_001];
const TARGETS: PageTarget[] = ['keep', 1, 2, 3];

test('the browser mirror agrees with the server on the per-page constant', async () => {
  assert.equal((await browser).CHARS_PER_PAGE, CHARS_PER_PAGE);
});

test('the browser mirror estimates and plans exactly as the server does', async () => {
  const b = await browser;
  for (const size of SIZES) {
    const text = 'x'.repeat(size);
    assert.equal(b.estimatePages(text), estimatePages(text), `estimate at ${size}`);
    for (const target of TARGETS) {
      assert.deepEqual(b.lengthPlan(text, target), lengthPlan(text, target), `plan at ${size} for ${target}`);
    }
  }
});

test('the meter shows one decimal, the same on both sides', async () => {
  const b = await browser;
  for (const pages of [0, 2, 3.449, 3.45, 3.46, 4.0001, 0.05]) assert.equal(b.roundPages(pages), roundPages(pages));
  assert.equal(roundPages(3.449), 3.4);
  assert.equal(roundPages(2), 2);
});
