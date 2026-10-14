import { sourceFamily } from './source-groups';
import { DEFAULT_RANGE, countByDay, dailySeries, type RangeKey } from './stats-series';
import { techKey } from './tech-label';

/*
 * The Overview's numbers, shaped for the page (pure): the four status cards
 * with their fortnight, and what the matches ask for by technology. Rows in,
 * view data out — overview-stats.ts does the reading.
 */

/** The four statuses worth acting on, in the order the cards stand. */
export const KPI_STATUSES = ['NEW', 'ALERTED', 'APPLIED', 'SAVED'] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

/** A card's sparkline: the last fourteen UTC days, today last. */
export const SPARK_DAYS = 14;

const DAY_MS = 86_400_000;

export interface KpiRow {
  /** A job's status as the database writes it; the four the cards show are the ones counted. */
  status: string;
  fetchedAt: Date;
  alertedAt: Date | null;
  appliedAt: Date | null;
}

/**
 * When a row took the status it has: the alert for an alerted job, the
 * application for an applied one, the day it was found for the rest (a save
 * leaves no date of its own). "+1 in the last 24h" on Applied is then an
 * application sent today, not a job that happened to be found today.
 */
export function statusMoment(row: KpiRow): Date {
  if (row.status === 'ALERTED') return row.alertedAt ?? row.fetchedAt;
  if (row.status === 'APPLIED') return row.appliedAt ?? row.fetchedAt;
  return row.fetchedAt;
}

export interface KpiTrend {
  /** Rows that took the status in the last 24 hours. */
  last24h: number;
  /** Per UTC day over the last fortnight, oldest first. */
  spark: number[];
}

/** Each status card's recent movement, out of the rows that moved in the last fortnight. */
export function kpiTrends(rows: readonly KpiRow[], now: Date): Record<KpiStatus, KpiTrend> {
  const since = now.getTime() - DAY_MS;
  const out = {} as Record<KpiStatus, KpiTrend>;
  for (const status of KPI_STATUSES) {
    const moments = rows.filter((r) => r.status === status).map(statusMoment);
    out[status] = {
      last24h: moments.filter((at) => at.getTime() >= since).length,
      spark: dailySeries(countByDay(moments), SPARK_DAYS, now),
    };
  }
  return out;
}

export interface TermCount {
  /** The classifier's lowercase tag. */
  term: string;
  /** Matches that name it. */
  count: number;
  /** 0–100 against the most named term: the bar's width. */
  share: number;
}

/**
 * The technologies the rows name, most named first. A row counts once per
 * term however often it repeats it; a tie keeps the alphabet's order, so the
 * list does not reshuffle between two page loads.
 */
export function topTerms(rows: readonly { techMatch: readonly string[] }[], max: number): TermCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const term of new Set(row.techMatch.filter((t) => t.trim().length > 0).map(techKey))) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
  const top = sorted[0]?.[1] ?? 0;
  return sorted.map(([term, count]) => ({ term, count, share: top > 0 ? Math.round((count / top) * 100) : 0 }));
}

/** The one bar every per-company vendor board is counted under; the page words it. */
export const COMPANY_BOARDS = 'COMPANY_BOARDS';

export interface SourceCount {
  /** `COMPANY_BOARDS`, or the `AtsType` of the one source. */
  source: string;
  /** Matches that came through it. */
  count: number;
  /** 0–100 against the most productive source: the bar's width. */
  share: number;
}

/**
 * Where the matches came from, most first. The boards a person watches are
 * one bar however many there are; every other kind stands alone. A tie keeps
 * the alphabet's order, so the list does not reshuffle between two page loads.
 */
export function topSources(rows: readonly { atsType: string }[], max: number): SourceCount[] {
  const counts = new Map<string, number>();
  for (const { atsType } of rows) {
    const source = sourceFamily(atsType) === 'vendor' ? COMPANY_BOARDS : atsType;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
  const top = sorted[0]?.[1] ?? 0;
  return sorted.map(([source, count]) => ({ source, count, share: top > 0 ? Math.round((count / top) * 100) : 0 }));
}

/** The Overview's own link: the chart's range and technology ride in the URL, the defaults stay out of it. */
export function overviewHref(view: { range: RangeKey; stack: string | null }): string {
  const params = new URLSearchParams();
  if (view.range !== DEFAULT_RANGE) params.set('range', view.range);
  if (view.stack) params.set('stack', view.stack);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/** A `?stack=` value as a tag the rows could carry, or null: lowercase, short, no markup. */
export function readStackParam(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const term = value.trim().toLowerCase();
  return /^[a-z0-9.#+][a-z0-9 .#+/-]{0,39}$/.test(term) ? term : null;
}
