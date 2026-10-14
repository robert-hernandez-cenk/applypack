import type { CronRunStatus } from '@prisma/client';

/** The page of one run (#36): its address, the id read back from it, and which history rows link to it. Pure. */

/** Postgres `Int4`: a larger number cannot be a run's id, and Prisma would throw on it. */
const MAX_RUN_ID = 2_147_483_647;

export const liveStatusPath = (id: number): string => `/runs/${id}`;

/** The id a path carries, or null for anything that is not a positive whole number a run could have. */
export function parseRunId(param: string): number | null {
  if (!/^\d+$/.test(param)) return null;
  const id = Number(param);
  return id >= 1 && id <= MAX_RUN_ID ? id : null;
}

/** Only a run in flight has a live status to look at; an ended one is read in the history. */
export const showsLiveStatus = (status: CronRunStatus): boolean => status === 'RUNNING';
