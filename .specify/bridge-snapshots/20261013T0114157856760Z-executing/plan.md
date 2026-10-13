# Implementation Plan: Per-user job state (issue #9)

**Spec**: [spec.md](./spec.md) · **ADR**: 0067 · **Builds on**: 0065 (identity), 0066 (per-user searches)

## Summary
Split `Job` into the shared posting and `UserJob(userId, jobId)`. The worker keeps one classifier call per posting and one `JobScore` per search; verdicts are merged per owner (`Profile.userId`) and written to each owner's `UserJob`. Every reader that showed `Job.status` / `fitScore` / pipeline fields reads the current user's `UserJob`.

## Technical context
TypeScript strict, Prisma + Postgres 16, Hono JSX dashboard, node test runner (pure modules only). Verification matrix (testing-gate): schema change -> hand-written migration checked over seeded old-shape data, `prisma migrate diff` empty, route smoke on a scratch DB; pure modules -> unit tests.

## Design
- **Schema**: `UserJob` holds status, fitScore, techMatch, redFlags, summary, priorityRulesApplied, alertedAt, alertHeldAt, appliedAt, recruiterContact, pipelineStage, applicationNotes, appliedResumeId/Version/Text; `@@unique([userId, jobId])`, FK cascade both sides, indexes mirroring the old Job ones. `JobStageEvent.userId` (default 1, FK cascade). The matching `Job` columns and indexes are dropped.
- **Pure** (`jobs/verdict-merge.ts`): `ProfileVerdict.userId`; `mergeVerdictsByUser` groups and merges per owner (the old `mergeVerdicts` stays for the global winner that supplies posting facts such as salary). `rescore-status.ts` unchanged, called per user. New pure `jobs/user-job.ts`: `userJobData` (merged -> row data), `shouldCreateFor` (hand-picked / keepStatus rules).
- **Stores**: `jobs/user-job-store.ts` is the only writer of `user_job` (create-for-users, upsert from a merge, status guards for alerts and holds, queries shared by readers: `visibleTo(userId)` where-fragment `{ userJobs: { some: { userId } } }`).
- **Ingest** (`process-jobs.ts`): merge per user; one nested create of the Job with `userJobs`; per user hold/alert, each to its winner's target; unscored/prefiltered rows give every user a row (`listUserIds`). `matched` counts a posting once.
- **Re-score** (`score-store.saveJobScores`, `reclassify-job`, `classify-existing`): per-user status via `statusAfterRescore` from that user's current row; users without verdicts untouched; no new rows for hand-picked sources.
- **Manual / import / folder-saved**: created for the adding person only (`createManualJob(…, userId)`).
- **Readers**: `/jobs`, job page, board, applications, overview stats, welcome, target, letter etc. go through `currentUser().id`; job-level data (description, company, cross-listing, salary) from `Job`. Digest, stale nudge, funnel yield, `fetch-once`-style scripts pass `DEFAULT_USER_ID`; held-alert delivery covers every user's held rows (targets are install-wide until #11). Cleanup deletes dismissed `UserJob`s past retention, then jobs nobody holds.
- **Forced by the split (not scoped)**: resume matches, cover letters, briefs, verifications, application packs and `appliedResume` stay keyed by job; `UserJob.appliedResume*` moves with applied state; `ApplicationPack`/pack runner reads the default user's row.

## Risks
- Big mechanical surface (about 50 files): the compiler is the worklist; Prisma types after dropping Job columns find every reader.
- Migration must backfill before dropping columns and keep `migrate diff` empty.
