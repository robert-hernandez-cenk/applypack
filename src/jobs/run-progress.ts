import { z } from 'zod';

/**
 * What a running job tells the Runs page about itself (ADR 0072). The worker
 * writes it into the job's own `cron_run.progress`; the dashboard reads it
 * back. Pure: no I/O, the write is injected into `createReporter`.
 */

/** A report is saved at most this often inside one stage; a new stage is saved at once. */
export const WRITE_INTERVAL_MS = 5_000;
/** The rate behind the estimate looks at this many samples ... */
export const SAMPLE_WINDOW = 12;
/** ... taken at least this far apart, so the window spans minutes, not a burst. */
export const SAMPLE_GAP_MS = 30_000;
/** No estimate before this many items are done: the first few say nothing about the rate. */
export const ETA_MIN_DONE = 20;
/** A last report older than this is a worker that stopped, not one that is slow. */
export const STALE_AFTER_MS = 120_000;

const Count = z.number().int().nonnegative();

const RunProgressSchema = z.object({
  stage: z.string(),
  /** A catalog key: the worker's language is not the reader's. */
  label: z.string(),
  /** A catalog key too. */
  unit: z.string(),
  done: Count.optional(),
  /** Absent = unknown. */
  total: Count.optional(),
  startedStageAt: z.string(),
  updatedAt: z.string(),
  counters: z.record(z.string(), Count).optional(),
  /** [done, epoch ms] pairs for the rate. */
  samples: z.array(z.tuple([Count, z.number()])).max(SAMPLE_WINDOW).optional(),
});

export type RunProgress = z.infer<typeof RunProgressSchema>;

/** What a job passes to `report`: the reporter adds the stamps and the samples. */
export type ProgressReport = Pick<RunProgress, 'stage' | 'label' | 'unit' | 'done' | 'total' | 'counters'>;

export type ReportProgress = (p: ProgressReport) => void;

/** A stored value, or null when the row never reported or the value is not ours. */
export function parseProgress(json: unknown): RunProgress | null {
  const parsed = RunProgressSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function shouldWrite(last: { at: number; stage: string } | null, stage: string, now: number): boolean {
  return last === null || last.stage !== stage || now - last.at >= WRITE_INTERVAL_MS;
}

export function pushSample(samples: Array<[number, number]>, done: number, at: number): Array<[number, number]> {
  const last = samples[samples.length - 1];
  if (last && at - last[1] < SAMPLE_GAP_MS) return samples;
  return [...samples, [done, at] as [number, number]].slice(-SAMPLE_WINDOW);
}

/** The share done, 0..1; null when there is no total to measure against. */
export function fraction(p: Pick<RunProgress, 'done' | 'total'>): number | null {
  if (p.done === undefined || p.total === undefined || p.total <= 0) return null;
  return Math.min(p.done, p.total) / p.total;
}

/** Seconds left at the rate of the sampled window; null whenever that would be a guess. */
export function etaSeconds(p: RunProgress): number | null {
  const first = p.samples?.[0];
  if (p.total === undefined || p.done === undefined || first === undefined) return null;
  if (p.done < ETA_MIN_DONE) return null;
  const seconds = (Date.parse(p.updatedAt) - first[1]) / 1000;
  const rate = (p.done - first[0]) / seconds;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.max(0, Math.round((p.total - p.done) / rate));
}

export function isStale(updatedAtIso: string, nowMs: number): boolean {
  return nowMs - Date.parse(updatedAtIso) > STALE_AFTER_MS;
}

export interface ReporterDeps {
  write: (p: RunProgress) => Promise<void>;
  now: () => number;
  /** Told once per failed write; the job goes on regardless. */
  onError?: (err: unknown) => void;
}

/**
 * Throttles a job's reports into writes. `report` is synchronous and never
 * throws; one write is in flight at a time, and a stage change that arrives
 * meanwhile is sent when it lands. `flush` waits for what is in flight and
 * closes the reporter, so a write cannot land after the run's final update.
 */
export function createReporter(deps: ReporterDeps): { report: ReportProgress; flush: () => Promise<void> } {
  let stage: string | null = null;
  let stageStartedAt = 0;
  let samples: Array<[number, number]> = [];
  let lastWrite: { at: number; stage: string } | null = null;
  let inFlight: Promise<void> | null = null;
  let waiting: RunProgress | null = null;
  let closed = false;

  const send = (p: RunProgress): void => {
    lastWrite = { at: deps.now(), stage: p.stage };
    inFlight = deps
      .write(p)
      .catch((err) => deps.onError?.(err))
      .then(() => {
        inFlight = null;
        const next = waiting;
        waiting = null;
        if (next && !closed) send(next);
      });
  };

  const report: ReportProgress = (r) => {
    if (closed) return;
    const now = deps.now();
    if (r.stage !== stage) {
      stage = r.stage;
      stageStartedAt = now;
      samples = [];
    }
    if (r.done !== undefined) samples = pushSample(samples, r.done, now);
    const next: RunProgress = {
      ...r,
      startedStageAt: new Date(stageStartedAt).toISOString(),
      updatedAt: new Date(now).toISOString(),
      samples,
    };
    if (inFlight) {
      // Only a stage change is worth holding for: a count is out of date by the time it would land.
      if (lastWrite?.stage !== r.stage) waiting = next;
      return;
    }
    if (shouldWrite(lastWrite, r.stage, now)) send(next);
  };

  const flush = async (): Promise<void> => {
    closed = true;
    waiting = null;
    while (inFlight) await inFlight;
  };

  return { report, flush };
}
