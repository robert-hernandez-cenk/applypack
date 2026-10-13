import type { Profile } from '@prisma/client';
import { prisma } from './db';
import { t } from './i18n/t';
import { logger } from './logger';
import { MAX_ACTIVE_PROFILES } from './profile-guards';
import type { WorkplaceCode } from './location';
import type { RelocationCode } from './eligibility';
import { withGlobalWriteLock } from './settings';
import type { PriorityRule } from './priority-rules';

/** A stale id: the search was deleted, most often from another tab. The sentence reaches the flash. */
const searchGone = (): Error => new Error(t('settingsRoute.search.gone'));

export interface ProfileInput {
  name: string;
  stackRequired: string[];
  roleTypes: string[];
  stackNiceToHave: string[];
  stackExclude: string[];
  notes: string | null;
  seniority: string[];
  /** ISO-2 codes and group codes (ADR 0032); both empty = anywhere. */
  countries: string[];
  regions: string[];
  /** Arrangements the search accepts; empty = any. */
  workplace: WorkplaceCode[];
  /** Where the candidate lives now (ISO-2), null = not said (ADR 0033). */
  residence: string | null;
  /** Whether they would move for a role: no | yes | sponsorship (ADR 0033). */
  relocation: RelocationCode;
  onsiteCities: string[];
  minSalaryUsd: number;
  minFitScore: number;
  notificationTargetId: number | null;
  /** The resume this search hunts with; null = pick by skill overlap. */
  resumeId: number | null;
  priorityRules: PriorityRule[];
}

/**
 * A profile with nothing said yet — what "New profile" creates, and the base
 * a resume draft is measured against so every field the scan speaks for lands
 * in the new search (src/resume/profile-draft.ts). Born inactive (issue #50).
 */
export function blankProfileInput(): ProfileInput {
  return {
    name: 'New profile',
    stackRequired: [],
    roleTypes: [],
    stackNiceToHave: [],
    stackExclude: ['junior', 'intern'],
    notes: null,
    seniority: [],
    countries: [],
    regions: [],
    workplace: ['REMOTE'],
    residence: null,
    relocation: 'no',
    onsiteCities: [],
    minSalaryUsd: 0,
    minFitScore: 70,
    notificationTargetId: null,
    resumeId: null,
    priorityRules: [],
  };
}

/*
 * Searches belong to a person (ADR 0066). Everything the dashboard reads or
 * writes takes the `userId` first and folds it into the `where`, so another
 * person's id misses exactly as a deleted one does. The worker is the one
 * caller that looks across people: `listAllActiveProfiles`.
 */

export async function listProfiles(userId: number): Promise<Profile[]> {
  return prisma.profile.findMany({ where: { userId }, orderBy: { id: 'asc' } });
}

export async function getProfile(userId: number, id: number): Promise<Profile | null> {
  return prisma.profile.findFirst({ where: { id, userId } });
}

/** The searches that hunt with a given resume — shown on that resume's page. */
export async function listProfilesForResume(
  userId: number,
  resumeId: number,
): Promise<Pick<Profile, 'id' | 'name'>[]> {
  return prisma.profile.findMany({
    where: { userId, resumeId },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });
}

/**
 * The searches one person has running (ADR 0028). Ordered by id so the order
 * is stable. Their primary is guaranteed to be in here — `setActiveProfile`
 * marks it active — so a caller that only wants defaults can use
 * getActiveProfile.
 */
export async function listActiveProfiles(userId: number): Promise<Profile[]> {
  return prisma.profile.findMany({ where: { userId, active: true }, orderBy: { id: 'asc' } });
}

/**
 * Every search that is running, whoever owns it: what a scoring pass reads.
 * The job catalog is shared, so one classifier call scores a posting against
 * all of them and a verdict is stored for each (ADR 0066). Ordered by id so
 * the classifier prompt is byte-stable across a tick.
 */
export async function listAllActiveProfiles(): Promise<Profile[]> {
  return prisma.profile.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
}

/**
 * Flip one search on or off. A person's primary cannot be switched off: it
 * supplies the defaults every page falls back to, and a primary that scores
 * nothing is a dashboard that quietly stops working.
 */
export async function setProfileActive(userId: number, id: number, active: boolean): Promise<void> {
  // Counting the running searches and then flipping the row is check-then-act:
  // two tabs both read 7, both pass, and 9 searches run. `withGlobalWriteLock`
  // is why they cannot (issue #70). The limit is per person.
  const name = await withGlobalWriteLock(async (tx) => {
    const profile = await tx.profile.findFirst({ where: { id, userId } });
    if (!profile) throw searchGone();
    if (active) {
      const running = await tx.profile.count({ where: { userId, active: true, id: { not: id } } });
      if (running >= MAX_ACTIVE_PROFILES) {
        throw new Error(t('settingsRoute.search.tooMany', { n: MAX_ACTIVE_PROFILES }));
      }
    } else {
      const owner = await tx.user.findUnique({ where: { id: userId }, select: { primaryProfileId: true } });
      if (owner?.primaryProfileId === id) {
        throw new Error(t('settingsRoute.search.primaryOff'));
      }
    }
    await tx.profile.update({ where: { id }, data: { active } });
    return profile.name;
  });
  logger.info({ userId, profileId: id, name, active }, 'profiles: active toggled');
}

/** The person's primary search, or null before they have one. */
export async function getActiveProfile(userId: number): Promise<Profile | null> {
  const owner = await prisma.user.findUnique({ where: { id: userId }, include: { primaryProfile: true } });
  return owner?.primaryProfile ?? null;
}

export async function createProfile(userId: number, input: ProfileInput): Promise<Profile> {
  return prisma.profile.create({ data: { ...input, userId } });
}

export async function updateProfile(
  userId: number,
  id: number,
  input: ProfileInput,
): Promise<Profile> {
  const { count } = await prisma.profile.updateMany({ where: { id, userId }, data: input });
  if (count === 0) throw searchGone();
  return prisma.profile.findUniqueOrThrow({ where: { id } });
}

export async function deleteProfile(userId: number, id: number): Promise<void> {
  // Cannot delete the primary profile — UI must switch first. Under the same
  // lock as the other profile writes: reading the primary and then deleting
  // let a tab that was making this search primary win the race, and the
  // dashboard lost the row every page falls back to.
  await withGlobalWriteLock(async (tx) => {
    const owner = await tx.user.findUnique({ where: { id: userId }, select: { primaryProfileId: true } });
    if (owner?.primaryProfileId === id) {
      throw new Error(t('settingsRoute.search.primaryDelete'));
    }
    const { count } = await tx.profile.deleteMany({ where: { id, userId } });
    if (count === 0) throw searchGone();
  });
}

export async function setActiveProfile(userId: number, id: number): Promise<void> {
  // The other half of the same race: reading the row and then pointing the
  // user at it let a delete land in between, and the foreign key refused
  // the write with Prisma's own text in the flash.
  const name = await withGlobalWriteLock(async (tx) => {
    const profile = await tx.profile.findFirst({ where: { id, userId } });
    if (!profile) throw searchGone();
    await tx.user.update({ where: { id: userId }, data: { primaryProfileId: id } });
    // The primary always runs: it is the fallback every page reads, so leaving
    // it switched off would show defaults from a search that scores nothing.
    await tx.profile.update({ where: { id }, data: { active: true } });
    return profile.name;
  });
  logger.info({ userId, profileId: id, name }, 'profiles: primary set');
}

/**
 * A person with no primary search gets a blank one (a new member's first
 * sign-in, ADR 0066). A no-op when they have one, so it is safe to call twice.
 */
export async function ensurePrimaryProfile(userId: number): Promise<void> {
  await withGlobalWriteLock(async (tx) => {
    const owner = await tx.user.findUnique({ where: { id: userId }, select: { primaryProfileId: true } });
    if (!owner || owner.primaryProfileId !== null) return;
    const created = await tx.profile.create({ data: { ...blankProfileInput(), userId, active: true } });
    await tx.user.update({ where: { id: userId }, data: { primaryProfileId: created.id } });
  });
}
