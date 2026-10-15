# Feature Specification: Keep profile and page links when importing from Reactive Resume

**Feature Branch**: `issue-44-reactive-resume-links`

**Created**: 2026-10-15

**Status**: Draft

**Input**: GitHub issue #44 — a bug in #39 (`specs/039-reactive-resume-import`). A resume imported from Reactive Resume, from an exported file or by pulling from an instance, comes out without the person's GitHub and LinkedIn addresses, and "Download original" returns the same text without them. Profile links must survive the import, and so must links written inside a summary or a bullet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Profile links reach the header (Priority: P1)

A person whose Reactive Resume lists a GitHub and a LinkedIn profile imports it. The new resume's header shows the address of each profile next to the email, phone and place, and nothing is repeated further down the resume. A profile that only has a username, with no address, stays as `Network: username`. A profile the person hid in Reactive Resume stays hidden.

**Why this priority**: This is the reported defect. A resume whose contact line has no links reads as unfinished to an employer, and the person cannot get the links back except by retyping them.

**Independent Test**: Import an export whose profiles carry both a username and an address, and read the stored resume text: each address is in the header line, no trailing Profiles section exists, and "Download original" holds the same lines.

**Acceptance Scenarios**:

1. **Given** a profile with a username and an address, **When** the resume is imported, **Then** the header contact line holds the address, written as the full link and nothing else.
2. **Given** a profile with a username and no address, **When** the resume is imported, **Then** the header contact line holds `Network: username`.
3. **Given** a profile hidden in Reactive Resume, **When** the resume is imported, **Then** it appears nowhere in the text.
4. **Given** several profiles and a personal website, **When** the resume is imported, **Then** every address appears once, in the order Reactive Resume lists them, after the email, phone, place and website.
5. **Given** an export from any of the three generations ApplyPack reads (v4, v5, v6), **When** it is imported, **Then** the address is found wherever that generation keeps it.
6. **Given** a resume with no profiles, **When** it is imported, **Then** the text is the same as before this change.

---

### User Story 2 - Links written inside the text survive (Priority: P2)

A person put a link in a summary or in a bullet ("Shipped the [billing rewrite](https://…)"). After the import the link's address is still in the text, next to the words it was attached to, so a reader of the plain text, and the model that scores it, can see where it pointed.

**Why this priority**: The same loss, in a place fewer resumes use. It does not block the header fix.

**Independent Test**: Import a summary and a bullet that each hold a link; both addresses are in the stored text. Import one whose link text is the address itself and see it once.

**Acceptance Scenarios**:

1. **Given** a link with words attached, **When** the resume is imported, **Then** the text reads `words (address)`.
2. **Given** a link whose visible text is empty or is the address itself, **When** the resume is imported, **Then** the address appears once, alone.
3. **Given** a link that is not a web or mail address (a `javascript:` target, a data URL, a relative path), **When** the resume is imported, **Then** only its words remain and the target is dropped.
4. **Given** text with no links, **When** the resume is imported, **Then** the text is the same as before this change.

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
- **FR-011**: A resume with no profiles and no links in its text MUST import to exactly the text it produced before this change.
- **FR-012**: Uploads of any other kind (`.docx`, `.pdf`, `.md`, `.txt`) MUST produce the same text as before.

### Key Entities

- **Profile**: one entry of the person's online profiles in Reactive Resume — a network name, a username, an optional address, and whether it is hidden.
- **Header contact line**: the one line under the person's name and headline that holds email, phone, place, website and, after this change, profile addresses.
- **Imported text**: the Markdown a Reactive Resume export is written out to, stored as the resume's text and as its original.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For an export whose profiles all carry an address, 100% of those addresses appear in the imported text's header, and 0 appear in a trailing section.
- **SC-002**: For an export whose summary and bullets contain links, 100% of the web and mail addresses appear in the imported text; 0 other targets do.
- **SC-003**: Importing the existing fixtures for v4, v5 and v6 produces, for every part other than profiles and links, text identical to the text produced before this change.
- **SC-004**: A description holding 300 000 characters of unterminated link markup imports in under one second.
- **SC-005**: A person who imports their resume and presses "Download original" sees their GitHub and LinkedIn addresses in the file.

## Assumptions

- The three generations of export ApplyPack already reads (v4, v5, v6) keep a profile's address in the places ADR 0073 and the fixtures record; no new generation is added.
- A bare address in a contact line is how a resume header already reads, and the later steps that read a resume's header already recognise GitHub and LinkedIn addresses there.
- The original export file is not kept (ADR 0073); only the written-out text is, so resumes imported before this change are fixed by importing again, not by a migration.
- Out of scope: migrating stored resumes, keeping the original JSON, changing how a header is parsed into a structure or drawn, and any change to what other upload kinds produce.
- Released as a patch version, 2.59.8.
