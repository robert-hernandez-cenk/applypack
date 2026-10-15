# Research: Reactive Resume connection as a saved setting

No external unknowns: the instance API, its limits and the address policy are #39's (see `specs/039-reactive-resume-import/research.md`). The decisions below are internal.

## D1 — One table, own accessor, Gmail's shape

**Decision**: `ReactiveResumeConnection { userId @id, baseUrl, apiKey, createdAt, updatedAt }`, cascade on user delete. `reactive-connection-store.ts` is the only file that touches it. `getConnectionView(userId)` selects `baseUrl` only; `readInstanceKey(userId)` returns `{ base, key }` for the two routes that call the instance. A source test holds a closed list of files that may name the table or the accessor and checks every read has an explicit `select`.

**Rationale**: `gmail/store.ts` + `secret-access.test.ts` is the repo's precedent for a per-person secret; reusing it keeps the review surface known.

**Alternatives**: a JSON column on `UserSettings` (rejected: every settings read would carry the key; `settings-split.ts` classifies columns and a secret has no business in the general read); the `AppSettings.aiKeys` map (install-wide, wrong owner).

## D2 — Validate on save by listing

**Decision**: saving runs `parseInstanceUrl` → `reachable(base, { privileged: isAdmin })` → `listInstanceResumes(base, key)`. Success (including an empty list) stores; any failure flashes #39's message and stores nothing. Replace is the same upsert; a failed replace leaves the old pair.

**Rationale**: the list call is the cheapest request that proves address, key and API presence together, and it is what the first use does anyway.

**Alternatives**: store unchecked and fail on first use (rejected: the person learns of a typo at the worst time; also stores junk).

## D3 — The stash drops the key and gains a target

**Decision**: `Pull = { userId, ids, target }`, `target = { kind: 'new' } | { kind: 'version', resumeId }`. Import reads the key and base from the store, re-checks reach for the person's current standing, fetches, and branches on the target. A person who removed the connection between list and pick gets the "list again" message.

**Rationale**: spec FR-009. With the key in the database, holding a copy in memory is only a second place to leak from.

**Alternatives**: keep key in stash (rejected, FR-009); drop the stash and post the id straight to import (rejected: the "may only import what was listed" check and the ten-minute expiry are #39 behaviours worth keeping, and the ids are cheap to hold).

## D4 — Share the new-version save

**Decision**: extract the body of `POST /resumes/:id/replace` after the upload is read (same-text check → `replaceResumeFile` → `startScanRun` with the version messages) into `saveNewVersion(c, current, upload)` used by the file route and the Reactive Resume import.

**Rationale**: spec FR-007 says "exactly like a file upload"; one function makes that true by construction.

**Alternatives**: duplicate the block (rejected: two copies of the same-text rule drift).

## D5 — Where the card lives

**Decision**: a Section beside Gmail on the same Settings tab, because both are "a place the person's postings or resumes come from, connected to an outside account", and the Gmail card's save/flash/anchor pattern (`/settings?tab=profile#gmail`) is reused with `#reactive-resume`.

**Alternatives**: a card on `/resumes` (rejected: the request says setting; also keeps the secret form out of a list page).

## D6 — Key shown to the person

**Decision**: never. The card shows the address and "a key is saved". The replace form's key field is always empty.

**Alternatives**: last four characters (rejected: no use to the person, and spec SC-003 counts any key text in a page as a leak).
