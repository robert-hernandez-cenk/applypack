-- A resume imported from Reactive Resume remembers which one: the instance resume id,
-- the format generation and the instance host (#50, ADR 0079). All three set or cleared together; no backfill, no index.
ALTER TABLE "resume" ADD COLUMN "remoteId" TEXT,
ADD COLUMN "remoteGeneration" TEXT,
ADD COLUMN "remoteHost" TEXT;
