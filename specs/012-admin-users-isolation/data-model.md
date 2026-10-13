# Data model: Admin role, users page and isolation tests (#12)

No schema change and no migration.

## Existing entities used
- `User` (id, oidcSub, name, role `ADMIN|MEMBER`, createdAt, primaryProfileId): the role is the only authorization input. Deleting a row cascades to profiles, user jobs, stage events, resumes (and their matches, letters, reviews), facts, packs, user settings, notification targets and company mutes (slices 1-5).
- `CronRun.userId` (nullable int, no foreign key): a user's own recap and nudge runs; deleted explicitly with the user.

## Derived (not stored)
- `RouteAccess`: `'admin' | 'personal' | 'open'` per method and path (`users/admin-policy.ts`).
- `UserChange`: `'promote' | 'demote' | 'remove'`; `Verdict`: `ok | not-found | self | last-admin | no-change`.
- `UserSummary` for the users page: id, name, role, createdAt, lastActiveAt|null, counts `{ searches, postings, resumes, destinations }`.

## State transitions
MEMBER -> ADMIN (promote, by another admin) · ADMIN -> MEMBER (demote, by another admin, only if another admin remains) · any -> removed (by another admin, never the last admin).
