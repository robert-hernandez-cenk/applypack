import { prisma } from '../db';
import { logger } from '../logger';
import { viewOf, type ConnectionView } from './reactive-connection';

/*
 * The only file that touches `reactive_resume_connection` (ADR 0075), and the
 * only one that returns the API key: `readInstanceKey`, for the routes that
 * make a request to the instance. Every read says which columns it wants
 * (`reactive-connection-access.test.ts`), and every function takes the
 * person's id first. Logs carry the host, never the key.
 */

export async function getConnectionView(userId: number): Promise<ConnectionView | null> {
  const row = await prisma.reactiveResumeConnection.findUnique({ where: { userId }, select: { baseUrl: true } });
  return row ? viewOf(row.baseUrl) : null;
}

/** The instance and the key to call it with — for a list or an import, nowhere else. */
export async function readInstanceKey(userId: number): Promise<{ base: string; key: string } | null> {
  const row = await prisma.reactiveResumeConnection.findUnique({ where: { userId }, select: { baseUrl: true, apiKey: true } });
  return row ? { base: row.baseUrl, key: row.apiKey } : null;
}

/** Sets or replaces the person's one connection; a pair is never half written. */
export async function saveConnection(userId: number, base: string, key: string): Promise<void> {
  await prisma.reactiveResumeConnection.upsert({
    where: { userId },
    create: { userId, baseUrl: base, apiKey: key },
    update: { baseUrl: base, apiKey: key },
  });
  logger.info({ userId, host: viewOf(base).host }, 'reactive resume: connection saved');
}

export async function deleteConnection(userId: number): Promise<void> {
  await prisma.reactiveResumeConnection.deleteMany({ where: { userId } });
  logger.info({ userId }, 'reactive resume: connection removed');
}
