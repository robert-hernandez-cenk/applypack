# Implementation Plan: Admin role, users page and isolation tests (#12)

**Spec**: [spec.md](./spec.md) · **ADR**: 0070 (new) · **Builds on**: 0064-0069

## Technical context
TypeScript strict, Hono (jsx) dashboard, Prisma/Postgres. No schema change: `User.role` and every cascade exist (slices 1-5). Pure modules get unit tests (`npx tsx --test`); route behaviour is covered by `src/scripts/route-smoke.ts` on a scratch database.

## Constitution / repo rules check
- Pure policy and rules in their own files, store is the only Prisma touch (`users/store.ts`).
- Every string a catalog key in every language (`i18n/catalog/*.json`, `catalog.test.ts`).
- No new export unused (`exports:audit`); no new env var; no secrets.
- Worker unaffected (no HTTP, no new import into the worker of web code).

## Design

### 1. Admin policy (pure) - `src/users/admin-policy.ts`
- `ADMIN_ROUTES` and `PERSONAL_ROUTES`: lists of `"METHOD /pattern"` strings in Hono syntax (`:id`). `routeAccess(method, path)` returns `'admin' | 'personal' | 'open'` by matching a path against the patterns (segment-wise, `:x` matches one segment; most specific wins: literal beats param, so `/companies/mutes` is personal while `/companies/:id/delete` is admin).
- `open`: `/health`, `/auth/*`, `/static/*` (already userless).
- Unclassified routes: `routeAccess` returns `'admin'` (fail closed) and the route smoke fails the build on any registered route that is not listed.
- Mixed routes decided: `POST /settings/schedule` is personal (its fetch half is already gated in the handler); `GET /settings`, `GET /companies`, `GET /runs`, `GET /runs/fetch-now/:id[/state]`, `GET /` personal (their pages adapt to the role).
- Middleware `requireAdmin()` in `src/web/admin-guard.ts`: after `withCurrentUser`, for a member and `routeAccess === 'admin'` answer 403 with a small localized page (`Layout`), JSON 403 for `/state` paths. Runs before body parsing. `/welcome` GET for a member redirects to `/` (not 403) since old bookmarks exist; POSTs 403.
- `isAdmin(user)` helper shared by pages.

### 2. Rules (pure) - `src/users/rules.ts`
`judgeUserChange({ users: {id, role}[], actorId, targetId, change: 'promote'|'demote'|'remove' })` → `{ ok: true } | { ok: false, reason: 'not-found'|'self'|'last-admin'|'no-change' }`. Self first (nobody demotes/removes themselves), then last-admin. Store re-checks inside a serializable transaction using the same function on a fresh read, and takes the repo's global write lock if present (`withGlobalWriteLock`) so two admins cannot race.

### 3. Users page - `/users` (admin) 
`src/web/routes/users.tsx` + `src/web/pages/users.tsx`: table of users (name, role badge, joined, last active, counts via `userSummaries()` in the store), per-row role form and a `ConfirmAction` remove with text from `src/web/user-delete-confirm.ts` (pure, tested). Menu entry "Users" in the system group, admin only (and a Settings link). Routes: `GET /users`, `POST /users/:id/role`, `POST /users/:id/delete`. Flash on refusal with the reason in words.
- Last activity: max of `UserJob.updatedAt` (if column exists, else `statusChangedAt`), `JobStageEvent.at`, `CronRun.startedAt where userId`. Resolved in research (R3).

### 4. Gating the UI by role
- `layout.tsx`: nav items carry `admin?: true`; `Layout` filters by `currentUser().role`. Items: companies stays (members: mutes), discovery admin, ai admin, runs open, users admin, screen only when employer mode and admin.
- `settings` page: `isAdmin` prop. Member sees tabs `profile, notifications, applications, automation, general` (personal parts). Hide for members: tabs `sources`, `ai`, `screening`; on `profile` the job-fetching section's pause toggle (schedule form already read-only for the fetch half); on `notifications` the source-health toggle; on `general` the login item, update check, employer toggle. A member's `?tab=ai|sources|screening` shows `profile`.
- `overview`: pause button and "Fetch now" and the wizard link only for admin; `needsWelcome` redirect only for admin.
- `companies` page: member view = muted-companies section only (page prop `manage=false`). `runs` page: controls hidden for members; funnel kept. `fetch-run` page: "Run again" button admin only (a member cannot reach a run since starting is admin-only, but `Fetch now` buttons in `jobs-list.tsx` empty state and elsewhere must be hidden for members).
- Settings POST handlers that mix: none besides schedule.

### 5. Store-level and route guards from #11
- `profiles.ts`: `createProfile`/`updateProfile` call `assertResumeOwner(userId, input.resumeId)` (throws `searchGone`-style typed error "resume not found") - one query on `resume` where id and userId.
- `/target/runs/:id` and `/state`: `TargetRun` gets `userId` on start (`target-runs.ts`); getRun by id returns the run only if `userId === currentUser().id` (pure `ownsRun(run, userId)` in `target-runs.ts` tested). Same treatment for the watchlist and fetch runs is not needed (admin-only / install-wide).
- Pack queueing: extract the pure "who queues a pack" decision if one exists; otherwise test the existing pure `trigger.ts` per-person inputs. Decided in research (R5): add a unit test over `pack/trigger.ts` with two people's settings (pure already); document that the DB-level queueing is exercised by the member sweep in route-smoke where feasible.

### 6. Wizard
`needsWelcome` stays pure; `overview` passes `isAdmin`. `getDisplaySettings.setupCompleted` is used by the language invite logic: for members it is treated as completed (so the browser-language invite flow works as for a finished install). Done in `app.ts` display step: `setupCompleted || role !== 'ADMIN'`.

### 7. Isolation sweep (route-smoke)
- Registered-routes check: iterate `app.routes` (Hono exposes `{method, path}`), require each to be in `ADMIN_ROUTES ∪ PERSONAL_ROUTES ∪ open` (and not both) → one check row.
- Member session sweep: build a Hono wrapper like `isolationChecks` does with a member session and the real route modules + `requireAdmin()`; for every admin route (from the list, ids filled by fixtures) request as member → expect 403 and compare row counts before/after for the writes; for every personal route that takes an id, request the administrator's ids → expect 404/redirect-with-flash and body free of the administrator's marker strings. Reuse `fill()` with owner fixtures.
- Users-page checks: demote/remove rules end to end, session of a removed user → 401.

### 8. Docs and release
ADR 0070 (+ README row), SPEC.md stance, PRODUCT.md, README and `docs/oidc-login.md` multi-user section, `docs/where-to-look.md` rows, CHANGELOG 2.58.0 + `package.json`/lock version (no tag), CLAUDE.md file-rule bullet for `users/` and the admin policy, i18n keys in every catalog.

## Project structure (new/changed)
```
src/users/admin-policy.ts (+test)   src/users/rules.ts (+test)   src/users/store.ts
src/web/admin-guard.ts              src/web/routes/users.tsx     src/web/pages/users.tsx
src/web/user-delete-confirm.ts (+test)
src/web/{app.ts,layout.tsx,routes/{settings,companies,runs,overview,target}.tsx,pages/{settings,overview,companies,runs,fetch-run,jobs-list}.tsx}
src/profiles.ts  src/web/target-runs.ts  src/scripts/route-smoke.ts  src/i18n/catalog/*.json
docs/adr/0070-*.md  SPEC.md PRODUCT.md README.md CHANGELOG.md package.json
```

## Risks
- Hono sub-route 403 ordering: the guard must be registered before routes and after `withCurrentUser`; verified in the sweep.
- Pseudo-language pass: new pages must contain no English outside the catalog.
- Missing a route in the lists: fail-closed default plus the build-failing check.
