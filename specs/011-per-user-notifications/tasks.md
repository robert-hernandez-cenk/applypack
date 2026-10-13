# Tasks: Per-user notifications, mutes and personal settings

Format: `- [ ] Tnn [P?] [USn] description (file)`.

## Phase 1: Setup
- [x] T001 Scratch Postgres via `npm run db` with a throwaway `APPLYPACK_DATA_DIR`; baseline `lint:types` and tests (no files)

## Phase 2: Foundational (blocks all stories)
- [x] T002 Pure module `settings-split.ts`: `GLOBAL_COLUMNS` / `PERSONAL_COLUMNS`, `splitSchedule`, `mergeSchedule`, personal defaults; unit tests incl. "every AppSettings column is classified" against the Prisma field enum (src/settings-split.ts, src/settings-split.test.ts)
- [x] T003 Schema: `UserSettings` (userId PK cascade; telegramEnabled default true, applicationTrackingEnabled default true, staleApplicationsDigestEnabled default true, reapplyDays Int?, coverAngles/pipelineStages/schedule/pack Json?, locale String?, updatedAt), `NotificationTarget.userId` + per-owner uniques, `CompanyMute` `@@id([userId, key])`, `CronRun.userId Int?`, `User` back-relations; drop moved columns from `AppSettings` (prisma/schema.prisma)
- [x] T004 Hand-written migration `20261014090000_user_settings` backfilling user 1; seed old-shape data and verify; `prisma migrate diff` empty (prisma/migrations/)
- [x] T005 `settings.ts`: `UserSettingsView`, `getUserSettings(userId)`, personal setters taking `userId`, `getAlertSchedule(userId)`, `getPackSettings(userId)`, `getDisplaySettings(userId)`, owner-scoped target functions; `AppSettingsView` global only (src/settings.ts)
- [x] T006 `jobs/cron-run.ts`: `recordCronRun(name, fn, userId?)`, `lastSuccessfulRunAt(name, userId?)` (user 1 also matches legacy null) (src/jobs/cron-run.ts)
- [x] T007 `users/store.ts`: `listAdminIds()`; `notifier.ts`: userId-first `alertChannel/sendAlert/sendDigest/sendPackNotice`, own-target resolution, operator notice helpers for administrators (src/users/store.ts, src/notifier.ts)

## Phase 3: US1 chats and alerts are mine
- [x] T008 [US1] Held delivery per user and target, channel and hours per person; `held-alerts.ts` groups by `(userId, target)` with test (src/jobs/alert-delivery.ts, src/jobs/held-alerts.ts, src/jobs/held-alerts.test.ts)
- [x] T009 [US1] `process-jobs`: per-person channel, alert hours, pack settings; callers drop `schedule` for a flag (src/jobs/process-jobs.ts, fetch-job.ts, hn-hiring-job.ts, import-job.ts)
- [x] T010 [US1] Settings targets UI/routes scoped to the person; search target picker and save reject a foreign target (src/web/routes/settings.tsx)
- [x] T011 [US1] `init.ts` `.env` bootstrap and `scripts/test-telegram.ts` for the default user (src/init.ts, src/scripts/test-telegram.ts)
- [x] T012 [US1] Operator notices to administrators: budget alert, page-change notice (src/ai-ledger.ts, src/jobs/page-change-alerts.ts, src/jobs/fetch-job.ts)

## Phase 4: US2 alert switch, timing, digest are mine
- [x] T013 [US2] `digest-job` and `stale-applications-job` take the person's settings and targets; recap source-health line for administrators (src/jobs/digest-job.ts, src/jobs/stale-applications-job.ts)
- [x] T014 [US2] `index.ts` hourly loop over people with their schedule, run rows with `userId`; `digest-once` / `stale-once` loop people (src/index.ts, src/scripts/digest-once.ts, src/scripts/stale-once.ts)
- [x] T015 [US2] Schedule/alerts/application-tracking/stale routes and `schedule-view` read and write the person's settings; schedule form fetch half stored only for an administrator (src/web/routes/settings.tsx, src/web/schedule-view.ts)

## Phase 5: US3 mutes and re-apply window are mine
- [x] T016 [US3] `employer-store.ts` per-person mutes and `loadEmployerRulesFor`; tick gate "all candidates"; per-person row exclusion (src/jobs/employer-store.ts, src/jobs/process-jobs.ts)
- [x] T017 [US3] Mute UI/routes, `/jobs` hiding, folders and import previews use the person's rules (src/web/routes/*)

## Phase 6: US4 dashboard settings are mine
- [x] T018 [US4] Pipeline stages, cover angles, pack settings, language and zone per person; display middleware after user; run locale per user (src/web/app.ts, src/run-locale.ts, routes: applications, jobs, letter, pack, jobs-import, welcome)
- [x] T019 [US4] Pack runner: owner settings/mutes/angles, per-owner notices, `cancelQueuedAutoPacks(userId)`, `listUnnotifiedPacks(userId)` (src/jobs/pack-job.ts, src/pack/store.ts)

## Phase 7: US5 install-wide stays shared
- [x] T020 [US5] Welcome/wizard, update notice, fetch-now, cost-hint and other global readers audited by grep for stale personal keys (src/web/*, src/jobs/*)

## Phase 8: Polish
- [x] T021 Route smoke: extended two-person isolation checks; fixtures updated (src/scripts/route-smoke.ts)
- [x] T022 ADR 0069 with the classification table; `docs/where-to-look.md`; CLAUDE.md file rule; CHANGELOG if the repo keeps one per slice (docs/adr/0069-*.md, docs/where-to-look.md, CLAUDE.md)
- [x] T023 Full verification: `lint:types`, full tests, `exports:audit`, build, migration check, route smoke (no files)
