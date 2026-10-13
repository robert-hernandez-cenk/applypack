import { prisma, isUniqueViolation } from '../db';
import { withGlobalWriteLock } from '../settings';
import { DEFAULT_USER_ID, provisionStep, type CurrentUser, type Identity, type UserRole } from './identity';
import { judgeUserChange, type ChangeVerdict, type UserChange } from './rules';

/** The only file that touches `users` (ADR 0065). */

export async function loadUser(id: number): Promise<CurrentUser | null> {
  const row = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  return row;
}

/**
 * The user a provider identity stands for, created on first sight. Returns the id.
 * Two first sign-ins at once settle on the unique `oidcSub`: the loser reads the winner's row.
 */
export async function provisionOidcUser(identity: Identity): Promise<number> {
  const name = identity.name ?? identity.sub;
  const known = await prisma.user.findUnique({ where: { oidcSub: identity.sub }, select: { id: true } });
  const defaultUnclaimed =
    !known && (await prisma.user.count({ where: { id: DEFAULT_USER_ID, oidcSub: null } })) === 1;
  const step = provisionStep({ known: known !== null, defaultUnclaimed });
  if (step === 'known' && known) return known.id;
  if (step === 'claim-default') {
    // Guarded by `oidcSub: null`, so of two simultaneous first sign-ins only one takes it.
    const claimed = await prisma.user.updateMany({ where: { id: DEFAULT_USER_ID, oidcSub: null }, data: { oidcSub: identity.sub, name } });
    if (claimed.count === 1) return DEFAULT_USER_ID;
  }
  try {
    const created = await prisma.user.create({ data: { oidcSub: identity.sub, name, role: 'MEMBER' }, select: { id: true } });
    return created.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const won = await prisma.user.findUniqueOrThrow({ where: { oidcSub: identity.sub }, select: { id: true } });
    return won.id;
  }
}

/** The administrators: who hears an operator notice (ADR 0069). */
export async function listAdminIds(): Promise<number[]> {
  const rows = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, orderBy: { id: 'asc' } });
  return rows.map((r) => r.id);
}

/** Every user's id: a posting stored without a verdict is handed to all of them (ADR 0067). */
export async function listUserIds(): Promise<number[]> {
  const rows = await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  return rows.map((r) => r.id);
}

/** What the users page shows about a person, and what removing them would take with them (ADR 0070). */
export interface UserSummary {
  id: number;
  name: string;
  role: UserRole;
  createdAt: Date;
  /** The newest thing the person did that leaves a mark; null when they never did anything. */
  lastActiveAt: Date | null;
  searches: number;
  postings: number;
  resumes: number;
  comparisons: number;
  letters: number;
  destinations: number;
}

function newest(...dates: (Date | null | undefined)[]): Date | null {
  const known = dates.filter((d): d is Date => d instanceof Date);
  return known.length === 0 ? null : new Date(Math.max(...known.map((d) => d.getTime())));
}

export async function listUserSummaries(): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, role: true, createdAt: true } });
  return Promise.all(
    users.map(async (u) => {
      const own = { userId: u.id };
      const [searches, postings, resumes, comparisons, letters, destinations, resume, settings, stage, applied] = await Promise.all([
        prisma.profile.count({ where: own }),
        prisma.userJob.count({ where: own }),
        prisma.resume.count({ where: own }),
        prisma.resumeMatch.count({ where: { resume: own } }),
        prisma.coverLetter.count({ where: { resume: own } }),
        prisma.notificationTarget.count({ where: own }),
        prisma.resume.aggregate({ where: own, _max: { updatedAt: true } }),
        prisma.userSettings.findUnique({ where: own, select: { updatedAt: true } }),
        prisma.jobStageEvent.aggregate({ where: own, _max: { recordedAt: true } }),
        prisma.userJob.aggregate({ where: own, _max: { appliedAt: true } }),
      ]);
      return {
        ...u,
        lastActiveAt: newest(resume._max.updatedAt, settings?.updatedAt, stage._max.recordedAt, applied._max.appliedAt),
        searches,
        postings,
        resumes,
        comparisons,
        letters,
        destinations,
      };
    }),
  );
}

/**
 * Applies a role change or a removal, judged on a fresh read under the settings lock so two administrators
 * acting at once cannot take the last one away. Returns the verdict; the data is untouched unless it is ok.
 */
export async function changeUser(input: { actorId: number; targetId: number; change: UserChange }): Promise<ChangeVerdict> {
  return withGlobalWriteLock(async (tx) => {
    const users = await tx.user.findMany({ select: { id: true, role: true } });
    const verdict = judgeUserChange({ users, ...input });
    if (!verdict.ok) return verdict;
    if (input.change === 'remove') {
      // A person's recaps and nudges name them without a foreign key (ADR 0069).
      await tx.cronRun.deleteMany({ where: { userId: input.targetId } });
      await tx.user.delete({ where: { id: input.targetId } });
    } else {
      await tx.user.update({ where: { id: input.targetId }, data: { role: input.change === 'promote' ? 'ADMIN' : 'MEMBER' } });
    }
    return verdict;
  });
}
