# Tasks: Per-user job state

Format: `- [ ] Tnn [P?] [USn] description (file)`.

## Phase 1: Setup
- [ ] T001 Scratch Postgres via `npm run db` with a throwaway `APPLYPACK_DATA_DIR`; baseline `lint:types` and tests (no files)

## Phase 2: Foundational (blocks all stories)
- [ ] T002 Schema: `UserJob` model; `JobStageEvent.userId`; drop the personal columns and indexes from `Job` (prisma/schema.prisma)
- [ ] T003 Hand-written migration: create `user_job`, backfill one row per job for user 1 from the old columns, add `job_stage_event.userId`, drop the columns; seed old-shape data and verify; `prisma migrate diff` empty (prisma/migrations/)
- [ ] T004 [P] Pure: `ProfileVerdict.userId`, `mergeVerdictsByUser`, tests (src/jobs/verdict-merge.ts, .test.ts)
- [ ] T005 [P] Pure: `jobs/user-job.ts` (`userJobFields` from a merged verdict, `createsRowFor` rule) with tests (src/jobs/user-job.ts)
- [ ] T006 `jobs/user-job-store.ts`: the only writer of `user_job` (upsert from verdict, hold/alert stamps, row creation for users) and the `visibleTo(userId)` where fragment; `users/store.ts:listUserIds` (src/jobs/user-job-store.ts)

## Phase 3: US3 worker writes per user
- [ ] T007 [US3] `process-jobs.ts` ingest: per-user merge, nested `userJobs` create, per-user hold/alert/pack
- [ ] T008 [US3] `score-store.saveJobScores`, `reclassify-job.ts`, `classify-existing.ts`: per-user rescore, scope, unscored runner
- [ ] T009 [US3] `manual-job.ts`, `jobs-import`, `import-job`, `source-file-store`, `folder`: rows for the adding person only

## Phase 4: US1 readers are per person
- [ ] T010 [US1] /jobs list, chips, counts, filters, job page, status/notes/stage actions (web/routes/jobs.tsx and helpers)
- [ ] T011 [US1] board, applications, overview, welcome, target, letter, pack, resumes, keywords, screen routes and stores that read Job status/fit/stage
- [ ] T012 [US1] cross-listing and job-pick readers

## Phase 5: US4 background jobs
- [ ] T013 [US4] alert-delivery (all users' held rows), digest, stale nudge, cleanup, funnel yield, scripts

## Phase 6: US2 upgrade safety and polish
- [ ] T014 [US2] route-smoke fixtures, tests and scripts compile on the new shape
- [ ] T015 ADR 0067, CLAUDE.md file-rule paragraph, docs/where-to-look.md, spec/ARCHITECTURE touch-ups
- [ ] T016 Verification matrix: `lint:types`, full tests, `exports:audit`, migration over seeded data, `migrate diff`, route smoke on scratch DB
