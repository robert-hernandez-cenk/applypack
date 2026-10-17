# Research: Write Tailored Edits Back to Reactive Resume

## R1 — The write API (verified)

- **Decision**: duplicate the source with `POST /api/openapi/resumes/{id}/duplicate` `{ name }` (returns the new id
  as a JSON string), read the clone with `GET /resumes/{id}`, change it with `PATCH /resumes/{id}`
  `{ expectedUpdatedAt, operations: [...] }` (RFC 6902).
- **Evidence**: the published spec (`https://docs.rxresu.me/spec.json`, version 6.0.3) and a read-only call to the
  person's instance on 2026-10-16: `GET /api/openapi/spec.json` reports `6.0.3`; `GET /resumes` and
  `GET /resumes/{id}` answer `{ id, name, slug, tags, isPublic, showDownloadButtons, isLocked, data, createdAt,
  updatedAt, hasPassword, applicationId }`. The write calls themselves are verified live in the verification stage
  (quickstart step 3), not assumed.
- **Why duplicate + patch, not create + put**: duplicate carries layout, design, template, metadata and hidden items
  without ApplyPack ever having to understand them. `PUT` with a full `data` would need the raw JSON stored.
- **Alternatives**: `POST /resumes` + `PUT data` (needs full JSON in hand, risks dropping unknown fields);
  `PUT` on the original (forbidden by the issue).
- **Failure codes** (spec): 400 `INVALID_PATCH_OPERATIONS`, 403 `RESUME_LOCKED`, 409 `RESUME_VERSION_CONFLICT`,
  400 `RESUME_SLUG_ALREADY_EXISTS` (not hit: slug omitted, server makes it unique).
- **Retry**: the spec says never to retry POST/PUT/PATCH/DELETE after a timeout; the client does no retry at all.

## R2 — What is stored on the resume

- **Decision**: `Resume.remoteId` (the instance's resume id) and `Resume.remoteGeneration` (`v4|v5|v6`), both
  nullable. The raw JSON is **not** stored.
- **Why**: the person's instance is the source of truth for layout; a stored copy would go stale and would be a
  second copy of personal data. Re-reading at send time and comparing the derived text to `Resume.text` detects
  staleness exactly (FR-003) with no extra column.
- **Alternatives**: store JSON (issue's first option; rejected: staleness, size, privacy); store a per-item id map
  (issue's second option; equivalent to re-deriving, but can drift).
- **Origin host**: not stored — the person's saved connection names the instance. If the connection points elsewhere
  than the resume came from, the id simply will not resolve (404 → "not found there" message). Documented in the ADR.

## R3 — Line → field provenance

- **Decision**: `readReactiveResumeMapped(json)` returns the same markdown and, per output line, an optional source
  `{ pointer, id, field, kind }`, where `pointer` is the JSON Pointer to the field (e.g.
  `/sections/experience/items/3/description`, `/basics/headline`, `/summary/content`, `…/keywords`) and `kind` is
  `html` (rich text), `text` (plain string) or `keywords` (string array). `readReactiveResume` is that function's
  `markdown` part, so the text cannot drift between the two (a test asserts byte equality over every fixture).
- **Why a pointer plus item id**: array indexes shift if someone reorders in RR between reading and patching; the
  send reads the source and the clone in the same moment, patches the clone by index, and `expectedUpdatedAt` makes
  a concurrent edit a 409 rather than a wrong write. The item `id` is kept for the report ("Experience · Dell").
- **Alternatives**: patch by `test` + `replace` pairs (extra ops for little gain once `expectedUpdatedAt` is used).

## R4 — Applying an edit to a rich-text field

- **Decision**: a field's HTML is split into its top-level blocks (`<p>…</p>`, each `<li>` of a top-level `<ul>/<ol>`).
  Each block's text goes through the same `plain()` the reader uses; the concatenation must equal the field's lines in
  the master text (an **alignment self-check**). If it does, the master→copy line diff for that field is applied
  block by block: an unchanged block keeps its HTML verbatim (inline `<strong>` etc. survive); a changed block gets
  its inner text replaced by the escaped new text; an added bullet line becomes a new `<li>` after the preceding
  block; a removed line removes its block. If the check fails, every edit in that field is reported "not applied: the
  field could not be matched" and nothing in it is written.
- **Plain fields** (headline, a `text` field) are replaced whole; **keywords** lines (`Name: a, b, c`) replace the
  array by splitting on commas; a skills line whose label changed is reported not applied (the label is another field).
- **Never mapped, always reported**: a new section/heading, a line added at the very top or before any sourced line, a
  changed contact line (assembled from several fields), a changed date or title line (assembled), changes inside a
  field that failed alignment.
- **Why**: loses inline formatting only in blocks the person actually reworded, never elsewhere; and never guesses.
- **Alternatives**: regenerate whole field HTML from text (loses all formatting); an LLM mapping (non-deterministic —
  rejected, a rule a user can lose data to belongs in code).

## R5 — Zero-edit identity (spec FR-005, SC-002)

`planWriteBack` with `copyText === masterText` yields an empty operation list; applying it to the JSON gives deep
equality with the input. A second property test applies a no-op rewrite (each changed field set to its own current
value) and asserts equality, guarding the apply path itself.

## R6 — Generation gate

Generation is detected by the reader (`v6` when items carry `dates`). Only `v6` is written (the only verified
generation); `v4`/`v5` decline with a message, and reading/importing are untouched. The instance's own version is
not asked — the endpoint answers (404/405 → `notApi`) if it lacks the routes.

## R7 — Order and partial failure

Sequence: GET source → verify text equality → plan (pure) → POST duplicate → GET clone (indexes, `updatedAt`,
`isLocked`) → PATCH → report. A failure before duplicate creates nothing. A failure after duplicate leaves a clone
on the instance: the report names its id/address and says so (we do not delete — no trash call in v1, per spec
non-goals). The clone's own content is used for pointer resolution, so a changed order between source and clone cannot
mis-address.

## R8 — Naming and links

New name: `<Resume> - <Company> - <Role>`, truncated to a safe length (the instance's limit is unknown; 200 chars).
The "open in Reactive Resume" link is `<base>/builder/<id>` (the app's route for an editor); verified live in step 3,
else the link falls back to the base address.

## R9 — Where the button goes

Beside the download in both places a copy is shown: the target page's saved-copy line (`pages/target.tsx`) and the
resume page's tailored card (`pages/resume-detail.tsx`). One route serves both: `POST /tailored/:id/reactive-send`.

## R10 — Live fixture

A real v6 response, redacted to the same shape (names, contacts, companies, bullets replaced by placeholder text of
similar length and the same HTML forms, ids kept as `e1…`). Committed under `src/resume/fixtures/`; the real file
stays in the scratchpad only (per the standing live-data rule).
