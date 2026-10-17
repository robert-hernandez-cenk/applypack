# Contract: calls to the Reactive Resume instance

All calls: base = the person's saved connection; URL = `apiUrl(base, path)` (prefix `/api/openapi`); header
`x-api-key: <key>` and `Accept: application/json` (+ `Content-Type: application/json` on a body); `redirect:
'manual'` (any 3xx → `redirect`); 10 s timeout; 5 MB body cap; **no retry**. The key appears only in the header.
Reachability (`reachable`) is checked by the caller first.

| # | Call | Body | Success | Used for |
| --- | --- | --- | --- | --- |
| 1 | `GET /resumes/{id}` | – | `{ id, name, data, isLocked, updatedAt, … }` | the source, and the clone |
| 2 | `POST /resumes/{id}/duplicate` | `{ "name": "<Resume> - <Company> - <Role>" }` | `200` JSON string = new id | the clone |
| 3 | `PATCH /resumes/{id}` | `{ "expectedUpdatedAt": "<clone.updatedAt>", "operations": [ {op,path,value}… ] }` | `200` resume | the edits |

Status mapping (extends `refusalOf`): 401/403 without a `RESUME_LOCKED` code → `unauthorized`; 403 + code
`RESUME_LOCKED` → `locked`; 409 → `conflict`; 400 + `INVALID_PATCH_OPERATIONS` → `badPatch`; any other 400 on a write is `badPatch` too (the words say "the request", not "the edits"); 404/405/410 →
`notApi` (a missing id is `notFound` for call 1 on a known-good instance: the client returns `notApi`; the route
words it "not found there"); other non-2xx → `unreachable`; abort → `timeout`; body past the cap → `tooLarge`.

Responses are validated with zod (`id` string for #2; an object with `data` for #1/#3).

Patch operations are only `replace`, `add` (insert a list block / array element) and `remove`, on pointers into
`data`, resolved against the **clone** just read. No `move`/`copy`/`test`.

Not called: `PUT`, `DELETE`, `lock`, `versions`, `exports`.
