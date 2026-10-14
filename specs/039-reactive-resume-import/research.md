# Research: Reactive Resume import

Sources: docs.rxresu.me (JSON schema guide, API reference, "Accessing the previous version", fetched 2026-10-14). **No live instance was available; nothing below has been checked against a real export.**

## R1 — Which generations exist and how do they differ

- **Decision**: read v4, v5 and v6; detect from the file's own shape.
- **Facts**: hosted rxresu.me runs v6; v6 itself imports v5 and recognises v4 files; there is no version field in any export.
- **v6** (documented): top-level `picture, basics, summary, sections, customSections, metadata`. `summary.content` is HTML. Sections hold `items` with `hidden`; section settings have `hidden`. Dates in `dates {start,end,present,raw?}` plus rendered `period`/`date` strings. Experience may carry `roles[]`. Skills have `name, proficiency, level, keywords[]`.
- **v5**: same family without the `dates` object and the `roles` array (period/date strings only). `basics.url` instead of `website` in places. Only reachable through a file or a self-hosted copy.
- **v4**: `basics {name, headline, email, phone, location, url{label,href}, picture}`, `sections` keyed by name each `{name, visible, id, items[]}`; items carry `visible`, `date` (a string), `summary` (HTML), `company/position/location/url`; skills `{name, description, level, keywords[]}`; `summary` is `sections.summary.content`.
- **Detection rule** (to be confirmed by fixtures): v6 if `summary` is an object at top level or any item has a `dates` object; v4 if `sections.summary` exists or items use `visible`; else v5. Anything lacking `basics` and `sections` is "not a Reactive Resume file".
- **Alternatives**: ask the person for the version (rejected: spec FR-002); support only v6 (rejected by the user, who chose both).

## R2 — Live API surface

- **Decision**: `GET {base}/api/openapi/resumes` (list, data omitted) and `GET {base}/api/openapi/resumes/{id}` (full, response has `id, name, slug, tags, isPublic, isLocked, data`), header `x-api-key`.
- **Facts**: the documented server base is `http://localhost:3000/api/openapi` and the hosted one `https://rxresu.me/api/openapi`; `x-api-key` is the documented key header. The list endpoint's exact path/response field names were not in the fetched excerpt.
- **Mitigation**: parse the list leniently (an array, or an object with an array under `items`/`resumes`/`data`; each row needs `id` and a name); an unrecognised answer is the "not Reactive Resume" message, not a crash. Flagged unverified in the PR.
- **Alternative**: the public resume endpoint by username/slug (rejected: only works for shared resumes; spec scopes to the person's own).

## R3 — HTML to text

- **Decision**: reuse `src/http.ts:stripHtml` once on each HTML field, then map its `• ` bullets to Markdown `- `.
- **Why**: it already decodes entities first, keeps paragraph and list structure (gotcha 12) and is tested. Never run twice on the same string.

## R4 — Markdown layout

- **Decision**: `# Name`, a contact line (email · phone · location · website), headline, then `## Summary`, `## Experience`, `## Education`, `## Skills`, … in the order of the file's own layout when it states one (v6 `metadata.layout`), else the fixed order above; each item `### Position — Company (place) · dates` + body. Skills as `Name: kw, kw`. This reads like the resumes ApplyPack already takes as `.md`, so the structure reader and the keyword matcher see headings, bullet lines and a skills line.
- **Alternative**: JSON Resume out (rejected: ApplyPack stores text as the source of truth; ADR 0039).

## R5 — Outbound safety

- **Decision**: `parseInstanceUrl` (pure): http/https only, no userinfo, host non-empty, trailing slash trimmed, query/fragment dropped, path prefix kept (self-hosted behind `/resume`). Policy: `isPrivateHost(url.hostname)` is the pure first gate; after it, `lookupAddresses` and `isPrivateIp` on every address. Members get both gates; administrators and `localInstall()` skip them. Requests use `redirect: 'manual'` (a 3xx is the "redirect" message), `AbortController` 10 s, body read through a byte cap of 5 MB.
- **Reuse**: `jobs/posting-url.ts` already exports the address predicates and resolver; `checkPostingUrl` is not reused (it carries ADR 0005 host rules that do not apply).
- **Residual risk** (same as the posting fetcher): DNS rebinding between lookup and connect is not pinned; accepted and written in the ADR.
- **Alternatives**: block private addresses for everyone (rejected: self-hosted instances live there); admin-only feature (rejected: members have resumes too).

## R6 — Key handling

- **Decision**: the list POST sends URL + key to the server; on success the server keeps `{userId, baseUrl, key, createdAt}` in `pull-stash.ts` (TTL 10 min, max 8 entries, evicting oldest) and the picker page carries only the stash id and the resume ids/names. The import POST reads the stash, fetches that resume, drops the entry. The key is never in HTML, a URL, a flash message, a log field or an error string; request-failure messages are built from the status/failure kind, never the headers.
- **Alternative**: re-ask the key on import (rejected: the list-then-pick flow would need the key in a hidden field in the page).

## R7 — Stored file

- **Decision**: `original` = the Markdown bytes, `sourceFilename` = `<resume name>.md`, `mimeType` = `text/markdown`. The Download button then returns a faithful copy of the text. Nothing of the raw JSON is kept (it carries design settings and, for v6, no extra content worth the bytes).
