# Tasks: Admin role, users page and isolation tests

Format: `- [ ] Tnn [P?] [USn] description (file)`.

## Phase 1: Setup
- [x] T001 Scratch Postgres via `npm run db` with a throwaway `APPLYPACK_DATA_DIR`; baseline `lint:types` and tests (no files)

## Phase 2: Foundational (blocks all stories)
- [x] T002 Pure `users/admin-policy.ts`: `ADMIN_ROUTES`, `PERSONAL_ROUTES`, `routeAccess(method, path)` with most-specific-wins matching and fail-closed default, `isAdmin(user)`; unit tests incl. `/companies/mutes` personal vs `/companies/:id/delete` admin, `/jobs/import` before `/jobs/:id`, unknown path = admin (src/users/admin-policy.ts, src/users/admin-policy.test.ts)
- [x] T003 Pure `users/rules.ts`: `judgeUserChange` (not-found, self, last-admin, no-change) with unit tests (src/users/rules.ts, src/users/rules.test.ts)

## Phase 3: US1 only an administrator runs the install
- [x] T004 [US1] `web/admin-guard.ts` middleware (403 page via Layout, JSON for `/state`, `/welcome` GET redirect for members) wired in `app.ts` after `withCurrentUser`; display step treats members as setup-completed (src/web/admin-guard.ts, src/web/app.ts)
- [x] T005 [US1] Layout menu: admin-only items filtered by role (discovery, AI usage, users; screening already conditional) (src/web/layout.tsx)
- [x] T006 [US1] Settings page: `isAdmin` prop; hide tabs sources/ai/screening and install-wide sections (job fetching toggle, source-health toggle, login item, update check, employer toggle) for members; member `?tab=` to a hidden tab falls back to profile (src/web/pages/settings.tsx, src/web/routes/settings.tsx)
- [x] T007 [US1] Overview: wizard redirect and link, pause button only for admin; `Fetch now` buttons hidden for members on /runs, fetch-run page and the jobs empty state (src/web/routes/overview.tsx, src/web/pages/overview.tsx, src/web/pages/runs.tsx, src/web/pages/fetch-run.tsx, src/web/pages/jobs-list.tsx)
- [x] T008 [US1] /companies member view: mutes only (`manage` prop) (src/web/routes/companies.tsx, src/web/pages/companies.tsx)
- [x] T009 [US1] i18n keys for the 403 page, hidden-section notes, menu, in every catalog (src/i18n/catalog/*.json)

## Phase 4: US2 users page
- [x] T010 [US2] `users/store.ts`: `listUserSummaries()` (role, createdAt, last activity, counts), `changeUserRole`, `removeUser` in a transaction under the global write lock re-judging with `judgeUserChange`, deleting the user's `cron_run` rows (src/users/store.ts)
- [x] T011 [US2] Pure `web/user-delete-confirm.ts` + test (src/web/user-delete-confirm.ts, src/web/user-delete-confirm.test.ts)
- [x] T012 [US2] `/users` route and page (list, role form, ConfirmAction remove, flashes with reasons), mounted in app, policy lists, menu entry (src/web/routes/users.tsx, src/web/pages/users.tsx, src/web/app.ts)
- [x] T013 [US2] i18n keys for the users page in every catalog (src/i18n/catalog/*.json)

## Phase 5: US4 guards from #11
- [x] T014 [US4] `profiles.ts` resume-owner guard in `createProfile`/`updateProfile` (src/profiles.ts)
- [x] T015 [US4] Target runs carry their starter; `/target/runs/:id` and `/state` answer not found for anyone else; pure `ownsRun` + test (src/web/target-runs.ts, src/web/target-runs.test.ts, src/web/routes/target.tsx)
- [x] T016 [US4] Pack trigger test with two people's settings (src/pack/trigger.test.ts)

## Phase 6: US3 isolation sweep
- [x] T017 [US3] Route smoke: registered-routes classification check; member sweep over admin routes (403, no change) and personal routes with the administrator's ids (not found, no foreign text); users-page rule checks; removed-user 401 (src/scripts/route-smoke.ts)

## Phase 7: US5 docs and release
- [x] T018 [US5] ADR 0070 + ADR README row; SPEC.md, PRODUCT.md, README, docs/oidc-login.md multi-user section, docs/where-to-look.md, CLAUDE.md bullet, ADR 0066-0069 "forced for slice 6" notes closed (docs/, *.md)
- [x] T019 [US5] CHANGELOG 2.57.0 + compare link, package.json and lock version (no tag) (CHANGELOG.md, package.json, package-lock.json)

## Phase 8: Polish and verification
- [x] T020 Full verification: lint:types, tests, exports:audit, build, route smoke on a fresh scratch database, screenshots of /users at 375 and 1280 px (no files)
