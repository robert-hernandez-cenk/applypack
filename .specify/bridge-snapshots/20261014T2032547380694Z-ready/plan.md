# Implementation Plan: Import a resume from Reactive Resume

**Branch**: `issue-39-reactive-resume-import` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/039-reactive-resume-import/spec.md`

## Summary

A Reactive Resume export (v4, v5 or v6 JSON) becomes an ordinary ApplyPack resume, from an uploaded file or pulled live from an instance with an API key. One pure module turns the JSON into Markdown; the Markdown is the stored text and the stored file, so scan, structure and comparison are untouched. The live pull is two POSTs on `/resumes` (list, import) over one I/O module and a short-lived in-memory key stash. Members are kept off the server's own network by the existing private-address guard in `jobs/posting-url.ts`.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: none new. `zod` for the file and the API answers, `src/http.ts:stripHtml` for HTML fields, `jobs/posting-url.ts` (`isPrivateIp`, `isPrivateHost`, `lookupAddresses`) for the address policy, native `fetch` with `AbortController`.

**Storage**: the existing `Resume` row (`original` = the Markdown bytes, `mimeType` = `text/markdown`, `sourceFilename` = `<name>.md`). No schema change, no migration. The key lives in an in-memory `Map` only.

**Testing**: `npm test` (node:test). Pure modules get unit tests with hand-written fixtures; the I/O module is tested against a local `node:http` stand-in server; the route smoke gets two steps.

**Target Platform**: the dashboard (`src/web/`), local install and Docker. The worker never imports any of this.

**Project Type**: web-service (Hono dashboard) plus pure library modules.

**Performance Goals**: conversion is string work on a file under 5 MB; the live pull is two requests bounded by a timeout.

**Constraints**: request timeout 10 s (the project default), response cap 5 MB (the upload ceiling), no redirects, key never persisted/logged/rendered, no new dependency.

**Scale/Scope**: one resume per import; the stash holds a handful of entries for ten minutes.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template; the binding rules are the repo's `CLAUDE.md`. Gate against those:

| Rule | Status |
| --- | --- |
| Pure functions, side effects in a dedicated module | Pass: `reactive-resume.ts` and `reactive-resume-url.ts` pure; `reactive-resume-api.ts` is the only file that fetches |
| zod for ALL external data | Pass: file and both API answers parsed through zod, tolerant (unknown keys ignored) |
| Native fetch + AbortController, no axios | Pass |
| No default exports, no magic numbers, pino not console | Pass (limits are named constants; no key in any log line) |
| Worker must not import it | Pass: web-only |
| Every new route in exactly one policy list | Pass: both POSTs go in `PERSONAL_ROUTES` (the member-vs-admin split is the address policy, not the route) |
| i18n: key in every catalog in the same PR | Pass: planned, held by `catalog.test.ts` |
| `exports:audit`: no dead / over-exported export | Watch: export only what another file imports |
| ADR for architecture / sources-policy changes | Pass: ADR 0073 (a user-directed outbound request, and the file format) |
| ADR 0005 (no scraping job boards) | N/A: the person's own resume, via the owner's API key |

Re-check after design: no violation introduced.

## Project Structure

### Documentation (this feature)

```text
specs/039-reactive-resume-import/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   └── reactive-resume-shapes.md
└── tasks.md            # speckit-tasks
```

### Source Code (repository root)

```text
src/resume/reactive-resume.ts          # pure: detect v4/v5/v6, → { name, markdown } | refusal code
src/resume/reactive-resume.test.ts
src/resume/reactive-resume-url.ts      # pure: parseInstanceUrl, apiUrl(base, path), policy decision
src/resume/reactive-resume-url.test.ts
src/resume/reactive-resume-api.ts      # the ONLY file that calls an instance: list + get, bounded
src/resume/reactive-resume-api.test.ts # against a local http stand-in
src/resume/fixtures/reactive-resume/   # v4.json v5.json v6.json hidden-and-html.json not-rr.json (hand-written, unverified vs live)
src/web/pull-stash.ts                  # in-memory key stash, TTL, per user
src/web/pull-stash.test.ts
src/web/upload.ts                      # readResumeUpload: .json branch → Markdown file
src/web/routes/resumes.tsx             # POST /resumes/reactive/list, POST /resumes/reactive/import
src/web/pages/resumes.tsx              # "Import from Reactive Resume" card + picker page
src/users/admin-policy.ts              # the two routes in PERSONAL_ROUTES
src/i18n/catalog/{en,es,fr,uk}.json    # new keys
docs/adr/0073-*.md  docs/where-to-look.md  CLAUDE.md (one bullet)  CHANGELOG.md
```

**Structure Decision**: single project, matching the repo's pure-module / one-I/O-module split. `.json` is handled inside `readResumeUpload`, not in `ACCEPTED_EXTENSIONS`, because that constant also gates screening intake and the applicant folders, where a JSON file must stay unaccepted.

## Complexity Tracking

None: no new dependency, table, route family or process.
