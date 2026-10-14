# Tasks: Import a resume from Reactive Resume

**Input**: Design documents from `/specs/039-reactive-resume-import/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Requested by repo convention (pure modules unit-tested, test first). Run `npm run lint:types && npm test` before each commit.

**Organization**: by user story. Execution order is US1 → US3 → US2, because US2 (live pull) calls the address policy that US3 delivers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- All paths are relative to the worktree root.

## Phase 1: Setup

- [x] T001 Write the five hand-made fixtures in `src/resume/fixtures/reactive-resume/`: `v6.json` (experience with `roles`, `dates` objects incl. present/raw, skills with keywords, a hidden section, a hidden item, HTML `summary.content`/`description` with `<p>`, `<ul><li>`, `<a>`, `&amp;`), `v5.json` (period/date strings, no `dates`), `v4.json` (`sections.summary`, `visible` flags, `date` strings, `url.href`), `hidden-and-html.json` (edge cases), `not-rr.json` (a JSON Resume–style file with no `basics`+`sections` pair). Each file gets a leading `"_note"`-free body; put the "hand-written from the published schema, unverified against a live instance" note in `src/resume/fixtures/reactive-resume/README.md`.

## Phase 2: Foundational

- [x] T002 Add ADR `docs/adr/0073-reactive-resume-import-reads-a-file-or-asks-the-owners-instance.md` (decision: Markdown as stored form, `.json` handled in `readResumeUpload` not `ACCEPTED_EXTENSIONS`, user-directed outbound request with `x-api-key`, key held in memory only, member/admin address policy reusing `posting-url.ts`, DNS-rebinding residual, unverified shapes) and list it in `docs/adr/README.md`.

**Checkpoint**: fixtures and ADR exist; stories can start.

## Phase 3: User Story 1 — Upload a Reactive Resume export (P1) 🎯 MVP

**Goal**: a v4/v5/v6 JSON file uploaded on `/resumes` becomes a normal, scanned resume.

**Independent Test**: upload each fixture; a resume appears whose text has the sections in order, hidden items absent; `not-rr.json` is refused in plain words; an identical second upload gives the duplicate notice.

- [x] T003 [US1] Write failing tests `src/resume/reactive-resume.test.ts`: generation detection per fixture (`v6`/`v5`/`v4`); markdown contains name, headline, contact line, `## Summary`, `## Experience` with `### Position — Company (place) · dates`, roles under one employer, `## Skills` as `Name: kw, kw`; dates (`2022-03`→"Mar 2022", `present`→"Present", year only, `raw` fallback, none → no dates); hidden section/item and `visible:false` absent; HTML → paragraphs + `- ` bullets with no tags/entities; `not-rr.json` → `{ ok:false, code:'notReactiveResume' }`; `{}`/empty content → `'empty'`; zero throws on junk (`null`, `[]`, a string).
- [x] T004 [US1] Implement `src/resume/reactive-resume.ts` (pure, no I/O): zod-tolerant schemas for the three shapes (unknown keys ignored, missing = empty), `detectGeneration`, `readReactiveResume(json: unknown): ReactiveResumeRead | { ok:false; code }` per `data-model.md` and `contracts/reactive-resume-shapes.md`; HTML fields through `stripHtml` from `src/http.ts` exactly once, then leading `• ` → `- `; section order from v6 `metadata.layout` when present, else the fixed order in research R4; named constants for month names/labels, no magic numbers. Export only what other files import. Make T003 pass.
- [x] T005 [US1] Write failing tests in `src/resume/resume-text.test.ts` (upload.ts imports config and the logger, so the pure seams `reactiveResumeFromBytes` / `markdownResume` live in resume-text.ts and are tested there): `.json` Reactive Resume upload → `{ sourceFilename: '<name>.md', mimeType: 'text/markdown', original: <markdown bytes>, text }`; non-export JSON → `{ error }` naming the cause; invalid JSON → `{ error }`; text under 200 chars → the existing `tooShort` notice; `.pdf` path unchanged.
- [x] T006 [US1] Edit `src/web/upload.ts:readResumeUpload`: for `.json`, parse (bounded by the existing 5 MB body limit), call `readReactiveResume`, map refusals to catalog errors, apply the same minimum-length rule as `extractResumeText` (reuse its constant by export, not by copy), build the Markdown file. Do NOT add `.json` to `ACCEPTED_EXTENSIONS` (it gates screening intake). Make T005 pass.
- [x] T007 [US1] Add `'.json'` to the file input `accept` and the hint on the upload card in `src/web/pages/resumes.tsx` (about line 347–352) only, with a one-line hint "or a Reactive Resume export"; add the i18n keys used by T006/T007 (`resumes.reactive.notExport`, `resumes.reactive.empty`, `resumes.reactive.fileHint`, `upload.badJson` or reuse an existing key if one fits) to `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json` (hand-translated; `catalog.test.ts` must pass).
- [x] T008 [US1] Run `npm run lint:types && npm test && npm run exports:audit`; commit `Import a Reactive Resume export file (#39, US1)` with the ticked tasks.

**Checkpoint**: US1 works alone and is shippable.

## Phase 4: User Story 3 — Members cannot aim the server at its own network (P2)

**Goal**: the pure address rules and the member/admin policy, ready for US2.

**Independent Test**: unit tests only (no network): refusal table below.

- [ ] T009 [P] [US3] Write failing tests `src/resume/reactive-resume-url.test.ts`: `parseInstanceUrl` accepts `https://rxresu.me`, `http://localhost:3000/`, `https://host/resume/` (prefix kept, trailing slash trimmed, query/fragment dropped); refuses `ftp:`, `javascript:`, `https://u:p@host`, empty, `not a url`; `apiUrl(base, '/resumes')` joins under `/api/openapi` and keeps a prefix; `memberMayReach(url)` is false for `localhost`, `127.0.0.1`, `[::1]`, `10.0.0.5`, `192.168.1.2`, `169.254.169.254`, `[::ffff:169.254.169.254]`, a bare word `intranet`, `x.internal`; true for `rxresu.me`.
- [ ] T010 [US3] Implement `src/resume/reactive-resume-url.ts` (pure): `parseInstanceUrl(raw)` → `{ ok:true; base:URL } | { ok:false; code:'empty'|'invalid'|'scheme'|'credentials' }`, `apiUrl(base, path)`, `memberMayReach(base)` using `isPrivateHost` from `src/jobs/posting-url.ts`. Make T009 pass.
- [ ] T011 [US3] Add to the same test file a case using an injected `Resolver` for `reachable(base, { privileged }, resolve)` in `reactive-resume-url.ts`: privileged → ok with no lookup; member + name resolving to `10.0.0.9` → refused; member + name resolving to a public address → ok; lookup failure → `noHost`. Implement `reachable` (async; uses `isPrivateIp`, `lookupAddresses` default). Make it pass.

**Checkpoint**: policy decided and tested.

## Phase 5: User Story 2 — Pull a resume with an API key (P2)

**Goal**: `/resumes` card: URL + key → picker → imported resume; key never kept.

**Independent Test**: against the local stand-in server in `reactive-resume-api.test.ts`, list and get work; wrong key, non-RR answer, redirect, timeout and oversize each give their own failure code; the key is not in any returned message.

- [ ] T012 [P] [US2] Write failing tests `src/web/pull-stash.test.ts`: `stashPull({userId,base,key})` returns an id; `takePull(id, userId)` returns the entry once and deletes it; another user's id → null; entries expire after the TTL (inject clock); the 9th entry evicts the oldest; `JSON.stringify` of anything the module returns for display (`describePull`) contains no key.
- [ ] T013 [US2] Implement `src/web/pull-stash.ts` modelled on `src/web/import-stash.ts` (TTL 10 min, max 8, per-user, in-memory `Map`, named constants). Make T012 pass.
- [ ] T014 [P] [US2] Write failing tests `src/resume/reactive-resume-api.test.ts` with a local `node:http` stand-in (random port): `listInstanceResumes(base, key)` returns `[{id,name}]` from an array and from `{items:[…]}`; sends `x-api-key` and `Accept` only; `getInstanceResume(base,key,id)` returns `data` parsed by `readReactiveResume`; failure codes `unauthorized` (401/403), `notApi` (404 / HTML body / wrong JSON), `redirect` (3xx, not followed), `tooLarge` (body over cap, stream aborted), `timeout` (injected short limit), `unreachable`; no failure message contains the key (assert on every code path).
- [ ] T015 [US2] Implement `src/resume/reactive-resume-api.ts` — the only file that fetches an instance: native `fetch`, `redirect:'manual'`, `AbortController` (10 s constant, overridable by argument for tests), response read through a byte-capped reader (5 MB constant), zod-parsed answers, typed `InstanceError` with a `code` and never headers/URL userinfo in `message`. Make T014 pass.
- [ ] T016 [US2] Add the two routes to `src/web/routes/resumes.tsx` per `contracts/routes.md`: `POST /resumes/reactive/list` (parse URL → `reachable` with `privileged = isAdmin(currentUser()) || localInstall()` → list → `stashPull` → render picker page; every failure a `flashRedirect('/resumes','err',…)` with a distinct catalog message) and `POST /resumes/reactive/import` (`takePull` first, always deleting; fetch, `readReactiveResume`, minimum length, `findResumeWithText` duplicate notice, `createResume(currentUser().id, { name, sourceFilename:'<name>.md', mimeType:'text/markdown', original, text })`, scan queued exactly as `POST /resumes` does, success flash `resume.flash.uploaded`). Use `onceGuard`. No `logger` field may carry the key or the raw URL.
- [ ] T017 [US2] Add both routes to `PERSONAL_ROUTES` in `src/users/admin-policy.ts` (`'POST /resumes/reactive/list'`, `'POST /resumes/reactive/import'`).
- [ ] T018 [US2] Build the UI in `src/web/pages/resumes.tsx`: an "Import from Reactive Resume" card (URL input with placeholder `https://your-instance.example`, password-type key input with `autocomplete="off"`, a Hint that the key is used for this one request and not kept and that v4 instances use the exported file) and a `ReactivePickPage` (radio per resume name, hidden `pull`, submit "Import"). Follow `accessible-interactions` (labels, focus, keyboard) and the `Hint` / `data-ui` rules; data (resume names) takes `translate="no"`.
- [ ] T019 [US2] Add every string from T016/T018 (list/pick labels, each failure message incl. `unauthorized`, `notApi` pointing to the file route, `redirect`, `tooLarge`, `timeout`, `unreachable`, `expired`, member refusal `privateAddress`, `scheme`, `credentials`) to the four catalogs; `catalog.test.ts` green.
- [ ] T020 [US2] Add a route-smoke step in `src/scripts/route-smoke.ts`: `POST /resumes` with the `v6.json` fixture creates a resume; `POST /resumes/reactive/list` with a loopback URL as a member-equivalent context is refused (or, if the smoke runs privileged, assert the picker for a stand-in); confirm the pseudo-language run finds no untranslated English on the new card and picker.
- [ ] T021 [US2] Run `npm run lint:types && npm test && npm run exports:audit`; commit `Pull a resume from a Reactive Resume instance (#39, US2, US3)` with the ticked tasks.

**Checkpoint**: all three stories work.

## Phase 6: Polish & cross-cutting

- [ ] T022 [P] Add rows to `docs/where-to-look.md` ("A Reactive Resume file or instance → a resume") and a `CLAUDE.md` bullet for `reactive-resume*.ts` / `pull-stash.ts` in the File rules list; add a short README/docs mention where resume formats are listed.
- [ ] T023 [P] Add a `CHANGELOG.md` entry for the next PATCH version (highest tag + 0.0.1; patch only, per the fork's rule), and bump `package.json` / `package-lock.json` to match at release time only (not in this PR unless the repo's flow does it before merge).
- [ ] T024 Run the full quickstart (`quickstart.md` §1–§4) on a scratch data folder, record real output for the PR, and list what could not be verified (real Reactive Resume instance/export). Tick the verification tasks and commit `Mark #39 verification tasks complete`.

## Dependencies & execution order

- Phase 1 → Phase 2 → US1 (MVP) → US3 → US2 → Polish.
- T009 ∥ T012 ∥ T014 can be written in parallel (different files); T010/T011 before T016; T013 before T016; T015 before T016.
- US1 has no dependency on US2/US3 and can ship alone.

## Implementation strategy

MVP = US1 (T001–T008): the file route covers hosted and self-hosted, v4–v6. Then the policy (US3) and the live pull (US2) as one increment, since the pull is unsafe to ship without the policy.
