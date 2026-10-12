# Data Model: OIDC login for the dashboard

No database tables. Two signed cookies and one settings object.

## OidcSettings (from env, validated by `readOidcSettings`)

| Field | Source | Rule |
|-------|--------|------|
| issuer | `OIDC_ISSUER` | URL; https, or http for loopback hosts only |
| clientId | `OIDC_CLIENT_ID` | non-empty |
| clientSecret | `OIDC_CLIENT_SECRET` | non-empty |
| sessionSecret | `OIDC_SESSION_SECRET` | at least 32 characters |
| publicUrl | `WEB_PUBLIC_URL` | http(s) origin, no path, trailing slash removed |
| redirectUri | derived | `publicUrl` + `/auth/callback` |
| sessionSeconds | `OIDC_SESSION_HOURS` | integer 1 to 168, default 8 |
| secureCookies | derived | `publicUrl` is https |

Result: `{ enabled: false } | { enabled: true; settings } | { error: string }`. `error` when `OIDC_ISSUER` is set and any other required value is missing or invalid, or when other `OIDC_*` values are set without `OIDC_ISSUER`.

## Session (cookie `ap_session`, signed)

`{ sub: string; name: string | null; exp: number }`. `sub` is non-empty (the provider's stable id). `name` comes from `name`, `preferred_username` or `email`, for display and logs only. `exp` is the issue time plus `sessionSeconds`, epoch seconds. Valid when the signature checks and `now < exp`.

## PendingSignIn (cookie `ap_oidc`, signed, 10 minutes)

`{ state: string; nonce: string; verifier: string; next: string }`. `next` has already passed `safeNext`. Consumed and deleted by the callback.

## State transitions

anonymous, then (login) pending, then (callback ok) signed in, then (logout or expiry) anonymous. A callback failure returns to anonymous with the pending cookie cleared.
