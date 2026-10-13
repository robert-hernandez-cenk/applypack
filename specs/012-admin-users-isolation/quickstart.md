# Quickstart: validating #12

Prerequisites: Node 24, `npm install`, `DATABASE_URL` set (any value for unit tests).

1. Unit tests: `npx tsx --test "src/**/*.test.ts"` - the admin policy, the rules, the delete confirm, the run ownership and the catalog.
2. Types and exports: `npm run lint:types && npm run exports:audit`.
3. Route smoke on a scratch database (never the live data folder):
   `APPLYPACK_DATA_DIR=<scratch> npm run db`, then `npm run build && npm run smoke:routes` against a fresh database each run. Expect: every route classified, member sweep green, users-page checks green, pseudo-language pass clean except the known Claude Code version string on `/settings?tab=ai` and `/welcome?step=ai`.
4. By hand (optional): start with OIDC settings (docs/oidc-login.md), sign in as the first person (administrator), sign in as a second (member): the member sees no Discovery/AI usage/Users in the menu, `/settings/ai/key` answers 403, the administrator's `/users` page lists both and refuses to demote the last administrator.
5. Screenshots of `/users` at 375 px and 1280 px per the testing gate.
