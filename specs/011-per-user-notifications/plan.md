# Implementation Plan: Per-user notifications, mutes and personal settings (issue #11)

**Spec**: [spec.md](./spec.md) · **ADR**: 0069 · **Builds on**: 0065 (identity), 0066 (searches), 0067 (job rows), 0068 (resumes)

## Summary
`AppSettings` stays the singleton for what runs the install. A new `UserSettings` row per person holds what is personal. `NotificationTarget` and `CompanyMute` get an owner. Every send path takes the owning `userId`; the worker loops people where a message is theirs, and operator notices go to administrators.

## Technical context
TypeScript strict, Prisma + Postgres 16, Hono JSX dashboard, node test runner (pure modules only). Verification (testing-gate): schema change -> hand-written migration applied over seeded old-shape data, `prisma migrate diff` empty, route smoke on a scratch DB with extended two-person isolation checks; pure code -> unit tests; `tsc` does not catch stale `select:` keys, so readers of the moved columns are audited by grep; `env-example` and i18n catalog tests stay green.

## Design
- **Schema** (one migration `20261014090000_user_settings`)
  - `UserSettings(userId PK -> users cascade, telegramEnabled, applicationTrackingEnabled, staleApplicationsDigestEnabled, reapplyDays, coverAngles, pipelineStages, schedule, pack, locale, updatedAt)`; row 1 is copied from `app_settings`; the moved columns are dropped from `app_settings` except `schedule`, which stays as the global fetch schedule.
  - `NotificationTarget.userId` (default 1, cascade, index); uniques become `(userId, botToken, chatId)` and `(userId, webhookUrl)`.
  - `CompanyMute`: `userId` (default 1, cascade), primary key `(userId, key)`.
  - `CronRun.userId Int?` (no FK): null = install-wide or legacy.
- **Pure module `settings-split.ts`**: `GLOBAL_COLUMNS`, `PERSONAL_COLUMNS` (test compares them with the Prisma field enums so a new column must be classified), `splitSchedule`/`mergeSchedule`: global schedule keeps `{timezone, fetch}`; personal keeps `{timezone, alerts}`; `mergeSchedule(global, personal)` = the `Schedule` callers know.
- **settings.ts**: `AppSettingsView` loses the personal fields; `UserSettingsView` + `getUserSettings(userId)` (upsert on read) and `set*` writers take `userId` first. `getSchedule()` stays the fetch gate's global; `getAlertSchedule(userId)` returns the person's `Schedule` (their zone and alerts). `getPackSettings(userId)`. `getDisplaySettings(userId)` = personal zone and locale + global `setupCompleted`. Targets: every function takes `userId`; ids of other owners read as missing.
- **notifier.ts**: `alertChannel(userId)`, `sendAlert/sendDigest/sendPackNotice(userId, ...)`; `resolveTargets(userId, targetId)` ignores a target of another person. Operator notices (`sendBudgetAlert`, `sendPageChangeAlert`) loop administrators.
- **Worker**: `process-jobs` builds employer rules per person, drops a posting before classification only when every candidate recipient turns it away, and removes a muting person from the rows; alert channel, alert hours and pack settings are read per person and cached for the tick. `alert-delivery` groups held rows by `(userId, target)`, checks channel and hours per person. `digest-job`/`stale-applications-job` take `userId` and read their own settings; `index.ts` loops people each hour, runs those whose hour it is and records a run row with `userId`; `lastSuccessfulRunAt(name, userId)` reads the person's mark (user 1 also matches legacy null rows). Pack runner: `noLongerWanted`/`runOne` read the owner's pack settings, mutes and cover angles; notices are delivered per owner; `cancelQueuedAutoPacks(userId)`, `listUnnotifiedPacks(userId)`.
- **Dashboard**: settings routes use `currentUser().id`; the display middleware runs after the user is known; the schedule form's fetch half is stored only for an administrator; target pickers list own targets; the mute list and `/jobs` use own mutes; pack/letter/applications routes read own settings.
- **Scripts/init**: `.env` bootstrap and `*-once` scripts address the default user; digest/stale once-scripts loop people.
- **Docs**: ADR 0069 (classification table), `docs/where-to-look.md`, CLAUDE.md file-rule line.

## Decisions (recorded in the PR)
Setup wizard flag, source-health flag and AI budget stay global; operator notices to administrators; schedule form fetch half admin-only (forced); the digest `since` mark per person; employer gate drops only when all candidates turn it away.

## Risks
Wide caller surface (~40 files) -> compiler worklist plus grep audit for stale `select:` keys; run history mark -> legacy rows treated as user 1.
