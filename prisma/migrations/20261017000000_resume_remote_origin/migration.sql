-- A resume imported from Reactive Resume remembers which one (#50, ADR 0079).
-- Both columns are set or cleared together; no backfill, no index.
ALTER TABLE "resume" ADD COLUMN "remoteId" TEXT,
ADD COLUMN "remoteGeneration" TEXT;
