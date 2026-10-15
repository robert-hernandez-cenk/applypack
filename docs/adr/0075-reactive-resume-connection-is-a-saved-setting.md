# 0075 — The Reactive Resume connection is a saved setting

**Status:** Accepted (2026-10-15). Issue #42. Supersedes the "key in memory only" part of
[0073](./0073-reactive-resume-import-reads-a-file-or-asks-the-owners-instance.md); builds on
[0071](./0071-job-leads-are-read-from-the-persons-own-mailbox.md) (a per-person secret kept so a later request can use it) and
[0070](./0070-administrators-run-the-install-members-work-in-their-own-space.md) (administrators and members).

## Context

0073 asked for the instance address and API key on every pull and held the key for ten minutes. That
is fine once and wrong for a person who keeps their resume in Reactive Resume and brings each edit
here: every update meant retyping a key. The request was for a setting, and for the resume page's
"Upload a new version" to take Reactive Resume as a source.

## Decision

- **One connection per person**, `reactive_resume_connection(userId, baseUrl, apiKey)`, cascade on user
  delete. It is set, replaced and removed on Settings, beside the Gmail card.
- **The key is stored.** There is no way to "set once" otherwise. It is kept as plain text in the
  install's database, as Gmail's refresh token is; encrypting at rest needs a key the install has no
  place to keep. `CLAUDE.md`'s secrets carve-outs gain this key under the same rules: read only through
  its own accessor, never rendered in full, never logged.
- **One reader.** `src/resume/reactive-connection-store.ts` is the only file that touches the table;
  `readInstanceKey` is the only function that returns the key, called by the routes that make a request to
  the instance. Pages get a `ConnectionView` (address and host) with no key field; the card never shows
  any part of the key and the replace form's key field is always empty. A source test closes the list of
  files that may name the table or the accessor.
- **Checked on save.** Saving lists the person's resumes with the address and key; only a pair that
  works is stored, and a failed replace leaves the old pair. The address rules of 0073 (http/https, no
  credentials, no redirects, time and size limits, private addresses for administrators only) apply
  at save, list and import, for the person's standing at that moment.
- **The pull stash holds no key.** It keeps the ids that were listed, the owner, and the target (a new
  resume, or the next version of one resume). The import reads the key from the store.
- **Two uses.** `/resumes` lists from the saved connection and imports a new resume (the typed form is
  gone). A resume's "Upload a new version" card gains "From Reactive Resume": the pick becomes the next
  version through the same path as a file upload (same-text notice, version number, re-scan), keeping the
  resume's own name.

## Consequences

- A copy of the database now holds a working key to the person's Reactive Resume account. That key only
  reads their resumes (no write-back is made), and removing the card deletes it; a leaked key is revoked at
  the instance.
- Not done: remembering which Reactive Resume resume a version came from, several connections per person,
  encryption at rest.
