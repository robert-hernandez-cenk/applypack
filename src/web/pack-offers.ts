import { prisma } from '../db';
import { listActiveProfiles } from '../profiles';
import { currentUser } from './current-user';
import { isBlankProfile } from '../profile-guards';
import { packsForSearches } from '../starter-packs/suggest';
import { companiesInSegments, countsBySegment, segments } from '../starter-packs/catalog';
import { keyOf } from '../starter-packs/resolve';

/** A starter pack that fits the running searches, and how much of it is here already (ADR 0040). */
export interface PackOffer {
  id: string;
  label: string;
  blurb: string;
  count: number;
  tracked: number;
}

/**
 * The starter packs that fit the running searches, less any already here in
 * full (ADR 0040). The wizard's boards step and the Companies page's
 * "Sources for your searches" read the same list (TASKS S26).
 */
export async function packOffers(): Promise<PackOffer[]> {
  const [profiles, tracked] = await Promise.all([
    listActiveProfiles(currentUser().id),
    prisma.company.findMany({ select: { atsType: true, atsToken: true } }),
  ]);
  const fit = new Set(packsForSearches(profiles.filter((p) => !isBlankProfile(p))));
  const here = new Set(tracked.map((r) => keyOf(r.atsType, r.atsToken)));
  const counts = countsBySegment();
  return segments()
    .filter((s) => fit.has(s.id))
    .map((s) => ({
      ...s,
      count: counts.get(s.id) ?? 0,
      tracked: companiesInSegments([s.id]).filter((c) => here.has(keyOf(c.atsType, c.atsToken))).length,
    }))
    .filter((p) => p.tracked < p.count);
}
