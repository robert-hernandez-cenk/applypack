# Implementation Plan: OIDC login for the dashboard

**Branch**: `issue-2-oidc-login` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-oidc-login/spec.md` (GitHub issue #2)

## Summary

Add an optional OpenID Connect sign-in to the Hono dashboard. When `OIDC_ISSUER` is set, a middleware replaces Basic Auth for pages: a visitor with no valid session is sent through the authorization-code flow with PKCE (`openid-client` v6), and on return gets a signed, expiring, httpOnly session cookie. State for the round trip (state, nonce, PKCE verifier, return path) rides in a second short-lived signed cookie, so nothing is stored server side and no migration is needed. `/health` keeps today's rule exactly (Basic Auth if `WEB_BASIC_AUTH` is set, open otherwise), which settles FR-010. A partial configuration or an unreachable provider exits at start. The worker is untouched.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 runtime (engines >=22)

**Primary Dependencies**: Hono 4 (`hono/cookie` signed cookies, already installed); new: `openid-client` ^6.8 (pulls `jose` and `oauth4webapi`). ADR 0064 records it.

**Storage**: none. Session and pending sign-in are signed cookies. No Prisma change.

**Testing**: Node test runner via tsx (`npx tsx --test "src/**/*.test.ts"`); pure modules unit-tested; route wiring covered by `app.request()` tests with a fake provider client; route smoke unchanged.

**Target Platform**: server install (Docker) and `npm start`; browser dashboard.

**Project Type**: web-service (dashboard) in an existing repo.

**Performance Goals**: one extra HMAC verification per request; provider contacted only at start, sign-in and callback.

**Constraints**: worker must not run an HTTP server or import the OIDC module; default behaviour unchanged with no `OIDC_*` set; secrets only from env, never logged or rendered; every user-visible string through `t()` with all four catalogs (en, es, fr, uk); `.env.example` parity test must stay green; named exports only; pino logging.

**Scale/Scope**: single-operator dashboard; about 8 new source files, 1 env block, 1 ADR, docs.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled Spec Kit template, so there are no project gates. The repo's CLAUDE.md rules act as the gate and are listed under Constraints above. Result: PASS. Post-design re-check: PASS (no worker change, no new server, one justified dependency).

## Design decisions

1. **Enablement and validation**: `OIDC_ISSUER` turns it on. A pure `readOidcSettings(env)` in `src/web/oidc/settings.ts` returns `{ enabled: false }`, `{ enabled: true, settings }` or `{ error }`. It is not a zod refinement on `ConfigSchema`, because `env-example.test.ts` reads `ConfigSchema.shape`. The six variables are still declared in `ConfigSchema` as optional strings. `app.ts` calls the reader at start and exits 1 with the message on `error` (FR-011).
2. **Settings**: `OIDC_ISSUER` (https; http allowed only for loopback hosts), `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SESSION_SECRET` (at least 32 chars), `WEB_PUBLIC_URL` (http/https origin; the redirect URI is `<WEB_PUBLIC_URL>/auth/callback`), `OIDC_SESSION_HOURS` (default 8, 1 to 168).
3. **Flow**: `GET /auth/login?next=/path` builds state, nonce and a PKCE pair, stores them with the sanitised return path in the signed `ap_oidc` cookie (10 min), redirects to the provider. `GET /auth/callback` reads and clears that cookie, runs `authorizationCodeGrant` with the expected state, nonce and verifier (which validates the ID token), requires a `sub` claim, and sets the `ap_session` cookie. `POST /auth/logout` clears it and renders a signed-out page. Logout is POST so the existing origin guard covers it.
4. **Session**: `ap_session` is a signed cookie holding `{ sub, name, exp }` (exp in epoch seconds, checked on every request in addition to the cookie's max-age). `HttpOnly`, `SameSite=Lax`, `Secure` when `WEB_PUBLIC_URL` is https. Signed with Hono's HMAC using `OIDC_SESSION_SECRET`; a different key means no session, so two installs on one domain with different secrets fail closed.
5. **Gate**: one middleware, mounted where Basic Auth is today. Exempt: `/auth/*`, `/static/*`, `/health`. Without a session: a GET that accepts `text/html` is redirected to `/auth/login?next=<path+query>`; anything else gets 401 plain text (FR-004).
6. **Open redirect**: `safeNext()` (pure) accepts only a path beginning with a single `/`, no `//`, no backslash, no scheme; anything else becomes `/`.
7. **`/health` (FR-009, FR-010)**: when OIDC is on, `WEB_BASIC_AUTH` protects `/health` only; unset, `/health` is open exactly as today. The health script already sends the Basic header, so it is unchanged. `/health` returns only `ok`, `db`, `lastFetch`.
8. **Provider failures**: discovery runs at start (exit 1 on failure). A callback failure logs the reason (no tokens) and renders a "sign-in did not complete" page with a retry link, status 401. Existing sessions keep working while the provider is down (stateless).
9. **UI**: a sign-out form in the sidebar footer, shown only when OIDC is on, and two small pages (signed out; sign-in failed). Words go in the catalogs in all four languages. Both pages follow `layout.tsx`.
10. **Testability seam**: the provider is behind a small `OidcClient` interface (`authorizeUrl`, `exchange`) in `src/web/oidc/client.ts`, the only file importing `openid-client`. Routes take the client by injection, so tests use a fake.
11. **Docs**: ADR 0064 (dependency added; stateless cookie sessions; OIDC replaces Basic for pages), `docs/where-to-look.md`, `.env.example`, a short `docs/` page, CHANGELOG entry per repo habit.

## Project Structure

### Documentation (this feature)

```text
specs/002-oidc-login/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-routes.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── config.ts                      # + six optional OIDC_* / WEB_PUBLIC_URL fields
├── web/
│   ├── app.ts                     # mount gate; scope Basic Auth to /health when enabled
│   ├── layout.tsx                 # sign-out form in the sidebar when enabled
│   └── oidc/
│       ├── settings.ts            # pure: readOidcSettings
│       ├── settings.test.ts
│       ├── next-path.ts           # pure: safeNext
│       ├── next-path.test.ts
│       ├── session.ts             # pure: encode/decode/expiry of the payload
│       ├── session.test.ts
│       ├── client.ts              # only importer of openid-client
│       ├── routes.tsx             # /auth/login, /auth/callback, /auth/logout + pages
│       ├── gate.ts                # middleware
│       └── gate.test.ts           # app.request() with a fake client
├── i18n/catalog/{en,es,fr,uk}.json  # new keys
.env.example                       # OIDC block
docs/adr/0064-oidc-login-for-the-dashboard.md
docs/where-to-look.md
CHANGELOG.md
package.json / package-lock.json   # openid-client
```

**Structure Decision**: a new `src/web/oidc/` folder, web-only (the worker never imports it), pure decisions split from I/O per CLAUDE.md. The `exports:audit` gate means each export must be used outside its own file or by a test seam.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New runtime dependency | Discovery, PKCE and ID-token validation are security-critical | Hand-rolling them with `jose` makes us own state, nonce, issuer and audience checks |
