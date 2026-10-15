# Tasks: Edit a job's details and re-classify it

**Input**: Design documents from `/specs/046-edit-reclassify-jobs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: Requested by repo convention (pure modules unit-tested, test first). Run `npm run lint:types` and the touched test files before each commit. The full suite has 35 files that fail in a fresh worktree for want of `.env` ("Invalid environment configuration"); compare against that baseline, do not chase it.

**Organization**: by user story. US1 (edit + re-score) is the MVP and carries the shared pieces; US2 (undo) and US3 (shared posting refused) build on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- All paths are relative to the worktree root `C:\Users\rcher\Dev\applypack-Worktrees\issue-46-edit-reclassify-jobs`. Run touched tests with `node --import tsx --test <files>` in a one-command subshell, never a persistent `cd`.

## Phase 1: Setup

- [x] T001 Baseline recorded in the worktree before any change: `npm ci` clean, `npm run lint:types` clean, `npm test` = 3565 pass / 35 fail, every failure "Invalid environment configuration".

## Phase 2: Foundational

- [x] T002 Extract (as built: a pure `src/jobs/description-columns.ts` + `description-columns.test.ts`, so the test needs no database; `posting-limits.ts` likewise holds the two length constants, re-exported by `manual-job.ts`) from `src/jobs/description-refresh.ts` `descriptionColumns(job: Pick<Job,'description'|'descriptionOriginal'>, text: string)` returning `{ description, descriptionOriginal: job.descriptionOriginal ?? job.description, descriptionRefreshedAt: new Date(), descriptionSimhash: toDbBigInt(simhash64(text)) }` with `text` already normalised by the caller; make `refreshDescription` use it (behaviour unchanged). Export it. `restoreDescription` stays as is.
- [x] T003 Add the two routes to `PERSONAL_ROUTES` in `src/users/admin-policy.ts`, next to the description entries: `'GET /jobs/:id/edit'`, `'POST /jobs/:id/edit'` (the route smoke fails if a route is in neither list).

## Phase 3: User Story 1 — Add the missing context and get a fair verdict (P1) 🎯 MVP

**Goal**: a sole holder edits title, company, location and description on `/jobs/:id/edit`; the save writes only what changed, refills place facets and employer key, keeps the description it arrived with, and re-scores with `keepStatus: true`.

**Independent Test**: edit a pasted posting's location and description, save, see the new text, place chips and a verdict; status unchanged; nothing-changed save spends no AI call.

- [x] T004 [US1] Test first. Create `src/jobs/job-edit.test.ts` for the pure `src/jobs/job-edit.ts`: (a) `canEdit(holderIds, userId)` true only for exactly `[userId]`; false for `[]`, `[other]`, `[userId, other]`; (b) `planEdit(current, form)` returns `{ ok: false, error }` with codes `titleEmpty` (blank after trim), `titleTooLong` (> 300), `companyTooLong` (> 200), `locationTooLong` (> 300), `descriptionTooShort` (changed and < `MIN_DESCRIPTION_CHARS`), `descriptionTooLong` (changed and > `MAX_POSTING_CHARS`); an unchanged short description is NOT an error; an empty location is allowed; (c) `{ ok: true, changes }` holds only changed fields: title/location compared after trim, description compared after `normaliseDescription`, company compared with the name the page shows (`shown`) — equal → no `employer` change, blank → `employer: null`; (d) no change → `{ ok: true, changes: {} }` and `isUnchanged(changes)` true. Run it and confirm it FAILS (module missing).
- [x] T005 [US1] Create `src/jobs/job-edit.ts` (pure, named exports only, no I/O, constants at top: `MAX_TITLE_CHARS = 300`, `MAX_COMPANY_CHARS = 200`, `MAX_LOCATION_CHARS = 300`, importing `MIN_DESCRIPTION_CHARS` / `MAX_POSTING_CHARS` from `./manual-job` and `normaliseDescription` from `./description-diff`) until T004 passes. Export `JobEditError` (the six codes), `JobEditForm`, `JobEditChanges` (`title?`, `employer?: string | null`, `location?`, `description?`), `canEdit`, `planEdit`, `isUnchanged`. Words are catalog keys, never text, in this file.
- [x] T006 [P] [US1] (As built: the flash reuses `rescoreFlash` for the no-verdict cases and has two keys, `jobEdit.flash.scored` and `jobEdit.flash.notScored`.) Test first. Create `src/web/job-edit-flash.test.ts` for the pure `src/web/job-edit-flash.ts:jobEditFlash(outcome: Rescored)` → `{ kind: 'ok' | 'warn'; text }` using `t()` keys: scored → ok `jobEdit.flash.scored`; prefiltered → ok `jobEdit.flash.prefiltered`; no-search → warn `jobEdit.flash.noSearch`; failed → warn `jobEdit.flash.failed` with `{ reason }` (empty reason → the key without a reason clause, mirror `rescore-flash.ts`). Follow how `src/web/rescore-flash.test.ts` sets the locale. Confirm it FAILS, then create `job-edit-flash.ts` until it passes.
- [x] T007 [US1] Create `src/jobs/job-edit-store.ts`, the only file of this feature that touches Prisma: `editJob(job: ClassifiableJob, userId: number, changes: JobEditChanges): Promise<{ kind: 'refused' } | { kind: 'saved'; job: Job; rescored: Rescored }>`. Steps: `userJob.findMany({ where: { jobId }, select: { userId } })` → `canEdit` else `{ kind: 'refused' }`; build `data` from the changed fields only — `title`; `employer` plus `employerKey = hiringKey(employer, job.company.name, !sourceIsEmployer(job.company.atsType))` (null employer → `hiringKey(null, …)`); `location` plus `workplace/countries/regions/locationSource` from `parseLocation(location)`; description via `descriptionColumns(job, description)` from T002; one `prisma.job.update`; then `classifyExistingJob({ ...job, ...updated }, { keepStatus: true, userId })` inside try/catch (failure → `{ kind: 'failed', reason: '' }`, `logger.error`). `logger.info` the changed field names, never the texts. No test (Prisma module, per repo rule); covered by the route smoke (T016).
- [x] T008 [US1] Create `src/web/pages/job-edit.tsx` (`hono/jsx`, pragma as the other pages): `JobEditPage` with props `{ job: { id, title, companyName: string | null, location, description }, values?, error?: JobEditError, tab }`. A `Layout` titled by the posting (`titleIsData`), a form posting to `/jobs/${id}/edit` with labelled inputs `title`, `company`, `location`, `description` (textarea), hidden `tab`, a Save button and a Cancel link back to `jobHref(id, tab)`. Use the page's existing form primitives (look at `pages/job-new.tsx` or the paste form for the field components) and `Hint` for helper text (`data-ui="hint"`): the company hint says a blank company reads as "Company not named" for a mailed, imported or folder posting; the description hint says the original is kept and can be restored. Posting data in inputs takes `translate="no"`. When `error` is set show it as an inline message from key `jobEdit.error.<code>` with `{ min }`/`{ max }` params. Also export `JobEditSharedPage` (the story-3 explanation + back link, key `jobEdit.shared`).
- [x] T009 [US1] In `src/web/routes/jobs.tsx` add `GET /jobs/:id/edit` and `POST /jobs/:id/edit` per `contracts/routes.md`. Both: `idParam` check (400 `http.badId`), load the job with `company: { select: { name, atsType, sourceConfig } }` (the guard already 404s non-holders), read holders (`prisma.userJob.findMany`) and `canEdit` — if false render `JobEditSharedPage` with status 403. GET renders the pre-filled page (company = `hiringName(job.employer, job.company) ?? ''`). POST (wrapped in `onceGuard((c) => `edit:${id}`, (c) => `/jobs/${id}`)`) reads `parseBody()`, runs `planEdit`; error → 400 re-render with typed values; `isUnchanged` → `flashRedirect(jobHref(id, tab), 'warn', t('jobEdit.unchanged'))`; else `editJob` (`refused` → 403 shared page), then `flashRedirect(jobHref(id, tab), flash.kind, flash.text)` from `jobEditFlash(result.rescored)`. Description-less change (title/company/location only) still re-scores. Never read `status`, `url`, `salary*` from the form.
- [x] T010 [US1] In `src/web/pages/job-detail.tsx` add an `editable: boolean` prop to `JobDetailProps` and, in the Details card (right rail), an **Edit** `Button href={`/jobs/${job.id}/edit?tab=${tab}`} variant="secondary" size="sm"` shown only when `editable`; compute `editable` in the job page's GET handler in `src/web/routes/jobs.tsx` with the same holder query and `canEdit`. Update every caller/test fixture of `JobDetailPage` that the type checker names.
- [x] T011 [US1] Catalog keys in `src/i18n/catalog/en.json`, then `uk.json`, `es.json`, `fr.json` in the same commit (`catalog.test.ts` fails otherwise): `job.edit` (button), `jobEdit.title` / `jobEdit.heading`, field labels `jobEdit.field.title|company|location|description`, hints `jobEdit.hint.company|description`, `jobEdit.save`, `jobEdit.cancel`, `jobEdit.shared`, `jobEdit.unchanged`, `jobEdit.error.titleEmpty|titleTooLong|companyTooLong|locationTooLong|descriptionTooShort|descriptionTooLong` (with `{min}`/`{max}`), `jobEdit.flash.scored|prefiltered|noSearch|failed`. Sentences are single messages, no glued fragments. No `browser.*` key is added, so `npm run i18n:browser` is not needed.
- [x] T012 [US1] Verify and commit the story: `npm run lint:types`, `node --import tsx --test src/jobs/job-edit.test.ts src/web/job-edit-flash.test.ts src/i18n/catalog.test.ts src/users/admin-policy.test.ts`, and `npm run exports:audit` (every new export must be used: drop `isUnchanged`/`JobEditChanges` exports if only the module itself uses them). Commit `Edit a job's details and re-classify it (#46, US1)` with the `tasks.md` boxes ticked in the same commit.

**Checkpoint**: US1 is complete and shippable on its own.

## Phase 4: User Story 2 — Undo a description edit (P2)

**Goal**: "Restore the original" returns the text from before the first edit, also after several edits.

**Independent Test**: edit a description twice, restore, see the first text.

- [x] T013 [US2] Test first. In `src/jobs/description-refresh.test.ts` (create; keep it pure by testing `descriptionColumns` only): first call with `descriptionOriginal: null` keeps `job.description` as the original; a second call on a job whose `descriptionOriginal` is already set keeps that first original (not the intermediate text); `descriptionSimhash` equals `toDbBigInt(simhash64(text))`; `descriptionRefreshedAt` is a Date. Confirm it passes against T002's extraction (it should — the test pins the behaviour the edit relies on). If `description-refresh.ts` cannot be imported without `DATABASE_URL` (it imports `../db`), move `descriptionColumns` into a new pure file `src/jobs/description-columns.ts` and import it from both `description-refresh.ts` and `job-edit-store.ts`; update T002's export accordingly.
- [x] T014 [US2] Manual check from `quickstart.md` step 3 (Restore the original after an edit) — the existing restore route and the "Description replaced … Restore the original" row already render for `descriptionOriginal !== null`; confirm the wording `job.descriptionReplaced` still reads right for an edit (it says the description was replaced; adjust the `en` string and its three translations only if it names the company's listing). Commit `Pin the description undo for edits (#46, US2)` if anything changed.

## Phase 5: User Story 3 — A shared posting cannot be changed (P2)

**Goal**: with other holders, no Edit button, the page explains, a direct POST changes nothing.

**Independent Test**: two people hold one posting; the second user's POST leaves every column as it was.

- [x] T015 [US3] Confirm the three refusal points exist and are consistent: button hidden (T010), GET/POST render `JobEditSharedPage` with 403 (T009), and `editJob` re-checks holders just before the write (T007). Add to `src/jobs/job-edit.test.ts` the explicit cases `[userId, other]` and `[other]` for `canEdit` if T004 does not already name them. Commit with T016.

## Phase 6: Polish & cross-cutting

- [x] T016 Route smoke: in `src/scripts/route-smoke.ts` add a `GET /jobs/<pasted fixture id>/edit` (expects 200 and the four fields) and a `POST /jobs/<id>/edit` changing the location (expects 303), plus a POST with an empty title (expects 400); the pseudo-language pass will then cover the new page. Run only on a throwaway database.
- [x] T017 [P] Docs, in the commit that changes the behaviour: add a row to `docs/where-to-look.md` ("Edit a posting's title, company, location, description" → `/jobs/:id/edit`, `jobs/job-edit.ts` pure, `jobs/job-edit-store.ts` writes, `web/job-edit-flash.ts`); one paragraph in `SPEC.md` (what a person can edit and the sole-holder rule); the file map line in `ARCHITECTURE.md`; one file-rule bullet in `CLAUDE.md` next to the `description-refresh` mention only if the file rules list it (grep first; do not invent a new section).
- [x] T018 [P] Patch version bump `2.59.8` → `2.59.9` in `package.json` and `package-lock.json` (patch only, per the fork's release rule).
- [x] T019 Final verification: `npm run lint:types`, `npm test` (compare to the 3565 / 35 baseline; the 35 are the `.env` failures), `npm run exports:audit`, `npm run build`, and the `quickstart.md` manual steps 1–8 on a scratch data folder (`APPLYPACK_DATA_DIR`, never the live one). Anything that needs a live engine or a second user that cannot be run here is listed as unverified for the PR. Tick the boxes and commit `Mark #46 verification tasks complete`.

## Dependencies & order

- T002, T003 → T007/T009 (store and routes need them). T004 → T005. T006 independent.
- T005 → T007 → T008 → T009 → T010 → T011 → T012 (one commit for US1).
- US2 (T013–T014) and US3 (T015) only add pins and checks over US1; T016–T019 last.

## Parallel examples

- T006 (flash test+impl) with T004/T005 (edit rules): different files.
- T017 (docs) and T018 (version) with each other, after code is settled.

## Implementation strategy

MVP = Phase 2 + Phase 3 (US1) — the whole reported need. US2 and US3 are verification and pinning over it. Commit per story as above.
