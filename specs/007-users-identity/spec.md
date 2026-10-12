# Feature: Users table, identity and request context (issue #7, slice 1 of 6 of #5)

Shared job catalog, private per-user workspace. This slice adds who is using the install; no existing table is scoped yet.

## Requirements
- FR1: a `users` table (id, oidcSub unique nullable, name, role ADMIN|MEMBER, createdAt). The migration creates the default admin user (id 1) so existing data has an owner.
- FR2: first OIDC sign-in provisions a user from the `sub`; the first user (taking over the default user) is admin, later ones are members. Repeat sign-ins find the same user.
- FR3: the session carries the user id; an old session without one is treated as signed out.
- FR4: without OIDC (open or Basic Auth) the dashboard runs as the default user; behaviour is unchanged.
- FR5: a request-scoped `currentUser()` for dashboard code; a `userId: number` argument convention for worker code.
- FR6: ADR 0065; SPEC/PRODUCT/CLAUDE/where-to-look updated.

## Non-goals
Scoping any table, users page, role management, per-user AI keys, employer mode.

## Acceptance
- Migration applies on an existing database and leaves `prisma migrate diff` empty.
- Unit tests: provisioning decision, session shape, request context (session, no session, DB down, /health).
- Route smoke passes with no OIDC.
