/**
 * The order of the /jobs list (#25) — pure, no I/O.
 *
 * A sort is `<key>_<asc|desc>` in the page address. Six keys are columns of
 * the table and carry a header link; `postedAt` has no column and is reached
 * from the "Sort by" menu only. The four values the list took before columns
 * could sort (`fetchedAt_desc`, `fitScore_desc`, `postedAt_desc`, `title_asc`)
 * are still members, with the order they always had.
 */
import type { Prisma } from '@prisma/client';

export const SORT_COLUMNS = ['title', 'company', 'fitScore', 'salary', 'status', 'fetchedAt'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];

const SORT_KEYS = [...SORT_COLUMNS, 'postedAt'] as const;
type SortKey = (typeof SORT_KEYS)[number];

export type SortDir = 'asc' | 'desc';
const SORT_DIRS: readonly SortDir[] = ['asc', 'desc'];

export const SORT_VALUES = SORT_KEYS.flatMap((k) => SORT_DIRS.map((d) => `${k}_${d}` as const));
export type SortValue = (typeof SORT_VALUES)[number];

export const DEFAULT_SORT: SortValue = 'fetchedAt_desc';

/** Where a first click on a column starts: words read A→Z, numbers and dates best / newest first. */
const NATURAL_DIR: Record<SortKey, SortDir> = {
  title: 'asc',
  company: 'asc',
  status: 'asc',
  fitScore: 'desc',
  salary: 'desc',
  fetchedAt: 'desc',
  postedAt: 'desc',
};

export interface ParsedSort {
  key: SortKey;
  dir: SortDir;
}

/** The sort a query value names; anything unknown is the default order. */
export function parseSort(value: string | undefined): ParsedSort {
  const known = SORT_VALUES.find((v) => v === value) ?? DEFAULT_SORT;
  const [key, dir] = known.split('_') as [SortKey, SortDir];
  return { key, dir };
}

/** A query value as one of the listed sorts — what the page and its links carry. */
export function normalizeSort(value: string | undefined): SortValue {
  const { key, dir } = parseSort(value);
  return `${key}_${dir}`;
}

/** The sort a header's link carries: the other way on the sorted column, the natural way on any other. */
export function nextSort(current: string | undefined, column: SortColumn): SortValue {
  const now = parseSort(current);
  const dir = now.key === column ? (now.dir === 'asc' ? 'desc' : 'asc') : NATURAL_DIR[column];
  return `${column}_${dir}`;
}

/** The `aria-sort` of a column's header; undefined on every column the list is not sorted by. */
export function ariaSort(current: string | undefined, column: SortColumn): 'ascending' | 'descending' | undefined {
  const now = parseSort(current);
  if (now.key !== column) return undefined;
  return now.dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * The list is the person's rows: the score and the status are theirs, the
 * rest is the posting's. A row with nothing in the column goes last either
 * way, and the id closes every order so a page break never repeats or skips
 * a row among equals. A company is who hires (the aggregator's employer),
 * then the board the posting came through; a status is the enum's declared
 * order. Fit is the person's best score across their searches.
 */
export function sortOrderBy(value: string | undefined): Prisma.UserJobOrderByWithRelationInput[] {
  const { key, dir } = parseSort(value);
  const nullsLast = { sort: dir, nulls: 'last' } as const;
  const tieBreak: Prisma.UserJobOrderByWithRelationInput = { id: 'asc' };
  switch (key) {
    case 'title':
      return [{ job: { title: dir } }, tieBreak];
    case 'company':
      return [{ job: { employer: nullsLast } }, { job: { company: { name: dir } } }, tieBreak];
    case 'fitScore':
      return [{ fitScore: nullsLast }, { job: { fetchedAt: 'desc' } }, tieBreak];
    case 'salary':
      return [{ job: { salaryMin: nullsLast } }, tieBreak];
    case 'status':
      return [{ status: dir }, tieBreak];
    case 'postedAt':
      return [{ job: { postedAt: dir } }, tieBreak];
    case 'fetchedAt':
      return [{ job: { fetchedAt: dir } }, tieBreak];
  }
}
