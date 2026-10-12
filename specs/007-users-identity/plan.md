# Plan

- `prisma/schema.prisma` + migration `20261012200000_users`: enum `UserRole`, model `User`, seed row id 1 "Default user" ADMIN, sequence advanced.
- `src/users/identity.ts` (pure): `DEFAULT_USER_ID`, `CurrentUser`, `FALLBACK_USER`, `Identity`, `provisionStep`.
- `src/users/store.ts` (Prisma): `loadUser`, `provisionOidcUser` (known / claim default via guarded updateMany / create; P2002 race re-read).
- `web/oidc/session.ts`: `identityOf`, `newSession(identity, uid, ...)`, `uid` in the cookie; `gate.ts` puts the session on the Hono context; `routes.ts` takes a `ProvideUser`.
- `web/current-user.ts`: AsyncLocalStorage + `withCurrentUser(load)` middleware wired in `app.ts` after the lock; sidebar shows the name when sign-in is on.
- Docs: ADR 0065, SPEC, PRODUCT, CLAUDE.md, where-to-look, oidc-login.md.

Decisions without asking: first sign-in claims the default user; old sessions force a re-login; a vanished user row is a 401; DB down with no session falls back to a built-in default user so pages stay up.
