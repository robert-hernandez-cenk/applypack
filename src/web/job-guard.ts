import type { MiddlewareHandler } from 'hono';
import { prisma } from '../db';
import { t } from '../i18n/t';
import { currentUser } from './current-user';

/*
 * A posting is shared, but a person sees only the ones they hold a row for
 * (ADR 0067). Every route under /jobs/<id> — the page, its status, comparison,
 * verification, letter and pack actions — answers "not found" for a posting
 * the signed-in person does not hold, one check for all of them.
 */

/** The job id of a /jobs/<id>[/…] path, or null for any other path (/jobs, /jobs/new, /jobs/import). */
export function jobIdOfPath(path: string): number | null {
  const m = /^\/jobs\/(\d+)(?:\/|$)/.exec(path);
  return m ? Number(m[1]) : null;
}

export function requireHeldJob(): MiddlewareHandler {
  return async (c, next) => {
    const jobId = jobIdOfPath(c.req.path);
    if (jobId === null || !Number.isSafeInteger(jobId)) return next();
    const held = await prisma.userJob.findUnique({
      where: { userId_jobId: { userId: currentUser().id, jobId } },
      select: { id: true },
    });
    if (!held) return c.text(t('http.notFound'), 404);
    return next();
  };
}
