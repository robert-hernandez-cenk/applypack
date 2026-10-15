/*
 * How short and how long a posting's text may be. Pure, so the edit rules
 * (job-edit.ts) can read them without pulling in the database that
 * manual-job.ts, which re-exports them, imports.
 */

export const MIN_DESCRIPTION_CHARS = 200;
/** The most a pasted or replaced posting may run to — the model reads 30 k of it (posting-url.ts caps a fetched page there too). */
export const MAX_POSTING_CHARS = 60_000;
