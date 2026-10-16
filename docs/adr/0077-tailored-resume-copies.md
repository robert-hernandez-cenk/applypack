# 0077 — Tailored resume copies

**Status:** Accepted (2026-10-16). Issue #48. Amends [0038](./0038-docx-patch-save.md) (the patch path now
writes a copy, not a new version) and [0076](./0076-one-tailoring-front-door.md) (the editor's save is
"Save tailored copy").

## Context

The editor's "Save as vN" wrote the edited text and file over the one `Resume` row, bumped its version and
cleared its scan. Wording written for one posting then became the resume: the next scan read it into
`skills`, `primarySkills`, `industries` and the headline; `listOtherResumeSkills` offered its skills as
"your other resume has this"; the coverage card and the "Fill from resume" flow read it; and the duplicate
check compared uploads against it. The person who tailors for ten postings ended with a resume that
described none of them.

## Decision

- **A copy is its own row.** `TailoredResume (resumeId, jobId, text, file, mime, name)` is unique per
  (resume, posting) and cascades from both. The target page's save upserts it; the resume's text, file,
  version, scan fields and `scannedAt` are never written, and no scan is queued.
- **The owner is reached through the resume** (ADR 0068): every store function takes `userId` first and
  reads `where: { …, resume: { userId } }`. There is no `userId` column on the copy to drift.
- **Separate table, not a flag.** Every reader of "my resumes" (the list, the scan, other-resume hints, the
  duplicate check, the profile draft) reads `prisma.resume`, so a copy is excluded from all of them
  without touching them. A flag on `Resume` would need a filter in each, and one miss would leak.
- **The patch base follows the text on screen.** The editor's `baseText` is the displayed comparison's
  `resumeText`, which after a first save is the copy's. `src/resume/tailored.ts:patchSource` picks the copy's own
  file when `baseText` equals the copy's text, else the resume's; a refused patch falls to the existing
  clean-`.docx` path, styled from the resume's file.
- **The copy's comparison belongs to the copy.** `matchResumeToJob({ ...resume, text: copy.text }, …,
  { tailoredId })` stores a `ResumeMatch` against the resume with `tailoredId` set, `resumeText` the
  copy's words. `matchStatsByResume`, `listLatestKeywordTables` (coverage) and `listMatchesForResume`
  filter `tailoredId IS NULL`; the target page still reads the row like any other.
- **`ON DELETE CASCADE` on `tailoredId`**, not `SET NULL`: nulling would turn a deleted copy's
  comparisons into comparisons of the master and put them back into its count, best score and coverage.
  A replaced copy keeps its row id, so its earlier comparisons stay attached.
- **Promote to master is the old overwrite, on purpose.** `promoteTailored` calls `replaceResumeFile`
  with the copy's file and text (next version, scan and structure cleared) and a scan is queued, behind a
  confirmation that names the overwrite. The copy stays.
- **`POST /resumes/:id/draft` requires a posting.** The target page is its only caller; the no-posting
  scan branch is deleted.
- **No backfill.** Versions saved before this change stay as they are.

## Alternatives considered

- **`kind` / `parentId` on `Resume`.** Fewer tables, one filter in every resume query; a forgotten filter
  is a silent leak, which is the defect being removed.
- **`draft = true` on the copy's comparison.** `matchStatsByResume` counts drafts, and the history labels
  them "draft v3", which they are not.
- **Several copies per posting / copy history.** Not asked for; the upsert keeps one and the comparison
  history on the target page already shows how the score moved.
- **A copy per comparison.** The same sprawl the earlier "save as a copy" produced on `/resumes`.

## Consequences

- A resume can only change by an upload, a Reactive Resume pull, or a deliberate promotion.
- A deleted copy takes its comparisons with it; the resume's own are untouched.
- Copies hold a file each (`bytea`); they are bounded by resumes × postings and leave with either.
- The target page's "Save as vN" wording, the version in the save flash and the scan after a save are gone.
