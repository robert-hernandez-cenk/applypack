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

## Users and roles

Signing in creates or finds the person's row in `users` (ADR 0065). The first
person to sign in takes over the install's default user — and so everything the
install held before — and is its **administrator**; anyone after is a **member**.
Sessions issued before multi-user support carry no user id, so everyone signs in
once more after upgrading.

| | Administrator | Member |
| --- | --- | --- |
| Their own searches, jobs, resumes, comparisons, letters, applications | yes | yes |
| Their own alerts, chats, mutes, language, time zone, pack settings | yes | yes |
| Companies page | sources, watchlist, folders, starter packs | their muted companies only |
| Runs | read, and "Fetch now" | read only |
| Discovery, imports, AI usage, AI engine and keys, source keys, fetch schedule and pause, update check | yes | no (403) |
| Employer mode and its screenings, the setup wizard | yes | no (403) |
| The Users page | yes | no (403) |

**Managing people.** Administrators open **Users** in the menu: promote a member,
demote another administrator, or remove a user. Removing a person deletes their
searches, job list, resumes and everything on them, destinations and mutes (the
confirm lists the counts); the shared job catalog stays. If they sign in again
they come back as a new member. Nobody can demote or remove themselves (ask
another administrator), and the last administrator can never be demoted or
removed, so the install is never left without one.

**Restrict who can sign in at the provider.** There are no invitations or
approvals: everyone the provider authenticates becomes a member and can read the
shared job catalog and use the AI engine for their own comparisons.
Per-person AI keys are not supported; the engine and its spend are the
administrators'.
