# Route contract: Reactive Resume connection

All routes are POST, CSRF-origin-checked like the rest of the dashboard, and **personal** (`PERSONAL_ROUTES`). Every one acts as `currentUser()`. No response, redirect or flash ever contains the key.

## Settings

### `POST /settings/reactive-resume`

Form: `url` (text), `key` (password, may not be empty).
1. `parseInstanceUrl(url)` → on failure flash `resumes.reactive.fail.*` (URL codes).
2. `reachable(base, { privileged: isAdmin })` → flash private-address / no-host message.
3. `listInstanceResumes(base, key)` → `InstanceError` flashes #39's message.
4. Upsert `(userId, baseUrl, apiKey)`; flash ok. Redirect to `/settings?tab=profile#reactive-resume`.

Failure at 1–3: nothing written, redirect with an error flash. Guarded by `onceGuard` per person.

### `POST /settings/reactive-resume/remove`

Deletes the person's row (idempotent); flash ok; same redirect.

## Resumes

### `POST /resumes/reactive/list` (changed)

No form fields. No saved connection → flash "set it up in Settings" → `/resumes`. Else reach (current standing) → list → empty list flashes the "none" warning; otherwise stash `{ userId, ids, target: new }` and render the pick page.

### `POST /resumes/:id/reactive/list` (new)

Same for a resume the person owns (404 otherwise); stash target `{ version, resumeId }`; refusals redirect to `/resumes/:id`.

### `POST /resumes/reactive/import` (changed)

Form: `pull` (stash id), `id` (a listed Reactive Resume id). Takes the pull (always consumed); missing or expired → "list again". Missing connection → "list again / set up". Re-checks reach, reads the key from the store, fetches, converts with `reactiveResumeText`.
- target `new`: `saveUploaded` as before (new resume named after the Reactive Resume resume).
- target `version`: the resume must still be the person's; `saveNewVersion` (same-text notice, next version, rescan). The resume keeps its name.

Instance and text errors redirect to `/resumes` or `/resumes/:id` by target. A refused key adds "replace it in Settings".

## Pages

- Settings card: not saved → form (address, key) ; saved → "Connected to **host**. A key is saved." + replace form (address prefilled, key empty) + remove (confirm).
- `/resumes`: the typed form is gone; saved → a button "List my Reactive Resume resumes"; not saved → a one-line pointer to the Settings card.
- Resume page, "Upload a new version": file form as before, plus a second form/button "From Reactive Resume" (saved) or the pointer (not saved).
