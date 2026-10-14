# Research: Page target for resume tailoring (#38)

Seams were read in the code before planning. Two differ from the first sketch; both are recorded here.

## Decisions

### D1. The target is a stored marker, like `evidence` (not a new column)
- **Decision**: `pages` rides in the `ResumeMatch.breakdown` JSON beside `mode` / `evidence` (`match-mode.ts:storedBreakdown`). Readers default to `keep` for a row without it (FR-003).
- **Rationale**: `mode`, `verificationId` and `evidence` already work this way; no migration, and `suggestForMatch` (which has only the stored `match`) can read it back for "Rewrite all" and for the floor's re-ask.
- **Alternatives**: a Prisma column (migration for a per-run option, rejected); keeping it only in the run (lost on later suggestion requests, rejected).

### D2. The target is part of the memo key
- **Decision**: `match-reuse.ts:reuseDecision` / `pickReusable` take the requested target and compare it with the stored marker, as they do for `evidence`; the run key in `routes/target.tsx` and `comparison-run.ts` gains the target.
- **Rationale**: the same text compared at 2 pages and at keep must not answer for each other (FR-002).
- **Alternative**: one stored row regardless of target — would show the wrong cuts.

### D3. No `PROMPT_VERSION` bump (differs from the sketch)
- **Decision**: the LENGTH TARGET block goes in the **user** message and only when a target is set. The system prompts are untouched, so `keep` prompts are byte-identical to today and `PROMPT_VERSION` (16) stays.
- **Rationale**: bumping it would invalidate every stored keyword frame and memo for every user (`planKeywordFrame`, `reuseDecision`), costing a re-run of everything for a feature most comparisons do not use. A guard test pins that the `keep` prompt text is unchanged (FR-008, SC-003).
- **Risk**: the system prompt still says "~8 removals" (`PACE_SUGGESTIONS`). The user block states that, with a target, the length rule overrides that cap; covered by a prompt test and by manual verification in quickstart.

### D4. The block goes into BOTH prompts that write removals (differs from the sketch)
- **Decision**: `buildMatchPrompt` in `full` mode (every Compare button posts `full`, so this is the normal path) and `buildSuggestionsPrompt` (lazy second half, "Rewrite all", and the floor's re-ask) both take an optional `length` input and render the same block via one `lengthLines()` helper.
- **Rationale**: the sketch named only the suggestions prompt, but `matchResumeToJob(mode: 'full')` writes the removals in its own call. `suggestForMatch` reads the target from the stored row, so a rewrite stays consistent (US3).
- `fast` mode writes no removals and ignores the target.

### D5. Estimate = existing constant, one definition
- **Decision**: `src/resume/length.ts` owns `CHARS_PER_PAGE = 3_500`; `parse-warnings.ts` imports it (no second definition). `estimatePages(text) = text.length / CHARS_PER_PAGE`, shown to one decimal. The browser mirror `src/web/public/length.mjs` follows the `score.mjs` / `evidence.mjs` pattern with a parity test.
- **Rationale**: spec FR-010; the existing "over the 2-page US norm" warning already uses the same figure, so the two never disagree.

### D6. Cut-cap scaling
- **Decision**: `cutBudget(overshootChars)` — roughly one removal per ~600 chars over, floored at the default 8 and capped at 40 — passed to the model as a number in the block. The caps are code constants; `gateRemovals` is unchanged.
- **Output budget**: more removals mean more output. `SUGGESTIONS_MAX_TOKENS` is 10 000 and `MATCH_MAX_TOKENS` must be checked in implementation; if the cap needs to rise with a target it rises only when a target is set (task T008).

### D7. Pack is untouched
- `src/pack/prepare.ts` calls the comparison without a target, so the marker is `keep` and nothing changes (FR-011). `matchResumeToJob`'s new option is optional with default `keep`.

## Open items
None blocking.
