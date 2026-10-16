-- Condense is a stage of its own (#49, ADR 0078): the wording proposals of its
-- second step, with the text they were written against. The cuts of its first
-- step stay in "removals".
ALTER TABLE "resume_match" ADD COLUMN "condense" JSONB NOT NULL DEFAULT '{}';
