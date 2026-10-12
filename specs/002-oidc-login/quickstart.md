# Quickstart: validating OIDC login

## Automated (no provider needed)

```bash
npm run lint:types
npx tsx --test "src/web/oidc/*.test.ts" src/env-example.test.ts src/i18n/catalog.test.ts
```

`npm test` itself does not expand its file list under cmd.exe on Windows; use the glob form there.

Expected: all pass. The gate tests cover redirect vs 401, forged or expired cookie, callback mismatch, open-redirect rejection, and the `/health` and `/static` exemptions.

## Default unchanged

Start with no `OIDC_*` set (`npm start`, or the route smoke on a throwaway database). Expected: identical to the previous release; `/auth/login` is 404.

## Fail closed

Set only `OIDC_ISSUER=https://idp.example.test`. Expected: the dashboard exits 1 with a message naming `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SESSION_SECRET` and `WEB_PUBLIC_URL`.

## Against a real provider (manual)

1. Register a confidential client at the provider with redirect URI `<WEB_PUBLIC_URL>/auth/callback`.
2. Set the six variables in `.env` and restart the dashboard.
3. Open `/jobs` in a private window: you are sent to the provider, sign in, and land on `/jobs`.
4. Press Sign out in the sidebar, then reload `/jobs`: you are sent to the provider again.
5. `curl -i <url>/overview` gives 401 (no `text/html` in Accept); `curl -u user:pass <url>/health` works when `WEB_BASIC_AUTH` is set.

Not run in CI; reported as unverified in the PR until someone runs it.
