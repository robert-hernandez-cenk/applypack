---

description: "Task list for writing tailored edits back to Reactive Resume (#50)"
---

# Tasks: Write Tailored Edits Back to Reactive Resume

**Input**: `specs/050-reactive-resume-writeback/` — plan.md, spec.md, research.md, data-model.md, contracts/instance-api.md, contracts/web-route.md, quickstart.md

**Tests**: TDD on the pure modules (`reactive-resume.ts` provenance, `reactive-resume-apply.ts`), the client with an injected `fetch`, and the orchestration with fake I/O. Prisma and route code is verified by `lint:types`, the route smoke and `prisma migrate diff` (CLAUDE.md). The live roundtrip is a verification task and needs the user's go-ahead.

**Format**: `- [ ] T### [P?] [US?] description with path`. Paths are relative to the worktree root. Story order: US2 (origin) precedes US1 (send) because the send reads the origin; both are P1.

## Phase 1: Setup

- [ ] T001 Hand-write `prisma/migrations/20261017000000_resume_remote_origin/migration.sql`: `ALTER TABLE "resume" ADD COLUMN "remoteId" TEXT, ADD COLUMN "remoteGeneration" TEXT;` (both nullable, no default, no index)
- [ ] T002 Add `remoteId String?` and `remoteGeneration String?` to `model Resume` in `prisma/schema.prisma` (comment: the Reactive Resume resume this text was imported from, ADR 0079; both set or both null); run `npx prisma generate`; confirm `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` is empty against a shadow database
- [ ] T003 [P] Create the redacted fixture `src/resume/fixtures/reactive-resume-v6.json` from the live response held in the scratchpad (`live-first.json`): same keys, item ids (`e1`…), HTML forms (`<p>`, `<ul><li><p>`, `<strong>`), `dates`, `customFields`, `metadata`; every name, contact, company, bullet and link replaced by placeholder text of similar length; no real address, phone or e-mail. Never commit the real file

## Phase 2: Foundational (blocks all stories)

- [ ] T004 [P] Write failing tests in `src/resume/reactive-resume.test.ts`: `readReactiveResumeMapped(json)` returns `markdown` byte-identical to `readReactiveResume(json).markdown` for the v4, v5, v6 fixtures and the new redacted fixture; `lines.length === markdown.split('\n').length`; the summary lines carry pointer `/summary/content` kind `html`; an experience description line carries `/sections/experience/items/<i>/description` with the item `id`; a skills line carries `…/keywords` kind `keywords`; the headline line carries `/basics/headline` kind `text`; contact, company and `Position · Dates` lines carry `null`
- [ ] T005 Implement `readReactiveResumeMapped` in `src/resume/reactive-resume.ts`: give each block line an optional source (`{ pointer, id, field, kind, label }`, data-model.md `LineSource`) alongside its text, keep `readReactiveResume` as a thin wrapper over it so the markdown cannot drift; no change to any existing output; until T004 passes
- [ ] T006 [P] Write failing tests in `src/resume/reactive-resume-api.test.ts` with an injected `fetch`: `duplicateInstanceResume(base, key, id, name)` POSTs `{ name }` to `/api/openapi/resumes/<id>/duplicate` and returns the id string; `patchInstanceResume(base, key, id, { expectedUpdatedAt, operations })` PATCHes; `getInstanceResume` also returns `updatedAt` and `locked`; status mapping per contracts/instance-api.md (403 + `RESUME_LOCKED` → `locked`, 409 → `conflict`, 400 + `INVALID_PATCH_OPERATIONS` → `badPatch`, 401/403 → `unauthorized`, 3xx → `redirect`, over the cap → `tooLarge`, abort → `timeout`); no mutation is retried (one fetch call on timeout); the key appears in no error message and only in the `x-api-key` header; `redirect: 'manual'` on mutations
- [ ] T007 Implement in `src/resume/reactive-resume-api.ts`: new `InstanceFailure` codes `locked`, `conflict`, `badPatch`; `request(method, url, key, body?, limits)` shared by the GET and the mutations; zod parse of the duplicate reply (`z.string().min(1)`) and the patched/read resume; `duplicateInstanceResume`, `patchInstanceResume`; `getInstanceResume` returns `{ name, data, updatedAt, locked }`; until T006 passes. Update the callers of `getInstanceResume` and the `SAVED_INSTANCE_FAILURE` map in `src/web/reactive-failures.ts` for the new codes (exhaustive)
- [ ] T008 Add the origin to the store in `src/resume/store.ts`: `ResumeSummary` exposes `remoteId` and `remoteGeneration`; `createResume` and `replaceResumeFile` take an optional `origin: { remoteId, generation } | null` and write both columns together (a file upload passes `null`, which clears them); `src/resume/store.ts` remains the only file touching `resume`
- [ ] T009 [P] Add the words for every new message to `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json` in one pass (keys listed in T028) and run the catalog test to confirm parity

**Checkpoint**: `npm run lint:types` and `npm test` green.

## Phase 3: User Story 2 — A resume remembers where it came from (P1)

**Independent test**: import one resume from Reactive Resume and one from a file; the first shows "From Reactive Resume (v6)" and stores `remoteId` + `remoteGeneration`, the second shows nothing and stores `NULL`s; a new version from a file clears them; a new version pulled from RR sets them.

- [ ] T010 [US2] In `src/web/routes/resumes.tsx` `POST /resumes/reactive/import`: pass `{ remoteId: id, generation: read.generation }` from the `reactiveResumeText` result (extend `src/resume/resume-text.ts:reactiveResumeText` to return the generation) through `saveNewVersion` / `saveUploaded` into `replaceResumeFile` / `createResume`; `POST /resumes/:id/replace` and plain uploads pass `null`
- [ ] T011 [US2] Show the origin on the resume page in `src/web/pages/resume-detail.tsx` under the name: a `data-ui="hint"` line "From Reactive Resume (v6)" only when `remoteId` is set, plus a one-line note when the generation is not v6 that sending back is not available; words via `t()`, generation shown as data
- [ ] T012 [US2] Add the origin to the `route-smoke` first-run fixtures in `src/scripts/route-smoke.ts` (a resume with `remoteId`/`remoteGeneration` set, one without) so the line renders in both states

## Phase 4: User Story 1 — Send a tailored copy back as a new Reactive Resume resume (P1) 🎯 MVP

**Independent test**: from a copy with a changed bullet and a changed summary, one press creates `<Resume> - <Company> - <Role>` in RR with exactly those two changes, the original untouched (live: quickstart step 3; automated: orchestration test with fake I/O and the fixture).

- [ ] T013 [P] [US1] Write failing tests in `src/resume/reactive-resume-apply.test.ts` over the redacted fixture: zero edits (`copyText === masterText`) → `operations: []` and the applied JSON deep-equals the input; changing one bullet's words → one `replace` on that field whose HTML keeps every untouched block verbatim (including `<strong>`) and the changed block carries the escaped new text; adding a bullet after an existing one → a new `<li>` after it; removing a bullet → its `<li>` removed; changing the summary → `replace` of `/summary/content`; changing the headline → `replace` of `/basics/headline`; changing a skills line → `replace` of the `keywords` array split on commas; HTML-significant characters in new text (`<`, `&`, `"`) are escaped
- [ ] T014 [US1] Implement `src/resume/reactive-resume-apply.ts` (pure, no I/O): `planWriteBack({ json, mapped, masterText, copyText })` → `{ operations, edits }` (data-model.md `WriteBackPlan`); split a field's HTML into top-level blocks, run the reader's `plain()` over each, require the concatenated lines to equal the field's lines (alignment self-check), diff master→copy lines with `loadLineDiff().diffLines` (`src/resume/line-diff.ts`), emit `replace`/`add`/`remove` ops with pointers resolved against the JSON given; `applyOperations(json, operations)` (pure, for tests and for resolving against the clone) supporting exactly those three ops; until T013 passes
- [ ] T015 [P] [US1] Write failing tests in `src/resume/reactive-resume-writeback.test.ts` with fake I/O: success path calls, in order, get source → duplicate with the name `<Resume> - <Company> - <Role>` (truncated to 200 characters) → get clone → patch with `expectedUpdatedAt` = the clone's, and returns `{ ok: true, remoteId, applied, notApplied }`; the stale check (source text differs from the stored text) returns `stale` with no duplicate call; `generation` other than `v6` returns `generation` with no call at all; a duplicate that succeeds and a patch that fails returns the failure code **with** `createdRemoteId`; a locked or unreachable source creates nothing; no I/O function is called twice on a timeout
- [ ] T016 [US1] Implement `src/resume/reactive-resume-writeback.ts`: `reactiveWriteBack(io, input)` where `io = { getSource, duplicate, getClone, patch }` and `input = { remoteId, generation, storedText, copyText, name }`; maps `InstanceError` codes to the `SendResult` failure codes of data-model.md; resolves pointers against the clone (not the source) before patching; no retry; until T015 passes
- [ ] T017 [US1] Add `POST /tailored/:id/reactive-send` to `src/web/routes/resumes.tsx` per contracts/web-route.md: resolve the copy through `currentUser()`; refuse a resume without origin; read `readInstanceKey(user.id)`; `reachable(...)`; run `reactiveWriteBack` with the real client functions as `io`; `onceGuard` keyed per user and copy; redirect to the allowed `back` destination with the flash (success with a `tRich` link to `<base>/builder/<id>`; failure words from `reactive-failures.ts`); log counts and ids only, never the key or the text. List the route once in `PERSONAL_ROUTES` in `src/users/admin-policy.ts`
- [ ] T018 [US1] Add the "Send to Reactive Resume" button beside the download in `src/web/pages/resume-detail.tsx` (`TailoredCard` row actions) and in `src/web/pages/target.tsx` next to the saved copy's download link: a `<form method="post">` button shown only when the master has a `remoteId` of generation `v6` and the person has a saved connection (else omitted, with the card hint saying why once); accessible name includes the posting (`reactive.send.aria`); company and role in any text are data (`translate="no"`)
- [ ] T019 [US1] Confirm the closed list in `src/resume/reactive-connection-access.test.ts`: `web/routes/resumes.tsx` is already allowed and no other file names `readInstanceKey`; run the test; add a line to the list only if a new file is unavoidable

## Phase 5: User Story 3 — Honest reporting of what could not be sent (P2)

**Independent test**: a copy that changes one mappable bullet and adds one line belonging to no field → the clone has the bullet and the page lists the added line as not applied with its reason; a stale source, a locked source and an unreachable instance each produce their own words and create nothing; the local copy is unchanged after every failure.

- [ ] T020 [P] [US3] Add failing cases to `src/resume/reactive-resume-apply.test.ts`: a line added before any sourced line → `notApplied` `noField`; a changed contact line → `assembled`; a changed `Position · Dates` or company line → `assembled`; a new `## Heading` section → `newSection`; a changed skills label → `labelChanged`; a field whose blocks do not line up with its lines (hand-built HTML with a nested list) → every edit in it `misaligned` and no operation emitted for that field; every changed line in the diff appears in `edits` exactly once (applied or not applied), none dropped
- [ ] T021 [US3] Implement the reasons in `planWriteBack` until T020 passes; each `EditReport` carries `status`, `kind`, `label` (English noun for the field, e.g. "Experience · <company>"), the line text and `reason`
- [ ] T022 [US3] Word the report in `src/web/pages/` (a small `reactive-send-report` view used by the flash redirect target, or a flash list through `tRich`): count applied, list each not-applied edit with `placeName`-style worded label and a reason function of the code in the reader's language; stored/compared values stay English; unit-test the reason function covers every code (`src/web/reactive-failures.test.ts`)
- [ ] T023 [US3] Failure words for `noOrigin`, `noConnection`, `stale`, `generation`, `notFound`, `locked`, `conflict`, `badPatch`, `unauthorized`, `unreachable`, `timeout`, `tooLarge`, `notApi`, `redirect`, `privateAddress` in `src/web/reactive-failures.ts` (exhaustive map, so a new code does not compile without words); the `createdRemoteId` variant names the clone and says it was left in place
- [ ] T024 [US3] Route-smoke steps in `src/scripts/route-smoke.ts`: `POST /tailored/:id/reactive-send` on a copy whose resume has no origin → refused with a flash and the copy unchanged; on a copy of a resume with an origin but no saved connection → "no connection" flash; a cross-origin POST is refused; the pseudo-language pass finds no English outside the catalog on the changed pages

## Phase 6: Polish and cross-cutting

- [ ] T025 [P] Write `docs/adr/0079-reactive-resume-write-back.md` (Status Accepted, issue #50; context; decision: origin = id + generation, no raw JSON, re-read and compare, duplicate-and-patch, block-level HTML edits, v6 only, never the original, no retry, no delete; consequences: inline formatting lost in a block the person reworded, a send leaves a clone on partial failure; links to 0073, 0075, 0077); add it to `docs/adr/README.md`
- [ ] T026 [P] Docs: a row in `docs/where-to-look.md` for the write-back; module lines in `ARCHITECTURE.md` and `SPEC.md`; the `reactive-resume*` paragraph in `CLAUDE.md` gains `reactive-resume-apply.ts` (pure), `reactive-resume-writeback.ts` (I/O injected), the client's new calls and the unchanged "only file that calls the instance" rule
- [ ] T027 [P] `CHANGELOG.md` entry `## [2.59.13] — 2026-10-17` (Added: send a tailored copy to Reactive Resume as a new resume, #50, ADR 0079); bump `package.json` and `package-lock.json` to `2.59.13` (patch only)
- [ ] T028 Final catalog sweep: keys `reactive.send.button`, `reactive.send.aria`, `reactive.send.ok`, `reactive.send.partial`, `reactive.send.notApplied.<reason>` (×5), `reactive.send.fail.<code>` (×15), `resume.reactive.origin`, `resume.reactive.originNoSend`, `resume.tailored.reactiveHint` present in `en`, `es`, `fr`, `uk`; `npm test` (catalog test) green
- [ ] T029 `npm run lint:types`, `npm test`, `npm run exports:audit` all green; fix any dead or over-exported symbol; re-read the full diff (`git diff main...HEAD`) for lines that do not earn their place

## Phase 7: Verification

- [ ] T030 **Verification** — route smoke on a throwaway database: `npm run build && npm run smoke:routes` (CLAUDE.md warns it inserts rows; never the live database); paste the tail of the output
- [ ] T031 **Verification** — live roundtrip, **only with the user's go-ahead** (it writes to their instance), following quickstart.md step 3: record the original's `updatedAt` and a hash of its `data` (scratchpad only); import/tailor/send; confirm the new resume exists with the same template, colours and section order and exactly the changed texts; re-fetch the original and confirm `updatedAt` and `data` hash are unchanged; confirm the stale refusal creates nothing; move every test resume to Trash; put the redacted result (counts, truncated ids, no key, no personal text) in the PR; record whether the builder link `<base>/builder/<id>` opened the clone, else change it to the base address (research R8)
- [ ] T032 If the live response differs from the redacted fixture's shape, update the fixture and the reader/apply tests in the same commit (the live data outranks the fixture)

## Dependencies and order

- Phase 1 → Phase 2 → Phase 3 (US2) → Phase 4 (US1) → Phase 5 (US3) → Phase 6 → Phase 7.
- T004/T006/T009/T003 are independent files and can run in parallel; T005 needs T004, T007 needs T006, T014 needs T013 and T005, T016 needs T014 and T007, T017 needs T016 and T008/T010, T021 extends T014.
- US2 is needed by US1 (the button's condition and the route's refusal read the origin); US3 extends US1's pure module and words.

## Implementation strategy

MVP = Phases 1–4: origin recorded, the send creating the clone with mappable edits. US3 then hardens the reporting (some of its refusals — stale, no origin — are already in T016/T017). Commit per phase/story with `(#50, US#)` and the `tasks.md` boxes in the same commit; verification tasks stay unchecked until their evidence is pasted.
