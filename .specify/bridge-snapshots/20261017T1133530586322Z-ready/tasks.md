---

description: "Tasks for keyword edits that keep the page in place (#53)"
---

# Tasks: Keyword edits that keep your place

**Input**: `specs/053-tailor-edits-no-reload/` (spec.md, plan.md, research.md, data-model.md, contracts/inline-regions.md, quickstart.md)

**Tests**: TDD for the pure helpers of `inline-post.mjs` (unit tests next to the source in `src/web/`), the route smoke for the markup. DOM glue is verified in a real browser (T020). Env for unit tests: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy`. All paths relative to the worktree.

## Phase 1: Setup

- [ ] T001 Baseline: `npm run lint:types` and `npm test` pass before any change (already green on `origin/main`: 4114 pass, 0 fail)

## Phase 2: Foundational — the module and the shared pieces (blocks every story)

- [ ] T002 Write failing tests in `src/web/inline-post.test.ts` (import `./public/inline-post.mjs`): `planSwap(currentIds, incomingIds, currentPath, finalPath)` returns `{ kind: 'swap', ids }` when paths are equal and every current id is in the incoming set (ids not in the current set are ignored), and `{ kind: 'navigate' }` when the paths differ or a current id is missing from the incoming set; `focusKey({ action, term, name })` and `pickFocus(candidates, key)` over plain objects `{ action, term, name, index }`: exact match wins, else the first candidate of the same `action`+`term`, else the Add field (empty `term`, `name` = `term`), else `null`; `formBody(entries)` builds the urlencoded string from `[name, value]` pairs preserving order and repeated names; `createQueue()` runs jobs one at a time in submit order and keeps going after a job throws; `foldStates(list)`/`applyFolds(list, states)` over `[{ fold, open }]` carry the open state by `data-fold` name
- [ ] T003 Create `src/web/public/inline-post.mjs` with the pure exports from T002 and `wireInlinePosts(root)`: on `submit` of `form[data-inline]`, with `fetch`/`DOMParser` present, `preventDefault`, snapshot `action` and body (the submitter included) and queue the post; a form already in flight ignores another submit; sets `aria-busy` and `style.opacity` while in flight; posts `application/x-www-form-urlencoded` with `credentials: 'same-origin'`; parses the final HTML with `DOMParser`; `planSwap`; replaces each `[data-region]` by `document.importNode` of the incoming one and carries `details[data-fold]` open state; re-runs `wireSelectCommits` on replaced regions; restores focus through `focusKey`/`pickFocus` (never leaves it on `body`); dispatches `inline:swapped` with `{ doc }`; `navigate` → `location.assign(response.url)`; a thrown `fetch` or non-OK final status writes `t('browser.inline.failed')` into `#flash-slot` as an error banner (DOM calls, `textContent`) and clears busy state. Header comment in the style of `select-commit.mjs`. T002 passes
- [ ] T004 [P] Catalog: add `browser.inline.failed` ("Your change was not saved. Check the connection and try again.") to `src/i18n/catalog/{en,es,fr,uk}.json`, then `npm run i18n:browser` to regenerate `src/web/public/i18n-en.mjs`; `src/i18n/catalog.test.ts` and `src/web/i18n-browser.test.ts` pass
- [ ] T005 [P] `src/web/ui.tsx` `Flash`: always render `<div id="flash-slot" data-region class="empty:hidden">` around the banner (empty when there is no flash); keep the banner markup and the `children` slot unchanged

**Checkpoint**: the module exists, tested, nothing wired yet; every page still renders as before.

## Phase 3: User Story 1 — Correct keywords without losing my place (P1)

**Goal**: on both pages a keyword edit updates the list, score, message and leaves scroll and focus alone.

**Independent test**: scroll the keyword list, change a level: row, score and message update; `scrollY` and focus unchanged.

- [ ] T006 [US1] `src/web/pages/resume-match-card.tsx`: `data-inline` on the form in `LevelControls` and in `AddKeywordForm`; `id="keyword-table" data-region` on the `KeywordTable` root `div`; `data-fold="matched"` / `data-fold="ignored"` on its two `details`
- [ ] T007 [US1] `src/web/pages/resume-match-card.tsx` match tab (`MatchResult`): wrap the `FitBadge` and the delta `Badge` in `<div id="match-score" data-region class="contents">`; wrap `ScoreBreakdownChips` and `DeltaBox` in `<div id="match-breakdown" data-region class="space-y-5 empty:hidden">`
- [ ] T008 [US1] `src/web/pages/target.tsx`: wrap `MainAdviceLine` and `ScoreCeilingLine` in `<div id="score-advice" data-region class="space-y-1.5 empty:hidden">`; wrap the ready-to-apply `<p>` in `<div id="score-ready" data-region class="empty:hidden">`; wrap the `DeltaBox` in `<div id="delta-box" data-region class="empty:hidden">`; wrap the fold summary text in `<span id="kw-fold-count" data-region>`. Leave the ring, `#length-meter`, `#length-live`, the editor and the sticky bar alone (`target-page.mjs` holds references to them)
- [ ] T009 [US1] Boot scripts: add `import { wireInlinePosts } from '/static/inline-post.mjs'; wireInlinePosts(document);` to the `TARGET_BOOT` string in `src/web/pages/target.tsx` and to the script in `src/web/pages/job-detail.tsx` (next to `wireSelectCommits(document)`)
- [ ] T010 [US1] Extend `src/scripts/route-smoke.ts` (where it already fetches the match tab and the tailor page): assert the HTML carries `id="flash-slot"`, `id="keyword-table"`, `data-inline` on the keyword forms, and the regions of T007/T008; assert a keyword POST still answers 303 and the followed page carries the message (FR-008: server unchanged)

**Checkpoint**: US1 works on both pages in a browser (drafts on the tailor page are handled in US2).

## Phase 4: User Story 2 — The tailor page keeps my draft and stays live (P1)

**Goal**: a keyword edit never touches the resume text; ring, highlights and chips follow the new levels.

**Independent test**: type in the editor, change a keyword level: text and unsaved bar survive; ring/chips/highlights match.

- [ ] T011 [US2] Write failing test in `src/web/target-page.test.ts` (extend if it exists, else create): `readData(doc)` returns the parsed JSON of `#target-data` from a fake `doc` (`getElementById(...).textContent`) and `null` when absent
- [ ] T012 [US2] `src/web/public/target-page.mjs`: export `readData(doc)`; make `init(data)` return `{ refresh(fresh) }` that does `Object.assign(data, fresh)` then `render()` and does nothing when `fresh` is null (the file's existing reads of `data` are live; do not cache any); T011 passes
- [ ] T013 [US2] `src/web/pages/target.tsx` `TARGET_BOOT`: keep the `init(...)` return, `document.addEventListener('inline:swapped', (e) => page.refresh(readData(e.detail.doc)))`; ensure the order is init first, then `wireInlinePosts`

**Checkpoint**: US2 verified in a browser with unsaved text.

## Phase 5: User Story 3 — Works without scripts, fails honestly (P2)

**Goal**: no-JS path unchanged; a failed post says so; a foreign answer navigates.

**Independent test**: scripts off → normal post; server stopped → error line; session-ended answer → navigates.

- [ ] T014 [US3] Review `inline-post.mjs` against FR-008–FR-010: a form without `data-inline` or a browser without `fetch` is never intercepted; the error banner uses the same classes as `Flash`'s error tone and a `role="status"`/live region so it is announced; busy state is always cleared (`finally`). Add tests to `src/web/inline-post.test.ts` for the queue continuing after a failed job and for `planSwap` navigating on a login-page answer (different path)

## Phase 6: Polish & cross-cutting

- [ ] T015 [P] ADR `docs/adr/0081-inline-keyword-edits.md` via the `adr-writer` skill (context: reload per edit; decision: opt-in `data-inline`, follow the redirect, region swap by id, `refresh()` on the tailor page; alternatives: fragment endpoint, `<main>` swap; consequences: stale-until-reload confirm lists, one extra render) and its line in `docs/adr/README.md`
- [ ] T016 [P] `ARCHITECTURE.md` file map: add `inline-post.mjs` beside `select-commit.mjs`; note `refresh()` where `target-page.mjs` is described
- [ ] T017 [P] `CHANGELOG.md` `## [2.59.16]` **Fixed** entry (#53, ADR 0081) and `package.json` / `package-lock.json` version `2.59.16` (patch only)
- [ ] T018 Full checks: `npm run lint:types`, `npm test` (env above), `npm run exports:audit`, `npm run i18n:browser` leaves no diff
- [ ] T019 Route smoke on a scratch database per the local verification recipe (built-in database, `npm run build`, `migrate deploy`, `smoke:routes`); the two known local-machine pseudo-language failures are not this change
- [ ] T020 Browser verification with Playwright against a scratch install at 1280 and 390 wide, following `quickstart.md`: scroll and focus preserved for level/ignore/restore/reset/remove/add, a refused add, unsaved editor text preserved with live ring, server-down error line, scripts-off normal post; record `scrollY` before/after
- [ ] T021 Mark the verification tasks complete in this file and list anything unverified for the PR body

## Dependencies

T001 → T002 → T003. T004 and T005 are parallel with T002/T003. US1 (T006–T010) needs T003–T005. US2 (T011–T013) needs T009 and T006. US3 (T014) needs T003. Polish needs everything it documents.

## Implementation strategy

MVP = Phases 2–3 (match tab edits stay in place). US2 follows because the tailor page is the issue's own page; US3 is the hardening pass.
