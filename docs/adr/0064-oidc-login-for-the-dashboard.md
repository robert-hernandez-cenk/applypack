# 0064 — The dashboard can sign in through an OpenID Connect provider

**Status:** Accepted (2026-10-12). Builds on the cross-origin write guard
(issue #69) and the optional Basic Auth lock (`WEB_BASIC_AUTH`).

## Context

The dashboard's only lock was one shared username and password, optional, sent
with every request by the browser's own prompt. An operator who runs ApplyPack
on a server and already has an identity provider had no way to use it (issue
#2). Basic Auth also cannot be ended: there is no sign-out.

## Decision

- **Opt in with `OIDC_ISSUER`.** With it unset nothing changes and `/auth/*`
  does not exist. With it set, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
  `OIDC_SESSION_SECRET` (32 characters or more) and `WEB_PUBLIC_URL` are
  required; `OIDC_SESSION_HOURS` defaults to 8. `readOidcSettings` is pure and
  checks them together, so a half-written block, or a provider that does not
  answer discovery, stops the start (exit 1) — never an open dashboard.
- **Authorization-code flow with PKCE through `openid-client` v6.** It does
  discovery and validates the ID token (signature, issuer, audience, nonce,
  expiry). Only `web/oidc/client.ts` imports it; routes take an `OidcClient`,
  so tests use a fake.
- **No server-side state.** The pending sign-in (state, nonce, verifier, the
  page asked for) rides in a signed `ap_oidc` cookie for ten minutes; the
  session is a signed `ap_session` cookie holding `{ sub, name, exp }`, `exp`
  checked on every request. HttpOnly, SameSite=Lax, Secure when
  `WEB_PUBLIC_URL` is https. No table, no migration, a restart signs nobody out.
- **OIDC replaces Basic Auth for pages.** A browser GET that accepts HTML is
  redirected to sign in; anything else (form posts, the polled `/state`
  endpoints, curl) gets a 401. `WEB_BASIC_AUTH`, when set, then guards
  `/health` only — the container healthcheck already sends it — and with it
  unset `/health` is open exactly as before.
- **Anyone the provider authenticates is let in.** The dashboard has one role
  and no per-user data, so it keeps no allowlist of its own; the documentation
  says to restrict the client at the provider.
- **Sign-out is a POST**, covered by the existing origin guard.

## Consequences

- One new runtime dependency (`openid-client`, with `jose` and `oauth4webapi`).
- No server-side revocation: signing out clears the browser's cookie; ending
  every session means changing `OIDC_SESSION_SECRET`. Sign-out does not sign
  the person out of the provider.
- The provider must answer at start. An outage while the dashboard runs does
  not matter until someone needs a new sign-in.
- The worker is untouched and never imports `web/oidc/`.

## Alternatives considered

- **`jose` and a hand-written flow.** Smaller dependency, but state, nonce,
  issuer and audience checks become ours to get wrong.
- **A session table in Postgres.** Gives revocation, costs a migration, a
  cleanup job and a table both services touch.
- **An allowlist of emails or a domain.** Safer with a public provider, but a
  second configuration surface for a one-role tool; left to the provider.
- **Keeping Basic Auth for pages as well.** Two ways in, and the weaker one
  would remain.

## When to revisit

If the dashboard gains more than one role or per-person data, an allowlist
(or groups from the ID token) and server-side sessions come back on the table.
