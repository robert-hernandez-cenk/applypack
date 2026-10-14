# Tasks: Jobs by source panel on the Overview

**Input**: `specs/029-jobs-by-source/` — plan.md, spec.md, research.md, quickstart.md

**Tests**: Requested (TDD per the plan): the pure `topSources` is tested first. The card is covered by the route smoke and a browser check.

**Format**: `[ID] [P?] [Story] Description` — repo root is the worktree `C:\Users\rcher\Dev\applypack-Worktrees\issue-29-jobs-by-source`.

## Phase 1: Setup

- [ ] T001 Confirm the baseline: `npm run lint:types` and `npm test` pass on the untouched branch (typecheck already verified clean at worktree creation)

## Phase 2: Foundational

None — no schema, no new dependency, no shared plumbing beyond what User Story 1 adds.

---

## Phase 3: User Story 1 - See which sources produce my matches (Priority: P1) 🎯 MVP

**Goal**: a "Jobs by source" card under "Jobs by stack" with the last 30 days' matches grouped by source, vendor boards merged.

**Independent Test**: matches from Gmail, two vendor boards and an aggregator → the card shows "Company boards" (sum of the two), "Gmail", the aggregator, counts adding up to the footer's total; none in the window → no card.

### Tests first

- [ ] T002 [US1] In `src/web/overview-numbers.test.ts` add `topSources` tests that FAIL first: vendors (`GREENHOUSE`, `LEVER`) merge into `COMPANY_BOARDS` with the summed count; non-vendors (`GMAIL`, `REMOTEOK`, `FOLDER`, `MANUAL`) stay separate; sorted by count desc, ties by `source` asc (stable); cut to `max`; `share` is 0–100 against the largest (largest = 100, rounded); empty input → `[]`; an unknown `atsType` is kept as its own entry, never dropped

### Implementation

- [ ] T003 [US1] In `src/web/overview-numbers.ts` add `export const COMPANY_BOARDS`, `export interface SourceCount { source: string; count: number; share: number }` and `export function topSources(rows: readonly { atsType: string }[], max: number): SourceCount[]` — uses `sourceFamily(atsType) === 'vendor'` from `./source-groups`; same sort/share rule as `topTerms`; make T002 pass
- [ ] T004 [US1] In `src/web/overview-stats.ts` add `const SOURCE_BARS = 8`; extend the `matchRows` `userJob.select` to `job: { select: { fetchedAt: true, company: { select: { atsType: true } } } }` and carry `atsType` through the `.then` map; add `sources: { entries: SourceCount[]; matches: number }` to `OverviewStats` filled with `topSources(matchRows, SOURCE_BARS)` and `matchRows.length`; leave `options`, the chart series and `activity` untouched
- [ ] T005 [P] [US1] Add four keys to `src/i18n/catalog/en.json` next to `overview.jobsByStack`: `overview.jobsBySource` ("Jobs by source"), `overview.theSourcesBehindTheMatches` (info: where the last 30 days' matches came from; company career platforms are counted together; a job counts once), `overview.source.companyBoards` ("Company boards"), `overview.source.outOf` (`Out of {n, plural, one {# match} other {# matches}} in the last 30 days.`)
- [ ] T006 [P] [US1] Add the same four keys, translated, to `src/i18n/catalog/es.json`, `fr.json` and `uk.json` (same position, `catalog.test.ts` requires all four)
- [ ] T007 [US1] In `src/web/pages/overview.tsx` add the card straight after the "Jobs by stack" card, in the same column: `{stats.sources.entries.length > 0 && <Card>…}` with `CardHeader` (`overview.jobsBySource`, `info`, the existing `overview.n30Days` chip), a `<ul class="space-y-2.5">` of rows copied from the stack card's markup WITHOUT the `<a>` (label span, `aria-hidden` bar with `Math.max(3, share)` width, right-aligned `formatNumber(count)`), and the footer `<p data-ui="hint" …>` with `overview.source.outOf` and `stats.sources.matches`; label = `overview.source.companyBoards` for `COMPANY_BOARDS`, else `sourceLabel(source)` from `../source-names`

**Checkpoint**: `npm run lint:types && npm test` green; the card renders on a seeded install.

---

## Phase 4: User Story 2 - The panel reads like its neighbour (Priority: P2)

**Goal**: names behave correctly across languages and the card matches the stack card's look and the repo's docs.

**Independent Test**: in each of the four languages the title, info, "Company boards" and footer are worded; "Greenhouse"/"RemoteOK" stay as written; no bar navigates.

- [ ] T008 [US2] In `src/web/pages/overview.tsx` set `translate="no"` on a row's label span only when the entry is not worded: `source !== COMPANY_BOARDS && !wordedSource(source)` (`wordedSource` from `../source-groups`) — Gmail, Folder, Import, Manual, Feed and Careers page follow the language, vendor and aggregator names do not
- [ ] T009 [P] [US2] Update `docs/where-to-look.md`: extend the Overview row that says "See how many jobs match over time, and what the matches ask for" to mention **Jobs by source** (grouped by source kind, vendor boards merged; `overview-numbers.ts:topSources`), and add `topSources` beside `topTerms` wherever the file names the Overview's stack list
- [ ] T010 [US2] Run `npm run i18n:browser` only if the English catalog change requires the generated browser copy (it should not: no `browser.*` key was added) and confirm `git status` shows no generated-file drift

**Checkpoint**: both stories work; docs match.

---

## Phase 5: Polish & verification

- [ ] T011 Run `npm run lint:types && npm test` and `npm run exports:audit` (no dead or over-exported export: `COMPANY_BOARDS`, `SourceCount`, `topSources` are all used) — paste the output
- [ ] T012 Run `npm run build` then `npm run smoke:routes` on a THROWAWAY database (CLAUDE.md: it inserts rows) — the Overview and its pseudo-language pass must stay green; if no throwaway database is available, say so and list it as unverified
- [ ] T013 Browser check per `quickstart.md`: desktop and 375 px, English plus one other language, no matches → no card; run on a scratch `APPLYPACK_DATA_DIR`, never the live folder; no horizontal scroll at 375 px
- [ ] T014 Review the diff (`git diff main...HEAD`): every line earns its place, no duplicated markup that should be shared with the stack card unless it is genuinely simpler

---

## Dependencies & Execution Order

- T001 → T002 → T003 (test first, then make it pass) → T004 → T007; T005 and T006 are independent of T002–T004 but T007 needs the keys, and `catalog.test.ts` needs both T005 and T006 together.
- T008 follows T007 (same file, same markup). T009 is independent.
- Phase 5 follows both stories.

### Parallel Opportunities

- T005 and T006 (different files); T009 alongside T008.

## Implementation Strategy

MVP = User Story 1 (the card with correct numbers and words). User Story 2 is the label/language polish and docs; both ship in the one PR. Commit per story (`... (#29, US1)`), then verification, then review. The release (version bump, changelog, tag v2.59.2) is a separate PR after the merge.
