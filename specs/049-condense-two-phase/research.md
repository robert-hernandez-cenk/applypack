# Research: Condense two-phase stage

## Decisions

1. **Cuts stay in `resume_match.removals`.** Decision: Phase A writes the existing column; the change sheet, removal cards and apply-all already read it. Alternative (a new column) rejected: two sources for the same card.
2. **Wording proposals get their own JSON column `condense`.** Their quotes are against the post-cut text, not `resume_match.resume_text`, so mixing them into `actions` would mis-anchor them. Shape: `{ rewrites: MatchAction[], from: string }`.
3. **Marker in `breakdown.condense`** (`'removals' | 'rewrites'`), read by `condense.ts`, written with the same JSON merge as `withSuggestionsMode`. Panel state and the "Phase B needs Phase A" rule read it. The reuse memo already keys on `PROMPT_VERSION` (bumped to 17) and the page target, so a reused row never carries cuts made by the old combined request as if they were Condense's.
4. **Reply shapes.** Phase A reply `{removals}` reuses the removal element of `MatchSchema`. Phase B reply `{rewrites}` reuses the action element fields (section, where, what, why, quote, replacement); the stored action gets `priority: 'medium'` and `insert_after: null`, so `gateActions` and the editor's change cards apply unchanged.
5. **Shorter-only gate** is pure in `condense.ts`: a rewrite whose replacement is not strictly shorter than its quote loses its replacement (kept as advice), like the other gates.
6. **Budget.** `lengthPlan(text, target)`; cuts asked for = `cutBudget(overshoot)` when over target, `CUTS_DEFAULT` on demand. Extra answer tokens use `lengthExtraTokens`, which moves from the main calls to the cuts call.
7. **Suggestions text override.** `suggestForMatch(userId, match, job, onError, owed, text?)`: when `text` is given the prompt and the gates use it instead of `match.resumeText`. The stored `removals` are passed through untouched; the reply no longer has a removals field.
8. **Floor.** `suggestion-floor.ts` reads actions only; removals leaving the reply does not affect it. The "~8 removals" pace text goes with the rule.
9. **Runs.** Add `'condense'` to `RunStep`; claim keys `condense-cuts:<matchId>` and `condense-words:<matchId>`; result URL back to the editor.
10. **Auto-start.** Not done: each phase is started by the person, so review sits between phases.
11. **Ledger labels** `resume-condense-cuts` / `resume-condense-words` in `AI_FEATURES`, `ai-spend.ts` names, `ai-tasks.ts` role `analysis`.

## Unknowns

None open.
