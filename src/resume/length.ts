/*
 * How long a resume is, and how far over a page target it runs (ADR 0074).
 * The estimate is characters over one per-page constant — a guide, not a
 * layout measurement — and `src/web/public/length.mjs` mirrors it for the
 * editor's live meter (`src/web/length.test.ts` enforces parity). Pure.
 */

/** ~3500 chars ≈ one US letter page of resume text. */
export const CHARS_PER_PAGE = 3_500;

/**
 * What a prompt may ask for with no target, and the most a target may ask for:
 * the reply schema takes at most 30 removals (`MatchSchema` in prompts.ts —
 * `prompts.test.ts` parses a reply of exactly this many), so a prompt that asked
 * for more would fail its own parse.
 */
export const CUTS_DEFAULT = 8;
export const CUTS_MAX = 30;
/** One removal per this many characters over the target: about one bullet, since a quote is at most ~200 characters. */
const CHARS_PER_CUT = 250;

export const PAGE_TARGETS = [1, 2, 3] as const;
/** `keep` is no limit: the flow behaves exactly as before the target existed. */
export type PageTarget = 'keep' | (typeof PAGE_TARGETS)[number];

function asTarget(n: number): PageTarget {
  return (PAGE_TARGETS as readonly number[]).includes(n) ? (n as PageTarget) : 'keep';
}

/** A form value → target; anything unrecognised keeps the length. */
export function parsePageTarget(v: unknown): PageTarget {
  if (typeof v === 'number') return asTarget(v);
  return typeof v === 'string' && /^\d$/.test(v) ? asTarget(Number(v)) : 'keep';
}

/** Target of a stored row; no marker means the row predates it. */
export function readPageTarget(breakdown: unknown): PageTarget {
  if (typeof breakdown !== 'object' || breakdown === null) return 'keep';
  const v = (breakdown as { pages?: unknown }).pages;
  return typeof v === 'number' ? asTarget(v) : 'keep';
}

/** Carriage returns are not counted: the editor's text has none, and the two must agree on the same document. */
function charCount(text: string): number {
  return text.replace(/\r/g, '').length;
}

export function estimatePages(text: string): number {
  return charCount(text) / CHARS_PER_PAGE;
}

/** One decimal, as the editor's meter shows it. */
export function roundPages(pages: number): number {
  return Math.round(pages * 10) / 10;
}

export interface LengthPlan {
  target: PageTarget;
  /** Estimated pages of the text as it stands. */
  pages: number;
  /** null with no target. */
  budgetChars: number | null;
  overshootChars: number;
  met: boolean;
}

export function lengthPlan(text: string, target: PageTarget): LengthPlan {
  const budgetChars = target === 'keep' ? null : target * CHARS_PER_PAGE;
  const overshootChars = budgetChars === null ? 0 : Math.max(0, Math.ceil(charCount(text) - budgetChars));
  return { target, pages: estimatePages(text), budgetChars, overshootChars, met: overshootChars === 0 };
}

/** How many removals the prompt may ask for: the default, growing with the overshoot, capped. */
export function cutBudget(overshootChars: number): number {
  return Math.min(CUTS_MAX, Math.max(CUTS_DEFAULT, Math.ceil(overshootChars / CHARS_PER_CUT)));
}

/**
 * Room for the extra removals a target asks for, added to the answer budget
 * (the thinking headroom is added on top, and capped, by `anthropicMaxTokens`):
 * a removal is its section, place, what, why and a quote of up to ~200 chars.
 */
const TOKENS_PER_EXTRA_CUT = 120;

export function lengthExtraTokens(plan: LengthPlan): number {
  if (plan.target === 'keep' || plan.met) return 0;
  return (cutBudget(plan.overshootChars) - CUTS_DEFAULT) * TOKENS_PER_EXTRA_CUT;
}
