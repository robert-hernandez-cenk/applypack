# Research: OIDC login for the dashboard

## R1. Client library
- **Decision**: `openid-client` ^6.8 (functional API over `oauth4webapi` and `jose`).
- **Rationale**: maintained, certified; does discovery, PKCE helpers and ID-token validation (issuer, audience, nonce, signature, expiry) in `authorizationCodeGrant`. Chosen by the operator in brainstorming.
- **Alternatives**: `jose` plus a hand-written flow (more code to get wrong); `oauth4webapi` directly (lower level, same author); a Hono OIDC middleware (adds an opinionated session layer we do not want).
- **API notes (v6)**: `discovery(issuerUrl, clientId, clientSecret)`, `randomPKCECodeVerifier`, `calculatePKCECodeChallenge`, `randomState`, `randomNonce`, `buildAuthorizationUrl`, `authorizationCodeGrant(config, currentUrl, { pkceCodeVerifier, expectedState, expectedNonce })`, `tokens.claims()`. A plain-http issuer needs the `allowInsecureRequests` execute option, used only for loopback. Exact signatures are confirmed against the installed package when the client is written.

## R2. Session storage
- **Decision**: signed cookie, no server store.
- **Rationale**: no migration, sessions survive a restart; Hono ships `setSignedCookie` (HMAC-SHA256). The payload is tiny (`sub`, display name, `exp`).
- **Alternatives**: a Postgres session table (migration, cleanup job, worker/web coupling); an in-memory map (loses sessions on restart).
- **Trade-off**: no server-side revocation. Logout clears the cookie only, and rotating `OIDC_SESSION_SECRET` ends every session. Accepted for a single-operator tool and documented.

## R3. Pending sign-in state
- **Decision**: a second signed cookie `ap_oidc`, 10 minutes, `SameSite=Lax` (it must survive the top-level redirect back), cleared on callback.
- **Rationale**: keeps the flow stateless and binds the callback to the browser that started it, which is the purpose of `state`.
- **Alternatives**: server-side map (lost on restart, needs expiry).

## R4. Config validation
- **Decision**: optional fields in `ConfigSchema`; cross-field validation in a pure `readOidcSettings`.
- **Rationale**: `env-example.test.ts` reads `ConfigSchema.shape`, and a `superRefine` would turn the schema into an effect without `.shape`. A pure function is also directly testable.

## R5. `/health` when OIDC is on and no shared password is set (FR-010)
- **Decision**: keep today's rule. Basic Auth guards `/health` only if `WEB_BASIC_AUTH` is set; otherwise it is open.
- **Rationale**: the health script and compose file stay unchanged; the endpoint discloses only reachability and last fetch status; an operator who wants it locked sets `WEB_BASIC_AUTH`, which the health script already sends.
- **Alternatives**: a separate health token (new setting, compose change); requiring `WEB_BASIC_AUTH` whenever OIDC is on (breaks a valid setup for little gain).

## R6. Non-browser requests
- **Decision**: redirect only a GET that accepts `text/html`; everything else gets 401.
- **Rationale**: pages poll `*/state` endpoints with fetch and post forms; following a redirect to the provider's HTML would fail confusingly.

## R7. Existing cross-origin guard
- It already refuses cross-site POSTs, so `POST /auth/logout` needs no token. `SameSite=Lax` on the session cookie adds a second layer.

## R8. Real provider shapes
- No live provider is available in this session. Unit and route tests use a fake client; the quickstart lists a manual check against a real provider (for example a local Keycloak or Dex container), reported as unverified until someone runs it.
