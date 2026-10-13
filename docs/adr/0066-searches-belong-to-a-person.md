# 0066 — Searches belong to a person; scoring still covers everyone's

**Status:** Accepted (2026-10-12). Slice 2 of 6 of issue #5. Builds on
[0065](./0065-users-and-identity.md); amends [0028](./0028-parallel-searches-one-call-per-posting.md)
(where the primary lives).

## Context

With users (0065) the first table to become private is the search (`Profile`):
everything a person wants from the shared catalog starts there. The catalog is
shared, so a posting is fetched once and the classifier should still see it
once, not once per person.

## Decision

- **`Profile.userId`** (NOT NULL, default 1, FK `users`, cascade). The
  migration's column default backfills every existing search to the default
  user.
- **The primary moves to the person.** `User.primaryProfileId` (unique FK,
  SetNull) replaces `AppSettings.activeProfileId`; the migration copies the old
  value onto user 1 and drops the column. A primary is always running, as before.
- **`profiles.ts` takes the user first** and folds it into every `where`: a
  search of someone else misses exactly as a deleted one does ("search gone"),
  so no id reveals another person's search. `MAX_ACTIVE_PROFILES` (8) is per
  person.
- **Scoring is not per user.** The worker reads `listAllActiveProfiles()`, so
  one classifier call scores a posting against every running search of every
  person and a `JobScore` is stored for each search; each search still gates
  its own alerts with its own `minFitScore`. `Job.fitScore` stays the best-of
  across all searches until slice 3 (per-user job state).
- **Views filter by owner.** `/jobs`'s chips, the `?profile=` filter and the
  "open to me" filter, and a job page's score row read only the signed-in
  person's searches (`scores where profile.userId`).
- **A new member gets a blank, running, primary search** at first sign-in
  (`ensurePrimaryProfile`, idempotent); the person who takes over the default
  user keeps the existing ones.
- Code with no request (`pack-job`, dry-run scripts) passes `DEFAULT_USER_ID`
  until the slice that scopes what it reads (resumes, slice 4).

## Consequences

- The classifier prompt carries every running search of every person: with the
  per-person cap the worst case grows with the number of users (about 0.6 s per
  search per posting, ADR 0028). A total cap is a later decision if installs
  grow that way.
- Alerts still go to the install's targets (a search's `notificationTargetId`
  is untouched) until slice 5; a posting that matches only a teammate's search
  is stored and alerted by that search alone.
- A `pg_dump --data-only` taken before this change carries
  `app_settings."activeProfileId"` and no longer imports; take the dump after
  upgrading.

## Alternatives considered

- **A flag on `Profile` for the primary.** Needs a partial unique index Prisma
  cannot express, so `migrate diff` would drift.
- **Keeping `AppSettings.activeProfileId` beside the new column.** Two answers
  to "which is primary".
- **One classifier call per person.** Cost multiplies by the number of people
  for the same posting; the shared catalog is the point.
- **A global cap of 8 running searches.** One person could lock the others out.
