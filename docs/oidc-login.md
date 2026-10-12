# Sign in through your identity provider (OpenID Connect)

By default the dashboard has no login (it listens on your own machine only), or
one shared `user:password` pair in `WEB_BASIC_AUTH`. If you run ApplyPack on a
server and already have an identity provider — Keycloak, Authentik, Authelia,
Google, Microsoft Entra, Okta, Auth0, Dex — the dashboard can sign people in
through it instead. See [ADR 0064](./adr/0064-oidc-login-for-the-dashboard.md)
for why it works the way it does.

> **Anyone your provider signs in is let in.** ApplyPack keeps no list of
> allowed people of its own, so restrict the client at the provider — to your
> own account, a group, or your organisation — before you switch this on. With a
> public provider such as Google and no restriction, any account holder could
> open your dashboard: your resumes, your jobs, your API keys.

## 1. Register the dashboard at the provider

Create a **confidential** OpenID Connect client (web application, authorization
code flow) and give it one redirect URI:

```
<WEB_PUBLIC_URL>/auth/callback        e.g.  https://jobs.example.com/auth/callback
```

Keep the client ID and client secret. The client must be allowed the scopes
`openid profile email`.

## 2. Set the dashboard's side

In `.env` (see `.env.example`). Set **all** of these; the dashboard refuses to
start with some of them missing, and says which:

| Setting | What it is |
| --- | --- |
| `OIDC_ISSUER` | The provider's address, `https://…`. The dashboard finds the rest at `<issuer>/.well-known/openid-configuration`. `http://` is accepted only for `localhost`. |
| `OIDC_CLIENT_ID` | From step 1. |
| `OIDC_CLIENT_SECRET` | From step 1. |
| `OIDC_SESSION_SECRET` | At least 32 random characters, for example `openssl rand -base64 48`. Signs the sign-in cookie. |
| `WEB_PUBLIC_URL` | The address you open the dashboard at, with no path: `https://jobs.example.com`. Behind a reverse proxy, the address outside it. |
| `OIDC_SESSION_HOURS` | Optional. How long a sign-in lasts, 1 to 168. Default 8. |

Restart the dashboard. If the provider cannot be reached at start, it stops with
a message saying so rather than running without the lock.

## What changes

- Opening any page without a sign-in sends you to the provider, and back to the
  page you asked for. **Sign out** is in the menu.
- Scripts and `curl` get a `401` instead of a redirect.
- `WEB_BASIC_AUTH`, if you keep it set, no longer opens pages. It guards
  `/health` only — the container healthcheck sends it. With it unset, `/health`
  is open, as it always was; it says whether the database answers and when the
  last fetch ran, nothing more.
- Static files (the stylesheet) and `/health` need no sign-in.
- With none of the `OIDC_*` settings, nothing changes.

## Good to know

- **Signing out** ends the dashboard's session in that browser. It does not sign
  you out of the provider, so the next visit may sign you straight back in.
- **Ending every session at once:** change `OIDC_SESSION_SECRET` and restart.
  Sessions are not stored on the server, so there is no list to clear.
- **Two ApplyPack installs on one domain** should have different
  `OIDC_SESSION_SECRET`s; a session from one is then not accepted by the other.
- Serve the dashboard over https when it leaves your machine; cookies are marked
  `Secure` when `WEB_PUBLIC_URL` is https.
- The worker is not involved and needs none of these settings.
