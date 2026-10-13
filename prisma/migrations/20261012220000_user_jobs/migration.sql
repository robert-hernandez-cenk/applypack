-- What a person has made of a posting moves out of the shared posting
-- (ADR 0067). Every job that exists is the default user's (id 1): one
-- user_job row per job carries the old columns, then the columns go.
CREATE TABLE "user_job" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "fitScore" INTEGER,
    "techMatch" TEXT[],
    "redFlags" TEXT[],
    "summary" TEXT,
    "priorityRulesApplied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "alertedAt" TIMESTAMP(3),
    "alertHeldAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "recruiterContact" TEXT,
    "pipelineStage" TEXT,
    "applicationNotes" TEXT,
    "appliedResumeId" INTEGER,
    "appliedResumeVersion" INTEGER,
    "appliedResumeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_job_pkey" PRIMARY KEY ("id")
);

INSERT INTO "user_job" (
    "userId", "jobId", "fitScore", "techMatch", "redFlags", "summary", "priorityRulesApplied",
    "status", "alertedAt", "alertHeldAt", "appliedAt", "recruiterContact", "pipelineStage",
    "applicationNotes", "appliedResumeId", "appliedResumeVersion", "appliedResumeText", "createdAt"
)
SELECT
    1, "id", "fitScore", "techMatch", "redFlags", "summary", "priorityRulesApplied",
    "status", "alertedAt", "alertHeldAt", "appliedAt", "recruiterContact", "pipelineStage",
    "applicationNotes", "appliedResumeId", "appliedResumeVersion", "appliedResumeText", "fetchedAt"
FROM "job";

CREATE UNIQUE INDEX "user_job_userId_jobId_key" ON "user_job"("userId", "jobId");
CREATE INDEX "user_job_userId_status_idx" ON "user_job"("userId", "status");
CREATE INDEX "user_job_alertHeldAt_idx" ON "user_job"("alertHeldAt");
CREATE INDEX "user_job_userId_pipelineStage_appliedAt_idx" ON "user_job"("userId", "pipelineStage", "appliedAt");
CREATE INDEX "user_job_jobId_idx" ON "user_job"("jobId");
CREATE INDEX "user_job_appliedResumeId_idx" ON "user_job"("appliedResumeId");

ALTER TABLE "user_job" ADD CONSTRAINT "user_job_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_job" ADD CONSTRAINT "user_job_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_job" ADD CONSTRAINT "user_job_appliedResumeId_fkey"
    FOREIGN KEY ("appliedResumeId") REFERENCES "resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The stage history is the person's own; every event that exists is the default user's.
ALTER TABLE "job_stage_event" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "job_stage_event_userId_idx" ON "job_stage_event"("userId");
ALTER TABLE "job_stage_event" ADD CONSTRAINT "job_stage_event_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job" DROP CONSTRAINT "job_appliedResumeId_fkey";
DROP INDEX "job_appliedResumeId_idx";
DROP INDEX "job_status_fetchedAt_idx";
DROP INDEX "job_alertHeldAt_idx";
DROP INDEX "job_pipelineStage_appliedAt_idx";
ALTER TABLE "job"
    DROP COLUMN "fitScore", DROP COLUMN "techMatch", DROP COLUMN "redFlags", DROP COLUMN "summary",
    DROP COLUMN "status", DROP COLUMN "alertedAt", DROP COLUMN "alertHeldAt", DROP COLUMN "appliedAt",
    DROP COLUMN "recruiterContact", DROP COLUMN "pipelineStage", DROP COLUMN "applicationNotes",
    DROP COLUMN "appliedResumeId", DROP COLUMN "appliedResumeVersion", DROP COLUMN "appliedResumeText",
    DROP COLUMN "priorityRulesApplied";
