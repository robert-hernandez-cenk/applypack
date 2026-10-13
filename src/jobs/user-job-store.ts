import { JobStatus } from '@prisma/client';
import { prisma } from '../db';

/*
 * The one place `user_job` rows are read for the worker's decisions and
 * stamped after an alert (ADR 0067). Re-score writes go through
 * `score-store.ts`, which writes a score and its rows in one transaction.
 */

/** Each person's current status for a batch of postings: jobId -> userId -> status. */
export async function statusesOf(jobIds: number[]): Promise<Map<number, Map<number, JobStatus>>> {
  const out = new Map<number, Map<number, JobStatus>>();
  if (jobIds.length === 0) return out;
  const rows = await prisma.userJob.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true, userId: true, status: true },
  });
  for (const r of rows) {
    const users = out.get(r.jobId) ?? new Map<number, JobStatus>();
    users.set(r.userId, r.status);
    out.set(r.jobId, users);
  }
  return out;
}

/** Stamps a NEW match for the grouped delivery (`alert-delivery.ts`); a row the person already answered keeps their status. */
export async function holdAlert(userId: number, jobId: number): Promise<void> {
  await prisma.userJob.updateMany({ where: { userId, jobId, status: JobStatus.NEW }, data: { alertHeldAt: new Date() } });
}

/**
 * The alert went out. Still NEW, exactly as the held-alert path checks: the
 * send takes seconds and the dashboard is open the whole time. A row the
 * person dismissed or saved in between keeps their status.
 */
export async function markAlerted(userId: number, jobId: number): Promise<void> {
  await prisma.userJob.updateMany({
    where: { userId, jobId, status: JobStatus.NEW },
    data: { status: JobStatus.ALERTED, alertedAt: new Date() },
  });
}
