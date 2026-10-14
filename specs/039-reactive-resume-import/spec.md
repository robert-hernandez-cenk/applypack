# Feature Specification: Import a resume from Reactive Resume

**Feature Branch**: `issue-39-reactive-resume-import`

**Created**: 2026-10-14

**Status**: Draft

**Input**: GitHub issue #39 — bring a resume from Reactive Resume (the hosted service or a self-hosted copy) into ApplyPack, from its exported file or straight from the instance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a Reactive Resume export (Priority: P1)

A person keeps their resume in Reactive Resume. They export it as a JSON file and upload that file where they would upload a PDF or Word resume. ApplyPack reads it and saves a normal resume whose text holds everything the visible resume says: name and contact line, headline, summary, work history with dates, education, skills, projects, languages, certifications and the rest. The file can come from any Reactive Resume generation (v4, v5 or v6); the person is never asked which one.

**Why this priority**: It works for every instance, hosted or self-hosted, needs no network access or credentials, and is the whole value on its own.

**Independent Test**: Upload a v4, a v5 and a v6 export in turn; each produces a resume in the list whose text contains the sections in order, and which can be scanned and compared with a posting like any other resume.

**Acceptance Scenarios**:

1. **Given** a v6 export, **When** it is uploaded, **Then** a resume is saved whose text lists the headline, summary, each experience with company, position, place and dates, education, skills with their keywords, and the other visible sections.
2. **Given** a v5 export and a v4 export, **When** each is uploaded, **Then** each is recognised from its own shape and read to the same kind of text.
3. **Given** a section or an item that is hidden in Reactive Resume, **When** the file is uploaded, **Then** nothing of it appears in the text.
4. **Given** a summary or description written as formatted text (paragraphs, bullet lists, links), **When** it is read, **Then** the text keeps the paragraphs and shows bullets as list lines, with no markup left in.
5. **Given** a JSON file that is not a Reactive Resume export, or an export with no usable text, **When** it is uploaded, **Then** the person is told in plain words why nothing was saved, and no resume is created.
6. **Given** the same resume uploaded twice, **When** the second upload is read, **Then** the person gets the same duplicate notice an identical PDF would give.

---

### User Story 2 - Pull a resume from an instance with an API key (Priority: P2)

A person on hosted Reactive Resume or on their own server enters the instance address and an API key. ApplyPack lists their resumes there by name; they pick one and it is imported exactly as an uploaded export would be. They never have to download and re-upload a file. The key is used for these two requests only and is not kept.

**Why this priority**: Convenient, and it is what "including a self-hosted version" asks for in the strongest sense, but US1 already covers every instance.

**Independent Test**: Against a stand-in server that answers like Reactive Resume, enter its address and a key, see the resumes listed, pick one, and find a new resume saved. Reopen the page and confirm neither the address nor the key is shown anywhere.

**Acceptance Scenarios**:

1. **Given** a valid address and key, **When** the person asks to list, **Then** their Reactive Resume resumes are shown by name and they can pick one.
2. **Given** a picked resume, **When** it is imported, **Then** a normal resume is saved with the same text an uploaded export of it would give, named after it.
3. **Given** a wrong key, an address that does not answer, an answer that is not Reactive Resume, or an instance too old to offer this API, **When** the person asks to list, **Then** a plain message names which of these it was and suggests the file route for an old instance.
4. **Given** the list is shown and the person waits too long, **When** they pick one, **Then** they are asked to enter the key again; the key is never kept beyond a short wait.
5. **Given** any outcome, **When** the pages, logs and stored data are examined, **Then** the key appears in none of them.

---

### User Story 3 - Members cannot aim the server at its own network (Priority: P2)

On an install shared by several people, a member who types an address that points inside the server's own network (this machine, a private range, a link-local address) is refused. Administrators may use such addresses (the one person on a local install is one), because self-hosted Reactive Resume usually lives there.

**Why this priority**: Without it the live pull is a way for any member to make the server call internal services.

**Independent Test**: As a member, enter a loopback address and a private-range address and see both refused before any request leaves; as an administrator, the same addresses are allowed.

**Acceptance Scenarios**:

1. **Given** a member on a shared install, **When** they enter an address that resolves to a loopback, private or link-local address, **Then** it is refused with a message saying why, and no request is made to it.
2. **Given** an administrator, **When** they enter the same address, **Then** it is allowed.
3. **Given** an address that is not http or https, or that carries a user name or password, **When** it is entered, **Then** it is refused for everyone.
4. **Given** an instance that answers with a redirect, **When** the request is made, **Then** the redirect is not followed and the person is told.

---

### Edge Cases

- A v6 resume with several roles under one employer: each role appears under the employer, with its own dates and description.
- Dates: a start with no end and "present" reads as "to present"; a year alone stays a year; a date Reactive Resume kept only as written stays as written; an item with no dates prints none.
- A resume whose visible content is under the minimum length ApplyPack accepts for any resume is refused with the same notice as a short PDF.
- A very large file, or an instance answering with a very large body, is refused with a size message rather than read.
- Custom sections and cover letters in the file: their text is kept as plain sections; nothing else about them is imported.
- The picture, colours, fonts, layout and template are ignored.
- A name with characters a file name cannot hold still gives a sensible file name and resume name.
- The instance is slow: the request stops after a bounded wait and says so.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The resume upload MUST accept a Reactive Resume JSON export and save it as a resume whose text carries every visible section and item of the export.
- **FR-002**: The system MUST tell v4, v5 and v6 exports apart from the shape of the file itself and read each correctly; the person MUST NOT be asked for a version.
- **FR-003**: Hidden sections and hidden items MUST NOT appear in the text; layout, design, template and picture data MUST be ignored.
- **FR-004**: Formatted text in the file MUST become plain text that keeps paragraph breaks and shows list items as list lines.
- **FR-005**: Dates MUST be written in a readable form in all three generations, keeping a date that cannot be read exactly as it was written.
- **FR-006**: A file that is not a Reactive Resume export, is malformed, is too large, or yields too little text MUST be refused with a plain-words reason and MUST create nothing.
- **FR-007**: An imported resume MUST be an ordinary resume: owned by the importing person, checked for an identical existing text, and scanned the way an uploaded one is.
- **FR-008**: The person MUST be able to enter an instance address and an API key, list their resumes there, pick one and import it.
- **FR-009**: The live pull MUST work against the hosted service and against self-hosted instances at any address, including a path prefix.
- **FR-010**: The API key MUST be sent only to the entered instance, held only for the short wait between listing and picking, and MUST NOT be stored, logged, echoed into a page or put in a link.
- **FR-011**: Only http and https addresses without embedded credentials MUST be accepted; redirects MUST NOT be followed; each request MUST have a time limit and a size limit.
- **FR-012**: For members of a shared install, an address that resolves to a loopback, private or link-local address MUST be refused before any request is made; only administrators MAY use them.
- **FR-013**: Failures of the live pull (wrong key, no answer, not Reactive Resume, instance without the API, redirect, too large, too slow) MUST each give a distinct plain message, and an instance without the API MUST point to the file route.
- **FR-014**: Every string the person reads MUST be in the interface's language catalogs.
- **FR-015**: The feature MUST NOT write to, change or sync with the Reactive Resume instance, and MUST NOT remember the instance between visits.

### Key Entities

- **Reactive Resume export**: the JSON a person downloads from, or reads through the API of, a Reactive Resume instance; one resume's visible content plus design settings that are ignored.
- **Imported resume**: an ordinary ApplyPack resume created from one export; its text is the visible content written out in reading order, and its stored file is that text as a Markdown file.
- **Pull attempt**: the short-lived step between listing an instance's resumes and picking one; holds the key for a few minutes at most and nowhere else.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person with an export file has a scanned, comparable resume in under one minute from opening the upload page, with no choice about version or format.
- **SC-002**: For the three published example shapes (v4, v5, v6), 100% of visible sections and items appear in the saved text and 0 hidden ones do.
- **SC-003**: A person pulling from an instance goes from entering the address and key to a saved resume in three actions or fewer (list, pick, done).
- **SC-004**: In every tested outcome, success or failure, the key appears in 0 stored rows, 0 log lines and 0 rendered pages.
- **SC-005**: As a member on a shared install, 100% of loopback, private-range and link-local addresses are refused before any request leaves the server.
- **SC-006**: Every failure the person can meet gives a message that names the cause; none ends in a blank page or a generic error.

## Assumptions

- Reactive Resume's published description of its v6 file and API is accurate; no live instance was available, so the fixtures are hand-written from that description and from the v4 shape, and a real export may show differences the first users will find.
- The live pull works with v5 and v6 instances, which offer an API key and a list/get API; v4 instances do not, so v4 is reached through the file.
- A resume's Markdown text is the right stored form: the rest of ApplyPack already reads Markdown resumes, so scan, structure and comparison need no change.
- The pull is for the person's own resumes; publicly shared resumes of others are out of scope.
- The address check is made on the name's resolution at request time; a name that changes its answer between the check and the request is a known limit, accepted for a personal-use tool.
- Out of scope: writing back to Reactive Resume, keeping resumes in sync, storing the instance or key, importing the picture or design, cover letters beyond their text, and JSON Resume (jsonresume.org) files.
