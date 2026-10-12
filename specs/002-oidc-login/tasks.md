---

description: "Task list for OIDC login for the dashboard"
---

# Tasks: OIDC login for the dashboard

**Input**: Design documents from `/specs/002-oidc-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-routes.md, quickstart.md

**Tests**: requested (TDD). In each story the test tasks come first and must fail before the code that satisfies them is written.

**Conventions**: all paths are relative to the worktree root. Named exports only, pino for logs, zod for env, every user-visible string through `t()` in all four catalogs (`src/i18n/catalog/{en,es,fr,uk}.json`). Run tests on Windows with `npx tsx --test "<glob>"` (the `npm test` script does not expand `$(find …)` under cmd.exe) and with `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy` set.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 sign-in (P1), US2 sign-out and expiry (P2), US3 existing setups keep working (P1), US4 misconfiguration fails closed (P1)

---

## Phase 1: Setup

- [x] T001 Add `openid-client` (^6.8) as a runtime dependency with `npm --prefix . install openid-client` in `package.json` and `package-lock.json`; confirm `npm audit --omit=dev --audit-level=high` stays clean and note the installed version
- [x] T002 [P] Write ADR 0064 `docs/adr/0064-oidc-login-for-the-dashboard.md` using the adr-writer template (decisions: `openid-client` dependency, stateless signed-cookie sessions, OIDC replaces Basic Auth for pages while Basic Auth guards `/health` only, no allowlist) and add its line to `docs/adr/README.md`
- [x] T003 [P] Add the six optional fields to `ConfigSchema` in `src/config.ts` (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SESSION_SECRET`, `WEB_PUBLIC_URL`, `OIDC_SESSION_HOURS`), each `z.string().optional()` with empty string transformed to `undefined`, the same way `WEB_BASIC_AUTH` is
- [x] T004 Document the block in `.env.example` under the Dashboard section (all six names, one comment each, the "restrict your provider to the intended users" warning, and that OIDC replaces Basic Auth for pages while `WEB_BASIC_AUTH` still guards `/health`); run `npx tsx --test src/env-example.test.ts` until green

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the pure decisions and the single I/O seam. No route is wired here.

- [x] T005 [P] Write failing tests `src/web/oidc/settings.test.ts` for `readOidcSettings(env)`: nothing set gives `{ enabled: false }`; all valid gives `enabled: true` with `redirectUri` = `publicUrl` + `/auth/callback`, trailing slash removed, `secureCookies` true only for https, `sessionSeconds` default 28800; errors naming the variable for: missing `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SESSION_SECRET` shorter than 32 characters, missing or non-http(s) `WEB_PUBLIC_URL` or one with a path, non-https `OIDC_ISSUER` unless host is `localhost`, `127.0.0.1` or `::1`, `OIDC_SESSION_HOURS` not an integer 1 to 168, and any other `OIDC_*` set while `OIDC_ISSUER` is not
- [x] T006 [P] Write failing tests `src/web/oidc/next-path.test.ts` for `safeNext(raw)`: keeps `/jobs?x=1`; maps to `/` for undefined, empty, `jobs`, `//evil.test`, `/\\evil.test`, `https://evil.test/x`, `javascript:alert(1)`, paths with control characters, and `/auth/login` (no loop)
- [x] T007 [P] Write failing tests `src/web/oidc/session.test.ts` for the pure payload helpers: `newSession(claims, nowSec, ttlSec)` takes `sub` and a display name from `name`, then `preferred_username`, then `email`, else null; rejects an empty or non-string `sub`; `readSession(json, nowSec)` returns the session while `nowSec < exp`, and null at `exp`, for malformed JSON, for a wrong shape, and for a non-numeric `exp`
- [x] T008 Implement `src/web/oidc/settings.ts` (`readOidcSettings`, `OidcSettings` type) until T005 passes; constraints quoted from data-model.md: "sessionSecret at least 32 characters", "sessionSeconds integer 1 to 168, default 8", "issuer https, or http for loopback hosts only"
- [x] T009 [P] Implement `src/web/oidc/next-path.ts` (`safeNext`) until T006 passes
- [x] T010 [P] Implement `src/web/oidc/session.ts` (`newSession`, `readSession`, `Session` type) until T007 passes
- [x] T011 Define the `OidcClient` interface in `src/web/oidc/client.ts` (`authorizeUrl({ state, nonce, verifier }): Promise<string>` and `exchange({ callbackUrl, state, nonce, verifier }): Promise<{ sub: string; name: string | null } | null>`) and `createOidcClient(settings)` using `openid-client` v6 (`discovery`, `randomPKCECodeVerifier`-style helpers supplied by the caller, `calculatePKCECodeChallenge`, `buildAuthorizationUrl`, `authorizationCodeGrant`, `tokens.claims()`); `allowInsecureRequests` only for a loopback issuer. Confirm every call against the installed package's types; this is the only file that imports `openid-client`. Throw typed errors; never log tokens or the secret

**Checkpoint**: `npm run lint:types` clean; foundational tests green.

---

## Phase 3: User Story 1 - Sign in through the identity provider (Priority: P1)

**Goal**: a visitor with no session is sent to the provider and returns signed in.

**Independent Test**: with a fake `OidcClient`, a request for `/jobs` is redirected to `/auth/login?next=%2Fjobs`; the login route redirects to the provider URL and sets `ap_oidc`; a good callback sets `ap_session` and redirects to `/jobs`; a second request with the cookie passes.

### Tests for User Story 1 (write first, confirm they fail)

- [ ] T012 [P] [US1] Write failing tests `src/web/oidc/gate.test.ts` using a small Hono app, a fake `OidcClient` and the gate and routes from T014 to T015: unauthenticated `GET /x` with `Accept: text/html` gives 302 to `/auth/login?next=%2Fx`; the same with `Accept: application/json` or a `POST` gives 401 `text/plain`; `/static/a.css`, `/health` and `/auth/login` are not gated; `GET /auth/login?next=//evil.test` stores `/` in the pending cookie; the redirect carries the provider URL from the fake and sets an `HttpOnly; SameSite=Lax` `ap_oidc` cookie; callback with matching `state` sets `ap_session`, clears `ap_oidc` and redirects to the stored `next`; callback with a different `state`, with no pending cookie, with `error=access_denied`, and with a fake `exchange` that returns null each give 401, set no session and render the retry page; a request carrying the cookie from a successful callback passes the gate and reaches the handler
- [ ] T013 [P] [US1] Add the strings to all four catalogs (`en`, `es`, `fr`, `uk`): `oidc.failed.title`, `oidc.failed.body`, `oidc.failed.retry`, `oidc.unauthorized` (the 401 text); run `npx tsx --test src/i18n/catalog.test.ts` to confirm parity

### Implementation for User Story 1

- [ ] T014 [US1] Implement `src/web/oidc/gate.ts`: `oidcGate({ settings, sessionKey })` middleware per contracts/http-routes.md (exemptions `/auth/`, `/static/`, `/health`; reads `ap_session` with `getSignedCookie`, applies `readSession` with the current time; HTML GET redirects, anything else 401 with `t('oidc.unauthorized')`); expose the verified session on the Hono context for later use
- [ ] T015 [US1] Implement `src/web/oidc/routes.tsx`: `authRoutes({ settings, client })` with `GET /auth/login` (generate state, nonce, verifier with `crypto.randomBytes`/base64url, `safeNext`, set signed `ap_oidc` for 600 s, redirect) and `GET /auth/callback` (read and delete `ap_oidc`, compare state in constant time, call `client.exchange`, set signed `ap_session` using `newSession` with `HttpOnly`, `SameSite=Lax`, `Secure` per settings, redirect to `next`; every failure path logs the reason with pino, no tokens, and returns the retry page with status 401). Make T012 pass
- [ ] T016 [US1] Mount in `src/web/app.ts` at the place Basic Auth is applied today: when `readOidcSettings` is enabled, build the client, `app.use('*', oidcGate(...))` and `app.route('/', authRoutes(...))` before the origin guard and the rest of the routes; keep the guard order so `POST /auth/logout` stays covered by `originGuard()`

**Checkpoint**: US1 works end to end against the fake; with a real provider it is the quickstart's manual check.

---

## Phase 4: User Story 3 - Existing setups keep working (Priority: P1)

**Goal**: no change without OIDC; Basic Auth keeps `/health` when OIDC is on.

**Independent Test**: app built with no OIDC settings behaves as before; app built with OIDC plus `WEB_BASIC_AUTH` accepts Basic credentials on `/health` and rejects them on pages.

### Tests for User Story 3

- [ ] T017 [P] [US3] Extend `src/web/oidc/gate.test.ts` (or add `src/web/app-auth.test.ts` if app.ts cannot be imported without starting a server; extract a small `applyAuth(app, config)` into `src/web/oidc/mount.ts` for the test and use it from `app.ts`): with OIDC off, `/auth/login` is 404 and no gate runs; with OIDC on and `WEB_BASIC_AUTH=u:p`, `/health` without credentials gives 401 with a Basic challenge, with them passes; a page with Basic credentials and no session still redirects to sign-in; with OIDC on and no `WEB_BASIC_AUTH`, `/health` is open

### Implementation for User Story 3

- [ ] T018 [US3] In `src/web/app.ts` (via `mount.ts` if T017 required it): when OIDC is on, apply `basicAuth` to `/health` only when `WEB_BASIC_AUTH` is set; when OIDC is off keep the existing `*` Basic Auth block untouched. Keep the existing fail-closed exit for a malformed `WEB_BASIC_AUTH`
- [ ] T019 [US3] Confirm `src/scripts/health-check.ts` needs no change (it already sends `basicAuthHeader(config.WEB_BASIC_AUTH)`), and that `docker-compose.yml` and the `local` launcher health probes still work; record the finding in the PR body rather than editing them

**Checkpoint**: the full existing suite is still green with no `OIDC_*` set.

---

## Phase 5: User Story 4 - A misconfigured lock does not open the door (Priority: P1)

**Goal**: partial or unusable settings, or an unreachable provider, stop the start.

**Independent Test**: each bad configuration yields exit code 1 and a message naming the variable; nothing is served.

### Tests for User Story 4

- [ ] T020 [P] [US4] Add to `src/web/oidc/settings.test.ts` (or `mount` tests) a case per Story 4 scenario if not already covered in T005, and a test that the start-up helper `startAuth(config, deps)` returns `{ fatal: string }` when `readOidcSettings` errors and when `createOidcClient` rejects (discovery failure), and returns the gate and routes otherwise; the helper is pure over injected `createClient`

### Implementation for User Story 4

- [ ] T021 [US4] Implement `startAuth` in `src/web/oidc/mount.ts` and call it from `src/web/app.ts`: on `fatal`, `logger.error({}, 'web: …')` with the message and `process.exit(1)`, mirroring the existing `WEB_BASIC_AUTH` exit; top-level await or an async init consistent with how `server.ts` starts the app (check `src/web/server.ts` and adapt without making the module start a server on import)
- [ ] T022 [US4] Add the fatal-message strings only to logs (English, not translated, per CLAUDE.md "logs are not translated")

**Checkpoint**: quickstart "Fail closed" scenario passes by hand with a throwaway `.env`.

---

## Phase 6: User Story 2 - Sign out and session expiry (Priority: P2)

**Goal**: an operator can end the session; an old or forged session does not work.

**Independent Test**: after `POST /auth/logout` the next page request redirects to sign-in; a session cookie past `exp` or signed with another key is treated as none.

### Tests for User Story 2

- [ ] T023 [P] [US2] Extend `src/web/oidc/gate.test.ts`: `POST /auth/logout` with a valid session clears `ap_session` (expired `Set-Cookie`) and returns the signed-out page with a link to `/auth/login`; a cookie whose `exp` has passed (fake clock) redirects; a cookie signed with a different secret redirects; a cookie value altered by one character redirects; a cross-origin `POST /auth/logout` is refused by the origin guard when mounted with it
- [ ] T024 [P] [US2] Add catalog strings in all four languages: `oidc.signedOut.title`, `oidc.signedOut.body`, `oidc.signedOut.signIn`, `oidc.signOut` (the sidebar button); run the catalog parity test

### Implementation for User Story 2

- [ ] T025 [US2] Add `POST /auth/logout` and the signed-out page to `src/web/oidc/routes.tsx`
- [ ] T026 [US2] Show a Sign out form (`method="post" action="/auth/logout"`) in the sidebar footer in `src/web/layout.tsx`, only when OIDC is on: pass a boolean from the existing layout props or a module-level getter set by `mount.ts` (choose whichever matches how layout already reads global state such as `employerMode`); follow the accessible-interactions skill (real `<button>`, visible focus, label from `t('oidc.signOut')`), and keep `data-ui="hint"` rules for any helper text
- [ ] T027 [US2] If the layout change adds a Tailwind class not already in `src/web/public/tailwind.css`, run `npm run css` and commit the regenerated file

**Checkpoint**: all four stories pass their independent tests.

---

## Phase 7: Polish and cross-cutting

- [ ] T028 [P] Add a row to `docs/where-to-look.md` ("where does OIDC sign-in live?" and "how do I configure it?") and a short `docs/oidc-login.md` (provider registration, the six variables, redirect URI, the warning that the provider must be restricted to the intended users, session lifetime, how to end every session by rotating `OIDC_SESSION_SECRET`, what `/health` does)
- [ ] T029 [P] Add the CHANGELOG entry in `CHANGELOG.md` in the format the file already uses, and update the dashboard-security wording in `README.md` / `SECURITY.md` if they say "Basic Auth only"
- [ ] T030 Run `npm run lint:types`
- [ ] T031 Run the whole suite: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy npx tsx --test "src/**/*.test.ts"` and compare with the baseline (3,499 tests, 0 failing); paste the totals
- [ ] T032 Run `npm run exports:audit`; fix any export that nothing outside its own file uses (drop `export` or use it)
- [ ] T033 Run `npm audit --omit=dev --audit-level=high`
- [ ] T034 Run the route smoke on a throwaway database only (`npm run build` then `npm run smoke:routes`, see `.github/workflows/test.yml` for the env); if no throwaway Postgres is available, say so and list it as unverified instead of running it against real data
- [ ] T035 Walk the quickstart: default-unchanged and fail-closed by hand; list the real-provider scenario as unverified unless a provider is available
- [ ] T036 Review the diff against the repo rules (testing-gate, commit-discipline, code-review-expert) before the review stage

---

## Dependencies and execution order

- Phase 1 first. T003 before T004 (the parity test needs both). T002 is independent.
- Phase 2 blocks all stories. T005 to T007 in parallel, then T008 to T010 (each after its own test), then T011.
- US1 (Phase 3) needs Phase 2. US3 and US4 need US1's mount point (T016) to exist. US2 needs US1's routes and gate.
- Suggested order: US1, US3, US4, US2. US1 alone is the MVP but must not ship without US3 and US4, since they protect existing and misconfigured installs.
- Polish last.

## Parallel examples

- Phase 2: T005, T006, T007 together; then T009 and T010 together.
- US1: T012 and T013 together before T014 to T016.
- Polish: T028 and T029 together.

## Implementation strategy

1. Land Setup and Foundational with their tests.
2. Build US1 against the fake client, then wire US3 and US4 so the feature is safe to switch on.
3. Add US2.
4. Polish, docs, verification evidence, then the review stage.
Commit per story or phase with `(#2, USn)` suffixes and include the checkbox updates in the same commit.
