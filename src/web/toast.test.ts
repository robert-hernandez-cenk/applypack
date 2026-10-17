import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

type Plan = { sticky: true } | { sticky: false; ms: number };

// Served as a static ES module; node loads it the same way the browser does.
// @ts-expect-error — plain JS with no declaration file; the shape is asserted below.
const mod = import('./public/toast.mjs') as Promise<{
  toastPlan: (input: { kind: 'ok' | 'warn' | 'err'; textLength: number; hasAction: boolean }) => Plan;
  TOAST_MS: { base: number; perChar: number; min: number; max: number };
}>;

describe('toastPlan', () => {
  it('keeps warnings and errors until they are closed', async () => {
    const { toastPlan } = await mod;
    assert.deepEqual(toastPlan({ kind: 'warn', textLength: 10, hasAction: false }), { sticky: true });
    assert.deepEqual(toastPlan({ kind: 'err', textLength: 10, hasAction: false }), { sticky: true });
  });

  it('keeps a message that offers something to do', async () => {
    const { toastPlan } = await mod;
    assert.deepEqual(toastPlan({ kind: 'ok', textLength: 10, hasAction: true }), { sticky: true });
  });

  it('closes a plain success after a time that grows with its length', async () => {
    const { toastPlan } = await mod;
    assert.deepEqual(toastPlan({ kind: 'ok', textLength: 0, hasAction: false }), { sticky: false, ms: 4000 });
    assert.deepEqual(toastPlan({ kind: 'ok', textLength: 100, hasAction: false }), { sticky: false, ms: 8000 });
  });

  it('never leaves a success under 4 s or over 12 s', async () => {
    const { toastPlan, TOAST_MS } = await mod;
    assert.equal(TOAST_MS.min, 4000);
    assert.equal(TOAST_MS.max, 12000);
    assert.deepEqual(toastPlan({ kind: 'ok', textLength: 1000, hasAction: false }), { sticky: false, ms: 12000 });
    assert.deepEqual(toastPlan({ kind: 'ok', textLength: -5, hasAction: false }), { sticky: false, ms: 4000 });
  });
});
