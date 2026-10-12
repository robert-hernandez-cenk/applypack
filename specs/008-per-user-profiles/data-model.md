# Data model

| Entity | Change |
|---|---|
| `Profile` | + `userId Int` (default 1, FK `users.id`, cascade, indexed) |
| `User` | + `primaryProfileId Int?` (unique, FK `profile.id`, SetNull) |
| `AppSettings` | - `activeProfileId` (moved to `User.primaryProfileId`) |
| `JobScore` | unchanged (per profile) |

Rules: a primary belongs to its user and is always running; a user may run at most `MAX_ACTIVE_PROFILES` (8) searches; deleting a user cascades their searches.
