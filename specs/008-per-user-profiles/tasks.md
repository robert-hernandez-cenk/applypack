# Tasks: Per-user profiles, searches and scoring

Format: `- [ ] Tnn [P?] [USn] description (file)`.

## Phase 1: Setup
- [ ] T001 Scratch Postgres via `npm run db` with a throwaway `APPLYPACK_DATA_DIR`; baseline `lint:types` and tests (no files)

## Phase 2: Foundational (blocks all stories)
- [ ] T002 Schema: `Profile.userId Int @default(1)` FK User cascade + index; `User.primaryProfileId Int? @unique` FK Profile SetNull; drop `AppSettings.activeProfileId` (prisma/schema.prisma)
- [ ] T003 Hand-written migration `20261012210000_user_profiles`: add column default 1, FK, add `primaryProfileId`, copy old primary to user 1, drop old column; verify on a seeded DB and `prisma migrate diff` empty (prisma/migrations/)
- [ ] T004 `profiles.ts`: userId-scoped API (list/get/listActive/getActive/setActive/setPrimary/create/update/delete), per-user cap, `listAllActiveProfiles`, `ensurePrimaryProfile`; ownership miss = `searchGone` (src/profiles.ts)
- [ ] T005 Pure guard for the cap/ownership decisions with unit tests, if logic is extractable (src/profile-guards.ts, src/profile-guards.test.ts)

## Phase 3: US1 each person has their own searches (P1)
- [ ] T006 [US1] Settings, welcome, overview, resumes-from-profile routes and pages pass `currentUser().id` (src/web/routes/settings.tsx, welcome.tsx, overview.tsx, resumes.tsx, src/web/profile-from-resume.ts)
- [ ] T007 [US1] Other readers of "running searches / primary" scoped to the user: companies, folders, watchlist, jobs-import, job-pick, pack-offers, source-suggestions, welcome-facts (src/web/...)
- [ ] T008 [US1] Scratch-DB check script: two users, cross-user edit/delete/switch = search gone, cap per user, primary rules (src/scripts or ad hoc, not shipped if not useful)

## Phase 4: US2 existing installs unchanged (P1)
- [ ] T009 [US2] init bootstrap profile for `DEFAULT_USER_ID` (src/init.ts); route smoke fixtures use the default user (src/scripts/route-smoke.ts)

## Phase 5: US4 scoring covers everyone, views show only mine (P1)
- [ ] T010 [US4] Worker uses `listAllActiveProfiles()`: fetch-job, import-job, hn-hiring-job, classify-existing, fetchers/index, reclassify-job (src/jobs/*, src/fetchers/index.ts)
- [ ] T011 [US4] `runScoreUnscored({userId})` ranks with the user's primary; pack-job, pack-dry-once, priority-rules-dryrun pass `DEFAULT_USER_ID` (src/jobs/reclassify-job.ts, pack-job.ts, src/scripts/*)
- [ ] T012 [US4] /jobs chips, `?profile=` and job-detail score row limited to the user's searches (src/web/routes/jobs.tsx)

## Phase 6: US3 new member gets a search (P2)
- [ ] T013 [US3] New OIDC member gets `ensurePrimaryProfile` at provisioning, the claimed default user does not (src/web/app.ts, src/users/store.ts)

## Phase 7: Polish
- [ ] T014 ADR 0066; update SPEC.md, ARCHITECTURE.md, docs/where-to-look.md, CLAUDE.md, CHANGELOG if the repo bumps per change
- [ ] T015 `lint:types`, full tests, `exports:audit`, `migrate diff`, build + route smoke on scratch DB, Settings screenshot
