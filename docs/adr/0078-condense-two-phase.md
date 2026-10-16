# 0078 — Condense is a stage of its own: cuts, then wording, then the rest

**Status:** Accepted (2026-10-16). Issue #49. Amends [0074](./0074-page-target-for-tailoring.md) (the page
target steers Condense, no longer the comparison's request) and [0029](./0029-quick-check-and-lazy-suggestions.md)
(neither the full report nor the lazy suggestions write removals any more). Builds on
[0037](./0037-suggestions-carry-replacement-text-gated-in-code.md) (what may be applied is decided in code),
[0022](./0022-prompt-fences-for-untrusted-text.md) and [0077](./0077-tailored-resume-copies.md) (the condensed
text is what a tailored copy saves).

## Context

Removals, rewording and the page-length block came out of the same request as the additions and the
keywords (`RULE_REMOVALS`, `lengthLines` in `prompts.ts`). Cutting competed with everything else for the
model's attention, was sized by a rule inside a prompt that already asked for forty other things, and could
not be reviewed on its own: the person saw cuts and additions together, written against a text neither had
yet been applied to.

## Decision

- **Cuts leave the comparison.** `RULE_REMOVALS`, the `removals` output, the "~8 removals" pace and the
  LENGTH TARGET block are gone from `buildMatchPrompt` and `buildSuggestionsPrompt`; `SuggestionsSchema`
  has no `removals`. `PROMPT_VERSION` is 17, so no memo answers a request across the change.
  `MatchSchema.removals` stays, for rows stored before and for `readRemovals`.
- **A stage of three reviewed steps, started by the person from the editor** (`pages/condense-panel.tsx`):
  1. **Find cuts** (`condense-call.ts:findCuts`) reads the comparison's text, the posting and its stored
     keyword verdicts, asks for at most `cutsWanted(plan)` cuts (`cutBudget` over a target, `CUTS_DEFAULT`
     otherwise), runs `gateRemovals` and replaces the row's `removals`. The cards and the apply-all
     checkbox that already read `removals` are unchanged.
  2. **Tighten wording** (`tightenWording`) reads the editor text the form posts — the text the accepted cuts
     left — and asks for shorter replacements. They pass `gateActions` and then `shorterOnly` (a replacement
     that is not strictly shorter than its quote is dropped), and are stored in `ResumeMatch.condense`
     `{ rewrites, from }` as ordinary change cards. The server refuses the step until step one ran
     (`CondenseOrderError`; the route answers with a flash first).
  3. **Refresh suggestions** is the existing suggestions call over the editor text (`suggestForMatch(…,
     text)`), whose actions are then written against that text. The text is kept in `condense.actionsOn`
     so `rewrite.ts` and a later "Rewrite them all" read the same text the actions quote
     (`condense.ts:actionsText`).
- **The furthest step is a marker in the breakdown** (`breakdown.condense`: `removals` | `rewrites`, absent
  = never run), written with the data by the store (`updateMatchCuts`, `updateMatchWords`) in the same
  merge that rereads the row, so a fact confirmed during the call is not undone. Panel state and the order
  rule read it. Reuse needs no further key: the page target was already one, and a row made before this
  change has a lower prompt version.
- **Expanded when over the target, collapsed otherwise.** `condensePanel(plan, stage).open` is true when
  the resume is over its target or a step has something to review; with `keep` or a met target the panel is
  closed but every step stays available.
- **Runs, not requests.** Both calls go through `claimRun` keys `condense-cuts:<id>` / `condense-words:<id>`
  and the progress page (`web/condense-run.ts`), so a second press joins the first. One route,
  `POST /jobs/:id/matches/:matchId/condense/:step` (`cuts` | `words` | `refresh`), personal like the
  suggestions route.
- **Two ledger features**, `resume-condense-cuts` and `resume-condense-words`, both `analysis` tasks.

## Alternatives considered

- **Keep the rules in the main prompt and only raise the cut budget.** What the issue was filed against:
  the model still trades cuts for additions in one answer.
- **Run both phases inside the comparison, unattended.** The wording step depends on which cuts the person
  accepts, so it cannot be computed before they review; and it doubles the cost of every comparison for a
  stage most people skip. Left for the person to start.
- **Store the wording proposals in `actions`.** Their quotes belong to the post-cut text, not
  `resumeText`; mixing them would mis-anchor both lists and make "Rewrite" gate against the wrong text.
- **A separate table for Condense.** One row per comparison with one JSON column was enough; the
  marker and the column both die with the row.

## Consequences

- A comparison no longer carries cuts at all until Condense runs; a row stored before keeps the cuts the
  old request wrote and the panel says so.
- Rows made after "Refresh suggestions" quote the condensed text. Their cards locate it in the editor like
  any other, and an unplaceable one is reported by the editor as today.
- Condense costs two more calls, only when asked for.
- A real-key run on a long resume is the check that the cut budget meets the overshoot (SC-001); the unit
  tests cover the prompts, parsers and gates, not the model.
