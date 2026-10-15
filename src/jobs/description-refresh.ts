import type { Job } from '@prisma/client';
import { prisma } from '../db';
import { logger } from '../logger';
import { classifyExistingJob, type ClassifiableJob } from './classify-existing';
import { descriptionColumns } from './description-columns';
import { normaliseDescription } from './description-diff';

/*
 * The swap behind "Replace the description" and "Restore the original"
 * (#162 stage 3, ADR 0043). The posting's text IS evidence — every search's
 * verdict, every keyword and every gate read it — so a change to it is
 * confirmed by the user, keeps what it replaces, and re-judges what it can
 * at once: the classifier here, the keyword frame on the next comparison
 * (resume/keyword-frame.ts reads `descriptionRefreshedAt`). The fingerprint
 * follows the text so the dedupe scan (ADR 0018) keeps seeing this posting;
 * the cross-listing link, annotation only, is left as it was.
 */

export interface DescriptionSwap {
  job: Job;
  /** False when no running search could re-score it. */
  reclassified: boolean;
}

/** Replace the description with the listing's text; the first refresh keeps the original, later ones keep the first. */
export async function refreshDescription(job: ClassifiableJob, fetched: string, userId: number): Promise<DescriptionSwap> {
  const description = normaliseDescription(fetched);
  return swap(job, userId, descriptionColumns(job, description));
}

/** Put the original back; the swap stays dated so stored comparisons of the listing's text are not reused either. */
export async function restoreDescription(job: ClassifiableJob, userId: number): Promise<DescriptionSwap | null> {
  if (job.descriptionOriginal === null) return null;
  return swap(job, userId, { ...descriptionColumns(job, job.descriptionOriginal), descriptionOriginal: null });
}

async function swap(
  job: ClassifiableJob,
  userId: number,
  data: ReturnType<typeof descriptionColumns>,
): Promise<DescriptionSwap> {
  const updated = await prisma.job.update({ where: { id: job.id }, data });
  let reclassified = false;
  try {
    // The user cares about this posting — they just refreshed it — so a
    // search that now rejects it must not dismiss it under them.
    reclassified = (await classifyExistingJob({ ...job, ...updated }, { keepStatus: true, userId })).kind === 'scored';
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'description-refresh: re-classify failed');
  }
  logger.info(
    { jobId: job.id, before: job.description.length, after: data.description.length, restored: data.descriptionOriginal === null, reclassified },
    'description-refresh: swapped',
  );
  return { job: updated, reclassified };
}
