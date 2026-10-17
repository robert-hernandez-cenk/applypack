# Feature Specification: Write Tailored Edits Back to Reactive Resume

**Feature Branch**: `issue-50-reactive-resume-writeback`

**Created**: 2026-10-16

**Status**: Draft

**Input**: GitHub issue #50 — "Reactive Resume: keep resume origin and write tailored edits back as a new RR resume". Depends on #48 (tailored copies, merged), #55 and #49 (merged).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a tailored copy back as a new Reactive Resume resume (Priority: P1)

I keep my resume in Reactive Resume (hosted or my own server). I imported it into ApplyPack, tailored it for a posting, and saved a tailored copy. Next to the copy's download I press "Send to Reactive Resume". A new resume appears in my Reactive Resume account, named `<Resume> - <Company> - <Role>`, with the same layout and design as my original and the wording I changed for this posting. My original resume in Reactive Resume is not touched.

**Why this priority**: This is the feature. Today the edits live only in a downloaded document, and the person has to redo them by hand in the tool where the resume is actually designed.

**Independent Test**: Import a resume from Reactive Resume, save a tailored copy that changes a bullet and the summary, press the button. A new resume with that name exists in Reactive Resume carrying the two changes and every other field, style and section exactly as in the original; the original is byte-for-byte unchanged.

**Acceptance Scenarios**:

1. **Given** a resume imported from Reactive Resume and a tailored copy of it with changed bullets, **When** I press "Send to Reactive Resume", **Then** a new resume named `<Resume> - <Company> - <Role>` exists there with those bullets changed and nothing else different from the original.
2. **Given** the same, **When** the send finishes, **Then** the page says how many edits were applied and links to the new resume in Reactive Resume.
3. **Given** the send finished, **When** I look at the original resume in Reactive Resume, **Then** it is identical to before (content, layout, name).
4. **Given** a tailored copy with no edits (equal to the master), **When** I send it, **Then** the new resume is an exact clone.

---

### User Story 2 - A resume remembers where it came from (Priority: P1)

When I import a resume from Reactive Resume, ApplyPack records which Reactive Resume resume it was and which generation of the format it was. Resumes that came from a file, a paste or any other source have no origin. The origin is visible on the resume's page and gates the send button; it is never needed to use the resume anywhere else.

**Why this priority**: Without an origin there is nothing to write back to; every other part depends on it.

**Independent Test**: Import one resume from Reactive Resume and one from a file. The first shows its origin (instance host and resume name), the second shows none. Uploading a new version from Reactive Resume keeps or updates the origin.

**Acceptance Scenarios**:

1. **Given** I import a resume from Reactive Resume, **When** it is saved, **Then** it records the Reactive Resume resume id and the detected generation.
2. **Given** a resume from a file, **When** I open its tailored copy, **Then** no "Send to Reactive Resume" control is shown.
3. **Given** I upload a new version from a different Reactive Resume resume, **When** it is saved, **Then** the origin points at the new source.
4. **Given** resumes imported before this change, **When** I open them, **Then** they have no origin and nothing breaks; no backfill happens.

---

### User Story 3 - Honest reporting of what could not be sent (Priority: P2)

Some edits cannot be placed in the Reactive Resume data (a line I added that belongs to no field, a line the importer produced from several fields). Some sends fail (resume locked, instance unreachable, my Reactive Resume resume changed since I imported). The page tells me per edit what was applied and what was not, and why. My local tailored copy is never altered or lost by a failed or partial send.

**Why this priority**: A silent partial write would send a wrong resume to an employer; the core story is safe only if failures are visible, but the happy path stands without the finer reporting.

**Independent Test**: Save a copy that changes one mappable bullet and adds one line that maps to no field; send it. The new resume has the bullet; the page lists the added line as not applied with a reason.

**Acceptance Scenarios**:

1. **Given** an edit that maps to no field, **When** I send, **Then** it is listed as not applied with a reason and the other edits are applied.
2. **Given** my resume in Reactive Resume changed after I imported it, **When** I send, **Then** nothing is created and the page asks me to import the new version first.
3. **Given** the instance is unreachable, the key is rejected, or the source is locked, **When** I send, **Then** I see which of these happened in words, and no partial resume is left behind or, if one was created before the failure, the page says so and names it.
4. **Given** any failure, **When** I return to the tailored copy, **Then** it is unchanged and downloadable.

---

### Edge Cases

- The tailored copy was saved from a master that has since had a new version: the copy's base text no longer equals the master's text; the send is refused with a reason.
- A send is repeated for the same copy: a second new resume is created (names may collide; the instance makes the address unique). The page warns after the first send that one already exists.
- The Reactive Resume resume was deleted or the saved connection was removed: the send is refused with a reason; the connection page link is offered.
- The instance is on an older generation (v4/v5): reading and importing keep working; sending is declined with an explanation that only the verified generation is written.
- Hidden sections or items in Reactive Resume: never touched by an edit, as they never appear in the text.
- A very long resume or a response over the size limit: refused by the size limit with a visible reason.
- A person without a saved connection: the button explains how to add one rather than failing.
- The same send is submitted twice quickly: one send runs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Importing a resume from Reactive Resume MUST record, on the resume, the source resume id and the detected generation. Resumes from any other source MUST have neither.
- **FR-002**: The system MUST NOT store the Reactive Resume JSON. At send time it MUST fetch the source resume afresh and re-derive the text and the line-to-field mapping from it.
- **FR-003**: The send MUST be refused, creating nothing, when the freshly derived text differs from the resume's stored text (the source changed since import).
- **FR-004**: The reader MUST, without changing the text it produces, also say for each line which field of which item it came from and, for rich-text fields, which block of that field.
- **FR-005**: The mapping step MUST compare the master's text with the tailored copy's text line by line and produce a set of field-level changes; each change MUST be reported as applied or not applied with a reason. Applying zero edits MUST reproduce the source data exactly.
- **FR-006**: The send MUST create a new resume in the person's Reactive Resume account named `<Resume> - <Company> - <Role>` from a clone of the source, and apply the changes to the clone only. The original MUST NOT be modified.
- **FR-007**: Layout, design, section order, hidden items and all fields the edits do not touch MUST be preserved because the clone's data is edited, not regenerated.
- **FR-008**: The button MUST appear beside the copy's download only when the master has an origin and the person has a saved connection; otherwise it MUST be absent or explain why.
- **FR-009**: Calls to the instance MUST use the person's saved key as a header only, follow no redirects, obey time and size limits, honour the reachability rule, and MUST NOT be retried automatically after a timeout. The key MUST NOT appear in any page, flash, log or error.
- **FR-010**: Only the existing instance-client module MAY call the instance; the key MUST be read only through the existing accessor.
- **FR-011**: A failed or partial send MUST leave the local tailored copy and the resume unchanged.
- **FR-012**: Every read and write MUST be scoped to the signed-in person through the resume; one person MUST NOT send another's copy.
- **FR-013**: Only generation v6 is written. For other generations the send MUST be declined with an explanation; reading is unchanged.
- **FR-014**: All new words MUST exist in every interface language catalog; a reason shown to the person MUST be worded in their language while codes stay internal.
- **FR-015**: A redacted fixture of a real v6 response (same shape, no personal data) MUST be committed and used by the mapping tests; the roundtrip with zero edits MUST be a test.
- **FR-016**: An architecture decision record MUST describe the origin, the no-raw-JSON choice, the clone-and-patch write path and what is not sent.

### Key Entities

- **Resume origin**: which Reactive Resume resume (id) and generation a resume was imported from; empty for other sources. Belongs to the resume.
- **Provenance map**: for one read of a Reactive Resume resume, which field (item id, field, block) each text line came from. Derived, never stored.
- **Field change**: one planned change to one field of the clone; applied or not applied with a reason.
- **Send result**: the new resume's id and link, the counts of applied and not-applied changes with reasons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a live roundtrip against a real v6 instance, the new resume appears in the person's account with layout and design intact and the original resume unchanged (verified by comparing the original before and after).
- **SC-002**: A send with no edits produces data identical to the source (automated test on the recorded live shape).
- **SC-003**: Every edit the person made is shown as applied or not applied with a reason; none is silently dropped (automated check over mixed fixtures).
- **SC-004**: A person can go from a saved tailored copy to the new Reactive Resume resume in one button press.
- **SC-005**: No log line, page or error produced by the feature contains the key (automated secret-access and redaction tests).
- **SC-006**: Types, tests, export audit, catalogs, schema-vs-migration diff, and the route smoke pass.

## Assumptions

- The verified instance is Reactive Resume 6.0.3 (hosted or self-hosted); its public API documents create, duplicate, update and JSON-Patch operations, authenticated by an API key header, confirmed against the live instance.
- A tailored copy's text is the master's text with the person's edits (as saved by #48).
- Edits that change wording inside existing rich-text blocks and keyword lists are mappable; new sections, reordering and layout changes are not.
- The person already has a saved connection (#42/#75); this feature adds no new setting.
- Out of scope: writing to the original resume, creating Reactive Resume resumes from non-Reactive-Resume masters, v4/v5 write-back, storing raw JSON, retrying mutations, deleting or trashing the created resume from ApplyPack.
