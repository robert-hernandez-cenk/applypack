---

description: "Task list for tailored resume copies (#48)"
---

# Tasks: Tailored resume copies

**Input**: `specs/048-tailored-resume-copies/` — plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: TDD on the pure module (`resume/tailored.ts`); the rest is verified by `lint:types`, the route smoke and `prisma migrate diff` (CLAUDE.md: Prisma modules are not unit-tested).

**Format**: `- [ ] T### [P?] [US?] description with path`. Paths are relative to the worktree root.

## Phase 1: Setup

- [ ] T001 Hand-write `prisma/migrations/20261016120000_tailored_resume/migration.sql`: `CREATE TABLE "tailored_resume"` (id serial PK, `resumeId` int NOT NULL FK `resume` ON DELETE CASCADE, `jobId` int NOT NULL FK `job` ON DELETE CASCADE, `text` text NOT NULL, `sourceFilename` text NOT NULL, `mimeType` text NOT NULL, `original` bytea NOT NULL, `createdAt` timestamp default now, `updatedAt` timestamp), `UNIQUE ("resumeId","jobId")`, index on `jobId`; `ALTER TABLE "resume_match" ADD COLUMN "tailoredId" int` with FK to `tailored_resume` ON DELETE CASCADE and an index
- [ ] T002 Add `model TailoredResume` (`@@map("tailored_resume")`, `@@unique([resumeId, jobId])`, `@@index([jobId])`), `ResumeMatch.tailoredId Int?` with relation `onDelete: Cascade` and `@@index([tailoredId])`, and back-relations on `Resume` and `Job` in `prisma/schema.prisma`; run `npx prisma generate`; confirm `prisma migrate diff` (migrations → schema) is empty

## Phase 2: Foundational (blocks all stories)

- [ ] T003 [P] Write failing tests in `src/resume/tailored.test.ts` for `patchSource({ baseText, copyText })` ('copy' when equal after trim, 'master' when no copy / differs / empty base) and `tailoredFileName(resumeName, jobTitle, ext)` (slug of both, `.ext`, fallback `resume`)
- [ ] T004 Implement `src/resume/tailored.ts` (pure) until T003 passes
- [ ] T005 Add store functions to `src/resume/store.ts`, all `userId` first and scoped `where: { …, resume: { userId } }`: `upsertTailored(userId, resumeId, jobId, file)` (verifies the resume is the caller's; upsert on `(resumeId, jobId)`; returns the row without `original`), `getTailoredForJob(userId, resumeId, jobId)`, `getTailoredOriginal(userId, id)`, `listTailoredForResume(userId, resumeId)` (with job title + company, no bytes), `deleteTailored(userId, id)` → boolean
- [ ] T006 In `src/resume/store.ts` add `tailoredId` to `createMatch`'s input/data; filter `tailoredId: null` in `matchStatsByResume` and `AND "tailoredId" IS NULL` in `listLatestKeywordTables`; in `src/resume/match.ts` add `opts.tailoredId` and pass it to `createMatch`

**Checkpoint**: `npm run lint:types` and `npm test` green.

## Phase 3: User Story 1 — Tailor without touching my resume (P1) 🎯

**Independent test**: edit and save on the target page → resume text / version / scan fields / `scannedAt` unchanged; one copy exists; the page shows its score.

- [ ] T007 [US1] In `src/web/routes/resumes.tsx` replace `saveEdited` with `saveTailored(resumeId, job, text, baseText)`: load the master and its original and `getTailoredForJob`; choose the patch source with `patchSource`; keep the patch → clean-`.docx` → text fallback and notes; name the file with `tailoredFileName`; write with `upsertTailored`; return `{ copy, note, document }`
- [ ] T008 [US1] In the `POST /resumes/:id/draft` handler: require a posting visible to the caller (missing/foreign `jobId` → `flashRedirect` error, new key `resume.flash.draftNeedsJob`); delete the no-job scan branch; claim key becomes `draft:${id}:${hash}:${job.id}`; after saving, `matchResumeToJob({ ...resume, text: copy.text }, postingForPrompt(job), { tailoredId: copy.id, onError })` with NO `scanInBackground`; `downloadUrl` → `/tailored/${copy.id}/download`; flash/subtitle keys reworded for a copy
- [ ] T009 [US1] Reword the keys in `src/i18n/catalog/{en,es,fr,uk}.json`: `resume.save.done|scoring|scanFailed*|checked|compareFailed*` → "Saved a tailored copy …" (drop `{version}`), `target.save.title|button|barTitle` → "Save tailored copy"; remove `resume.save.scanFailed`/`scanFailedNext` if now unused; add `resume.flash.draftNeedsJob`; `catalog.test.ts` stays green
- [ ] T010 [US1] In `src/web/pages/target.tsx` use the new button/title keys (no version); check `src/web/public/target-page.mjs` for text built from the version and update it; update the nearby comment about "next version of the user's own resume"
- [ ] T011 [US1] Extend `src/scripts/route-smoke.ts`: save a copy through `POST /resumes/:id/draft` with a `jobId`; assert the resume row's text, version and `scannedAt` are unchanged and one `tailored_resume` row exists; save again → still one; POST without `jobId` → refused
- [ ] T012 [US1] `npm run lint:types && npm test`; commit "Save a tailored copy instead of a new resume version (#48, US1)" including ticked tasks

## Phase 4: User Story 2 — A copy never pollutes my other work (P1)

**Independent test**: after a copy with an extra skill, other resumes' hints, the master's stats/coverage, the duplicate check and the list are unchanged.

- [ ] T013 [US2] Verify by reading that `listResumes`, `listOtherResumeSkills`, `sameTextAs`/`findResumeWithText`, `getResumeIndustries` and `scanResume` read only `prisma.resume` (no code change expected); record the list in `research.md` R1 if anything surprising shows
- [ ] T014 [US2] Extend the route smoke: after a copy's comparison, assert `matchStatsByResume` count/best for the master exclude it, `listLatestKeywordTables` excludes it, and the resumes list still has one row for the master
- [ ] T015 [US2] `npm run lint:types && npm test`; commit "Keep tailored copies out of the master's numbers (#48, US2)"

## Phase 5: User Story 3 — Find, download, delete (P2)

**Independent test**: copies listed on the resume page and the target page; download returns the file; delete removes; resume delete removes all.

- [ ] T016 [US3] In `src/web/routes/resumes.tsx` add `GET /tailored/:id/download` (attachment, `contentDisposition`-safe name as `/resumes/:id/download` does, 404 when not the caller's) and `POST /tailored/:id/delete` (flash + redirect to `/resumes/<resumeId>` or the job's target page); add both to `PERSONAL_ROUTES` in `src/users/admin-policy.ts`
- [ ] T017 [US3] Add a "Tailored copies" card to `src/web/pages/resume-detail.tsx` (posting title + company with `translate="no"`, date, Download link, Delete via `ConfirmAction`); load `listTailoredForResume` in the `GET /resumes/:id` handler; use the `Empty` primitive only if the card is shown empty, otherwise omit the card
- [ ] T018 [US3] In `src/web/routes/jobs.tsx` target handler load `getTailoredForJob(user, resume.id, job.id)` and pass it to `src/web/pages/target.tsx`, which shows one line ("Your tailored copy — saved <date>") with a Download link next to the save form; add `resume.tailored.*` / `target.copy.*` keys in all four catalogs (a sentence is one message; no glued pieces)
- [ ] T019 [US3] Extend the route smoke: download returns the saved bytes; delete removes the copy and its comparisons; deleting the resume leaves no `tailored_resume` row
- [ ] T020 [US3] `npm run lint:types && npm test`; commit "List, download and delete tailored copies (#48, US3)"

## Phase 6: User Story 4 — Promote to master (P3)

**Independent test**: promote bumps the version, master text/file = the copy's, scan cleared; unconfirmed does nothing.

- [ ] T021 [US4] Add `promoteTailored(userId, id)` to `src/resume/store.ts` (reads the copy with its original through the owner scope, calls `replaceResumeFile`, returns the resume or null) and `POST /tailored/:id/promote` in `src/web/routes/resumes.tsx` (flash "… is now version N"; redirect to the resume); add the route to `PERSONAL_ROUTES`
- [ ] T022 [US4] Add the Promote button (via `ConfirmAction`, the confirm text names that the current master will be overwritten) to the card in `src/web/pages/resume-detail.tsx`; keys in all four catalogs
- [ ] T023 [US4] Extend the route smoke: promote → version +1, text equals the copy's, `scannedAt` null
- [ ] T024 [US4] `npm run lint:types && npm test`; commit "Promote a tailored copy to master (#48, US4)"

## Phase 7: Polish & cross-cutting

- [ ] T025 [P] Write `docs/adr/0077-tailored-resume-copies.md` (context, decision, consequences incl. cascade-vs-set-null on `tailoredId`, no backfill, one copy per pair); add it to the ADR index if there is one
- [ ] T026 [P] Update `docs/where-to-look.md` (a row for "where a tailored copy lives / how it stays out of the master's numbers"; fix the `saveEdited` reference in the docx-patch row), `ARCHITECTURE.md` file map, `CLAUDE.md` `src/resume/` paragraph (`tailored.ts`, store functions) and `SPEC.md` if it describes Save as vN
- [ ] T027 [P] `CHANGELOG.md` entry and `package.json` → 2.59.11 (patch only); sync `package-lock.json` version fields
- [ ] T028 `npm run lint:types && npm test && npm run exports:audit && npm run css` (no diff) and `prisma migrate diff` clean; run the route smoke on a throwaway database; record outputs
- [ ] T029 Browser check at desktop and phone widths on a scratch data folder: target page save, resume page card, promote confirm
- [ ] T030 Commit docs and release bits "Document tailored copies; release 2.59.11 (#48)"

## Dependencies

Phase 1 → Phase 2 → US1 → US2 (needs US1's copies to assert) → US3 → US4 (uses US3's card) → Polish. T003 before T004; T005/T006 after T002.

## Implementation strategy

MVP is US1 + US2 together (the defect and its leak). US3 and US4 add reach and the escape hatch. Commit at each phase's last task.
