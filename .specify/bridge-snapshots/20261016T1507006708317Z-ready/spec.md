# Feature Specification: One tailoring front door

**Feature Branch**: `issue-55-one-tailoring-front-door`

**Created**: 2026-10-16

**Status**: Draft

**Input**: GitHub issue #55 — "One tailoring front door: remove the /target launcher and the scratch resume row". Slice 0 of the tailoring work; #48 (tailored copy), #49 (condense) and #50 (Reactive Resume) follow in that order.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tailor from the job's Resume match tab with a length target (Priority: P1)

A person opens a stored job, goes to its Resume match tab, picks one of their saved resumes, chooses how many pages the result should fit (keep its length, 1, 2 or 3), and presses Compare. They are taken through the usual progress page to the tailoring editor, where every suggestion works and **Save as vN** is always available.

**Why this priority**: This is the one front door. Everything else in the issue removes the second one; without the length control here, the removal would take a capability away.

**Independent Test**: On a stored job with a saved resume, choose "1 page", press Compare, reach the editor, see that the comparison carries the 1-page target, and save the edited text as a new version.

**Acceptance Scenarios**:

1. **Given** a stored job and at least one saved resume, **When** the person chooses a page target and presses Compare, **Then** the comparison is stored with that target and the editor opens on it.
2. **Given** the same form left on its default, **When** they press Compare, **Then** the comparison asks nothing of the resume's length, as before.
3. **Given** a comparison opened in the editor, **When** the person edits the text and presses Save as vN, **Then** a new version of that saved resume is stored.
4. **Given** a comparison made earlier with a page target, **When** the person re-checks an edited draft from the editor, **Then** the re-check aims at the same target.

---

### User Story 2 - There is no second launcher and no hidden one-off resume (Priority: P1)

A person who used to compare an uploaded file or pasted text now adds the resume on the Resumes page first. Nothing in the app offers a one-off comparison any more: no `/target` page, no navigation entry, no "Compare a file or pasted text" link on the match card, no hidden resume that never appears in a list.

**Why this priority**: Removing the second door is the point of the issue; the tailored-copy and condense work assume a save is always possible and a length target is always present.

**Independent Test**: Request `/target` and `/target?job=1` (not found); open every page's navigation and the match card (no link to either); the resume table no longer has a hidden flag.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** the person looks at the navigation and at a job's match card, **Then** neither links to the old launcher.
2. **Given** a job with no saved resume, **When** the person opens its match card, **Then** it points them to the Resumes page to add one, not to a one-off comparison.
3. **Given** the progress page of a run in progress (`/target/runs/:id`), **When** the run finishes or fails, **Then** it behaves as before; when the run is gone, the person is sent to the jobs list with the existing "run gone" message.
4. **Given** an install that holds hidden scratch resumes and comparisons made on them, **When** it upgrades, **Then** those rows and everything that hung on them are removed, and every ordinary resume, comparison, review and letter is untouched.

---

### User Story 3 - The cover letter launcher takes a saved resume and a stored job (Priority: P2)

A person opens `/letter`, picks a stored job and one of their saved resumes, and writes the letter. The file, pasted-text, pasted-posting and posting-URL inputs are gone; a resume is added on the Resumes page and a posting at `/jobs/new` first. The optional "score first" and "research first" steps still work.

**Why this priority**: The letter launcher shares the removed resume-source code, so it must be cut to the same shape; it is otherwise unchanged.

**Independent Test**: Open `/letter`, choose a stored job and a saved resume, write the letter, and reach the drafted letter on the job page.

**Acceptance Scenarios**:

1. **Given** a stored job and a saved resume, **When** the person writes the letter, **Then** the letter is drafted and shown on the job page as before.
2. **Given** no saved resume or no stored job, **When** the person opens `/letter`, **Then** the page says what to add first and where.
3. **Given** the launcher, **When** the person looks for an upload, paste or new-posting input, **Then** none is offered.

---

### User Story 4 - Comparisons always judge the owner's own resume (Priority: P2)

Every new comparison is judged with the owner's confirmed facts and their other resumes. The "this is my own resume" tick-box is gone. Comparisons stored before this change keep reading as they were: an older one made on text alone still opens, and the reuse check still tells the two kinds apart.

**Why this priority**: With no file or paste input there is no other kind of resume to judge, so the choice disappears; legacy rows must still be valid.

**Independent Test**: Open a comparison stored before the change with the text-only marker; it opens and its score is unchanged. Run a new comparison; its stored marker says own-resume evidence.

**Acceptance Scenarios**:

1. **Given** a new comparison from the match tab, **When** it is stored, **Then** it is marked as judged with the owner's facts and resumes.
2. **Given** a stored comparison marked text-only, **When** it is read, **Then** it is still read as text-only and a new own-resume comparison does not reuse its answer.

---

### Edge Cases

- A bookmark or old link to `/target` or `/target?job=N`: answered as not found, like any unknown address.
- An old comparison made on a scratch resume that the upgrade removed: gone with it; no page may fail on a comparison without a resume.
- A run already in progress at upgrade time: the in-memory progress page still resolves or reports "run gone".
- A job with no saved resume: the match card says to add one on the Resumes page.
- Two identical Compare presses: still join one run, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT offer a page, form, route or navigation entry for comparing an uploaded file or pasted resume text, or a pasted posting, outside the Resumes page and `/jobs/new`.
- **FR-002**: The job's Resume match form MUST let the person choose the page target (keep length, 1, 2 or 3) and MUST store the choice with the comparison it starts.
- **FR-003**: The system MUST keep the progress page for running comparisons and its state endpoint working for the match tab and for every other flow that uses them.
- **FR-004**: The system MUST NOT keep any hidden or scratch resume: no store function creates one, no list or page needs to exclude one, and upgrading removes any that exist together with the rows that depend on them.
- **FR-005**: The tailoring editor MUST always allow Save as vN; it MUST have no one-off mode.
- **FR-006**: A re-check from the editor MUST judge the draft of the saved resume it came from, aimed at the page target of the comparison it started from.
- **FR-007**: The cover-letter launcher MUST accept only a stored job and a saved resume, and MUST keep its optional score and research steps.
- **FR-008**: New comparisons and letters MUST be judged with the owner's confirmed facts and other resumes; the tick-box that chose otherwise MUST be removed.
- **FR-009**: Comparisons stored before the change MUST still open, with their stored evidence marker read correctly, and the reuse check MUST keep distinguishing the two markers.
- **FR-010**: Interface text that only the removed pages used MUST be removed from every language catalog, and the catalogs MUST stay complete for what remains.
- **FR-011**: The lookup documentation, the page-target decision record and a new decision record for the removal MUST describe the single front door.

### Key Entities

- **Resume**: a person's saved document with versions; after this change every resume is a visible one.
- **Comparison (match)**: a resume judged against a stored job; carries the page target and the evidence marker (own, or legacy text-only).
- **Run**: the in-memory progress record behind the progress page, shared by every flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can go from a stored job to the editor with a chosen page target in one form submission on the match tab.
- **SC-002**: In the finished application there is exactly one way to start a resume-against-job comparison, and 100% of comparisons end in an editor where saving is possible.
- **SC-003**: After upgrading an install that had scratch resumes, 0 hidden resumes remain and all other resumes, comparisons, reviews and letters are unchanged in count.
- **SC-004**: Every comparison stored before the change still opens with the same score.
- **SC-005**: The cover letter can be written from a stored job and a saved resume end to end without any upload or paste step.
- **SC-006**: All automated checks the project runs (type check, tests, unused-export audit, language catalogs, schema/migration agreement, page smoke on a throwaway database) pass.

## Assumptions

- The upgrade runs the project's normal migration step; a hidden resume has no value worth keeping (it only ever held a one-off upload).
- Removing the launcher is intended to remove the capability of one-off comparisons; people add a resume on the Resumes page instead.
- The progress page keeps its current address because several flows use it.
- Out of scope: tailored copies (#48), condensing (#49), Reactive Resume work (#50), and any change to the editor beyond dropping its one-off mode.
