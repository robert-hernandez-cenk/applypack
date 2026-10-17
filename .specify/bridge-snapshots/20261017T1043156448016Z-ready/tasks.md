---

description: "Tasks for Consider, Applying, Expired and the No Offer column (#52)"
---

# Tasks: Consider, Applying and Expired stages; a collapsible No Offer column

**Input**: `specs/052-consider-applying-expired/` (spec.md, plan.md, research.md, data-model.md, contracts/routes.md, quickstart.md)

**Tests**: TDD for every pure module (unit tests next to the source), the route smoke for routes and pages. Env for unit tests: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy`. All paths relative to the worktree.

## Phase 1: Setup

- [ ] T001 Baseline: `npm run lint:types` and `npm test` pass before any change (typecheck already green on `origin/main`)

## Phase 2: Foundational — the rule and the stage list (blocks every story)

- [ ] T002 Write failing tests in `src/applied-state.test.ts`: `hasApplied` is true for status APPLIED, for a non-null `appliedAt`, for any stage other than `consider`/`applying` (`applied`, a work key, `rejected`, `ghosted`, `expired`), and false for no stage, `consider` and `applying` with no date and a non-APPLIED status; `PRE_APPLY_KEYS` is exactly `['consider','applying']`; `appliedWhere` is the matching Prisma fragment (OR of status APPLIED, appliedAt not null, stage not null AND not in the pre-apply keys)
- [ ] T003 Create `src/applied-state.ts` (named exports `PRE_APPLY_KEYS`, `hasApplied`, `appliedWhere`; type-only Prisma import); T002 passes
- [ ] T004 Write failing tests in `src/web/stage-config.test.ts` (extend): `boardStages` order Consider, Applying, Applied, work; `allStages` ends Rejected, Ghosted, Expired; `parseStageConfig` drops stored work keys `consider`, `applying`, `expired`, `no-offer`; `addStage` never produces a reserved key (label "Consider" becomes `consider-2`); `nextStageKey` walks consider→applying→applied→first work→…→last work→`rejected`, an end state (`rejected`, `ghosted`, `expired`) → first work stage; `END_KEYS`/`isEndStage`; `dotClassFor` gives the new stages a colour
- [ ] T005 `src/web/stage-config.ts`: add `consider`/`applying` entries (keys from `PRE_APPLY_KEYS`), `expired`, `END_STAGES`/`END_KEYS` (rename of the terminal list; keep `TERMINAL_*` only if a caller still needs it, otherwise rename callers — `exports:audit` must stay clean), `NO_OFFER_KEY = 'no-offer'`, reserve all new keys, update `boardStages`, `allStages`, `nextStageKey`, `dotClassFor`; T004 passes
- [ ] T006 [P] Catalog: add `stages.consider`, `stages.applying`, `stages.expired`, `stages.noOffer` to `src/i18n/catalog/{en,es,fr,uk}.json` (en: Consider, Applying, Expired, No Offer); `src/i18n/catalog.test.ts` passes

## Phase 3: User Story 1 — Park a posting in Consider (P1)

**Goal**: a Consider button on the job page; a Consider job counts as applied nowhere.

**Independent test**: press Consider, see the card in column 1; pack, resume prompt, company counts, digest ignore it.

- [ ] T007 [US1] Convert the readers to the shared rule: `src/pack/store.ts` (`appliedTo` uses `appliedWhere`; `packJobState.applied` uses `hasApplied`), `src/web/applied-resume.ts` (`needsAppliedResume` uses `hasApplied`), `src/web/routes/companies.tsx` and `src/web/routes/jobs-import.tsx` (application counts use `appliedWhere`); extend `src/web/applied-resume.test.ts` and add `src/pack/store-applied.test.ts` only if `appliedTo` can be tested without Prisma (else test the pure `hasApplied` mapping used by `packJobState`); tests assert a `consider` and an `applying` row is not applied
- [ ] T008 [P] [US1] `src/jobs/france-travail-sync.test.ts` (extend): `planSync` keeps protecting (anonymises, never deletes) a gone offer whose stage is `consider` or `applying`; add a one-line comment at `france-travail-sync.ts:100` saying the line is ownership, not "applied" (cleanup-job comment likewise)
- [ ] T009 [P] [US1] Time line: failing tests in `src/web/stage-time.test.ts` — a `consider`/`applying` card with `appliedAt` set but no ledger event gets no "applied Nd ago" line (returns null) and never stale; with a ledger event it reads "in Consider N days" and goes stale after 14; then change `src/web/stage-time.ts` (skip the appliedAt fallback for `PRE_APPLY_KEYS`)
- [ ] T010 [US1] `src/web/routes/applications.tsx`: `POST /jobs/:id/consider` per contracts/routes.md (tracking off → 303 to the job; 404 when the person holds no row; stage + `stageChangeEvent` in one `$transaction`; no-op when already `consider`; redirect via `jobHref(id, tab)` with `formTab`-style sanitising of `tab`); catalog flash key `applications.consideringFlash` (4 languages) if a flash is shown
- [ ] T011 [US1] `src/web/pages/job-detail.tsx` (+ `src/web/routes/jobs.tsx` for the new prop if needed): **Consider** `Button` immediately left of Mark applied, same row, posting to `/jobs/:id/consider` through its own form (hidden `tab`), shown only when tracking is on, stage ≠ `consider` and not `hasApplied`; catalog key `job.consider` in 4 languages. Keep the `accessible-interactions` rules (real button, label)
- [ ] T012 [US1] `src/web/pages/job-detail.tsx` stage select in "Application tracking": lists `allStages` (the new ones come for free); `src/web/routes/applications.tsx` validation already uses `allStages`

## Phase 4: User Story 2 — Consider → Applying → Applied (P1)

**Goal**: moves work from board and job page; `appliedAt` is set only on Applied.

**Independent test**: Consider → Applying → Applied from the board; date empty, empty, set. Mark applied from Consider/Applying/none sets Applied with the resume snapshot.

- [ ] T013 [US2] Extract the pure decision into `src/web/stage-events.ts` (extend, with tests in `src/web/stage-events.test.ts`): `appliedAtOnMove(toStage, currentAppliedAt, now)` → `now` only when moving to `applied` with no date, else `undefined` (no change); never clears
- [ ] T014 [US2] `src/web/routes/applications.tsx` quick-move (`POST /jobs/:id/stage`): include `appliedAt` from T013 in the update, and compute the ledger event with that date
- [ ] T015 [US2] `src/web/routes/jobs.tsx` Mark applied (`POST /jobs/:id/status`): seed `pipelineStage='applied'` when the stage is empty or in `PRE_APPLY_KEYS` (extract `seedsApplied(stage)` into `src/applied-state.ts` with a test in `src/applied-state.test.ts`: null/consider/applying → true; applied, work key, rejected, ghosted, expired → false); the ledger event's `from` is the real previous stage
- [ ] T016 [US2] Verify the job form route (`POST /jobs/:id/application`) still works for the new keys; no code change expected beyond the catalog; note the result in the PR

## Phase 5: User Story 3 — End states in a No Offer column (P1)

**Goal**: Rejected, Ghosted, Expired cards in the last column with badges; drop = Rejected; Unfiled keeps a panel.

**Independent test**: one card per end state shows in No Offer with badges; drag an active card on it → Rejected; drag a Ghosted card → unchanged.

- [ ] T017 [US3] Failing tests in `src/web/board.test.ts` (extend): `planMove(id, from, to, group)` returns null when `from` is in `group`; unchanged for no group; same-stage still null
- [ ] T018 [US3] `src/web/public/board.mjs`: `planMove` takes the optional group; the drop handler reads `target.dataset.dropGroup` (space-separated); `dragenter` no longer targets `#closed` (opens Unfiled `<details>` and the collapsed rail via the collapse module); header comment updated; T017 passes
- [ ] T019 [US3] `src/web/pages/applications.tsx`: render columns Consider, Applying, Applied, work…, then the **No Offer** `section` (`id="stage-col-no-offer"`, `data-drop-stage="rejected"`, `data-drop-group="rejected ghosted expired"`, header with title and combined count) holding the end-state cards ordered Rejected, Ghosted, Expired; `StageCard` takes an optional `badge` (specific end state, wording from the catalog, not colour alone); remove the Closed `<details>`; add a small `<details id="unfiled">` only when stranded; mobile nav chips: stages, then No Offer, then Unfiled; header meta uses a "no offer" count; drop `applications.closed*` keys that become unused and add the replacements in 4 languages (`applications.noOffer*`)
- [ ] T020 [US3] `src/web/routes/applications.tsx`: group cards for the page (`byStage` keyed by real stage; the page folds the end stages into the column); `loadBoard` columns come from `allStages`; exports keep working (`allStages` order). Update `src/web/applications-export.test.ts` if it fixes the stage list
- [ ] T021 [US3] Card time line text for `consider`/`applying` with no line: render nothing instead of `applications.noApplyDate` (`pages/applications.tsx`); Applied-and-later keep it
- [ ] T022 [US3] Reword settings copy: `settings.appliedAndTheTwoClosed` (now: Consider, Applying and Applied start the board and Rejected, Ghosted and Expired end it; the ones between are yours) and `settingsRoute.stages.lastColumn` in 4 languages; check `src/web/pages/settings.tsx` for any other "Closed" wording about the fixed columns

## Phase 6: User Story 4 — Collapse No Offer on desktop (P2)

**Goal**: collapse to a rail, remembered, keyboard operable.

**Independent test**: toggle, reload, keyboard only; storage blocked → still fine; no toggle on mobile.

- [ ] T023 [US4] Failing tests `src/web/column-collapse.test.ts` through `import('./public/column-collapse.mjs')`: `readCollapsed` returns false for null/garbage/throwing storage and true for `'1'`; `writeCollapsed` stores `'1'`/removes, swallows a throwing storage; `toggled(true)` false and back; `initCollapse` returns 0 with no toggle element and does not touch a document with no markup
- [ ] T024 [US4] Create `src/web/public/column-collapse.mjs` (`readCollapsed`, `writeCollapsed`, `toggled`, `initCollapse(doc, storage)`): sets `data-collapsed` on the column, `aria-expanded` and the accessible name (`browser.board.collapseNoOffer` / `expandNoOffer`) on the button, keeps focus on the button, expands without saving on `dragenter` over a collapsed column; storage key `applypack.board.noOffer.collapsed`; T023 passes
- [ ] T025 [US4] `src/web/pages/applications.tsx`: the toggle `<button type="button" aria-expanded="true" aria-controls="stage-col-no-offer">` in the No Offer header (`hidden md:inline-flex`, 44px-safe hit area per accessible-interactions), `BOARD_CSS` rules inside the `min-width: 768px` block for `[data-collapsed="true"]` (narrow rail, vertical title + count, body hidden, `transition` respecting `prefers-reduced-motion`), and import/init in `BOARD_BOOT`; add `browser.board.*` keys to 4 catalogs and run `npm run i18n:browser` to regenerate `src/web/public/i18n-en.mjs`
- [ ] T026 [US4] Check the pseudo-language and dark theme: no English outside the catalog on `/applications`, tokens only (no raw colours)

## Phase 7: Polish and release

- [ ] T027 Route smoke (`src/scripts/route-smoke.ts`): Consider from a job page (button present left of Mark applied, POST moves it; tracking off → no button), quick-move to Applying then Applied (apply date only after), Mark applied from Consider, a card in each end state shows in No Offer with the badge, an unknown stage is still 400, cross-origin POST to `/jobs/:id/consider` refused; keep existing assertions about `/applications` consistent with the removed Closed panel
- [ ] T028 [P] `docs/adr/0080-consider-applying-expired-no-offer.md` (amends 0025; use the adr-writer template and add the row to `docs/adr/README.md`); `docs/where-to-look.md` rows (board stages, `applied-state.ts`, collapse module, "Pipeline stage on a job", "Add / rename / reorder board columns"); `CLAUDE.md` is not changed; `SPEC.md`/`ARCHITECTURE.md` mentions of Applied/Closed updated where they describe the fixed columns
- [ ] T029 [P] Release: `package.json` and `package-lock.json` to `2.59.15`, `CHANGELOG.md` entry (Added/Changed) per release-discipline (patch only)
- [ ] T030 Verify (Stage 8): `npm run lint:types`, full `npm test`, `npm run exports:audit`, `npm audit --omit=dev --audit-level=high`, `prisma migrate diff` shows no schema change, route smoke on a scratch DB, viewport screenshots at 1280 and 390 (light and dark); mark these tasks complete

## Dependencies

Phase 2 blocks everything. US1 (Phase 3) and US2 (Phase 4) share `routes/applications.tsx` and `routes/jobs.tsx`; do US1 → US2 in order. US3 depends on Phase 2 and T020 on T010/T014. US4 depends on US3's markup (T019). T028/T029 can run beside T027.

## Parallel opportunities

T006, T008, T009 touch different files; T028 and T029 are independent of each other.

## Implementation strategy

MVP = Phases 1–5 (the stages, the readers, the column). US4 is the P2 polish on top. Commit per phase/story: Phase 2+3 as US1, Phase 4 as US2, Phase 5 as US3, Phase 6 as US4, then docs/release.
