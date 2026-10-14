import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETA_MIN_DONE,
  SAMPLE_GAP_MS,
  SAMPLE_WINDOW,
  STALE_AFTER_MS,
  WRITE_INTERVAL_MS,
  createReporter,
  etaSeconds,
  fraction,
  isStale,
  parseProgress,
  pushSample,
  shouldWrite,
  type ProgressReport,
  type RunProgress,
} from './run-progress';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function progress(over: Partial<RunProgress> = {}): RunProgress {
  return {
    stage: 'classify',
    label: 'runs.running.stage.classify',
    unit: 'runs.running.unit.postings',
    done: 100,
    total: 663,
    startedStageAt: iso(T0),
    updatedAt: iso(T0 + 600_000),
    samples: [[0, T0]],
    ...over,
  };
}

const settle = () => new Promise((r) => setImmediate(r));

const report = (over: Partial<ProgressReport> = {}): ProgressReport => ({
  stage: 'classify',
  label: 'runs.running.stage.classify',
  unit: 'runs.running.unit.postings',
  done: 1,
  total: 10,
  ...over,
});

describe('parseProgress', () => {
  it('accepts the stored shape', () => {
    assert.deepEqual(parseProgress(progress()), progress());
  });
  it('accepts a report with no total and no counters', () => {
    const p = progress({ total: undefined });
    assert.equal(parseProgress(p)?.total, undefined);
  });
  it('drops null, junk and a wrong shape', () => {
    assert.equal(parseProgress(null), null);
    assert.equal(parseProgress('x'), null);
    assert.equal(parseProgress({ stage: 'x' }), null);
  });
  it('drops negative or fractional counts', () => {
    assert.equal(parseProgress(progress({ done: -1 })), null);
    assert.equal(parseProgress(progress({ done: 1.5 })), null);
  });
  it('drops more samples than the window', () => {
    const samples = Array.from({ length: SAMPLE_WINDOW + 1 }, (_, i): [number, number] => [i, T0 + i]);
    assert.equal(parseProgress(progress({ samples })), null);
  });
});

describe('shouldWrite', () => {
  it('writes the first report', () => {
    assert.equal(shouldWrite(null, 'classify', T0), true);
  });
  it('holds a same-stage report inside the interval', () => {
    assert.equal(shouldWrite({ at: T0, stage: 'classify' }, 'classify', T0 + WRITE_INTERVAL_MS - 1), false);
  });
  it('writes once the interval has passed', () => {
    assert.equal(shouldWrite({ at: T0, stage: 'classify' }, 'classify', T0 + WRITE_INTERVAL_MS), true);
  });
  it('always writes a stage change', () => {
    assert.equal(shouldWrite({ at: T0, stage: 'sources' }, 'classify', T0 + 1), true);
  });
});

describe('pushSample', () => {
  it('adds the first sample', () => {
    assert.deepEqual(pushSample([], 0, T0), [[0, T0]]);
  });
  it('skips a sample closer than the gap', () => {
    const s: Array<[number, number]> = [[0, T0]];
    assert.deepEqual(pushSample(s, 3, T0 + SAMPLE_GAP_MS - 1), s);
  });
  it('adds one after the gap and keeps only the window', () => {
    let s: Array<[number, number]> = [];
    for (let i = 0; i < SAMPLE_WINDOW + 5; i++) s = pushSample(s, i, T0 + i * SAMPLE_GAP_MS);
    assert.equal(s.length, SAMPLE_WINDOW);
    assert.equal(s[s.length - 1]![0], SAMPLE_WINDOW + 4);
    assert.equal(s[0]![0], 5);
  });
});

describe('fraction', () => {
  it('is done over total', () => {
    assert.equal(fraction(progress({ done: 50, total: 200 })), 0.25);
  });
  it('is capped at 1 when the total moved', () => {
    assert.equal(fraction(progress({ done: 12, total: 10 })), 1);
  });
  it('is null without a positive total or a count', () => {
    assert.equal(fraction(progress({ total: undefined })), null);
    assert.equal(fraction(progress({ total: 0 })), null);
    assert.equal(fraction(progress({ done: undefined })), null);
  });
});

describe('etaSeconds', () => {
  it('uses the window rate, not the average since the start', () => {
    // 100 done over the last 100 s at the window start (400 done) -> 1 item/s; 163 left.
    const p = progress({
      done: 500,
      total: 663,
      startedStageAt: iso(T0),
      updatedAt: iso(T0 + 10_000_000),
      samples: [[400, T0 + 10_000_000 - 100_000]],
    });
    assert.equal(etaSeconds(p), 163);
  });
  it('is hidden below the item floor', () => {
    const p = progress({ done: ETA_MIN_DONE - 1, samples: [[0, T0]] });
    assert.equal(etaSeconds(p), null);
  });
  it('shows at the floor', () => {
    const p = progress({ done: ETA_MIN_DONE, total: 120, updatedAt: iso(T0 + 20_000), samples: [[0, T0]] });
    assert.equal(etaSeconds(p), 100);
  });
  it('is null with no total, no samples, no time passed, or no progress in the window', () => {
    assert.equal(etaSeconds(progress({ total: undefined })), null);
    assert.equal(etaSeconds(progress({ samples: undefined })), null);
    assert.equal(etaSeconds(progress({ samples: [] })), null);
    assert.equal(etaSeconds(progress({ updatedAt: iso(T0), samples: [[0, T0]] })), null);
    assert.equal(etaSeconds(progress({ done: 100, samples: [[100, T0]] })), null);
  });
  it('is zero when the work is done', () => {
    assert.equal(etaSeconds(progress({ done: 663, total: 663, samples: [[600, T0]] })), 0);
  });
});

describe('isStale', () => {
  it('is false up to the threshold and true after it', () => {
    assert.equal(isStale(iso(T0), T0 + STALE_AFTER_MS), false);
    assert.equal(isStale(iso(T0), T0 + STALE_AFTER_MS + 1), true);
  });
  it('is false for a clock that is behind', () => {
    assert.equal(isStale(iso(T0 + 5_000), T0), false);
  });
});

describe('createReporter', () => {
  function harness(opts: { fail?: boolean } = {}) {
    let now = T0;
    const writes: RunProgress[] = [];
    const releases: Array<() => void> = [];
    let hold = false;
    let pending: (() => void) | null = null;
    let cleared = 0;
    const reporter = createReporter({
      now: () => now,
      timer: {
        set: (fn) => {
          pending = fn;
          return 1;
        },
        clear: () => {
          cleared++;
          pending = null;
        },
      },
      write: (p) => {
        if (opts.fail) return Promise.reject(new Error('db down'));
        writes.push(p);
        if (!hold) return Promise.resolve();
        return new Promise<void>((resolve) => releases.push(resolve));
      },
    });
    return {
      reporter,
      writes,
      releases,
      tick: (ms: number) => void (now += ms),
      beat: () => pending?.(),
      cleared: () => cleared,
      hold: () => void (hold = true),
    };
  }

  it('writes the first report with stamps and a first sample', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await h.reporter.flush();
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0]!.startedStageAt, iso(T0));
    assert.equal(h.writes[0]!.updatedAt, iso(T0));
    assert.deepEqual(h.writes[0]!.samples, [[0, T0]]);
  });

  it('writes at most once per interval inside a stage', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await settle();
    for (let i = 1; i <= 20; i++) {
      h.tick(100);
      h.reporter.report(report({ done: i }));
    }
    await settle();
    assert.equal(h.writes.length, 1);
    h.tick(WRITE_INTERVAL_MS);
    h.reporter.report(report({ done: 21 }));
    await h.reporter.flush();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1]!.done, 21);
  });

  it('writes a stage change at once and restarts the stage clock', async () => {
    const h = harness();
    h.reporter.report(report({ stage: 'sources', done: 3, total: 9 }));
    await settle();
    h.tick(1_000);
    h.reporter.report(report({ stage: 'classify', done: 0, total: 50 }));
    await h.reporter.flush();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1]!.stage, 'classify');
    assert.equal(h.writes[1]!.startedStageAt, iso(T0 + 1_000));
    assert.deepEqual(h.writes[1]!.samples, [[0, T0 + 1_000]]);
  });

  it('keeps the stage start while the stage is unchanged', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await settle();
    h.tick(WRITE_INTERVAL_MS);
    h.reporter.report(report({ done: 4 }));
    await h.reporter.flush();
    assert.equal(h.writes[1]!.startedStageAt, iso(T0));
  });

  it('sends a stage change that arrived while a write was in flight, after it lands', async () => {
    const h = harness();
    h.hold();
    h.reporter.report(report({ stage: 'sources', done: 1, total: 4 }));
    h.reporter.report(report({ stage: 'classify', done: 0, total: 9 }));
    assert.equal(h.writes.length, 1);
    h.releases[0]!();
    await new Promise((r) => setImmediate(r));
    assert.equal(h.writes.length, 2);
    h.releases[1]!();
    await h.reporter.flush();
    assert.equal(h.writes[1]!.stage, 'classify');
  });

  it('never throws when the write fails, and flush still settles', async () => {
    const h = harness({ fail: true });
    assert.doesNotThrow(() => h.reporter.report(report()));
    await assert.doesNotReject(h.reporter.flush());
  });

  it('sends the latest report again after the interval when nothing was written, with a fresh stamp', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await settle();
    h.tick(1_000);
    h.reporter.report(report({ done: 9 }));
    await settle();
    assert.equal(h.writes.length, 1);
    h.tick(WRITE_INTERVAL_MS);
    h.beat();
    await settle();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1]!.done, 9);
    assert.equal(h.writes[1]!.updatedAt, iso(T0 + 1_000 + WRITE_INTERVAL_MS));
  });

  it('does not write on a beat when a write just happened', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await settle();
    h.tick(WRITE_INTERVAL_MS - 1);
    h.beat();
    await settle();
    assert.equal(h.writes.length, 1);
  });

  it('stops beating after flush', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await h.reporter.flush();
    assert.equal(h.cleared(), 1);
    h.tick(WRITE_INTERVAL_MS * 2);
    h.beat();
    await settle();
    assert.equal(h.writes.length, 1);
  });

  it('writes nothing after flush', async () => {
    const h = harness();
    h.reporter.report(report({ done: 0 }));
    await h.reporter.flush();
    h.tick(WRITE_INTERVAL_MS * 2);
    h.reporter.report(report({ done: 9 }));
    await new Promise((r) => setImmediate(r));
    assert.equal(h.writes.length, 1);
  });
});
