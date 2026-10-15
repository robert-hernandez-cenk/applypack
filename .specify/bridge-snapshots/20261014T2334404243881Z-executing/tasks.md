---

description: "Task list for the page target for resume tailoring (#38)"
---

# Tasks: Page target for resume tailoring

**Input**: Design documents in `specs/038-resume-length-control/` (plan.md, spec.md, research.md, data-model.md, contracts/length-target.md, quickstart.md)

**Tests**: Requested — TDD per CLAUDE.md "Testing": every pure module and the prompt builders get tests written first.

**Conventions**: all paths relative to the worktree root. Named exports only. Run `npm run lint:types && npm test` before each commit (commit per story/phase, messages end in `(#38, USn)`). `src/pack/` is never edited. The release is a patch bump only.

## Phase 1: Setup

- [ ] T001 Run the baseline once in the worktree (`npm run lint:types && npm test`) and note any pre-existing failure so later failures can be told apart

## Phase 2: Foundational (blocks every story)

**Goal**: the pure `PageTarget` / length model and the marker plumbing. No behaviour change yet.

- [ ] T002 [P] Write `src/resume/length.test.ts` first: `parsePageTarget` ("keep"|"1"|"2"|"3" → value; anything else, `undefined`, `"4"`, `0` → `'keep'`); `readPageTarget(breakdown)` (missing key / non-object / bad value → `'keep'`, `1|2|3` kept); `lengthPlan(text,'keep')` has no budget and `met` true; `lengthPlan(text,2)` with 10 500 chars → pages 3.0, `budgetChars` 7 000, `overshootChars` 3 500; a short text with target 3 → overshoot 0, met; `cutBudget(0)` = default 8, grows with overshoot (one removal per ~600 chars over), capped at 40
- [ ] T003 Implement `src/resume/length.ts` (pure, no I/O): export `CHARS_PER_PAGE = 3_500` (moved out of `parse-warnings.ts`), `PAGE_TARGETS`, `type PageTarget = 'keep' | 1 | 2 | 3`, `parsePageTarget`, `readPageTarget`, `estimatePages`, `lengthPlan`, `cutBudget` with its constants (`CUTS_DEFAULT = 8`, `CHARS_PER_CUT = 600`, `CUTS_MAX = 40`) named at the top; make T002 pass
- [ ] T004 Make `src/resume/parse-warnings.ts` import `CHARS_PER_PAGE` from `./length` (single definition; its `MAX_PAGES` stays); existing `parse-warnings.test.ts` stays green
- [ ] T005 Extend `src/resume/match-mode.ts:storedBreakdown` meta with a required `pages: PageTarget` written to the JSON key `pages`; update its test in `src/resume/match-mode.test.ts` (round trip; old row without key reads `keep`). The compiler then names every `createMatch` call site: update `src/resume/store.ts:createMatch` input (`pages: PageTarget`), `src/resume/match.ts` (passes `opts.pages ?? 'keep'`) and the fixture call in `src/scripts/route-smoke.ts` (`pages: 'keep'`)
- [ ] T006 [P] Extend `src/resume/match-reuse.ts`: `StoredMatch.pages?: PageTarget`, and `reuseDecision` / `pickReusable` take a `pages` argument (default `'keep'`) and return `'none'` when `(previous.pages ?? 'keep') !== pages`; add the cases to `src/resume/match-reuse.test.ts` (keep row vs 2 request → none; 2 vs 2 → reuse; old row without marker answers `keep` only)
- [ ] T007 Thread the target through the memo reads in `src/resume/match.ts:findReusableMatch(…, evidence, pages = 'keep')` (maps `readPageTarget(match.breakdown)` into the stored rows) and add `pages` to `ComparisonRequest` in `src/web/comparison-run.ts`: pass it to `findReusableMatch` (both call sites, lines ~57 and ~95), to `matchResumeToJob({ … pages })`, and into the run key `match:${jobId}:${resume.id}:${mode}:${pages}:…`
- [ ] T008 Check the output budgets with a target set: read `MATCH_MAX_TOKENS` (12 000) and `SUGGESTIONS_MAX_TOKENS` (10 000) in `src/resume/prompts.ts` against a worst case of `CUTS_MAX` (40) removals × ~200-char quotes + `why` (≈ 40 × 120 tokens ≈ 5 k). Decision: if the worst case fits the current budgets, change nothing and record the arithmetic in `research.md` D6; otherwise add a `LENGTH_EXTRA_TOKENS` constant used only when a target is set in `src/resume/match.ts` and `src/resume/suggestions.ts`
- [ ] T009 Commit Phase 2: `Add page target model and stored marker (#38)`

## Phase 3: User Story 1 — Ask for a resume that fits N pages (P1) 🎯 MVP

**Goal**: choosing a page target on the launcher makes the comparison propose cuts toward it.

**Independent Test**: Run `npm test -- src/resume/prompts.test.ts`: `keep` prompts equal the pinned snapshot; target 2 on a 4-page resume yields a prompt with the LENGTH TARGET block; the launcher form posts `pages`.

### Tests first

- [ ] T010 [P] [US1] In `src/resume/length.test.ts` add `lengthLines` cases: `keep` → `[]`; target met → `[]`; target 2 with overshoot 7 000 → lines containing the target, the estimated pages, the overshoot and `cutBudget` (as a number), the ordering instruction (least relevant to this posting first; older roles condensed to a line or two; keep the strongest evidence for the posting's must-haves) and the sentence that this cap overrides the default of about 8 removals; assert the block carries no `===` fence marker (it is our own instruction, outside the fence, ADR 0022)
- [ ] T011 [P] [US1] In `src/resume/prompts.test.ts` add: `buildMatchPrompt(resume, job, 'full', {})` and `buildSuggestionsPrompt(…)` with no `length` are byte-identical to snapshots taken from the current output (FR-008 / SC-003 guard — write the snapshot from `main`'s behaviour BEFORE touching the builders); with `length` set the block appears exactly once; `mode 'fast'` never includes it; `PROMPT_VERSION` is still 16 (D3)

### Implementation

- [ ] T012 [US1] Implement `lengthLines(plan: LengthPlan): string[]` in `src/resume/length.ts` (pure; wording in English — prompts are not translated)
- [ ] T013 [US1] In `src/resume/prompts.ts` add optional `length?: LengthPlan` to `MatchContext` and to `SuggestionsInput`; spread `...lengthLines(…)` into the user message of `buildMatchPrompt` (only when `mode === 'full'`, after `domainLines`) and of `buildSuggestionsPrompt` (after `domainLines`); make T011 pass
- [ ] T014 [US1] In `src/resume/match.ts` build `lengthPlan(resume.text, opts.pages ?? 'keep')` into `context.length`; add `pages?: PageTarget` to the opts doc comment; when the floor re-asks via `suggestForMatch` nothing extra is needed (it reads the stored marker, see T020)
- [ ] T015 [US1] Add `pages` to `TargetFormSchema` in `src/web/routes/target.tsx` (`pages: z.unknown().transform(parsePageTarget)`), pass `pages: f.pages` into both `startComparison` / `runComparison` requests and add `${f.pages}` to the `claimRun` key `target:${resume.id}:${f.mode}:${f.pages}:${hash}`
- [ ] T016 [US1] Check the other Compare paths in `src/web/routes/jobs.tsx` (`startComparison` at ~867 and ~1188): they carry `pages: 'keep'` explicitly (the job page's own Compare has no control in this feature) and the type forces the field; confirm `rebuild`/re-check paths keep `'keep'` and note it in the commit body
- [ ] T017 [US1] Add the Length control to `src/web/pages/target-start.tsx`: a labelled `<select name="pages">` (Keep as is / 1 page / 2 pages / 3 pages, default Keep as is), one-line hint through the `Hint` primitive saying cuts are suggestions you apply, with its own cost-neutral wording; follow the `accessible-interactions` skill (label, no placeholder-as-label); strings via `t()` keys `target.pages.label`, `target.pages.keep`, `target.pages.n` (plural-aware as the catalog does), `target.pages.hint` — added to `src/i18n/catalog/en.json` and the other three catalogs (`es`, `fr`, `uk`) in the same commit
- [ ] T018 [US1] Run `npm run lint:types && npm test`, then commit: `Page target on the Tailor launcher steers the cuts (#38, US1)`; tick T001–T018

**Checkpoint**: US1 is shippable alone — a target reaches the model and the suggestions respond; no meter yet.

## Phase 4: User Story 3 — The choice is remembered with the comparison (P3, done before the editor meter because US2 reads it)

**Goal**: a stored comparison keeps its target for "Rewrite all", the floor re-ask and reopening.

**Independent Test**: build a `ResumeMatch`-shaped object whose `breakdown.pages` is 2; `suggestForMatch` builds a suggestions prompt containing the block; a row without the marker builds one without it.

- [ ] T019 [P] [US3] Write the test first in `src/resume/suggestions.test.ts` (or the nearest pure seam — extract `suggestionsLength(match)` as a tiny pure function in `src/resume/length.ts` if `suggestForMatch` is Prisma-bound, per CLAUDE.md Testing): marker 2 → plan with budget 7 000; no marker → `keep` plan
- [ ] T020 [US3] In `src/resume/suggestions.ts:suggestForMatch` pass `length: lengthPlan(match.resumeText, readPageTarget(match.breakdown))` to `buildSuggestionsPrompt`; same row, same target for "Rewrite all" (route `src/web/routes/jobs.tsx:~888` needs no change — it passes the stored `match`)
- [ ] T021 [US3] Make the stored-target visible where the mode is: add the target to the match meta line in `src/web/pages/resume-match-card.tsx` only when it is not `keep` (`t('target.pages.stored', { n })`, all catalogs); old rows show nothing
- [ ] T022 [US3] `npm run lint:types && npm test`; commit: `Remember the page target on the stored comparison (#38, US3)`; tick T019–T022

## Phase 5: User Story 2 — See how long the resume is while editing (P2)

**Goal**: the editor shows "≈ 3.4 of 2 pages" updating as edits are applied.

**Independent Test**: `npm test -- src/web/length.test.ts` (mirror parity); in the browser, Apply all removals lowers the figure and the met state appears.

- [ ] T023 [P] [US2] Write `src/web/length.test.ts` first, in the style of `score.test.ts` / `evidence.test.ts`: import `public/length.mjs` through `import()`; for a table of texts and targets assert `estimatePages`, `overshootChars` and `isMet` equal `src/resume/length.ts`; assert the constants are equal (`CHARS_PER_PAGE`)
- [ ] T024 [US2] Create `src/web/public/length.mjs` as a line-for-line mirror of the pure functions the page needs (`CHARS_PER_PAGE`, `estimatePages`, `overshootChars`, `isMet`, `formatMeter(pages, target)` returning the numbers, not words — words come from `t()`); header comment names `src/resume/length.ts` as its twin like `score.mjs` does
- [ ] T025 [US2] Add the meter to `src/web/pages/target.tsx`: an element (`id="length-meter"`, `aria-live="polite"` via the existing live-region pattern next to `#score-live`) near the score ring, and embed `pageTarget` (1–3 or null) and `charsPerPage` in the page data the editor already reads; server renders the initial value from the resume text with `estimatePages`
- [ ] T026 [US2] In `src/web/public/target-page.mjs` import `./length.mjs` and, in the same place the live score is recomputed after each edit/apply/undo (around the `scoreLive` block, lines ~188–274), set the meter text via `t('browser.length.of', …)` / `t('browser.length.plain', …)` and toggle the met state; strings go in `src/i18n/catalog/en.json` as `browser.length.*` and the other catalogs, then run `npm run i18n:browser` (regenerates `public/i18n-en.mjs` and the demo copy)
- [ ] T027 [US2] Label it approximate in the visible text and `title` (`≈`, "estimate"), never "exact"; follow `ui-review`/`accessible-interactions` (contrast, not colour alone for met/over)
- [ ] T028 [US2] `npm run lint:types && npm test`; commit: `Live page estimate in the tailoring editor (#38, US2)`; tick T023–T028

## Phase 6: Polish and cross-cutting

- [ ] T029 [P] Add the docs rows to `docs/where-to-look.md` (where the page target lives: `length.ts`, `length.mjs`, launcher control, marker; how the user sets it) and keep `src/docs-paths.test.ts` green
- [ ] T030 [P] Write `docs/adr/0073-page-target-for-tailoring.md` (context: veteran resumes of 4+ pages; decision: target as marker + user-message block, suggest-and-apply, estimate character-based, no `PROMPT_VERSION` bump and why; consequences; non-goals) using the `adr-writer` skill's template, and add its line to `docs/adr/README.md`
- [ ] T031 [P] Add a section to `docs/TASKS.md` for this feature (facts, decisions, order; items ticked as shipped) following its existing convention
- [ ] T032 Add a CHANGELOG entry and bump the version as a PATCH release only (see `release-discipline` skill and the patch-only feedback memory): `package.json` / lockfile version per repo practice; do NOT tag or release before merge
- [ ] T033 `npm run lint:types && npm test && npm run exports:audit` and `src/env-example.test.ts` (no env change expected); fix any dead export (e.g. a helper only the test uses)
- [ ] T034 Run `quickstart.md` §1–§2 and paste the real output; run §3 route smoke only on a throwaway database (`npm run build && npm run smoke:routes`) — if no throwaway database is available, list it as unverified
- [ ] T035 Browser check per quickstart §4 at desktop and 375 px widths (launcher control, meter, Apply all lowering the figure) with a screenshot; if no AI engine/resume is available, verify the launcher and meter on a seeded comparison and list SC-001 as unverified
- [ ] T036 Commit docs and release note: `Document the page target, ADR 0073 (#38)`; tick T029–T036

## Dependencies and order

- Phase 2 blocks all stories. US1 → US3 (needs the marker read) → US2 (needs the target embedded in the page; also reads the stored marker). US2 only needs Phase 2 plus T015 for a target to exist, but ordering US3 first keeps the stored-marker read in one place.
- Parallel: T002 ‖ T006; T010 ‖ T011; T019 ‖ T023; T029 ‖ T030 ‖ T031.

## Implementation strategy

MVP is Phase 2 + US1 (the model is told and the user can choose). US3 then makes it durable; US2 closes the loop with the meter. Commit per phase; push after each commit.
