# 0065 — An install has users; the catalog is shared, the workspace is private

**Status:** Accepted (2026-10-12). Slice 1 of 6 of issue #5. Supersedes the
single-user stance of [0004](./0004-single-active-profile.md) for the
workspace; builds on [0064](./0064-oidc-login-for-the-dashboard.md).

## Context

One deployment served one person; a second person ran a second install. With
sign-in available (0064) several people can share one server, and the job
catalog (companies, fetched postings) is the same for all of them while
searches, resumes, job state and alerts are each person's own. This slice lays
the identity those later slices hang their data on; it scopes no table yet.

## Decision

- **A `users` table** (`User`: id, `oidcSub` unique and nullable, name, role
  `ADMIN | MEMBER`, createdAt). The migration creates row 1, "Default user",
  an admin: the owner of everything that exists today (`DEFAULT_USER_ID`).
- **Users are provisioned from the OIDC `sub`** on first sign-in. The first
  person to sign in takes over the default user (so an existing install's data
  stays with its owner, who is its admin); everyone after is a `MEMBER`. The
  claim is a guarded `UPDATE … WHERE oidcSub IS NULL`, and a duplicate `sub` is
  settled by the unique index.
- **The session carries the user id** (`uid`). A session cookie without one
  (issued before this change) reads as no session: the person signs in again.
- **Without OIDC there is one implicit user**, the default user, for the open
  dashboard and for Basic Auth alike. Nothing changes for those installs.
- **Request context.** `web/current-user.ts` sets the user for the request
  (an `AsyncLocalStorage`, like the display zone) and pages and routes read
  `currentUser()`. A session whose user row is gone is a 401. `/health`,
  `/auth/` and `/static/` run without a user, so they never need the database.
- **Worker convention.** The worker has no request: code that works on a
  person's data takes `userId: number` and its caller says whose. Until a
  slice scopes a table, callers pass `DEFAULT_USER_ID`.

## Consequences

- Any person the provider authenticates becomes a user (0064's "anyone the
  provider lets in"), now with their own row. Restrict the client at the
  provider.
- Deleting a user, a users page and role changes belong to slice 6.
- Per-user AI keys and employer mode (screenings) are out of scope for the epic.

## Alternatives considered

- **A separate default user kept apart from the first OIDC user.** Existing
  data would belong to nobody who can sign in.
- **Keeping the user in the session only.** Roles and later per-user rows need
  a row to point at.
- **Passing the user through the Hono context to layouts.** The sidebar and
  other deep components have no context; the async store reaches them.
