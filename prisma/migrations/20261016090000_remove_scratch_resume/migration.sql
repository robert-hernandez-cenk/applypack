-- The /target launcher and its hidden scratch resume are gone (#55, ADR 0076).
-- A hidden row only ever held a one-off upload. Its matches, reviews and
-- letters go with it (ON DELETE CASCADE); a profile or an application that
-- named it is unlinked (ON DELETE SET NULL).
DELETE FROM "resume" WHERE "hidden" = true;

-- AlterTable
ALTER TABLE "resume" DROP COLUMN "hidden";
