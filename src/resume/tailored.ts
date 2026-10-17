/**
 * Pure rules for a tailored copy (ADR 0077): which file an edit is written
 * into, and what the copy's file is called.
 */

/**
 * Which file the editor's edits are patched into. The target page's
 * `baseText` is the text of the comparison on show: after a first save that is
 * the copy's text, and the copy's own bytes are the file that text came from.
 * Anything else — no copy yet, or a comparison of the master — starts from the
 * master's file.
 */
export function patchSource(input: { baseText: string; copyText: string | null }): 'copy' | 'master' {
  const base = input.baseText.trim();
  return input.copyText !== null && base !== '' && base === input.copyText.trim() ? 'copy' : 'master';
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "Senior Backend PHP" + "Staff Engineer @ Acme" → "senior-backend-php-staff-engineer-acme.docx". */
export function tailoredFileName(resumeName: string, jobTitle: string, ext: string): string {
  return `${[slug(resumeName), slug(jobTitle)].filter(Boolean).join('-') || 'resume'}.${ext}`;
}

type Row = { id: number; tailoredId: number | null; draft: boolean };

/**
 * The comparison the editor opens on. A job has one working resume: the saved copy when there is one, else
 * the resume itself. A comparison of the resume's own words (not a draft) is only a report once a copy
 * exists, so the editor shows the copy's newest comparison instead; a draft is a text the person just
 * brought and stays. `matches` is newest first.
 */
export function workingMatch<T extends Row>(matches: T[], requestedId: number, copy: { id: number } | null): T | undefined {
  const asked = matches.find((m) => m.id === requestedId) ?? matches[0];
  if (!asked || !copy || asked.tailoredId !== null || asked.draft) return asked;
  return matches.find((m) => m.tailoredId === copy.id) ?? asked;
}

/** The history the editor lists: with a copy saved, the resume's own non-draft runs are reports, not texts to edit. */
export function editorHistory<T extends Row>(matches: T[], copy: { id: number } | null): T[] {
  return copy === null ? matches : matches.filter((m) => m.tailoredId !== null || m.draft);
}
