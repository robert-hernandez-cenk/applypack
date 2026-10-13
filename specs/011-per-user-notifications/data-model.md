# Data model: Per-user notifications and settings

## UserSettings (`user_settings`)
| Column | Type | Default |
|---|---|---|
| userId | Int PK, FK users cascade | |
| telegramEnabled | Boolean | true for a new person (they hear their matches once they add a chat); row 1 is copied from the old value |
| applicationTrackingEnabled | Boolean | true |
| staleApplicationsDigestEnabled | Boolean | true |
| reapplyDays | Int? | null |
| coverAngles | Json? | null |
| pipelineStages | Json? | null |
| schedule | Json? | null (alerts + zone) |
| pack | Json? | null (off) |
| locale | String? | null |
| updatedAt | DateTime | |


## NotificationTarget
Adds `userId Int @default(1)` -> users (cascade), `@@index([userId])`; `@@unique([userId, botToken, chatId])`, `@@unique([userId, webhookUrl])`.

## CompanyMute
Adds `userId Int @default(1)` -> users (cascade); `@@id([userId, key])`.

## CronRun
Adds `userId Int?` (no FK), `@@index([name, userId, startedAt])`.

## AppSettings
Drops: telegramEnabled, applicationTrackingEnabled, staleApplicationsDigestEnabled, reapplyDays, coverAngles, pipelineStages, pack, locale. Keeps `schedule` (global fetch half).

## Relations
`User.settings UserSettings?`, `User.notificationTargets`, `User.companyMutes`.
