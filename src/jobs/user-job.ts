import type { JobStatus } from '@prisma/client';
import { withApplyLinkFlags } from '../apply-link';
import type { MergedVerdict } from './verdict-merge';

/*
 * What one person has made of a posting (ADR 0067). Pure: the shape of a
 * `UserJob` row built from that person's merged verdict, the flat shape pages
 * read, and the rule for who gets a row when a posting is scored again.
 */

/** Where the posting can be applied — the flags on a row come with the posting's link. */
export interface PostingLink {
  url: string;
  pasted: boolean;
}

/** The verdict columns of a row: the winner among the person's own searches. */
export function verdictColumns(merged: MergedVerdict, link: PostingLink) {
  const c = merged.winner.classification;
  return {
    fitScore: c.fit_score,
    techMatch: c.tech_match,
    redFlags: withApplyLinkFlags(c.red_flags, link),
    summary: c.summary,
    priorityRulesApplied: merged.winner.priorityRulesApplied,
  };
}

/** One person's row after a score: their verdict columns and the status their searches settled on. */
export interface UserOutcome {
  userId: number;
  merged: MergedVerdict;
  status: JobStatus;
}

/** The row's create/update data for an outcome. */
export function outcomeData(o: UserOutcome, link: PostingLink) {
  return { ...verdictColumns(o.merged, link), status: o.status };
}

/**
 * Does a re-score hand a posting to a person who has no row for it yet? A
 * posting someone pasted, imported or saved belongs to them alone, so it never
 * does; and a score that keeps the status ("keepStatus": the paste's own
 * background score, a description refresh) only updates the rows that exist.
 */
export function givesRowToOthers(handPicked: boolean, keepStatus: boolean): boolean {
  return !handPicked && !keepStatus;
}

/**
 * A held posting read as one flat row: the posting's columns, then the
 * person's own (status, score, stage …). Select a `UserJob` with its `job`
 * nested and pass the row here; the page components keep reading the old flat
 * shape. The row's own `id` is not selected where a flat row is wanted, so
 * `id` stays the posting's.
 */
export function flat<U extends { job: object }>(u: U): U['job'] & Omit<U, 'job'> {
  const { job, ...mine } = u;
  return { ...job, ...mine };
}

/** A person's row without its keys: what lays over the posting's columns to make the flat shape pages read. */
export function personalOf<U extends { id: number; userId: number; jobId: number; createdAt: Date }>(
  u: U,
): Omit<U, 'id' | 'userId' | 'jobId' | 'createdAt'> {
  const { id: _id, userId: _userId, jobId: _jobId, createdAt: _createdAt, ...personal } = u;
  return personal;
}
