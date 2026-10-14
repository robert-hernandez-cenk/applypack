import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runningView } from './running-view';
import { STALE_AFTER_MS } from '../jobs/run-progress';

const START = Date.parse('2026-10-14T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function row(progress: unknown) {
  return { id: 7, name: 'fetch', startedAt: new Date(START), progress };
}

function stored(over: Record<string, unknown> = {}) {
  return {
    stage: 'classify',
    label: 'runs.running.stage.classify',
    unit: 'runs.running.unit.postings',
    done: 508,
    total: 663,
    startedStageAt: iso(START),
    updatedAt: iso(START + 3_000_000),
    counters: { kept: 41, setAside: 380 },
    samples: [[400, START + 2_900_000]],
    ...over,
  };
}

describe('runningView', () => {
  it('carries the name, the id and the elapsed time', () => {
    const v = runningView(row(null), START + 90_000);
    assert.equal(v.id, 7);
    assert.equal(v.name, 'fetch');
    assert.equal(v.elapsedMs, 90_000);
  });

  it('has no progress for a run that never reported', () => {
    assert.equal(runningView(row(null), START + 1).progress, null);
  });

  it('has no progress for a value that is not ours', () => {
    assert.equal(runningView(row({ stage: 5 }), START + 1).progress, null);
  });

  it('reads the stage, the count, the share and the counters', () => {
    const p = runningView(row(stored()), START + 3_010_000).progress;
    assert.ok(p);
    assert.equal(p.label, 'runs.running.stage.classify');
    assert.equal(p.unit, 'runs.running.unit.postings');
    assert.equal(p.done, 508);
    assert.equal(p.total, 663);
    assert.ok(Math.abs((p.fraction ?? 0) - 508 / 663) < 1e-9);
    assert.deepEqual(p.counters, [
      ['kept', 41],
      ['setAside', 380],
    ]);
  });

  it('estimates from the window rate: 108 items in 100 s, 155 left', () => {
    const p = runningView(row(stored()), START + 3_010_000).progress;
    assert.equal(p?.etaSeconds, 144);
    assert.equal(p?.noEstimate, false);
  });

  it('hides the estimate below 20 items without claiming there is none', () => {
    const p = runningView(row(stored({ done: 5, samples: [[0, START]] })), START + 3_010_000).progress;
    assert.equal(p?.etaSeconds, null);
    assert.equal(p?.noEstimate, false);
  });

  it('says there is no estimate when there is no total', () => {
    const p = runningView(row(stored({ total: undefined })), START + 3_010_000).progress;
    assert.equal(p?.etaSeconds, null);
    assert.equal(p?.noEstimate, true);
    assert.equal(p?.fraction, null);
  });

  it('caps the share at 1 when the count passed the total', () => {
    assert.equal(runningView(row(stored({ done: 700 })), START + 3_010_000).progress?.fraction, 1);
  });

  it('reads the age of the last update and never a negative one', () => {
    assert.equal(runningView(row(stored()), START + 3_012_000).progress?.updatedAgoMs, 12_000);
    assert.equal(runningView(row(stored()), START + 2_000_000).progress?.updatedAgoMs, 0);
  });

  it('is stale only after the threshold', () => {
    const at = START + 3_000_000;
    assert.equal(runningView(row(stored()), at + STALE_AFTER_MS).progress?.stale, false);
    assert.equal(runningView(row(stored()), at + STALE_AFTER_MS + 1).progress?.stale, true);
  });

  it('never shows a negative elapsed time', () => {
    assert.equal(runningView(row(null), START - 5_000).elapsedMs, 0);
  });
});
