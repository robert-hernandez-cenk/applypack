# HTTP contract: sign-in routes

Present only when OIDC is configured. With it off, `/auth/*` does not exist (404) and no gate runs.

| Route | Auth | Behaviour |
|-------|------|-----------|
| `GET /auth/login?next=<path>` | none | Sets `ap_oidc`; 302 to the provider's authorization endpoint (code flow, PKCE S256, scope `openid profile email`). `next` is sanitised; invalid becomes `/`. |
| `GET /auth/callback?code&state` | `ap_oidc` | Validates state, nonce, PKCE and ID token. Success: sets `ap_session`, clears `ap_oidc`, 302 to `next`. Failure (provider error, mismatch, missing `sub`, expired pending cookie): clears `ap_oidc`, 401 page with a retry link, reason logged without tokens. |
| `POST /auth/logout` | session | Clears `ap_session`; 200 "signed out" page with a sign-in link. Same-origin only (existing guard). |
| `GET /health` | Basic if `WEB_BASIC_AUTH` is set, else open | Unchanged response. Never needs a session. |
| `GET /static/*` | none | Unchanged. |
| everything else | `ap_session` | Valid: continues. Missing or invalid, and a `GET` accepting `text/html`: 302 to `/auth/login?next=<path+query>`. Otherwise 401 `text/plain`. |

Cookies: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` if and only if `WEB_PUBLIC_URL` is https. `ap_session` max-age is the session lifetime; `ap_oidc` max-age is 600 seconds.
