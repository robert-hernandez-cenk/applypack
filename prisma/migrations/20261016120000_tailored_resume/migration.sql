-- A tailoring save writes a copy for one posting instead of a new version of
-- the resume (#48, ADR 0077). Copies go with their resume or posting; the
-- comparisons of a copy go with the copy (not SET NULL: that would turn them
-- into comparisons of the master).

-- CreateTable
CREATE TABLE "tailored_resume" (
    "id" SERIAL NOT NULL,
    "resumeId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "original" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tailored_resume_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "resume_match" ADD COLUMN "tailoredId" INTEGER;

-- CreateIndex
CREATE INDEX "tailored_resume_jobId_idx" ON "tailored_resume"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "tailored_resume_resumeId_jobId_key" ON "tailored_resume"("resumeId", "jobId");

-- CreateIndex
CREATE INDEX "resume_match_tailoredId_idx" ON "resume_match"("tailoredId");

-- AddForeignKey
ALTER TABLE "tailored_resume" ADD CONSTRAINT "tailored_resume_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_resume" ADD CONSTRAINT "tailored_resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_match" ADD CONSTRAINT "resume_match_tailoredId_fkey" FOREIGN KEY ("tailoredId") REFERENCES "tailored_resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
