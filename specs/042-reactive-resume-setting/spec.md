# Feature Specification: Reactive Resume connection as a saved setting

**Feature Branch**: `issue-42-reactive-resume-setting`

**Created**: 2026-10-15

**Status**: Draft

**Input**: GitHub issue #42 — follow-up to #39 (`specs/039-reactive-resume-import`). The Reactive Resume connection is typed in again on every pull. It becomes a saved, per-person setting, and a resume's "Upload a new version" can take its new text from Reactive Resume.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save the connection once (Priority: P1)

A person opens Settings, finds a Reactive Resume card, and enters the address of their instance (hosted or self-hosted) and an API key. On save, ApplyPack checks them by listing the person's resumes there. If that works, the connection is kept; if not, nothing is kept and the person is told why. Afterwards the card says a connection is saved and to which address, never showing the key. They can replace it with a new address and key, or remove it.

**Why this priority**: Everything else reads this connection. Without it the other stories have nothing to use.

**Independent Test**: With a stand-in server that answers like Reactive Resume, save an address and key, reload Settings and see "connected to <host>" with no key in the page; save a wrong key and see the old connection unchanged; remove it and see the card back to empty.

**Acceptance Scenarios**:

1. **Given** no saved connection, **When** the person enters a valid address and key, **Then** the connection is saved and the card shows the address and that a key is saved.
2. **Given** a saved connection, **When** the person opens Settings again, **Then** the key appears nowhere on the page, in any link or in any message.
3. **Given** a wrong key, an address that does not answer, an answer that is not Reactive Resume, or an instance without the API, **When** the person saves, **Then** a plain message names which it was (the same messages as #39) and no connection is created or changed.
4. **Given** a saved connection, **When** the person saves a new address and key that check out, **Then** the new pair replaces the old one; when the check fails, the old one stays.
5. **Given** a saved connection, **When** the person removes it, **Then** both the address and the key are deleted and the pull options elsewhere point back to Settings.
6. **Given** a member of a shared install, **When** they save an address that resolves to a loopback, private or link-local address, **Then** it is refused before any request leaves; an administrator may save it (as in #39).
7. **Given** a person on a shared install, **When** another person looks at Settings, **Then** they see only their own connection; no one can see or use another person's.

---

### User Story 2 - Import a new resume from the saved connection (Priority: P1)

On the Resumes page, a person with a saved connection presses one button to list their Reactive Resume resumes, picks one, and gets a new resume exactly as in #39. They no longer type an address or a key. A person without a saved connection sees a short pointer to Settings instead. Uploading an exported file stays as it was.

**Why this priority**: It is the everyday gain of the setting and replaces the form #39 shipped.

**Independent Test**: Save a connection, open the Resumes page, list, pick, and find a new resume in the list. Remove the connection and see the pointer to Settings in its place.

**Acceptance Scenarios**:

1. **Given** a saved connection, **When** the person asks to list, **Then** their Reactive Resume resumes are shown by name without any field to fill in.
2. **Given** the list, **When** they pick one, **Then** a normal resume is saved as #39 specifies.
3. **Given** no saved connection, **When** the Resumes page is opened, **Then** no address or key field appears; a pointer leads to Settings.
4. **Given** a saved connection whose key was revoked at the instance, **When** the person lists, **Then** they are told the key was refused and sent to Settings to replace it; the stored connection is left as it is.
5. **Given** the list is shown and the person waits too long, **When** they pick one, **Then** they are asked to list again.

---

### User Story 3 - Upload a new version from Reactive Resume (Priority: P1)

On a resume's page, the "Upload a new version" card offers a second source beside the file: Reactive Resume. With a saved connection, the person lists their Reactive Resume resumes, picks the one that holds the updated text, and it becomes the resume's next version: the same new version number, the same "reads like the current version" notice, and the same re-scan as when a file is uploaded. Without a saved connection the option points to Settings.

**Why this priority**: It is the point of the request: keep one resume in Reactive Resume and pull each edit into ApplyPack without export and upload.

**Independent Test**: On a resume at v1 with a saved connection, choose Reactive Resume, pick a resume with different text, and see v2 scanned; repeat with unchanged text and see the notice and no new version.

**Acceptance Scenarios**:

1. **Given** a resume and a saved connection, **When** the person picks a Reactive Resume resume with different text, **Then** the resume's version goes up by one and it is scanned like an uploaded version.
2. **Given** a pick whose text reads like the resume's current version, **When** it is imported, **Then** the person is told it is the same as the current version and nothing changes.
3. **Given** the pick has too little text or is not readable, **When** it is imported, **Then** the person is told why (as in #39) and the resume is untouched.
4. **Given** no saved connection, **When** the card is viewed, **Then** the Reactive Resume option points to Settings and the file upload still works as before.
5. **Given** a resume that is not the person's, **When** its new-version route is used, **Then** it is "not found" as for any other resume action.
6. **Given** a pick from the list, **When** the version is saved, **Then** the resume keeps its own name; the Reactive Resume resume's name is not applied to it.

---

### Edge Cases

- The saved instance is down when the person lists: the same plain message as #39 ("did not answer"), the connection is kept.
- The instance's address now resolves to a private range for a member (the name's answer changed): refused at list and at import, connection kept.
- A person removes the connection between listing and picking: the pick fails with "list again" and no request is made.
- Two tabs save the connection at the same time: the last save wins; there is never half a pair.
- An administrator who loses administrator status keeps a private-address connection but it is refused on use, with the private-address message.
- The key pasted with surrounding spaces or line breaks is trimmed; an over-long paste is refused whole, not cut.
- A person deleted from the install takes their connection with them.
- Existing #39 behaviour for uploaded files, hidden sections, versions v4/v5/v6 and the size/time limits is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each person MUST be able to keep at most one Reactive Resume connection, made of an instance address and an API key, saved, replaced and removed from Settings.
- **FR-002**: Saving MUST check the pair first by listing the person's resumes at the instance, under #39's address rules (http/https only, no embedded credentials, no redirects, time and size limits, private addresses for administrators only); a failed check MUST create or change nothing and name its cause.
- **FR-003**: The stored key MUST be readable only through one dedicated accessor used to call the instance. It MUST NOT be rendered in full anywhere, logged, put in a link, a message, an error or a form value, and a person's connection MUST be visible and usable to that person only.
- **FR-004**: Settings MUST show whether a connection is saved and its address, and MUST NOT show the key or any part of it.
- **FR-005**: Removing the connection MUST delete both address and key; deleting the person MUST delete their connection.
- **FR-006**: The Resumes page MUST NOT ask for an address or a key. With a saved connection it MUST offer to list the person's Reactive Resume resumes and import the picked one as a new resume (#39 behaviour); without one it MUST point to Settings. Uploading an export file MUST remain.
- **FR-007**: A resume's "Upload a new version" card MUST offer Reactive Resume as a source beside the file. With a saved connection it MUST list the person's Reactive Resume resumes, and importing the picked one MUST replace the resume's file as a new version through the same steps as a file upload: same-text-as-current notice, next version number, re-scan.
- **FR-008**: A new version pulled from Reactive Resume MUST keep the resume's own name and MUST NOT change any other resume.
- **FR-009**: The step between listing and picking MUST hold only the ids of the listed resumes, who listed them and, for a new version, which resume it is for. It MUST NOT hold the key; the key is read from the store when the import runs. Its short lifetime and one-use rules from #39 stay.
- **FR-010**: The address check MUST be repeated at import time for the person's standing then (administrator or member), as in #39.
- **FR-011**: A refused, revoked or unreachable stored connection MUST give the same distinct plain messages as #39 and MUST leave the stored connection unchanged; a refused key MUST direct the person to Settings.
- **FR-012**: Every string the person reads MUST be in all of the interface's language catalogs (English, Spanish, French, Ukrainian), and the new Settings route MUST be registered as a personal route.
- **FR-013**: The feature MUST NOT write to, change or sync with the Reactive Resume instance, and MUST NOT record which Reactive Resume resume a version came from.
- **FR-014**: Documentation MUST record that this replaces #39's promise that the key is never stored (a new decision record), and the secret-handling rules in the project instructions MUST list the stored key as a deliberate exception.

### Key Entities

- **Reactive Resume connection**: one per person; an instance address and an API key; created, replaced and removed on Settings; used only to list and read that person's resumes at the instance.
- **Pull entry**: short-lived, one-use step between listing and picking; the person it belongs to, the ids listed, and the target (a new resume, or the next version of one named resume). It holds no key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the connection is saved once, importing a Reactive Resume resume as a new resume takes two actions (list, pick) with nothing typed.
- **SC-002**: Updating an existing resume from Reactive Resume takes two actions (list, pick) from its page, and ends in a scanned next version.
- **SC-003**: In every tested outcome (saved, replaced, refused, removed, pulled, failed), the key appears in 0 rendered pages, 0 links, 0 messages and 0 log lines.
- **SC-004**: As a member on a shared install, 100% of loopback, private-range and link-local addresses are refused before any request leaves the server, at save, list and import.
- **SC-005**: A person never sees or uses another person's connection in any tested case.
- **SC-006**: Every failure the person can meet gives a message that names the cause; a refused key names Settings as the place to fix it.

## Assumptions

- The key has to be stored to make "set once" possible; it is kept as-is in the install's database, as other per-person secrets are (the Gmail token, the AI keys), and an install's database is as private as its owner keeps it. Encryption at rest is out of scope.
- One connection per person is enough; people with two instances use the file route for the second.
- A person updating a resume from Reactive Resume picks the source resume each time; remembering the pairing is a follow-up.
- The check on save is a list call; an instance with no resumes yet answers with an empty list and is still a valid connection.
- #39's fixtures, address rules and text reading are reused unchanged; the stand-in server for tests is the one #39 used.
- Out of scope: several connections per person, remembering a resume's Reactive Resume source, writing back to Reactive Resume, syncing, encrypting the key at rest, importing the picture or design.
