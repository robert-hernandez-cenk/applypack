# 0074 — A page target steers the cuts in resume tailoring

**Status:** Accepted (2026-10-14). Issue #38. Builds on [0029](./0029-quick-check-and-lazy-suggestions.md)
(the stored comparison's mode marker), [0037](./0037-suggestions-carry-replacement-text-gated-in-code.md) (what may be applied is decided
in code) and [0022](./0022-prompt-fences-for-untrusted-text.md) (our own instructions sit outside the fence).

## Context

A seasoned candidate's resume runs four pages or more. The tailoring flow (Tailor resume → Compare →
suggestions → editor → Save / Download) had no length control: the removals the model proposed were
capped at about eight and aimed at "reads cleaner", not at a size. Nothing told the person how long the
text in the editor was.

## Decision

- **A page target on the launcher.** *Keep as is* (the default), 1, 2 or 3 pages, posted as `pages` on
  `/target`. Anything else parses to *Keep as is*.
- **The target is a stored marker and part of the memo key.** `breakdown.pages` next to `mode` and
  `evidence`; a row without it is *Keep as is*. A full comparison made for one target never answers a
  request for another; a quick check has no cuts and ignores it. The editor's re-check and re-upload
  inherit the target of the comparison they start from, so applying cuts and re-checking does not drop it.
- **The block is in the user message, in two prompts.** `lengthLines` adds a LENGTH TARGET block — the
  estimated pages, the overshoot in characters, how to choose (least relevant to this posting first, older
  roles to a line or two, the strongest evidence for the must-haves kept) and a removals cap scaled with
  the overshoot (one per ~250 characters, 8 to 30 — the reply schema takes at most 30 removals) — to `buildMatchPrompt` in `full` mode and to
  `buildSuggestionsPrompt`. The full report writes its own removals, so the sketch that named only the
  suggestions call would have missed the normal path. The suggestions call reads the stored marker, so
  "Rewrite all" and the floor's re-ask aim at the same target.
- **No `PROMPT_VERSION` bump.** The system prompts are unchanged and a *Keep as is* prompt is
  byte-identical (`prompts.test.ts`). A bump would have invalidated every stored keyword frame and
  memo for everyone, for a feature most comparisons do not use.
- **The answer budget grows with the cuts, only when a target is set** (`lengthExtraTokens`, 120 tokens
  per removal beyond the default 8). The extra is clamped by `anthropicAnswerRoom` so it never comes out of the thinking headroom (gotcha 16):
  1 000 tokens for the match call, 3 000 for the suggestions call.
- **Safety stays in code.** Every cut still goes through `gateRemovals` (contact details and wanted
  keywords). The block states a size, not a permission. Cuts arrive as the existing strike-through
  suggestions; nothing changes until the person applies them and saves.
- **The estimate is characters over one constant** (`CHARS_PER_PAGE`, 3 500, the figure behind the
  "over the 2-page norm" warning, now defined once in `resume/length.ts`). The editor repaints
  "≈ 3.4 of 2 pages" on every edit from a browser mirror (`public/length.mjs`), held to the server by
  `src/web/length.test.ts`. It is labelled an estimate.

## Alternatives considered

- **A separate "Shorten" action after Compare.** Two AI steps for one intent, and the first pass has
  already spent its removals on "cleaner", not "shorter".
- **A page meter only.** Shows the problem and leaves the choice of cuts to the person.
- **Trimming automatically to the target.** Rejected by the owner: shortening is suggest-and-apply.
- **A `Resume`-level or settings-level length.** The right length depends on the posting and the
  seniority it asks for; it is a property of one comparison.
- **A prompt rule alone.** Gotcha 11: a rule the user can lose data to belongs in code, and the gate is.

## Consequences

- Rows made for a target are never reused for another, so changing the target costs one new analysis; a full request with a target also does not reuse a stored quick check (it re-runs the full analysis rather than only the suggestions call). Teaching the suggestions-only path to stamp the target is a follow-up.
- The estimate can be off by a page for a dense or sparse layout; the meter says so.
- The unattended pack (ADR 0063) never sets a target and is unchanged.

## Non-goals

Automatic trimming; exact page layout; changing fonts or margins to fit; a target on the pack.

## Addendum (2026-10-16, issue #55)

The `/target` launcher this decision put the control on is gone ([0076](./0076-one-tailoring-front-door.md)).
The same select (*Keep as is* / 1 / 2 / 3, posted as `pages`) now sits on the job's Resume match form and
goes to `POST /jobs/:id/match`; the stored marker, the memo key and the editor's re-check are unchanged.
