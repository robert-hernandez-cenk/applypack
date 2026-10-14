-- Live state of a RUNNING cron_run (ADR 0072): what stage a job is in and how far it has got.
-- Null on every finished row and on a run that never reported.
ALTER TABLE "cron_run" ADD COLUMN "progress" JSONB;
