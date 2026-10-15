import type { Job, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { hiringKey, sourceIsEmployer } from '../employer';
import { logger } from '../logger';
import { parseLocation } from '../location';
import { classifyExistingJob, type ClassifiableJob, type Rescored } from './classify-existing';
import { descriptionColumns } from './description-columns';
import { canEdit, type JobEditChanges } from './job-edit';

/*
 * The write behind the edit page (#46); the rules are in job-edit.ts. The
 * holders are read again here, right before the write: the page that was
 * open may be older than the second person who was given the posting.
 */

export type JobEditResult =
  /** Somebody else holds the posting (or nobody does): nothing was written. */
  | { kind: 'refused' }
  | { kind: 'saved'; job: Job; rescored: Rescored };

export async function holderIdsOf(jobId: number): Promise<number[]> {
  const rows = await prisma.userJob.findMany({ where: { jobId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Writes the changed fields, then scores the posting again with every status left where it is. */
export async function editJob(job: ClassifiableJob, userId: number, changes: JobEditChanges): Promise<JobEditResult> {
  if (!canEdit(await holderIdsOf(job.id), userId)) return { kind: 'refused' };

  const data: Prisma.JobUpdateInput = {};
  if (changes.title !== undefined) data.title = changes.title;
  if (changes.employer !== undefined) {
    data.employer = changes.employer;
    data.employerKey = hiringKey(changes.employer, job.company.name, !sourceIsEmployer(job.company.atsType));
  }
  if (changes.location !== undefined) {
    // The person typed this string: the parser reads it as it would a pasted posting's (ADR 0031).
    const place = parseLocation(changes.location);
    Object.assign(data, { location: changes.location, workplace: place.workplace, countries: place.countries, regions: place.regions, locationSource: place.source });
  }
  if (changes.description !== undefined) Object.assign(data, descriptionColumns(job, changes.description));

  const updated = await prisma.job.update({ where: { id: job.id }, data });
  logger.info({ jobId: job.id, fields: Object.keys(changes) }, 'job-edit: saved');

  let rescored: Rescored;
  try {
    rescored = await classifyExistingJob({ ...job, ...updated }, { keepStatus: true, userId });
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'job-edit: re-classify failed');
    rescored = { kind: 'failed', reason: '' };
  }
  return { kind: 'saved', job: updated, rescored };
}
