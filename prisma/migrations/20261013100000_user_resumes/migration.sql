-- Resumes belong to a person, and so do the confirmed facts and the application
-- packs (ADR 0068). Everything that exists is the default user's (id 1): the
-- column default backfills it. Matches, reviews and letters are owned through
-- their resume and need no column.
ALTER TABLE "resume" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "resume_userId_idx" ON "resume"("userId");
ALTER TABLE "resume" ADD CONSTRAINT "resume_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A fact is a person's own: the term is unique per person, not per install.
ALTER TABLE "candidate_fact" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "candidate_fact_term_key";
CREATE UNIQUE INDEX "candidate_fact_userId_term_key" ON "candidate_fact"("userId", "term");
ALTER TABLE "candidate_fact" ADD CONSTRAINT "candidate_fact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A pack is per person and posting.
ALTER TABLE "application_pack" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "application_pack_jobId_key";
CREATE UNIQUE INDEX "application_pack_userId_jobId_key" ON "application_pack"("userId", "jobId");
CREATE INDEX "application_pack_userId_status_idx" ON "application_pack"("userId", "status");
ALTER TABLE "application_pack" ADD CONSTRAINT "application_pack_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
