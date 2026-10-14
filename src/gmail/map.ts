import { createHash } from 'node:crypto';
import { cleanEmployer, employerKey } from '../employer';
import type { NormalizedJob } from '../types';
import type { Listing } from './listing';

/*
 * A listing read from a mail, as the posting the pipeline takes (ADR 0071).
 * The employer is the company the mail named or nobody (ADR 0056), the date is
 * the mail's, and the description is what the mail said about this one job:
 * the pipeline scores a listing on that alone, because no link is ever
 * followed. Salary is not set here; it is the classifier's to read, from the
 * description's own line. Pure.
 */

const ID_CHARS = 24;
const EN_DASH = '–';

const words = (s: string): string =>
  s.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The same job in two digests is the same id however each spelled it: case, spacing, punctuation and a legal form are folded. */
function externalId(listing: Listing): string {
  const company = listing.company ? (employerKey(listing.company) ?? '') : '';
  return createHash('sha1').update(`${words(listing.title)}|${company}|${words(listing.location ?? '')}`).digest('hex').slice(0, ID_CHARS);
}

function salaryLine(listing: Listing): string | null {
  const figures = [listing.salaryMin, listing.salaryMax].filter((n): n is number => n !== null);
  if (figures.length === 0) return null;
  const [lo, hi] = [Math.min(...figures), Math.max(...figures)];
  return `Salary: ${lo === hi ? lo : `${lo}${EN_DASH}${hi}`} a year`;
}

const WORKPLACE = { remote: 'REMOTE', hybrid: 'HYBRID', onsite: 'ONSITE' } as const;

export function toNormalizedJob(listing: Listing, receivedAt: Date, companyId: number): NormalizedJob {
  const description = [listing.title, listing.company, listing.location, salaryLine(listing), listing.workplace ? `Workplace: ${listing.workplace}` : null]
    .filter((line): line is string => line !== null)
    .join('\n');
  return {
    companyId,
    externalId: externalId(listing),
    title: listing.title,
    url: listing.url,
    location: listing.location ?? '',
    description,
    postedAt: receivedAt,
    employer: cleanEmployer(listing.company),
    ...(listing.workplace && { locationHints: { workplace: WORKPLACE[listing.workplace] } }),
  };
}
