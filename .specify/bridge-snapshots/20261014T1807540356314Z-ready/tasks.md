---

description: "Task list for the Live Status page for a running job (#36)"
---

# Tasks: Live Status page for a running job

**Input**: Design documents from `/specs/036-live-status-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: requested (TDD). Pure modules get unit tests first; modules that import Prisma are verified by the route smoke and the quickstart (repo rule).

**Checks per phase**: `npm run lint:types && npm test && npm run exports:audit` green before each commit. Commit per phase: `<what it delivers> (#36, USn)`. Paths are relative to the worktree root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 / US2 / US3

## Phase 1: Foundational (blocks every story)

- [ ] T001 [P] Write failing tests `src/web/run-link.test.ts`: `liveStatusPath(7)` is `/runs/7`; `parseRunId` returns the number for `'7'`, `'0012'` → 12, and `null` for `''`, `'abc'`, `'-1'`, `'1.5'`, `'7x'`, `'0'` and anything above 2147483647; `showsLiveStatus('RUNNING')` is true and false for every other `CronRunStatus` value.
- [ ] T002 Implement `src/web/run-link.ts` (pure; `liveStatusPath`, `parseRunId`, `showsLiveStatus`) until T001 passes. Export only what another file imports.
- [ ] T003 [P] Move the "What happened" cell body out of `src/web/pages/runs.tsx` (error line with Details, `StatsCell`, the "nothing scored" note) into a new `src/web/pages/run-outcome.tsx` exporting `RunOutcome: FC<{ run: RunRow }>`; `RunsTable` renders `<RunOutcome run={r} />`. Output markup stays identical (no visual change).
- [ ] T004 [P] Export `RunningBlock` from `src/web/pages/running-card.tsx` (add `export`; no other change).
- [ ] T005 Add the i18n keys to `src/i18n/catalog/en.json` and the same keys to `es.json`, `fr.json`, `uk.json`: `runs.liveStatus` ("Live Status"), `runs.status.title` ("Run status"), `runs.status.back` ("Back to Run history"), `runs.status.gone` ("That run was not found."), `runs.status.ended` ("This run has ended."), `runs.status.waiting` ("Waiting for the first progress report."). Run `npm test -- src/i18n` style check (`catalog.test.ts`).

**Checkpoint**: `lint:types`, tests and `exports:audit` green (a new export used only in the next phase may need the next phase's commit to clear the audit; commit T001–T005 together with Phase 2 if so).

## Phase 2: User Story 1 - Live Status link and live page (Priority: P1) MVP

**Goal**: A RUNNING row links to a page that shows its progress and updates itself.

**Independent Test**: Hold a row RUNNING with a progress report; `/runs` shows "Live Status" for it only; `/runs/:id` shows the block; `/runs/:id/card` returns the fragment.

- [ ] T006 [US1] In `RunsTable` (`src/web/pages/runs.tsx`), when `showsLiveStatus(r.status)`, render `<a href={liveStatusPath(r.id)}>{t('runs.liveStatus')}</a>` (link styling as other in-table links, e.g. `underline`) in the "What happened" cell, before the outcome content; non-RUNNING rows unchanged.
- [ ] T007 [US1] Create `src/web/pages/run-status.tsx`: `RunStatusPage` with `Layout` (`active="runs"`, `refreshWithoutScript={30}` while running), `PageHeader` titled `runs.status.title` with the job name (`translate="no"`), a back link to `/runs`; for a RUNNING run, a host `<div id="running-host">` holding `<RunningCard rows={[view]} />`-style content via `RunningBlock` inside a `Card`, a note `runs.status.waiting` when `progress` is null, and the module script `import { init } from '/static/running.mjs'; init(document.getElementById('running-host'), { url: '/runs/<id>/card' });`.
- [ ] T008 [US1] In `src/web/routes/runs.tsx` add, after the fetch-now routes, `GET /runs/:id/card` (RUNNING and visible → `RunningBlock` fragment via `runningView`, `Cache-Control: no-store`; anything else → empty 200) and `GET /runs/:id` (renders `RunStatusPage`). Share one `loadRun(id)` using `visibleRuns()`.
- [ ] T009 [US1] Add `'GET /runs/:id'` and `'GET /runs/:id/card'` to `PERSONAL_ROUTES` in `src/users/admin-policy.ts` beside `GET /runs/running`.
- [ ] T010 [US1] Route smoke step in `src/scripts/route-smoke.ts`: insert a RUNNING `cron_run` with a progress report; assert `/runs` has the "Live Status" link to its id and no link for a finished row, `/runs/:id` and `/runs/:id/card` answer 200 with the job name/count, and a member (non-admin) can open both.
- [ ] T011 [US1] Run `npm run lint:types && npm test && npm run exports:audit`; commit Phase 1 + 2 together if the audit needs it: `Live Status link and page for a running job (#36, US1)`.

## Phase 3: User Story 2 - Outcome once the run ends (Priority: P2)

**Goal**: A page for a finished run (or one that finishes while open) shows the outcome.

**Independent Test**: Mark the smoke row OK; the card answers empty and the page shows the status, duration and the history row's sentence with a back link.

- [ ] T012 [US2] In `RunStatusPage`, for a non-RUNNING run render the outcome view: status `Badge` (reuse `runBadge`), duration (`formatDuration`), start stamp, `<RunOutcome run={run} />`, a line `runs.status.ended`, and the back link; no script and no refresh.
- [ ] T013 [US2] Route smoke: update the same row to OK with `stats`, assert `/runs/:id/card` is an empty 200 and `/runs/:id` shows the status and the same summary text as the `/runs` row; repeat with a FAILED row carrying `errorMessage` and assert the failure sentence.
- [ ] T014 [US2] Verify `public/running.mjs` already reloads on an empty card (existing `running.test.ts` covers `onGone`); add a test in `src/web/running.test.ts` only if the page needs a different `url` option path not yet covered.
- [ ] T015 [US2] Run the checks; commit `Show the outcome on the status page of an ended run (#36, US2)`.

## Phase 4: User Story 3 - Missing, foreign and malformed ids (Priority: P3)

**Goal**: Bad links land on Run history with a message.

**Independent Test**: `/runs/999999`, `/runs/abc` and another person's run all redirect to `/runs` with the flash.

- [ ] T016 [US3] In the `GET /runs/:id` handler use `parseRunId`; `null`, a missing row or a row not in `visibleRuns()` → `flashRedirect('/runs', 'err', t('runs.status.gone'))`. Confirm `/runs/running` and `/runs/fetch-now/...` still win over `:id` (registered earlier; route smoke covers it).
- [ ] T017 [US3] Route smoke: assert 303 to `/runs` for an unknown id, `abc`, and a run whose `userId` is another person (use the two-person fixtures already in the smoke); assert the same response body for unknown and foreign (no existence leak).
- [ ] T018 [US3] Run the checks; commit `Send unknown or foreign run ids back to Run history (#36, US3)`.

## Phase 5: Polish and docs

- [ ] T019 [P] Add a row to `docs/where-to-look.md` (a run's live status page: routes, `run-link.ts`, `pages/run-status.tsx`, `run-outcome.tsx`, polling via `running.mjs`), and a one-line addendum to ADR 0072 (`docs/adr/0072-*.md`) noting the page.
- [ ] T020 [P] Add a `CHANGELOG.md` entry under the next patch version (fork rule: patch bump only; the release PR bumps `package.json`, not this branch).
- [ ] T021 Run `npm run css` and confirm `src/web/public/tailwind.css` is unchanged or commit the regenerated file if a new utility class was used.
- [ ] T022 Run the full quickstart (`specs/036-live-status-page/quickstart.md`): checks, route smoke on a throwaway database, browser check at desktop and phone width (running page updating, ended page, bad id). List anything not run as unverified.
- [ ] T023 Commit `Document the Live Status page (#36)`.

## Dependencies

T001 → T002; T003, T004, T005 independent of them. Phase 2 needs Phase 1. US2 needs US1's page and route. US3 needs US1's route. Polish last.

## Parallel opportunities

T001, T003, T004, T005 touch different files. T019 and T020 are independent.

## Implementation strategy

MVP is Phase 1 + 2 (link and live page). US2 and US3 each land as their own commit; the branch ships as one PR.
