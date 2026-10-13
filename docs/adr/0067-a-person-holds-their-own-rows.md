# 0067 — What a person does with a posting is their own row; the posting is shared

**Status:** Accepted (2026-10-12). Slice 3 of 6 of issue #5. Builds on
[0065](./0065-users-and-identity.md) and [0066](./0066-searches-belong-to-a-person.md);
amends [0028](./0028-parallel-searches-one-call-per-posting.md) (where the
best-of lives).

## Context

With per-person searches (0066) the classifier already scores a posting once
for everyone, but `Job` still carried one status, one best-of score, one set of
notes and one application: whoever clicked last decided what everybody saw.

## Decision

- **`UserJob(userId, jobId)`** (unique, both FKs cascade) holds everything a
  person makes of a posting: `status`, the best-of verdict among *their*
  searches (`fitScore`, `techMatch`, `redFlags`, `summary`,
  `priorityRulesApplied`), `alertedAt` / `alertHeldAt`, the application
  (`appliedAt`, `recruiterContact`, `pipelineStage`, `applicationNotes`) and the
  resume it went out with (`appliedResume*`). `JobStageEvent.userId` makes the
  stage history theirs. `Job` keeps the shared posting: text, place, salary,
  fingerprint, cross-listing, liveness, `JobScore` rows.
- **A person sees a posting only if they hold a row.** Lists and counts read
  `user_job`; a page, status change or action on `/jobs/<id>/…` for a posting
  the person does not hold is "not found" (`web/job-guard.ts`, one middleware);
  cross-listing links name only postings they hold.
- **Verdicts are merged per owner** (`mergeVerdictsByUser`, by `Profile.userId`).
  Each person gets their own winner, kept / dismissed status, held stamp and
  alert, sent to the target of *their* winning search. One classifier call
  still serves everybody. Salary and place come from the best verdict of any
  search (they are the posting's).
- **Who gets a row.** A scored posting: every person with a verdict. A posting
  stored without a verdict (paused fetch, prefilter): every person. A pasted or
  imported posting is its adder's alone (`ownerId`); a re-score never gives a
  hand-picked posting, or any score that keeps statuses, to someone new
  (`givesRowToOthers`). A person created later holds nothing until a re-score or
  the next fetch hands them rows.
- **Re-score is per person.** `statusAfterRescore` runs on each person's own
  status; Applied and Saved never move; a person with no running search keeps
  their rows untouched; "Re-classify all" skips a posting only when every
  holder has applied to it.
- **Retention.** A person's dismissed row (no pipeline stage) is deleted after
  30 days; the posting goes when nobody holds it.
- **Worker convention.** Code without a request takes `userId`; the digest,
  the stale nudge and the pack runner pass `DEFAULT_USER_ID` until the slices
  that scope chats and resumes. Held-alert delivery covers every person's rows.
- Migration `20261012220000_user_jobs` backfills one row per existing job for
  the default user from the old columns, then drops them.

## Consequences

- A broadcast chat (no `notificationTargetId`) gets one alert per person who
  keeps a posting; targets stay install-wide until #11.
- The mute list, the re-apply window and the application pack are still
  install-wide (a pack is prepared with the default user's resume and follows
  their row); resumes and their dependents are #10.
- `funnel_day` and the source-health numbers stay install-wide; the "source
  yield" on /runs counts the person's own matches.
- A folder source that holds saved postings is the install's, not a person's:
  its rows reach every person whose searches have a verdict on them.
- Deleting an import source takes every person's rows from it.

## Alternatives considered

- **Per-user state as an array or JSON on `Job`:** no foreign keys, no indexes
  for the lists, unreadable SQL.
- **Keeping `Job.status` as a default and overlaying per-user changes:** two
  answers to "what is the status", as 0066 declined for the primary.
- **Scoring once per person:** cost multiplies by people for the same posting;
  a shared catalog is the point.
