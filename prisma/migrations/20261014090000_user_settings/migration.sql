-- What is a person's own in the settings, the chats and the mutes (ADR 0069).
-- Everything that exists is the default user's (id 1).

-- The personal half of app_settings, one row per person. Row 1 is the old
-- singleton's values; a later person gets theirs on first read.
CREATE TABLE "user_settings" (
    "userId" INTEGER NOT NULL,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "applicationTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "staleApplicationsDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reapplyDays" INTEGER,
    "coverAngles" JSONB,
    "pipelineStages" JSONB,
    "schedule" JSONB,
    "pack" JSONB,
    "locale" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_settings" ("userId", "telegramEnabled", "applicationTrackingEnabled", "staleApplicationsDigestEnabled",
    "reapplyDays", "coverAngles", "pipelineStages", "schedule", "pack", "locale", "updatedAt")
SELECT 1, "telegramEnabled", "applicationTrackingEnabled", "staleApplicationsDigestEnabled",
    "reapplyDays", "coverAngles", "pipelineStages", "schedule", "pack", "locale", CURRENT_TIMESTAMP
FROM "app_settings" WHERE "id" = 1;

-- app_settings.schedule stays: it is now the install's half (zone + fetch).
ALTER TABLE "app_settings" DROP COLUMN "applicationTrackingEnabled",
DROP COLUMN "coverAngles",
DROP COLUMN "locale",
DROP COLUMN "pack",
DROP COLUMN "pipelineStages",
DROP COLUMN "reapplyDays",
DROP COLUMN "staleApplicationsDigestEnabled",
DROP COLUMN "telegramEnabled";

-- A destination is a person's own; the same chat may be two people's.
ALTER TABLE "notification_target" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "notification_target_botToken_chatId_key";
DROP INDEX "notification_target_webhookUrl_key";
CREATE INDEX "notification_target_userId_idx" ON "notification_target"("userId");
CREATE UNIQUE INDEX "notification_target_userId_botToken_chatId_key" ON "notification_target"("userId", "botToken", "chatId");
CREATE UNIQUE INDEX "notification_target_userId_webhookUrl_key" ON "notification_target"("userId", "webhookUrl");
ALTER TABLE "notification_target" ADD CONSTRAINT "notification_target_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A mute is a person's own: the key is unique per person.
ALTER TABLE "company_mute" DROP CONSTRAINT "company_mute_pkey",
ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "company_mute_pkey" PRIMARY KEY ("userId", "key");
ALTER TABLE "company_mute" ADD CONSTRAINT "company_mute_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A recap or nudge run belongs to the person it was for; NULL (every row
-- before this) reads as the default user's for those two.
ALTER TABLE "cron_run" ADD COLUMN "userId" INTEGER;
CREATE INDEX "cron_run_name_userId_startedAt_idx" ON "cron_run"("name", "userId", "startedAt");
