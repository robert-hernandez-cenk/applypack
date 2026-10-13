import type { CompanyMute } from '@prisma/client';
import { prisma } from '../db';
import { logger } from '../logger';
import { getSettings, getUserSettings, markEmployersFilled } from '../settings';
import {
  cleanEmployer,
  employerFromDescription,
  employerKey,
  sourceIsEmployer,
  type EmployerRules,
} from '../employer';

/*
 * The database side of ADR 0056: the mute list, what the tick's gate reads,
 * and the one-time fill of the rows stored before Job.employerKey. The
 * decisions are employer.ts's; this module only reads and writes them. The
 * mute list and the re-apply window are a person's own (ADR 0069).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows read per pass by the one-time fill; a description is a few KB. */
const FILL_BATCH = 500;
/** Longer is not a reason, it is a letter. */
const MAX_REASON_CHARS = 300;

/** One person's rules: the keys they muted and, with their window on, the keys they applied to inside it. */
export async function loadEmployerRules(userId: number, now = new Date()): Promise<EmployerRules> {
  const [mutes, { reapplyDays }] = await Promise.all([
    prisma.companyMute.findMany({ where: { userId }, select: { key: true } }),
    getUserSettings(userId),
  ]);
  const muted = new Set(mutes.map((m) => m.key));
  if (reapplyDays === null) return { muted, appliedRecently: new Set() };
  // Only this person's applications count toward their window (ADR 0069).
  const applied = await prisma.userJob.findMany({
    where: { userId, appliedAt: { gte: new Date(now.getTime() - reapplyDays * DAY_MS) }, job: { employerKey: { not: null } } },
    select: { job: { select: { employerKey: true } } },
  });
  return { muted, appliedRecently: new Set(applied.flatMap((u) => (u.job.employerKey === null ? [] : [u.job.employerKey]))) };
}

/** Read once per tick, like the schedule: each person's rules, for the people a posting could reach. */
export async function loadEmployerRulesFor(userIds: readonly number[], now = new Date()): Promise<Map<number, EmployerRules>> {
  const rules = new Map<number, EmployerRules>();
  for (const userId of userIds) rules.set(userId, await loadEmployerRules(userId, now));
  return rules;
}

/** The keys /jobs hides by default for this person. */
export async function mutedKeys(userId: number): Promise<string[]> {
  const rows = await prisma.companyMute.findMany({ where: { userId }, select: { key: true } });
  return rows.map((r) => r.key);
}

/** Everybody's muted keys, for the one pass that scores for several people (ADR 0069). */
export async function allMutedKeys(): Promise<Map<number, Set<string>>> {
  const rows = await prisma.companyMute.findMany({ select: { userId: true, key: true } });
  const byUser = new Map<number, Set<string>>();
  for (const r of rows) byUser.set(r.userId, (byUser.get(r.userId) ?? new Set()).add(r.key));
  return byUser;
}

/** The person's mutes, newest first, with how many of the postings they hold each one hides. */
export async function listMutes(userId: number): Promise<(CompanyMute & { hidden: number })[]> {
  const mutes = await prisma.companyMute.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (mutes.length === 0) return [];
  const counts = await prisma.job.groupBy({
    by: ['employerKey'],
    where: { employerKey: { in: mutes.map((m) => m.key) }, userJobs: { some: { userId } } },
    _count: { _all: true },
  });
  const hidden = new Map(counts.map((c) => [c.employerKey, c._count._all]));
  return mutes.map((m) => ({ ...m, hidden: hidden.get(m.key) ?? 0 }));
}

export async function findMute(userId: number, key: string): Promise<CompanyMute | null> {
  return prisma.companyMute.findUnique({ where: { userId_key: { userId, key } } });
}

/** Mutes a name for a person; null when it is not one (nothing to match). Muting again rewrites the reason. */
export async function muteEmployer(userId: number, name: string, reason: string | null): Promise<CompanyMute | null> {
  const clean = cleanEmployer(name);
  const key = clean === null ? null : employerKey(clean);
  if (clean === null || key === null) return null;
  const why = reason?.trim().slice(0, MAX_REASON_CHARS) || null;
  const mute = await prisma.companyMute.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, name: clean, reason: why },
    update: { name: clean, reason: why },
  });
  logger.info({ userId, key }, 'employers: muted');
  return mute;
}

/** True when there was a mute to lift. */
export async function unmuteEmployer(userId: number, key: string): Promise<boolean> {
  const { count } = await prisma.companyMute.deleteMany({ where: { userId, key } });
  if (count > 0) logger.info({ userId, key }, 'employers: unmuted');
  return count > 0;
}

/**
 * Once per install (`AppSettings.employersFilledAt`): the rows stored before
 * Job.employerKey get theirs. A source that is the employer gives every row
 * its own name, in one update per company; an aggregator's rows give back
 * the "Hiring company: …" line their fetcher wrote, grouped so there is one
 * update per employer. A row that names nobody keeps NULL. Zero AI.
 */
export async function fillEmployerKeys(): Promise<void> {
  if ((await getSettings()).employersFilledAt !== null) return;
  const companies = await prisma.company.findMany({ select: { id: true, name: true, atsType: true } });
  let filled = 0;
  for (const company of companies.filter((c) => sourceIsEmployer(c.atsType))) {
    const key = employerKey(company.name);
    if (key === null) continue;
    const { count } = await prisma.job.updateMany({ where: { companyId: company.id, employerKey: null }, data: { employerKey: key } });
    filled += count;
  }
  const aggregators = companies.filter((c) => !sourceIsEmployer(c.atsType)).map((c) => c.id);
  let after = 0;
  for (;;) {
    const rows = await prisma.job.findMany({
      where: { companyId: { in: aggregators }, employerKey: null, id: { gt: after } },
      select: { id: true, description: true },
      orderBy: { id: 'asc' },
      take: FILL_BATCH,
    });
    if (rows.length === 0) break;
    after = rows[rows.length - 1]!.id;
    const byName = new Map<string, number[]>();
    for (const row of rows) {
      const name = employerFromDescription(row.description);
      if (name !== null) byName.set(name, [...(byName.get(name) ?? []), row.id]);
    }
    for (const [name, ids] of byName) {
      const key = employerKey(name);
      if (key === null) continue;
      const { count } = await prisma.job.updateMany({ where: { id: { in: ids } }, data: { employer: name, employerKey: key } });
      filled += count;
    }
  }
  await markEmployersFilled(new Date());
  logger.info({ filled }, 'employers: older rows given their employer keys');
}
