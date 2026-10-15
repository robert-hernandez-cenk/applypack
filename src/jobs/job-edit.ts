import { normaliseDescription } from './description-diff';
import { MAX_POSTING_CHARS, MIN_DESCRIPTION_CHARS } from './posting-limits';

/*
 * Editing a stored posting (#46) — the rules, with no I/O. Who may edit is
 * the one person who holds the posting: `Job` is the shared catalog, and a
 * posting someone else also holds is theirs to read as it was. What a form
 * changes is planned here; job-edit-store.ts writes it. Errors are codes,
 * never words: the page words them (`jobEdit.error.<code>`).
 */

export const MAX_TITLE_CHARS = 300;
export const MAX_COMPANY_CHARS = 200;
export const MAX_LOCATION_CHARS = 300;

export type JobEditError =
  | 'titleEmpty'
  | 'titleTooLong'
  | 'companyTooLong'
  | 'locationTooLong'
  | 'descriptionTooShort'
  | 'descriptionTooLong';

export interface JobEditForm {
  title: string;
  company: string;
  location: string;
  description: string;
}

/** The stored posting as the form sees it; `shownCompany` is the name the page shows (null: nobody is named). */
export interface JobEditCurrent {
  title: string;
  shownCompany: string | null;
  location: string;
  description: string;
}

/** Only the fields that differ. `employer: null` clears the named employer. */
export interface JobEditChanges {
  title?: string;
  employer?: string | null;
  location?: string;
  description?: string;
}

/**
 * Postings a person brought themselves: pasted, from their Gmail label, an
 * imported file, a folder. A board's or an aggregator's posting is the
 * vendor's text — shown as received, rewritten by the next sync (France
 * Travail's licence says whole) — whoever happens to hold it alone.
 */
const OWN_SOURCES: ReadonlySet<string> = new Set(['MANUAL', 'GMAIL', 'IMPORT', 'FOLDER']);

/** The posting came in through the person's own hands and nobody else holds it. */
export function canEdit(holderIds: readonly number[], userId: number, atsType: string): boolean {
  return OWN_SOURCES.has(atsType) && holderIds.length === 1 && holderIds[0] === userId;
}

export function isUnchanged(changes: JobEditChanges): boolean {
  return Object.keys(changes).length === 0;
}

/**
 * The description's length limits apply to a description that changed: a
 * person fixing a location on a two-line mail is not made to write 200
 * characters they did not touch.
 */
export function planEdit(current: JobEditCurrent, form: JobEditForm): { ok: true; changes: JobEditChanges } | { ok: false; error: JobEditError } {
  const title = form.title.trim();
  const company = form.company.trim();
  const location = form.location.trim();
  const description = normaliseDescription(form.description);

  if (title.length === 0) return { ok: false, error: 'titleEmpty' };
  if (title.length > MAX_TITLE_CHARS) return { ok: false, error: 'titleTooLong' };
  if (company.length > MAX_COMPANY_CHARS) return { ok: false, error: 'companyTooLong' };
  if (location.length > MAX_LOCATION_CHARS) return { ok: false, error: 'locationTooLong' };

  const changes: JobEditChanges = {};
  if (title !== current.title.trim()) changes.title = title;
  if (company !== (current.shownCompany ?? '').trim()) changes.employer = company === '' ? null : company;
  if (location !== current.location.trim()) changes.location = location;
  if (description !== normaliseDescription(current.description)) {
    if (description.length < MIN_DESCRIPTION_CHARS) return { ok: false, error: 'descriptionTooShort' };
    if (description.length > MAX_POSTING_CHARS) return { ok: false, error: 'descriptionTooLong' };
    changes.description = description;
  }
  return { ok: true, changes };
}
