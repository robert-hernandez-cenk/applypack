# 0083 — The page target is set in the Condense panel, not on the compare form

**Status:** Accepted (2026-10-17). Amends [0074](./0074-page-target-for-tailoring.md) (where the target is chosen and
how it is kept) and [0078](./0078-condense-two-phase.md) (the comparison no longer reads it at all).

## Context

0078 took the cuts out of the comparison, but the Length control stayed on the Compare form and the comparison
kept writing the target into its breakdown. Two things were wrong. A quick check wrote `keep` whatever was
chosen (`mode === 'full' ? pages : 'keep'`, left over from when only the full report cut), so the usual path
(Compare, then the editor) opened with "no page target was chosen" after two pages had been picked. And a
control whose only reader was a later, separate step told the person nothing at the moment they used it.

## Decision

- **The Compare form has no Length control.** `ComparisonRequest`, `matchResumeToJob`, the memo key
  (`reuseDecision`, `pickReusable`, `findReusableMatch`) and the re-run flash no longer carry a page target; a
  comparison does not depend on it, so it no longer decides whether a stored one is reused.
- **The Condense panel owns it.** A Length select sits in the Find cuts form; the route stores the choice on the
  comparison (`updateMatchPages`, the existing `breakdown.pages` marker) before starting the run, and `findCuts`
  reads it back as before. The editor's length meter follows the select at once (`target-page.mjs`).
- **A later comparison of the same posting and resume inherits it** (`createMatch` reads the newest earlier
  row), so saving a tailored copy or re-checking the draft does not lose the choice.

## Alternatives considered

- **Keep the control on Compare and fix the quick-check branch.** The bug goes, the confusion stays: the
  choice is made where nothing uses it.
- **A per-posting setting outside the comparison.** One more table for a value the comparison row already
  carries and every Condense reader already reads.

## Consequences

- A stored row's `pages` marker keeps its meaning; rows from before simply have what they had.
- Changing the target after Find cuts needs Find cuts again; the meter shows the new overshoot immediately.
