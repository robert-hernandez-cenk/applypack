# Feature Specification: Tailored Resume Copies

**Feature Branch**: `issue-48-tailored-resume-copies`

**Created**: 2026-10-16

**Status**: Draft

**Input**: GitHub issue #48 — "Tailored resume copies: stop 'Save as vN' overwriting the master resume". Depends on #55 (one tailoring front door, merged). Followed by #49 (condense) and #50 (Reactive Resume).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tailor for a posting without touching my resume (Priority: P1)

On a posting's tailoring page I edit my resume's wording for that job and press save. What I saved is a copy of my resume made for that posting. My resume itself — its text, its version number, and what the scan learned about it (headline, skills, sectors) — stays exactly as it was. The page then checks the copy against the posting and shows the score.

**Why this priority**: This is the defect. Today saving overwrites the one resume, so one job's wording leaks into every later scan, comparison, skill hint and the "Fill from resume" flow.

**Independent Test**: Open a posting's tailoring page, edit the text, save. Compare the resume before and after: text, version, scan fields and scan time are identical. A new copy exists for that posting, and a comparison of the copy's text is shown.

**Acceptance Scenarios**:

1. **Given** a scanned resume at version 3 and a posting, **When** I edit the text on the tailoring page and press "Save tailored copy", **Then** the resume still reads version 3 with the same text and scan fields, and a tailored copy for this posting exists with my edited text.
2. **Given** I saved a copy, **When** the save finishes, **Then** the page shows the copy's match score against the posting, and the resume is not re-scanned.
3. **Given** a copy exists for this posting, **When** I edit again and save, **Then** the copy is replaced (one copy per resume and posting), not duplicated.
4. **Given** the resume is a `.docx` the editor can patch, **When** I save a copy, **Then** the copy is that file with my edits written in; for any other resume it is the clean `.docx` the document view shows (as today).

---

### User Story 2 - A copy never pollutes my other work (Priority: P1)

Tailored copies stay out of everything computed from "my resumes". Skills a copy happens to mention do not show up as "your other resumes have this" hints on other resumes. The resume's comparison count, best score and coverage do not count the copy's comparison. Uploading a file whose text equals a copy's text is not flagged as a duplicate of one of my resumes. The resumes list shows only real resumes.

**Why this priority**: Without this, moving the data into a second table would only move the leak.

**Independent Test**: Save a copy that adds a skill the master lacks. Check a second resume's "other resumes" hints, the master's comparison stats and coverage card, the duplicate check and the resumes list: none change.

**Acceptance Scenarios**:

1. **Given** a copy that adds a skill the resume lacks, **When** another resume is compared with a posting, **Then** that skill is not offered as present on another resume.
2. **Given** a copy's comparison was stored, **When** I view the resume's comparison count, best score and coverage, **Then** they are the same as before the copy.
3. **Given** a copy exists, **When** I upload a file with the same text as the copy, **Then** it is not reported as a duplicate of my resume.

---

### User Story 3 - Find, download and delete my copies (Priority: P2)

On a posting's tailoring page I see the copy made for that posting and can download it. On the resume's own page I see all its copies, each naming the posting it was made for, with download and delete. Deleting a resume or a posting removes its copies.

**Why this priority**: A saved artefact that cannot be found or fetched is of no use, but the core protection (Stories 1–2) works without it.

**Independent Test**: Save copies for two postings; both appear on the resume page and each on its own posting's page; download one and get the saved file; delete one and it disappears; delete the resume and none remain.

**Acceptance Scenarios**:

1. **Given** copies for two postings, **When** I open the resume page, **Then** both are listed with their posting's title and company and a download link.
2. **Given** a copy, **When** I download it, **Then** I receive the saved file with a sensible name.
3. **Given** a copy, **When** I delete it, **Then** it is gone and the resume and its comparisons are unchanged.
4. **Given** a resume with copies, **When** the resume or a posting is deleted, **Then** the copies for it are deleted too.

---

### User Story 4 - Make a copy my new master on purpose (Priority: P3)

When a tailored copy is really the better resume, I can promote it to the master with an explicit, confirmed action. That is the old overwrite behaviour: the resume becomes the next version with the copy's text and file, and its scan is cleared so the next scan reads the new text.

**Why this priority**: The old behaviour stays available, but only behind a deliberate choice.

**Independent Test**: Promote a copy; the resume's version goes up by one, its text and file equal the copy's, and its scan is cleared.

**Acceptance Scenarios**:

1. **Given** a copy, **When** I press "Promote to master" and confirm, **Then** the resume becomes the next version with the copy's text and file and a cleared scan.
2. **Given** a copy, **When** I do not confirm, **Then** nothing changes.

---

### Edge Cases

- The editor was opened on the text a previous copy was judged on, so the edits start from the copy's text, not the master's: the copy's own file is the patch base.
- The `.docx` cannot be patched (PDF, unsupported template, refused patch): the clean `.docx` fallback and its explanation are used, as today.
- Two quick saves of the same text for the same posting: one run, one copy (the existing run claim).
- The resume or posting is deleted in another tab while saving: the save fails with a visible error, nothing orphaned is left.
- A copy is promoted after the master has moved on: promotion replaces the master with the copy as asked; the confirmation says the current master will be overwritten.
- Existing versions saved before this change stay as they are; there is no conversion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Saving from the tailoring page MUST create or replace the tailored copy for the (resume, posting) pair and MUST NOT change the resume's text, file, version, scan fields or scan time.
- **FR-002**: There MUST be at most one copy per resume and posting; saving again replaces it.
- **FR-003**: The copy MUST be written as a document by the same rules as today's save (the user's `.docx` patched with the edits when possible, else the clean `.docx`, else text), with the note saying which.
- **FR-004**: When the editor's starting text equals the existing copy's text, the copy's own file MUST be the base for patching; otherwise the resume's file is.
- **FR-005**: After saving, the system MUST compare the copy's text with the posting and show the score. The comparison MUST be stored against the resume but marked as belonging to the copy.
- **FR-006**: Comparisons marked as a copy's MUST be excluded from the resume's comparison count, best score, coverage and keyword tables.
- **FR-007**: A copy MUST be excluded from the resume list, other-resume skill hints, duplicate-text checks and any scan field.
- **FR-008**: Saving a copy MUST NOT queue a re-scan of the resume.
- **FR-009**: The tailoring page MUST show the copy for its posting with a download link; the resume page MUST list all its copies with posting, date, download, delete and promote.
- **FR-010**: A copy MUST be downloadable as the saved file and deletable by its owner only; every read and write MUST be scoped to the signed-in person through the resume.
- **FR-011**: Deleting a resume or a posting MUST delete its copies.
- **FR-012**: "Promote to master" MUST, after confirmation, apply the previous overwrite behaviour (next version, copy's text and file, cleared scan) and MUST NOT be reachable from the save.
- **FR-013**: The save control MUST read "Save tailored copy"; no "Save as vN" wording remains. New and changed words MUST exist in every interface language catalog.
- **FR-014**: The save request MUST require a posting; a request without one is refused.
- **FR-015**: No existing resume version is converted or backfilled.

### Key Entities

- **Tailored copy**: a version of one resume written for one posting — its text, the file, the file name and type, when it was made. Belongs to a resume (and so to a person) and to a posting. One per resume–posting pair.
- **Resume (master)**: unchanged in meaning; the clean source all scans, hints and coverage read.
- **Comparison**: gains a link to the copy it judged, empty for a comparison of the master itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After tailoring and saving for any posting, 100% of the resume's text, version and scan fields are identical to before (verified by an automated check).
- **SC-002**: A copy that adds a skill leaves other resumes' hints, the master's comparison count, best score and coverage unchanged (automated check).
- **SC-003**: From a posting's tailoring page, a person can reach their saved copy's download in one click, and from the resume page can see all copies in one place.
- **SC-004**: Promoting a copy is impossible without a separate confirmed action.
- **SC-005**: The full project checks (types, tests, export audit, catalogs, schema-vs-migration diff) and the route smoke on a throwaway database pass.

## Assumptions

- The tailoring page is the only caller of the save, and it always has a posting.
- One copy per resume–posting pair is enough; copy history is out of scope.
- A copy's comparison keeps the resume's id and version for display, and carries its text as the record of what was judged.
- The confirmation for promote uses the project's existing confirm pattern.
- Out of scope: condensing a resume (#49), Reactive Resume (#50), several copies per posting, converting existing versions.
