# Route contracts

Both routes are **personal** (`PERSONAL_ROUTES` in `src/users/admin-policy.ts`) and sit under `/jobs/:id/…`, so `requireHeldJob` answers 404 "not found" for a posting the person holds no row for.

## `GET /jobs/:id/edit`

| Case | Response |
|------|----------|
| Bad id | 400 `http.badId` |
| Not held | 404 (guard) |
| Held, other holders exist | 403, page with the explanation `jobEdit.shared` and a link back; no form |
| Held, sole holder | 200, form pre-filled: `title`, `company`, `location`, `description` (+ hidden `tab`) |

## `POST /jobs/:id/edit`  (form, `onceGuard` per job id)

Fields: `title`, `company`, `location`, `description`, `tab`.

| Case | Response |
|------|----------|
| Bad id / not held / shared | as the GET |
| Validation error | 400, the form again with the typed values and the message for the error code (`titleEmpty`, `titleTooLong`, `companyTooLong`, `locationTooLong`, `descriptionTooShort`, `descriptionTooLong`) |
| Nothing changed | 303 → `/jobs/:id`, flash warn `jobEdit.unchanged`; no AI call |
| Saved | 303 → `/jobs/:id?tab=…`, flash ok: saved and scored / saved, no search / saved, engine did not answer (with reason) / saved, prefiltered |

Never changes status, link, source or salary.
