---

description: "Task list for the two-phase condense stage (#49)"
---

# Tasks: Condense as its own two-phase stage

**Input**: `specs/049-condense-two-phase/` — plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: TDD on the pure module (`resume/condense.ts`) and the changed prompt guards; Prisma/AI/route code is verified by `lint:types`, the route smoke and `prisma migrate diff` (CLAUDE.md).

**Format**: `- [ ] T### [P?] [US?] description with path`. Paths are relative to the worktree root.

## Phase 1: Setup

- [x] T001 Hand-write `prisma/migrations/20261016150000_match_condense/migration.sql`: `ALTER TABLE "resume_match" ADD COLUMN "condense" JSONB NOT NULL DEFAULT '{}';`
- [x] T002 Add `condense Json @default("{}")` to `model ResumeMatch` in `prisma/schema.prisma` (comment: wording proposals + the text they were written against, ADR 0078); run `npx prisma generate`; confirm `prisma migrate diff` (migrations → schema) is empty
- [x] T003 [P] Register the labels `resume-condense-cuts` and `resume-condense-words` in `AI_FEATURES` in `src/ai-usage.ts`, `src/ai-spend.ts` (name keys `spend.feature.resumeCondenseCuts` / `…Words`, added to every catalog), `src/ai-tasks.ts` (role `analysis`) and the feature list in `src/ai-tasks.test.ts`

## Phase 2: Foundational (blocks all stories)

- [x] T004 [P] Write failing tests in `src/resume/condense.test.ts`: marker read/write (`readCondenseStage` absent → `none`, `'removals'`, `'rewrites'`; `withCondenseStage` merges without touching other breakdown keys), `shorterOnly` (a rewrite whose replacement is not strictly shorter than its quote loses its replacement and keeps its advice), `condensePanel(plan, stage)` (open when over target, collapsed when `met` or `keep`), reply parsers (`parseCutsResponse` accepts `{removals}` up to `CUTS_MAX`, `parseWordsResponse` accepts `{rewrites}`), and the moved rule guard (removals rules protect the contact line and wanted keywords)
- [x] T005 Implement `src/resume/condense.ts` (pure, no I/O): `CUTS_RULES` (the old `RULE_REMOVALS` text, moved here), cuts schema (`{removals}` from the `MatchSchema` removal element, max 30), words schema (`{rewrites}`: section, where, what, why, quote, replacement; max 40), `buildRemovalsPrompt` / `buildCondensePrompt` (every outside text through `fence()`; keyword verdicts fenced; the length block as our own instruction outside the fence), parsers, `shorterOnly`, stage marker helpers, `condensePanel`. Export the removal element schema and `postingBlock`/`clip`/`RENDERING_NOTE`/`untrustedDirective` from `src/resume/prompts.ts` as needed, until T004 passes
- [x] T006 Add store functions to `src/resume/store.ts`: `updateMatchCuts(id, removals)` (replaces `removals`, resets `condense` to `{}`, sets the stage marker `removals`), `updateMatchWords(id, rewrites, from)` (stores `condense = { rewrites, from }`, marker `rewrites`); `readCondense(row.condense)` parser lives in `condense.ts`
- [x] T007 Add `'condense'` to `RunStep` in `src/web/target-runs.ts` and its label/step copy in `src/web/pages/run-steps.tsx` and `src/i18n/catalog/*.json`

**Checkpoint**: `npm run lint:types` and `npm test` green.

## Phase 3: User Story 1 — Find cuts (P1) 🎯 MVP

**Independent test**: on a comparison over a 1-page target, press Find cuts → removal cards appear (gated), stored on the row, marker `removals`; a new full comparison stores no removals.

- [x] T008 [US1] Update the guards in `src/resume/prompts.test.ts` first (failing): the main full prompt, the quick prompt and the suggestions prompt contain neither `"removals"` nor `LENGTH TARGET`; `MatchSchema` still parses a legacy reply with removals; `SuggestionsSchema` has no removals; remove/move the two removal-rule tests and the `CUTS_MAX` suggestions parse test to `condense.test.ts`
- [x] T009 [US1] In `src/resume/prompts.ts` remove `RULE_REMOVALS` from `MATCH_STEPS.full` and `SUGGEST_SYSTEM`, `OUTPUT_REMOVALS` from both outputs, the "~8 removals" pace text, the `lengthLines` calls in `buildMatchPrompt`/`buildSuggestionsPrompt` and `length` from `MatchContext`/`SuggestionsInput`; drop `removals` from `SuggestionsSchema`; bump `PROMPT_VERSION` 16 → 17 (comment why)
- [x] T010 [US1] In `src/resume/match.ts` and `src/resume/suggestions.ts` remove `lengthPlan`/`lengthExtraTokens`/`length` from the main calls, stop gating/storing reply removals (`removals: []` on create; suggestions keep `match.removals`), keep `pages` stored on the row for Condense; fix `isEmpty` to ignore removals; adjust `updateMatchSuggestions` in `src/resume/store.ts` so it no longer writes `removals`; update `src/resume/length.ts` (`lengthLines` now takes only what `buildRemovalsPrompt` needs) and `length.test.ts`
- [x] T011 [US1] Implement `src/resume/condense-call.ts` `findCuts(userId, match, job, onError)`: stored keyword verdicts (`readKeywords`), facts per `readMatchEvidence`, `lengthPlan(match.resumeText, readPageTarget(match.breakdown))`, `cutBudget` / `CUTS_DEFAULT`, `askForJson` with label `resume-condense-cuts`, `maxTokens` = base + `lengthExtraTokens`, `gateRemovals`, then `updateMatchCuts`; returns the row or null
- [x] T012 [US1] Implement `src/web/condense-run.ts` `startCondenseRun(kind, …)` modelled on `src/web/suggestions-run.ts` (claim keys `condense-cuts:<id>` / `condense-words:<id>`, step `condense`, result URL back to the editor) and the route `POST /jobs/:id/matches/:matchId/condense/cuts` in `src/web/routes/jobs.tsx` per `contracts/routes.md`
- [x] T013 [US1] Create `src/web/pages/condense-panel.tsx` (heading, how far over the target in pages, Find cuts button, collapsed `<details>` when `condensePanel` says so, the empty state when a run produced no cuts, a one-line note for a row whose cuts predate Condense) and mount it above the suggestions in `src/web/pages/target.tsx`; every string a new `condense.*` key in all catalogs (`en`, `es`, `fr`, `uk`), data-ui hint hooks where prose is raw
- [x] T014 [US1] Add the new route and panel to `src/scripts/route-smoke.ts` (the editor renders the panel; the cuts POST redirects to a run)

**Checkpoint**: US1 independently works; `lint:types`, `test`, i18n catalog tests green.

## Phase 4: User Story 2 — Tighten wording (P1)

**Independent test**: after cuts, Tighten wording with the editor text → change cards whose replacement is shorter; refused before Find cuts.

- [x] T015 [US2] Extend `src/resume/condense.test.ts` (failing first): `buildCondensePrompt` fences the resume, posting and keyword verdicts and states the shorter-only rule; rewrite-to-action mapping (`priority: 'medium'`, `insert_after: null`); `readCondense` tolerates `{}` and garbage
- [x] T016 [US2] Implement `condenseWords(userId, match, job, text, onError)` in `src/resume/condense-call.ts`: refuse (throw typed `CondenseOrderError`) when the stage marker is `none`; label `resume-condense-words`; map rewrites to actions; `gateActions` then `shorterOnly`; `updateMatchWords(match.id, kept, text)`
- [x] T017 [US2] Route `POST …/condense/words` in `src/web/routes/jobs.tsx` (requires non-empty `text`, flash-redirect with the "run Find cuts first" message on `CondenseOrderError`/missing marker) and the Tighten wording form in the panel (visible after cuts; a hidden `text` field the client fills with the editor text on submit)
- [x] T018 [US2] In `src/web/public/target-page.mjs` fill the condense forms' `text` field from the editor on submit; in `src/web/pages/target.tsx` pass `condense.rewrites` to the page as extra change cards (under their own sub-heading) and into the data blob so spans highlight; i18n keys for the sub-heading and messages
- [x] T019 [US2] Add a `src/web/*.test.ts` case if a pure helper was added to the client module; route-smoke step for the refusal before cuts

**Checkpoint**: US2 works on top of US1.

## Phase 5: User Story 3 — Refresh suggestions on the condensed text (P2)

**Independent test**: with cuts applied, Refresh suggestions → new cards quote lines of the condensed text and the stored cuts are unchanged.

- [x] T020 [US3] Add the optional `text` argument to `suggestForMatch` (`src/resume/suggestions.ts`): prompt, gates, applied-wording and `rewriteRefusedLeads` read it instead of `match.resumeText`; stored removals untouched
- [x] T021 [US3] Route `POST …/condense/refresh` in `src/web/routes/jobs.tsx` reusing `startSuggestionsRun` with the posted text (refused with a flash on a quick check) and the Refresh suggestions button in the panel with i18n keys

## Phase 6: Polish & cross-cutting

- [x] T022 Update `src/prompt-fence-registry.test.ts`: add `resume/condense.ts` to `PROMPT_MODULES`, `resume/condense-call.ts` to `KNOWN_CALL_SITES`, and a CASE for each new builder
- [x] T023 [P] Write `docs/adr/0078-condense-two-phase.md` via the adr-writer template (decisions in research.md; supersedes the removals parts of ADR 0029/0074 where they conflict); update `docs/where-to-look.md`, `CLAUDE.md` (resume module list + the new file rule), `SPEC.md`, `ARCHITECTURE.md`, `CHANGELOG.md` and bump the patch version in `package.json` per the repo's release rules
- [x] T024 Run `npm run lint:types && npm test && npm run exports:audit`; fix dead exports
- [x] T025 Verified per `quickstart.md`: migration applied by `npm start` on a scratch data folder, route smoke green (exit 0, pseudo-language pass clean), dashboard screenshot of the panel (desktop; collapsed and open). NOT done: the real-key run on a long resume and the phone-width screenshot (no key in this session) — listed as unverified in the PR
- [ ] T026 Mark tasks complete and commit; review `git diff main...HEAD` with the `code-review` skill (Stage 9)

## Dependencies

Setup → Foundational → US1 → US2 → US3 → Polish. US2 needs the stage marker and panel from US1; US3 needs only the panel. T003, T004 and T023 are the parallel-safe tasks.

## Implementation strategy

MVP is US1 (Find cuts end to end plus the prompt strip). Commit per user story and push after each.
