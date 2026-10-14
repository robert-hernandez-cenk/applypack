import { prisma } from '../db';
import type { GmailStatus } from './status';

/*
 * The only file that touches `gmail_connection` and `gmail_message` (ADR 0071),
 * and the only one that reads the refresh token. Every read for a page goes
 * through `getConnection`, whose explicit `select` leaves the token out; the
 * token has its own accessor so no page can hold it by accident
 * (`secret-access.test.ts`). Every function takes the person's id.
 */

/** What a page may know about a connection: everything but the token. */
export interface ConnectionView {
  id: number;
  accountEmail: string;
  labelName: string;
  status: string;
  checkRequestedAt: Date | null;
  lastCheckAt: Date | null;
  lastMails: number | null;
  lastListings: number | null;
}

const VIEW = {
  id: true,
  accountEmail: true,
  labelName: true,
  status: true,
  checkRequestedAt: true,
  lastCheckAt: true,
  lastMails: true,
  lastListings: true,
} as const;

export async function getConnection(userId: number): Promise<ConnectionView | null> {
  return prisma.gmailConnection.findUnique({ where: { userId }, select: VIEW });
}

/** The refresh token — for the worker's read and for Disconnect's revoke, nowhere else. */
export async function readRefreshToken(userId: number): Promise<string | null> {
  const row = await prisma.gmailConnection.findUnique({ where: { userId }, select: { refreshToken: true } });
  return row?.refreshToken ?? null;
}

/**
 * A finished connect: the token replaces any earlier one, the label is kept
 * (a reconnect does not reset it), and a first check is queued.
 */
export async function saveConnection(userId: number, connection: { accountEmail: string; refreshToken: string }): Promise<void> {
  const fresh = { accountEmail: connection.accountEmail, refreshToken: connection.refreshToken, status: 'waiting', lastCheckAt: null, checkRequestedAt: new Date() };
  await prisma.gmailConnection.upsert({ where: { userId }, create: { userId, ...fresh }, update: fresh });
}

/** A new label starts from the first-run window: mails already read stay in the ledger and are not read again. */
export async function setLabel(userId: number, labelName: string): Promise<boolean> {
  const changed = await prisma.gmailConnection.updateMany({ where: { userId }, data: { labelName, status: 'waiting', lastCheckAt: null, checkRequestedAt: new Date() } });
  return changed.count === 1;
}

/** Queues a check unless one is already waiting. */
export async function requestCheck(userId: number): Promise<'queued' | 'already' | 'none'> {
  const row = await prisma.gmailConnection.findUnique({ where: { userId }, select: { checkRequestedAt: true } });
  if (!row) return 'none';
  if (row.checkRequestedAt) return 'already';
  await prisma.gmailConnection.update({ where: { userId }, data: { checkRequestedAt: new Date() } });
  return 'queued';
}

/** The ledger cascades with the row. */
export async function deleteConnection(userId: number): Promise<void> {
  await prisma.gmailConnection.deleteMany({ where: { userId } });
}

/** The people the worker reads for: the one listing that is not filtered to a person. */
export async function connectedUserIds(): Promise<number[]> {
  const rows = await prisma.gmailConnection.findMany({ select: { userId: true }, orderBy: { userId: 'asc' } });
  return rows.map((r) => r.userId);
}

/** People who pressed Check now (or just connected): the minute heartbeat takes these. */
export async function requestedUserIds(): Promise<number[]> {
  const rows = await prisma.gmailConnection.findMany({ where: { checkRequestedAt: { not: null } }, select: { userId: true }, orderBy: { userId: 'asc' } });
  return rows.map((r) => r.userId);
}

/** The person's hidden source row, created on first use. */
export async function ensureSourceCompany(userId: number): Promise<{ id: number; name: string }> {
  const atsToken = `user-${userId}`;
  return prisma.company.upsert({
    where: { atsType_atsToken: { atsType: 'GMAIL', atsToken } },
    create: { name: 'Gmail', atsType: 'GMAIL', atsToken, active: false },
    update: {},
    select: { id: true, name: true },
  });
}

/** Which of these mail ids the person has already read. */
export async function processedIds(connectionId: number, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.gmailMessage.findMany({ where: { connectionId, messageId: { in: [...ids] } }, select: { messageId: true } });
  return new Set(rows.map((r) => r.messageId));
}

export type MessageOutcome = 'listings' | 'none' | 'unreadable';

/** Written only after the mail's postings are stored. A second write of the same id is a no-op. */
export async function recordMessage(connectionId: number, row: { messageId: string; receivedAt: Date; outcome: MessageOutcome; count: number }): Promise<void> {
  await prisma.gmailMessage.upsert({ where: { connectionId_messageId: { connectionId, messageId: row.messageId } }, create: { connectionId, ...row }, update: {} });
}

export async function pruneLedger(connectionId: number, before: Date): Promise<void> {
  await prisma.gmailMessage.deleteMany({ where: { connectionId, receivedAt: { lt: before } } });
}

export interface CheckResult {
  status: GmailStatus;
  /** Set only by a read that ran to its end: it bounds the next window. */
  lastCheckAt?: Date;
  mails?: number;
  listings?: number;
}

/** Records how a check went and clears the request that started it, whatever happened. */
export async function recordCheck(userId: number, result: CheckResult): Promise<void> {
  await prisma.gmailConnection.updateMany({
    where: { userId },
    data: {
      status: result.status,
      checkRequestedAt: null,
      ...(result.lastCheckAt && { lastCheckAt: result.lastCheckAt }),
      ...(result.mails !== undefined && { lastMails: result.mails }),
      ...(result.listings !== undefined && { lastListings: result.listings }),
    },
  });
}
