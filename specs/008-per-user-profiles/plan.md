# Implementation Plan: Per-user profiles, searches and scoring

**Spec**: [spec.md](./spec.md) | **Issue**: #8 | **Base**: `issue-5-multiple-users`

## Technical Context
TypeScript strict, Prisma + Postgres, Hono JSX dashboard, node:test. The constitution file is the unfilled template; the governing rules are the repo `CLAUDE.md` (pure modules tested, Prisma modules smoke-verified, hand-written migrations, ADR for architecture, exports audit). No NEEDS CLARIFICATION remain.

## Design
- **Schema** (`prisma/schema.prisma`, migration `20261012210000_user_profiles`): `Profile.userId Int @default(1)` FK `User` (Cascade), index; `User.primaryProfileId Int? @unique` FK `Profile` (SetNull); named relations `UserProfiles` / `UserPrimary`. Migration order: add column default 1 (backfills), add FK, add `primaryProfileId`, `UPDATE users SET primaryProfileId = (SELECT activeProfileId FROM app_settings WHERE id=1) WHERE id=1`, drop `app_settings.activeProfileId`.
- **`src/profiles.ts`** (Prisma): every dashboard-facing function takes `userId` first and checks ownership (`where: { id, userId }`; a miss is `searchGone`). `listProfiles(userId)`, `getProfile(id, userId)`, `listActiveProfiles(userId)`, `getActiveProfile(userId)`, `setProfileActive(userId, id, active)`, `setActiveProfile(userId, id)`, `createProfile(userId, input)`, `updateProfile(userId, id, input)`, `deleteProfile(userId, id)`. New `listAllActiveProfiles()` (worker scoring, every user), `ensurePrimaryProfile(userId)` (create a blank, running, primary search when the user has none). Per-user cap counts `{ userId, active: true }`.
- **`src/profile-guards.ts`** stays pure; add the pure pieces worth testing (`canSwitchOn(running, max)` style) only if they carry logic.
- **Worker**: `fetch-job`, `import-job`, `hn-hiring-job`, `classify-existing`, `fetchers/index` use `listAllActiveProfiles()`. `reclassify-job` re-scores against `listAllActiveProfiles()`; `runScoreUnscored({userId})` ranks with that user's primary; `pack-job` and scripts pass `DEFAULT_USER_ID`. `verdict-merge` unchanged (best-of across all searches stays global until slice 3).
- **Dashboard**: routes/pages read `currentUser().id` and pass it on (`settings`, `welcome`, `overview`, `jobs`, `companies`, `folders`, `watchlist`, `jobs-import`, `job-pick`, `pack-offers`, `source-suggestions`, `welcome-facts`, `profile-from-resume`). `jobs.tsx`: chip list and `?profile=` honoured only for own searches; job page score rows filtered to own profiles (`scores: { where: { profile: { userId } } }`).
- **Provisioning**: `web/app.ts` wraps `provisionOidcUser` so a user created as a new member gets `ensurePrimaryProfile`; the claim of the default user needs nothing. `provisionOidcUser` in `users/store.ts` stays the only toucher of `users` for create/claim; `profiles.ts` writes `users.primaryProfileId` (documented exception, one column).
- **init.ts**: bootstrap creates and makes primary for `DEFAULT_USER_ID`.
- **Docs**: ADR 0066, SPEC, ARCHITECTURE, where-to-look, CLAUDE.md, CHANGELOG/version bump if the repo does so per change (check CHANGELOG pattern).

## Verification (testing-gate)
Schema -> hand-written migration + `prisma migrate diff` empty + applied on a scratch DB over seeded rows; pure pieces -> unit tests; dashboard -> rebuild, route smoke on a throwaway DB, screenshot of Settings; Prisma modules -> a scratch-DB script exercising ownership/cap/primary rules with two users.

## Risks
- Old `pg_dump` data files carry `app_settings."activeProfileId"`; `db:import` of a dump from before this change would fail on the dropped column (documented in ADR; dumps taken after upgrade are fine).
- Total running searches across users grows the classifier prompt (cost note in ADR).
