import { z } from 'zod';
import { extractJson } from '../text-utils';

/*
 * What the model hands back for one mail (ADR 0071), read tolerantly and
 * checked hard: a listing the mail did not give a link for is dropped, a
 * field it did not state stays null, and a mail can offer only so many jobs.
 * The link comes back as the number of a `[#n]` marker and is resolved here,
 * so an address that was not in the mail cannot get through. Pure.
 */

/** Jobs taken from one mail; a digest holds a dozen, and anything past this is counted, not read. */
export const MAX_LISTINGS_PER_MAIL = 30;
/** The longest title, company or place kept (the same bound as a pasted posting's fields). */
export const FIELD_CHARS = 200;
const MAX_SALARY = 5_000_000;

export interface Listing {
  title: string;
  company: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workplace: 'remote' | 'hybrid' | 'onsite' | null;
  /** The mail's own address for this job. */
  url: string;
}

const Field = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const s = (v ?? '').replace(/\s+/g, ' ').trim().slice(0, FIELD_CHARS);
    return s.length > 0 ? s : null;
  });

const Salary = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_SALARY ? Math.round(v) : null));

const Workplace = z
  .enum(['remote', 'hybrid', 'onsite'])
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);

const Entry = z.object({
  title: Field,
  company: Field,
  location: Field,
  salary_min: Salary,
  salary_max: Salary,
  workplace: Workplace,
  link: z.unknown(),
});

const Reply = z.object({ listings: z.array(z.unknown()) });

export interface ParsedListings {
  listings: Listing[];
  /** Entries left out: no title, no link the mail holds, or past the cap. */
  skipped: number;
}

/** `null` when the reply is not the expected shape at all. */
export function parseListings(raw: string, links: readonly string[]): ParsedListings | null {
  const json = extractJson(raw);
  if (json === null) return null;
  const reply = Reply.safeParse(json);
  if (!reply.success) return null;

  const listings: Listing[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const candidate of reply.data.listings) {
    const entry = Entry.safeParse(candidate);
    const link = entry.success ? entry.data.link : null;
    const url = typeof link === 'number' && Number.isInteger(link) && link >= 1 && link <= links.length ? links[link - 1] : undefined;
    if (!entry.success || entry.data.title === null || url === undefined) {
      skipped++;
      continue;
    }
    const { title, company, location, workplace } = entry.data;
    const key = `${title.toLowerCase()}|${(company ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (listings.length >= MAX_LISTINGS_PER_MAIL) {
      skipped++;
      continue;
    }
    // A reversed range is the model's slip, not the advertiser's.
    const [min, max] = entry.data.salary_min !== null && entry.data.salary_max !== null && entry.data.salary_min > entry.data.salary_max
      ? [entry.data.salary_max, entry.data.salary_min]
      : [entry.data.salary_min, entry.data.salary_max];
    listings.push({ title, company, location, salaryMin: min, salaryMax: max, workplace, url });
  }
  return { listings, skipped };
}
