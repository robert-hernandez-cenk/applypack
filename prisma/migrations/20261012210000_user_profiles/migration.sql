-- Searches belong to a user and so does the primary (ADR 0066). Every search
-- that exists is the default user's (id 1): the column's default backfills it.
ALTER TABLE "profile" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "profile_userId_idx" ON "profile"("userId");
ALTER TABLE "profile" ADD CONSTRAINT "profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The primary moves from the install-wide settings to the person.
ALTER TABLE "users" ADD COLUMN "primaryProfileId" INTEGER;
CREATE UNIQUE INDEX "users_primaryProfileId_key" ON "users"("primaryProfileId");
ALTER TABLE "users" ADD CONSTRAINT "users_primaryProfileId_fkey"
    FOREIGN KEY ("primaryProfileId") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "users" SET "primaryProfileId" = (SELECT "activeProfileId" FROM "app_settings" WHERE "id" = 1) WHERE "id" = 1;

ALTER TABLE "app_settings" DROP CONSTRAINT "app_settings_activeProfileId_fkey";
ALTER TABLE "app_settings" DROP COLUMN "activeProfileId";
