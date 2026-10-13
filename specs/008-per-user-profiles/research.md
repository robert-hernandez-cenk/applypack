# Research

- **Primary location**: `User.primaryProfileId` (unique FK, SetNull) over `Profile.isPrimary` + partial unique index. Mirrors the old `AppSettings.activeProfileId` shape, so the "primary" lookups stay a one-hop read and the migration is a single UPDATE. Rejected: boolean column (needs a partial unique index Prisma cannot express, so `migrate diff` would drift).
- **Drop vs keep the old column**: drop, one source of truth. Rejected keeping it dormant (two answers to "which is primary").
- **Cap scope**: per user (spec FR3). A global cap would let one person lock others out.
- **Worker iteration**: no per-user loop. One classifier call scores a posting against `listAllActiveProfiles()`; JobScore rows are per profile, so a view filters by profile owner. Rejected: a call per user (cost multiplies by users, the shared catalog is the point).
- **Foreign id handling**: ownership folded into the `where` so a foreign id and a deleted id both miss, giving one error path and no existence leak.
- **New member's first search**: blank, running, primary, via `ensurePrimaryProfile` at provisioning; pages already handle a blank primary (wizard/blank banner), so nothing new in the UI.
- **Alerts**: untouched; a search's `notificationTargetId` still points at install-wide targets until slice 5.
