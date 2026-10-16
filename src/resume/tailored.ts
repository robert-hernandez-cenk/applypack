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
