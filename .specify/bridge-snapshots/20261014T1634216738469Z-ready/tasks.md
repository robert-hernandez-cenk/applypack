---

description: "Task list for the live progress card for running jobs (#32)"
---

# Tasks: Live progress card for running jobs

**Input**: Design documents from `/specs/032-running-jobs-progress/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/runs-running.md, quickstart.md

**Tests**: requested (TDD). Pure modules get unit tests first; modules that import Prisma are verified by the route smoke and the quickstart (repo rule).

**Checks per phase**: `npm run lint:types && npm test && npm run exports:audit` green before each commit. Commit per phase: `<what it delivers> (#32, USn)`. Paths are relative to the worktree root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 / US2 / US3

## Phase 1: Setup

- [ ] T001 Add `progress Json?` to `model CronRun` in `prisma/schema.prisma` (comment: live state of a RUNNING row, null otherwise, ADR 0072) and hand-write `prisma/migrations/20261014150000_cron_run_progress/migration.sql` (`ALTER TABLE "cron_run" ADD COLUMN "progress" JSONB;`); run `npx prisma generate`; confirm `prisma migrate diff --from-migrations … --to-schema-datamodel` is empty on a throwaway DB if one is available.

## Phase 2: Foundational (blocks every story)

- [ ] T002 [P] Write failing tests `src/jobs/run-progress.test.ts` for: schema accepts the data-model shape and rejects bad values (negative `done`, non-int, more than 12 `samples`); `shouldWrite(lastWriteAt, lastStage, now, next)` is true on first report, on a stage change, and after 5 000 ms, false otherwise; `pushSample` caps at 12; `ratePerSecond` uses first/last sample of the window and is null with <2 samples or zero elapsed; `etaSeconds` is null when no `total`, when `done < 20`, when rate ≤ 0, else `(total − done) / rate`; `fraction` caps at 1 and is null without a positive `total`; `isStale(updatedAt, now)` is true past 120 000 ms.
- [ ] T003 Implement `src/jobs/run-progress.ts` (pure; constants `WRITE_INTERVAL_MS = 5_000`, `SAMPLE_WINDOW = 12`, `ETA_MIN_DONE = 20`, `STALE_AFTER_MS = 120_000`; zod `RunProgressSchema`, `type RunProgress`, `type ProgressReport` (the job's input: stage, label, unit, done?, total?, counters?), `parseProgress(json): RunProgress | null`, and the functions from T002) until T002 passes. Export only what another file imports.
- [ ] T004 Extend `recordCronRun` in `src/jobs/cron-run.ts`: `fn` becomes `(report: ReportProgress) => …` (existing `() => …` callers still compile). The reporter stamps `startedStageAt` (kept while the stage is unchanged) and `updatedAt`, appends a sample, applies `shouldWrite`, keeps at most one UPDATE in flight (a newer report that arrives meanwhile is sent when it lands), and catches/logs write errors without throwing. On finish or failure the wrapper awaits the in-flight write, then clears `progress` in the same `update` that sets the status (`Prisma.JsonNull`). No change to `stats` or `lastSuccessfulRunAt`.
- [ ] T005 Extract the reporter's state machine so it is testable without Prisma: put `createReporter({ write, now })` (returns `report`, `flush`) in `src/jobs/run-progress.ts` and add tests to `src/jobs/run-progress.test.ts` with a fake `write`/clock: throttled to one write per 5 s, stage change writes at once, a rejected `write` does not throw out of `report` or `flush`, `flush` waits for the in-flight write, and no write happens after `flush`. Make `cron-run.ts` call `createReporter` with its Prisma `update`.

**Checkpoint**: commit `Add run progress column, reporter and maths (#32)`.

## Phase 3: User Story 1 — see how far a running search has got (P1) 🎯 MVP

**Goal**: the card appears on /runs while the classify loop runs, and updates itself.

**Independent test**: insert a RUNNING row with `progress` (quickstart step 2) and watch the card appear, move and vanish; run the classify loop with the report hook faked in a unit test.

- [ ] T006 [P] [US1] Write failing tests `src/web/running-view.test.ts` for `runningView(row, now)` → `{ name, elapsedMs, stage, unit, done, total, fraction, counters, etaSeconds, noEstimate, updatedAgoMs, stale } | null-progress variant`: row without or with malformed `progress` gives name + elapsed only; `noEstimate` true only when a total is unknown; ETA hidden below 20 done; fraction capped at 1.
- [ ] T007 [US1] Implement `src/web/running-view.ts` (pure, uses `parseProgress`, `fraction`, `etaSeconds`, `isStale` from `src/jobs/run-progress.ts`) until T006 passes.
- [ ] T008 [P] [US1] Add `runs.running.*` keys to `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json`: title, `stage.sources`, `stage.classify`, `stage.mails`, `unit.sources`, `unit.postings`, `unit.mails`, `counter.kept`, `counter.setAside`, `counter.classified`, `counter.errors`, `counter.listings`, `elapsed`, `eta` ("about {time} left"), `noEstimate`, `lastUpdate` ("last update {ago} ago"), `starting` (no report yet); one sentence per message, plurals as the existing catalog does. `src/i18n/catalog.test.ts` must pass.
- [ ] T009 [US1] Create `src/web/pages/running-card.tsx`: `RunningCard({ rows, now })` renders `<section id="running-now" data-ui="running-now">` with one block per row from `runningView` (name in `translate="no"`, stage label, `role="progressbar"` with `aria-valuenow/min/max` when a total is known, "done / total", elapsed via `formatDuration`, counters, ETA or "no estimate", last-update line). Reuse `Card`/`Hint` primitives and existing colour tokens (`text-warn` for stale is applied in T016). Returns nothing for an empty list.
- [ ] T010 [US1] In `src/web/routes/runs.tsx` add a loader for RUNNING rows (`status: 'RUNNING'`, same `OR [{ userId: null }, { userId: currentUser().id }]`, ordered by `startedAt` asc), pass them to `RunsPage`, and add `GET /runs/running` returning `RunningCard` as a fragment with `Cache-Control: no-store` and an empty body when none (contract: `contracts/runs-running.md`). Add `'GET /runs/running'` next to `'GET /runs'` in `PERSONAL_ROUTES` in `src/users/admin-policy.ts`.
- [ ] T011 [US1] In `src/web/pages/runs.tsx` accept `running` props, render `<RunningCard>` between `FunnelCard` and the "Run history" title (the title condition must not depend on the card), keep the table badge, and pass `refreshWithoutScript={30}` to `Layout` only while `running.length > 0`. Load the module with a `<script type="module">` that imports `/static/running.mjs` only when the card exists.
- [ ] T012 [P] [US1] Write failing tests `src/web/running.test.ts` (import `public/running.mjs` via `import()`): `nextState('<section…>', '')` → `'remove'`, non-empty body → `'swap'`, fetch failure/non-200 → `'keep'`; `init` with a fake `fetchImpl` and a fake root swaps on 200, removes and stops on empty, keeps and retries on failure, skips while `document.hidden`.
- [ ] T013 [US1] Implement `src/web/public/running.mjs` (dependency-free ES module, `init(root, { url, everyMs = 5000, fetchImpl, setTimeoutImpl })`, `nextState`) until T012 passes. If the Dockerfile or `site/public/demo/` copy rules apply to `public/` files, confirm nothing else is needed.
- [ ] T014 [US1] Wire the classify loop: add `report?: (p: ProgressReport) => void` to `ProcessOptions` in `src/jobs/process-jobs.ts`; after `pending` is built call `report({ stage: 'classify', label: 'runs.running.stage.classify', unit: 'runs.running.unit.postings', done: 0, total: pending.length, counters })`, and in the loop after each `consumed++` report `done: consumed` with counters `{ kept: stats.persisted, setAside: stats.preFiltered, classified: stats.classified, errors: stats.classifyFailed }`. A throwing `report` must not break the loop (wrap in the caller or document that `report` never throws — the reporter in T005 guarantees it). In `src/jobs/fetch-job.ts` add `report?` to `FetchJobOptions` and pass it to `processNormalizedJobs`; in `src/jobs/fetch-tick.ts` change the `fetch` and `folder-watch` calls to `(report) => runFetchJob({ …, report })`.
- [ ] T015 [US1] Run `npm run css` and commit `src/web/public/tailwind.css` if any new utility appeared; run the full checks; commit `Show a live Running now card on the Runs page (#32, US1)`; tick T001–T015 in this file in the same commit.

**Checkpoint**: US1 works end to end for the hourly classify.

## Phase 4: User Story 2 — tell a stalled run from a slow one (P2)

**Goal**: the last-update line is visible and turns amber past two minutes.

**Independent test**: a row with `updatedAt` three minutes old renders amber; a fresh one does not.

- [ ] T016 [P] [US2] Add failing cases to `src/web/running-view.test.ts` (stale boundary at exactly 120 000 ms is not stale, 120 001 is; `updatedAgoMs` never negative under clock skew) and, if needed, to `src/jobs/run-progress.test.ts`.
- [ ] T017 [US2] In `src/web/pages/running-card.tsx` give the last-update line `text-warn` (plus a visible word, not colour alone: use the `runs.running.stalled` key added to the four catalogs) when `view.stale`, otherwise `text-ink-faint`; format the age with `formatDuration`. Re-run `npm run css` if a class is new.
- [ ] T018 [US2] Run the checks; commit `Mark a run that stopped reporting (#32, US2)`; tick T016–T018.

## Phase 5: User Story 3 — other long jobs show up too (P3)

**Goal**: sources and Gmail report; unknown jobs show elapsed only.

**Independent test**: unit-test the reporting of each job with a fake `report`; the elapsed-only block is already covered by T006.

- [ ] T019 [P] [US3] In `src/jobs/fetch-job.ts` call `opts.report?.({ stage: 'sources', label: 'runs.running.stage.sources', unit: 'runs.running.unit.sources', done: progress.done, total: progress.total })` inside the existing `runAllFetchers` progress callback (next to `opts.onSource?.`), and once before the walk with `done: 0`. The `classify` stage of T014 then replaces it.
- [ ] T020 [P] [US3] Add `report?` to `GmailJobDeps` in `src/jobs/gmail-job.ts` (type from `run-progress.ts`); in the mail loop report `stage: 'mails'`, `done` = mails handled so far, `total` = `take.length`, counters `{ listings }` summed from `reads`. Extend `src/jobs/gmail-job.test.ts` (fakes) to assert the report sequence: one per mail, listings counter increasing, total constant.
- [ ] T021 [US3] Hand `report` to the Gmail job: `src/jobs/for-each-user.ts` passes it from `recordCronRun(name, (report) => job(userId, report), userId)` (jobs that ignore it keep working), `src/jobs/gmail-tick.ts` forwards it to `liveGmailDeps()`/`runGmailJob`, `src/jobs/gmail-live.ts` includes it in the deps. Check the other `forEachUser` callers still compile unchanged.
- [ ] T022 [US3] Run the checks; commit `Report sources and Gmail mails to the progress card (#32, US3)`; tick T019–T022.

## Phase 6: Polish and cross-cutting

- [ ] T023 [P] Write `docs/adr/0072-running-jobs-report-progress-through-the-run-row.md` with the adr-writer template (context: worker memory invisible to web; decision: `cron_run.progress`, throttled reporter, fragment polling; alternatives rejected from research.md R1–R3) and add it to `docs/adr/README.md`.
- [ ] T024 [P] Add rows to `docs/where-to-look.md` (progress reporter: `src/jobs/run-progress.ts`, `cron-run.ts`; the card: `src/web/pages/running-card.tsx`, `/runs/running`, `public/running.mjs`) and one line each to `ARCHITECTURE.md` (data flow: worker → `cron_run.progress` → fragment) and `SPEC.md` (Runs page). Add a short file-rules bullet to `CLAUDE.md` for `run-progress.ts` (pure; the only writer is `cron-run.ts`; labels are catalog keys).
- [ ] T025 Extend `src/scripts/route-smoke.ts`: `GET /runs/running` returns 200 and an empty body with no running row; after inserting a RUNNING row with a valid `progress` it returns a fragment containing `id="running-now"`; the route also passes the pseudo-language page sweep and the admin-policy test (`src/users/admin-policy.test.ts`).
- [ ] T026 Run `npm run build` and the route smoke on a throwaway database; run the quickstart.md manual steps 1–6 on a scratch `APPLYPACK_DATA_DIR` (browser check at desktop and phone width, with and without script); record anything not verified for the PR.
- [ ] T027 Final: `npm run lint:types && npm test && npm run exports:audit`; commit `Document the progress card, ADR 0072 and smoke step (#32)`; tick T023–T027.

## Dependencies and order

- Phase 1 → Phase 2 → US1 → US2 and US3 (US2 and US3 are independent of each other; both need US1's card and the reporter).
- Within US1: T006→T007; T008 before T009; T009 before T010/T011; T012→T013; T014 needs Phase 2.
- Parallel: T002 ∥ nothing else in Phase 2; T006 ∥ T008 ∥ T012; T019 ∥ T020; T023 ∥ T024.

## Implementation strategy

MVP = Phase 1 + 2 + US1 (the hourly classify progress visible and live). US2 and US3 are small increments on top. Out of scope (do not build): reaper, cancel controls, rebuilding "Fetch now", progress history.
