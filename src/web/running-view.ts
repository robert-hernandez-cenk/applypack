import { etaSeconds, fraction, isStale, parseProgress } from '../jobs/run-progress';

/**
 * A RUNNING cron_run laid out for the "Running now" card. Pure: the page
 * hands it the row and the clock, and it decides what is shown — which of
 * the estimate, "no estimate" and nothing, and whether the last report is old
 * enough to call the run stalled (ADR 0072).
 */

/** The order counters are shown in. Postgres keeps a JSON object's keys by length, not as written, so the view orders them; a name not listed follows, alphabetically. */
const COUNTER_ORDER = ['kept', 'setAside', 'classified', 'errors', 'listings'];

function orderedCounters(counters: Record<string, number> | undefined): Array<[string, number]> {
  const rank = (name: string): number => {
    const i = COUNTER_ORDER.indexOf(name);
    return i === -1 ? COUNTER_ORDER.length : i;
  };
  return Object.entries(counters ?? {}).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export interface RunningRow {
  id: number;
  name: string;
  startedAt: Date;
  /** `cron_run.progress` as stored; anything that is not our shape reads as "never reported". */
  progress: unknown;
}

export interface RunningProgressView {
  /** Catalog keys: the card words them in the reader's language. */
  label: string;
  unit: string;
  done: number | null;
  total: number | null;
  /** 0..1, null when there is no total to measure against. */
  fraction: number | null;
  /** [counter name, count], in a fixed order. */
  counters: Array<[string, number]>;
  /** Seconds left, null while it would be a guess. */
  etaSeconds: number | null;
  /** True only when there is no total at all: below the item floor the estimate is merely not shown yet. */
  noEstimate: boolean;
  updatedAgoMs: number;
  stale: boolean;
}

export interface RunningView {
  id: number;
  name: string;
  elapsedMs: number;
  /** null for a job that has not reported (or never will): the card shows its name and elapsed time. */
  progress: RunningProgressView | null;
}

export function runningView(row: RunningRow, nowMs: number): RunningView {
  const base = { id: row.id, name: row.name, elapsedMs: Math.max(0, nowMs - row.startedAt.getTime()) };
  const p = parseProgress(row.progress);
  if (p === null) return { ...base, progress: null };
  return {
    ...base,
    progress: {
      label: p.label,
      unit: p.unit,
      done: p.done ?? null,
      total: p.total ?? null,
      fraction: fraction(p),
      counters: orderedCounters(p.counters),
      etaSeconds: etaSeconds(p),
      noEstimate: p.total === undefined,
      updatedAgoMs: Math.max(0, nowMs - Date.parse(p.updatedAt)),
      stale: isStale(p.updatedAt, nowMs),
    },
  };
}
