# Feature Specification: Keep profile and page links when importing from Reactive Resume

**Feature Branch**: `issue-44-reactive-resume-links`

**Created**: 2026-10-15

**Status**: Draft

**Input**: GitHub issue #44 — a bug in #39 (`specs/039-reactive-resume-import`). A resume imported from Reactive Resume, from an exported file or by pulling from an instance, comes out without the person's GitHub and LinkedIn addresses, and "Download original" returns the same text without them. Profile links must survive the import, and so must links written inside a summary or a bullet.

**Amended 2026-10-15 after reading the live instances** (resume 5 on the owner's ApplyPack, and the Reactive Resume resume it was pulled from): (1) the real export has *no* profiles — the LinkedIn and GitHub links are `basics.customFields` entries, each a `text` ("LinkedIn") and a separate `link`, and the importer kept only the `text`, so the header read `LinkedIn · Github` with no address; (2) the page's "what a parser reads" panel found **no name, email, phone, link or location, and one role of six**, because the Markdown the importer writes (`# Name`, `### Role`, `#### Sub-role`) is read by `structureFromText` as a stack of section headings, not as a header and roles. The goal is that an ATS-style reader gets everything Reactive Resume holds; the stories below are widened to that.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Profile and contact links reach the header (Priority: P1)

A person whose Reactive Resume lists a GitHub and a LinkedIn profile — as profiles, or as contact fields under their name — imports it. The new resume's header shows the address of each profile next to the email, phone and place, and nothing is repeated further down the resume. A profile that only has a username, with no address, stays as `Network: username`. A profile the person hid in Reactive Resume stays hidden.

**Why this priority**: This is the reported defect. A resume whose contact line has no links reads as unfinished to an employer, and the person cannot get the links back except by retyping them.

**Independent Test**: Import an export whose profiles carry both a username and an address, and read the stored resume text: each address is in the header line, no trailing Profiles section exists, and "Download original" holds the same lines.

**Acceptance Scenarios**:

1. **Given** a profile with a username and an address, **When** the resume is imported, **Then** the header contact line holds the address, written as the full link and nothing else.
2. **Given** a profile with a username and no address, **When** the resume is imported, **Then** the header contact line holds `Network: username`.
3. **Given** a profile hidden in Reactive Resume, **When** the resume is imported, **Then** it appears nowhere in the text.
4. **Given** several profiles and a personal website, **When** the resume is imported, **Then** every address appears once, in the order Reactive Resume lists them, after the email, phone, place and website.
5. **Given** an export from any of the three generations ApplyPack reads (v4, v5, v6), **When** it is imported, **Then** the address is found wherever that generation keeps it.
6. **Given** a resume with no profiles and no contact links, **When** it is imported, **Then** the header holds the same entries it held before this change.
7. **Given** a contact field with both words and a link (`LinkedIn` + `https://linkedin.com/in/x`), **When** the resume is imported, **Then** the header holds the link, not the words.
8. **Given** a contact field with words and no link ("Authorized to work in the US"), **When** the resume is imported, **Then** the header holds the words, as before.

---

### User Story 2 - Links written inside the text survive (Priority: P2)

A person put a link in a summary or in a bullet ("Shipped the [billing rewrite](https://…)"). After the import the link's address is still in the text, next to the words it was attached to, so a reader of the plain text, and the model that scores it, can see where it pointed.

**Why this priority**: The same loss, in a place fewer resumes use. It does not block the header fix.

**Independent Test**: Import a summary and a bullet that each hold a link; both addresses are in the stored text. Import one whose link text is the address itself and see it once.

**Acceptance Scenarios**:

1. **Given** a link with words attached, **When** the resume is imported, **Then** the text reads `words (address)`.
2. **Given** a link whose visible text is empty or is the address itself, **When** the resume is imported, **Then** the address appears once, alone.
3. **Given** a link that is not a web or mail address (a `javascript:` target, a data URL, a relative path), **When** the resume is imported, **Then** only its words remain and the target is dropped.
4. **Given** text with no links, **When** the resume is imported, **Then** its words are the same as before this change.

---

### User Story 3 - A plain parser reads the whole resume (Priority: P1)

The imported text reads the way an ordinary resume's extracted text does: the person's name on the first line, then the headline, then one contact line; sections under `##` headings; each job as a company line, a position line with its dates, and bullets under it. A plain reader — the "what a parser reads" panel on the resume page, the render's fallback reader, and an ATS that extracts text — then finds the name, the email, the phone, the place, the links, every job with its dates and bullets, every degree and every skills group, instead of a few section headings.

**Why this priority**: Without it the links of Story 1 are written into a text the reader cannot place, and the page tells the person their name, phone and place are missing when they are all in Reactive Resume. This is the reason the import is worth having.

**Independent Test**: Read the imported text of a resume shaped like the live one (six jobs, three degrees, ten skills groups, two contact links) with the plain reader: it reports the name, email, phone, place and both links, all six employers with every job's dates and bullets (a position an employer writes as a bold paragraph reads as a further role, as it does in a .docx), three degrees and ten skills groups.

**Acceptance Scenarios**:

1. **Given** an imported resume, **When** a plain reader reads it, **Then** the name is the first line of the text and the headline the second, with no `#` marker on either.
2. **Given** a job with a company, a position and dates, **When** it is imported, **Then** it is two lines, the company (with its place after a `·` when it has one) and the position with its dates after a `·`, followed by its bullets; a plain reader finds one job with those fields.
3. **Given** an employer that holds several positions, **When** it is imported, **Then** each position is a job of its own, the company line repeated above it.
4. **Given** the six jobs, three degrees and ten skills groups of a real export, **When** it is imported, **Then** a plain reader finds all six employers with all of their bullets, three degrees and ten skills groups, and no job, degree or name appears as a section heading.
5. **Given** a language with a fluency, **When** it is imported, **Then** it is written `Language (fluency)`, which a plain reader splits into the two.
6. **Given** a section, **When** it is imported, **Then** its heading is `## ` plus the title it has in Reactive Resume.

---

### Edge Cases

- A profile with an address but no username, no network name: the address alone.
- A profile with neither a username, a network nor an address: nothing is written for it.
- An address written with uppercase letters, a trailing slash or a query string is kept exactly as written; nothing is normalised.
- A very long or malformed link in a description does not slow the import down; a link it cannot read is left as its words.
- An address that appears both as the person's website and as a profile: shown once.
- Resumes already imported keep what they stored; importing again gives the new text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The import MUST write the address of every visible profile into the resume's header contact line, after the email, phone, place and website.
- **FR-002**: A profile that has an address MUST be written as that address alone, whether or not it also has a username.
- **FR-003**: A profile that has a username and no address MUST be written as `Network: username`, as before.
- **FR-004**: A hidden profile MUST NOT appear anywhere in the imported text.
- **FR-005**: The imported text MUST NOT contain a separate Profiles section.
- **FR-006**: An address MUST appear once in the header even when the person's website and a profile hold the same one.
- **FR-007**: A link inside a summary, a description or any other formatted text MUST keep its address in the imported text, written `words (address)`, or the address alone when the words are empty or are the address.
- **FR-008**: Only web (`http`, `https`) and mail (`mailto`) addresses MAY be kept from formatted text; any other target MUST be dropped and the link's words kept.
- **FR-009**: Reading links out of formatted text MUST take time proportional to the text's length, however long or malformed a link is.
- **FR-010**: The change MUST apply to both ways in: an uploaded export file and a pull from an instance.
- **FR-011**: Apart from the links (FR-001, FR-007, FR-013) and the form of the lines (FR-014 to FR-017), the words imported MUST be the same as before this change: no field gains, loses or rewords text.
- **FR-012**: Uploads of any other kind (`.docx`, `.pdf`, `.md`, `.txt`) MUST produce the same text as before.
- **FR-013**: A contact field with a link MUST be written into the header as the link; one without a link MUST be written as its words. Entries are de-duplicated like the others (FR-006).
- **FR-014**: The first line of the imported text MUST be the person's name and the second their headline (when they have one), neither carrying a `#`; the third MUST be the contact line.
- **FR-015**: A job MUST be written as a company line (`Company`, or `Company · Place`) followed by a position line (`Position · Dates`, or the dates alone when there is no position) followed by its text; an employer's several positions MUST each be written this way. An item that names neither a company nor a position MUST write only its text, never a line of dates alone.
- **FR-016**: No imported line MAY begin with `#` except a section heading, which MUST be `## ` plus the section's title.
- **FR-017**: An education entry, a certificate, an award, a publication, a volunteer entry, a reference and a project MUST each be written as plain lines, none as a heading; a language with a fluency MUST be written `Language (fluency)`.
- **FR-018**: Every piece of text Reactive Resume shows on the resume (name, headline, contact, summary, each visible item's fields, description and keywords) MUST appear in the imported text; only what Reactive Resume hides, and its design settings, MAY be left out.

### Key Entities

- **Profile**: one entry of the person's online profiles in Reactive Resume — a network name, a username, an optional address, and whether it is hidden.
- **Header contact line**: the one line under the person's name and headline that holds email, phone, place, website and, after this change, profile addresses.
- **Imported text**: the Markdown a Reactive Resume export is written out to, stored as the resume's text and as its original.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For an export whose profiles all carry an address, 100% of those addresses appear in the imported text's header, and 0 appear in a trailing section.
- **SC-002**: For an export whose summary and bullets contain links, 100% of the web and mail addresses appear in the imported text; 0 other targets do.
- **SC-003**: Importing the existing fixtures for v4, v5 and v6 produces, for every field other than profiles, contact links and anchors, exactly the words it produced before this change (only the line form differs).
- **SC-004**: A description holding 300 000 characters of unterminated link markup imports in under one second.
- **SC-005**: A person who imports their resume and presses "Download original" sees their GitHub and LinkedIn addresses in the file.
- **SC-006**: For the live export (six jobs, three degrees, ten skills groups, two contact links), the plain reader finds the name, email, phone, place and both links, all six employers and every one of the 58 bullets, three degrees and ten skills groups; the page lists none of the four contact kinds as missing.
- **SC-007**: In the imported text of every fixture, 0 lines begin with `#` other than `## ` section headings.

## Assumptions

- The three generations of export ApplyPack already reads (v4, v5, v6) keep a profile's address in the places ADR 0073 and the fixtures record; no new generation is added.
- A bare address in a contact line is how a resume header already reads, and the later steps that read a resume's header already recognise GitHub and LinkedIn addresses there.
- The original export file is not kept (ADR 0073); only the written-out text is, so resumes imported before this change are fixed by importing again, not by a migration.
- Out of scope: migrating stored resumes, keeping the original JSON, changing how a header is parsed into a structure or drawn, and any change to what other upload kinds produce.
- Released as a patch version, 2.59.8.
