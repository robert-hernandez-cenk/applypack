/*
 * How long the resume is against a page target — browser copy of
 * src/resume/length.ts (ADR 0074), for the editor's live meter: the estimate
 * is characters over one per-page constant, and the figure under the editor
 * must never disagree with the one the server computed for the same text.
 *
 * MIRROR: change length.ts and this file together — src/web/length.test.ts
 * runs both over one table.
 */

export const CHARS_PER_PAGE = 3500;

/** Carriage returns are not counted: the editor's text has none, and the two must agree on the same document. */
function charCount(text) {
  return text.replace(/\r/g, '').length;
}

export function estimatePages(text) {
  return charCount(text) / CHARS_PER_PAGE;
}

/** `target` is 1, 2, 3 or 'keep'. */
export function lengthPlan(text, target) {
  const budgetChars = target === 'keep' ? null : target * CHARS_PER_PAGE;
  const overshootChars = budgetChars === null ? 0 : Math.max(0, Math.ceil(charCount(text) - budgetChars));
  return { target, pages: estimatePages(text), budgetChars, overshootChars, met: overshootChars === 0 };
}

/** One decimal, as the meter shows it — the language's own digits come from the `{n, number}` message. */
export function roundPages(pages) {
  return Math.round(pages * 10) / 10;
}
