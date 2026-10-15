# Contract: routes

Both are personal routes (`PERSONAL_ROUTES`), same-origin POSTs behind the existing CSRF/origin guard.

## POST /resumes (existing) — file path

Multipart `file`. A `.json` file is now read by `readResumeUpload`: a Reactive Resume export becomes `{ sourceFilename: '<name>.md', mimeType: 'text/markdown', original: <markdown bytes>, text }`; a JSON file that is not one gives the flash error `resumes.reactive.notExport`. Everything after (duplicate check, create, scan, flash) is unchanged.

## POST /resumes/reactive/list

Form fields: `url` (instance address), `key` (API key).

| Outcome | Response |
| --- | --- |
| address refused (scheme, credentials, invalid, private for a member) | redirect `/resumes` with `err` flash naming the cause |
| instance answered with the list | 200 page: the picker (resume names, a radio per resume, hidden `pull` = stash id); no key, no URL echoed beyond the host |
| 401/403 | `err` flash: key refused |
| 404 or an answer that is not the API | `err` flash: not Reactive Resume / too old for this — use the exported file |
| 3xx | `err` flash: instance redirected; enter its final address |
| timeout / network error | `err` flash: no answer |
| body over cap / not JSON | `err` flash: too large / not Reactive Resume |

## POST /resumes/reactive/import

Form fields: `pull` (stash id), `id` (the picked resume's id).

| Outcome | Response |
| --- | --- |
| stash missing, expired or another user's | redirect `/resumes` with `err`: enter the key again |
| fetch/convert failure | redirect `/resumes` with `err` (same causes as above, or `notExport` / `tooShort`) |
| duplicate text | the same duplicate flash an identical upload gives |
| success | `createResume`, scan queued, redirect with the `resume.flash.uploaded` message |

The stash entry is deleted on every outcome of this route.

## Outbound requests (reactive-resume-api.ts)

`GET {base}/api/openapi/resumes` and `GET {base}/api/openapi/resumes/{id}` with `x-api-key: <key>`, `Accept: application/json`, `redirect: 'manual'`, 10 s abort, 5 MB cap. No other header, no cookie, no body.
