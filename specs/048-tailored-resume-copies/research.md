# Research: Tailored resume copies

## R1 — Where a copy lives
**Decision**: a new `tailored_resume` table, `UNIQUE (resumeId, jobId)`, cascading from `resume` and `job`.
**Rationale**: every resume reader (list, `listOtherResumeSkills`, `sameTextAs`, the scan) reads `prisma.resume`; a separate table is excluded from all of them with no edit. The owner is reached through the resume (ADR 0068) — no `userId` column to drift.
**Alternatives**: a `kind`/`parentId` flag on `Resume` (every reader needs a filter; one miss leaks); versions of the master (what the issue removes).

## R2 — Keeping the copy's comparison out of the master's numbers
**Decision**: `ResumeMatch.tailoredId Int?` FK to `tailored_resume` `ON DELETE CASCADE`; `matchStatsByResume` and `listLatestKeywordTables` filter `tailoredId IS NULL`. `draft` stays false.
**Rationale**: `matchStatsByResume` counts drafts too, so `draft = true` would not exclude it. `SET NULL` on delete would turn a deleted copy's comparisons into master ones, hence cascade. A replaced copy keeps its row id (upsert), so its earlier comparisons stay linked.
**Alternatives**: `draft = true` (does not hide from stats, mislabels in history); a separate match table (duplicates `ResumeMatch` and its readers).

## R3 — Judging the copy
**Decision**: `matchResumeToJob({ ...master, text: copy.text }, job, { tailoredId })`. The row keeps `resumeId` = master, `resumeVersion` = master's, `resumeText` = the copy's text. Facts, other-resume hints and `getResumeIndustries` read the master as before.
**Rationale**: `resumeText` is already the record of what was judged (the target page shows it); no prompt change.

## R4 — Patch base
**Decision**: pure `patchSource({ baseText, copyText })` → `'copy'` when `baseText` equals the copy's text (trimmed), else `'master'`. `saveTailored` patches that file's bytes against `baseText`. A refused patch falls to the existing clean-`.docx` path, styled from the master's file.
**Rationale**: the target page's `baseText` is the displayed match's `resumeText` — the copy's text after the first save. Patching the master's bytes against it would mismatch.

## R5 — File names
**Decision**: `tailoredFileName(resumeName, jobTitle, ext)` → slug of both, no version number; same slug rule as `versionFileName`.

## R6 — Promote
**Decision**: `promoteTailored(userId, copyId)` calls `replaceResumeFile` with the copy's file and text (next version, scan and structure cleared). The copy stays. Confirmed with the existing `ConfirmAction`.

## R7 — `/resumes/:id/draft` without a posting
**Decision**: refuse with an error flash when `jobId` is missing or the posting is not the person's; the scan-only branch is deleted. The only caller is the target page.

## R8 — Release
Patch release `2.59.11` with a CHANGELOG entry (fork rule: patch only).
