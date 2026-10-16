# Tasks: One tailoring front door

**Input**: Design documents from `/specs/055-one-tailoring-front-door/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: Requested by repo convention (pure modules unit-tested; rewritten tests replace deleted ones). Run `npm run lint:types` and the touched test files before each commit. Tests that import `config.ts` need `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy` (CI's dummy env); without it ~35 files fail with "Invalid environment configuration".

**Organization**: by user story, but **phases run in dependency order, not priority order**: US1 adds the one front door; US3 and US4 cut the shared resume-source code that US2 then deletes together with the launcher, the scratch row and the column. Each phase ends in a commit that type-checks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- All paths are relative to the worktree root `C:\Users\rcher\Dev\applypack-Worktrees\issue-55-one-tailoring-front-door`. Run touched tests with `node --import tsx --test <files>` in a one-command subshell `(cd <wt> && …)`, never a persistent `cd`.

## Phase 1: Setup

- [ ] T001 Baseline recorded in the worktree before any change: `npm run lint:types` clean; `npm test` with the CI dummy env — note the pass/fail counts here as the comparison point.

## Phase 2: Foundational

- [ ] T002 Move `ModeCard` out of `src/web/pages/target-start.tsx` into `src/web/ui.tsx` (exported, same props and markup) and update its importers `src/web/pages/letter-start.tsx` and `src/web/pages/screen-new.tsx`; `MineCheckbox` stays put until US4. Behaviour unchanged; `npm run lint:types` clean.

## Phase 3: User Story 1 — Tailor from the Resume match tab with a length target (P1) 🎯 MVP

**Goal**: the match tab's Compare form carries the page target and the stored comparison keeps it; the editor always allows Save as vN for a saved resume.

**Independent Test**: on a stored job with a saved resume pick "1 page", Compare, reach `/jobs/:id/target?match=…`, see the 1-page target on the comparison, Save as vN.

- [ ] T003 [US1] In `src/web/pages/resume-match-card.tsx` add a `pages` `<Select>` (options: keep, 1, 2, 3; default keep) to the Compare form posting to `/jobs/:id/match`, reusing the markup and `target.pages.*` catalog keys the launcher used in `src/web/pages/target-start.tsx` (lines ~181–190: `Field label=t('target.pages.label') hint=t('target.pages.hint')`, `t('target.pages.keep')`, `t('target.pages.n', {n})`). Look the `PAGE_TARGETS` list up in `src/resume/length.ts` rather than hard-coding 1–3.
- [ ] T004 [US1] Confirm `src/web/routes/jobs.tsx` `POST /jobs/:id/match` stores the posted target: a fresh Compare reads `parsePageTarget(form.pages)`; a re-check reads `readPageTarget(base.breakdown)` (FR-006). Add a small test in `src/web/comparison-pages.test.ts` only if a pure seam exists (e.g. extract the `pages` choice into `src/resume/length.ts:pageTargetForRun(base, formValue)` with tests); otherwise cover by the route smoke step in Phase 8.
- [ ] T005 [US1] Commit: `Add page target to the Resume match form (#55, US1)`.

## Phase 4: User Story 3 — /letter takes a stored job and a saved resume (P2)

**Goal**: the letter launcher has no upload, paste, new-posting or URL input.

**Independent Test**: `/letter` with a stored job and a saved resume drafts a letter; the page offers no other inputs.

- [ ] T006 [US3] Rewrite `src/web/pages/letter-start.tsx`: the job card is the `JobPicker` only (drop the `ModeCard name="jobMode"` wrapper and the "a new posting" card, `presetUrl`); the resume card is a `Select name="resumeId"` of `resumes` only (drop `upload`/`paste` cards and `MineCheckbox`). With no jobs or no resumes show a hint pointing to `/jobs/new` and `/resumes` instead of the form's submit. Keep tone, angles, `runMatch` and `runVerify` unchanged.
- [ ] T007 [US3] Rewrite `src/web/routes/letter.tsx`: `LetterFormSchema` = `{ jobId, resumeId }` (zod, `z.coerce.number().int()`), no `ResumeSourceFields`, no `resumeUploadLimit`; resolve the resume with `getResume(currentUser().id, resumeId)` (flash `letter.flash.resumeGone` ← reuse `upload.source.gone` text under a letter key) and the job as today (`userJobs.some`); delete the `new` branch, the `fetch`/`extract` steps, `createManualJob`, `fetchPostingText`, `checkPostingUrl`, `extractPostingFacts`; `evidence: 'own'`. The run's steps become `[match?] [verify?] letter`.
- [ ] T008 [P] [US3] Update `src/web/launcher.test.ts` (and `src/web/public/launcher.mjs` if it handles the removed modes) to the reduced form; delete cases for upload/paste/new-posting.
- [ ] T009 [US3] Commit: `Cut /letter to a stored job and a saved resume (#55, US3)`.

## Phase 5: User Story 4 — Comparisons always judge the owner's own resume (P2)

**Goal**: nothing writes the `text` evidence variant; legacy rows still read.

**Independent Test**: unit tests for `readMatchEvidence` on legacy `{evidence:'text'}`; new comparisons store `own`.

- [ ] T010 [US4] In `src/web/routes/jobs.tsx` replace every `evidence: row.hidden ? … : 'own'` / `resume.hidden ? … 'text'` with `evidence: 'own'` (`POST /jobs/:id/match`, `POST /jobs/:id/target/reupload`); in `src/resume/cover-letter.ts:67` make `evidence = opts.evidence ?? 'own'`. Keep `readMatchEvidence` and its tests in `src/resume/match-mode.ts` / `match-mode.test.ts` (legacy `text` rows).
- [ ] T011 [P] [US4] Confirm `src/resume/match-reuse.ts` still keys the memo on the evidence marker and its tests (`src/resume/*.test.ts`) still cover `text` vs `own`; add a case if missing.
- [ ] T012 [US4] Commit: `Judge every comparison with the owner's own resume (#55, US4)`.

## Phase 6: User Story 2 — No second launcher, no hidden one-off resume (P1)

**Goal**: `/target` is gone; no scratch row, no `hidden` column, no `ephemeral` editor mode.

**Independent Test**: `/target` and `/target?job=1` answer not found; no nav entry or link; `Resume` has no `hidden`; upgrade deletes hidden rows and their dependants.

- [ ] T013 [US2] Schema + migration: remove `hidden` from `model Resume` in `prisma/schema.prisma` (and its comment); create `prisma/migrations/20261016090000_remove_scratch_resume/migration.sql` that deletes dependants of hidden resumes for every relation lacking `ON DELETE CASCADE` (check `ResumeMatch`, `ResumeReview`, `CoverLetter`, `ApplicationPack`, `UserJob.appliedResumeId` and any other FK to `Resume` in `schema.prisma`; null out `UserJob.appliedResumeId` where it pointed at a hidden row), then `DELETE FROM "Resume" WHERE "hidden" = true;` then `ALTER TABLE "Resume" DROP COLUMN "hidden";`. Run `npx prisma generate`.
- [ ] T014 [US2] Remove `upsertScratchResume` and every `hidden` filter/field from `src/resume/store.ts` (lines ~39, 61, 97–120, 226, 237, 817 — `MatchWithResume.resume` loses `hidden`); fix callers: `src/scripts/pack-dry-once.ts:77`, `src/scripts/rescan-resumes.ts:18`, `src/pack/store.ts:280`, `src/web/applied-resume.ts` (+ `applied-resume.test.ts`), `src/web/routes/overview.tsx:167`, `src/web/routes/resumes.tsx` (277, 303, 344–345, 507 — drop `oneOffNotSaved` branch), `src/web/routes/resume-render.tsx:168–170` (+ `src/web/pages/resume-render.tsx`), `src/web/routes/settings.tsx:1529`, `src/web/routes/welcome.tsx` (265, 330, 460), `src/resume/cover-letter.ts` (`hidden` in its resume param) and `src/web/routes/jobs.tsx:1060`.
- [ ] T015 [US2] Simplify `src/resume/match-name.ts`: `comparedResumeName` returns `resume.name`; `previousFor` matches on `resumeId` and `createdAt`; delete `earlierParams` and `oneOffDraft`. Rewrite `src/resume/match-name.test.ts` for what remains; update the callers `src/web/pages/resume-match-card.tsx` (delta wording uses version only; remove the `kind: 'file'` message variants from the catalogs) and `src/web/pages/target.tsx`.
- [ ] T016 [US2] `src/web/routes/jobs.tsx`: delete the `oneOff` logic in `POST /jobs/:id/match` (lines ~906–915), `draft = text !== resume.text`, remove `ephemeral: resume.hidden` and the `describeResumeFile` hidden branch (and `jobRoute.file.oneOff`), and the `resume.hidden` special cases in `POST /jobs/:id/target/reupload` (name and `draft:false` overrides). `src/web/pages/target.tsx`: delete `ephemeral` from props and the five branches (`target.reupload.another`, `target.reupload.hintOneOff`, `target.dirty.oneOff`, the Save-as gate at ~480/844, the version suffix at ~630, ~744) so Save as vN is always rendered; `src/web/public/target-page.mjs` if it reads an ephemeral flag.
- [ ] T017 [US2] Delete the launcher: remove `GET /target` and `POST /target` and the unused imports from `src/web/routes/target.tsx` (keep `/target/runs/:id` and `/state`; the "run gone" redirect becomes `flashRedirect('/jobs', …)`); delete `src/web/pages/target-start.tsx`, `src/web/public/target-start.mjs`, `src/web/target-start.test.ts`; set the `target-runs.ts` default `backUrl` to `/jobs`; remove `{ key: 'target', href: '/target' }` from `src/web/layout.tsx` (and the `nav.target` catalog key and the `active="target"` references); remove `'GET /target'` and `'POST /target'` from `src/users/admin-policy.ts` (and its test if it lists them); update the `/target?job=` doc comments in `src/web/job-pick.ts`, `src/web/comparison-run.ts`.
- [ ] T018 [US2] `src/web/pages/resume-match-card.tsx`: remove both `/target?job=` links (the `match.noResumes` rich link `once` and the `match.compareFile` anchor) — `match.noResumes` becomes a sentence that links only to `/resumes`; drop `m.resume.hidden` in the history chips. Update `match.*` keys accordingly.
- [ ] T019 [US2] Delete `src/web/resume-source.ts`'s `ResumeSourceFields`, `ResumeSourceInput`, `ResolvedResume`, `resolveResumeSource`, `findResumeWithText`/`upsertScratchResume` imports; what remains is `ResumeOption` + `listResumeOptions` (keep the file name). Remove `MineCheckbox` (from the former `target-start.tsx` — already deleted in T017) and any now-unused helpers: `findResumeWithText` in `src/resume/store.ts`, `readResumeUpload`/`MAX_RESUME_NAME_CHARS`/`nameFromFilename` if `exports:audit` reports them unused, `src/web/public/posting-clean.mjs` and `posting-clean` imports if only the launcher used them, `src/jobs/posting-url.ts` / `posting-extract.ts` exports whose only caller was a launcher (decide by `npm run exports:audit`; do not delete a function another flow uses).
- [ ] T020 [P] [US2] Remove the catalog keys used only by the removed pages from `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json` (`target.start.*`, `target.flash.pickBoth|pickJob|jobGone|descriptionShort|postingLong`, `upload.source.*` and `upload.pastedName` if unused, `letter.*` strings for the removed inputs, `resume.flash.oneOffNotSaved`, `render.flash.hidden`, `match.earlierOneOff`, the `file` variant of the earlier-comparison wording, `jobRoute.file.oneOff`, `target.reupload.another|hintOneOff`, `target.dirty.oneOff`, `nav.target`, `jobRoute.match.*` if orphaned). Find them by running `src/i18n/catalog.test.ts` and `npm run exports:audit`; regenerate the browser catalog with `npm run i18n:browser` (and the copy in `site/public/demo/`) if any `browser.*` key changed.
- [ ] T021 [US2] Update `src/scripts/route-smoke.ts` (and fixtures): drop `/target` GET/POST and scratch-row steps; POST `/jobs/:id/match` with `pages=1` and `/letter` with a stored job + saved resume; keep the pseudo-language page sweep.
- [ ] T022 [US2] Commit: `Remove the /target launcher and the scratch resume (#55, US2)`.

## Phase 7: Docs and release metadata

- [ ] T023 [P] Update `docs/where-to-look.md` rows 147 and 203 (and any other `/target` launcher / `resolveResumeSource` / scratch resume mention found by grep) to the single front door.
- [ ] T024 [P] Add an addendum to `docs/adr/0074-page-target-for-tailoring.md` (the page target is chosen on the match form) and write `docs/adr/0076-one-tailoring-front-door.md` (context, decision, consequences: no one-off comparisons, `evidence` always `own` with legacy `text` still read, migration deletes hidden rows); list it in `docs/adr/README.md`. Update `CLAUDE.md` file-rule lines that name `resolveResumeSource`/the scratch row if any, `SPEC.md`/`ARCHITECTURE.md` mentions of `/target`.
- [ ] T025 Bump `package.json` (and lockfile) patch version and add the `CHANGELOG.md` entry (patch only; fork rule).
- [ ] T026 Commit: `Document the single front door, add ADR 0076 (#55)`.

## Phase 8: Verify

- [ ] T027 Run the quickstart: `npm run lint:types`; `npm test` with the CI dummy env (compare with T001); `npm run exports:audit`; `npm run css` and `git diff --exit-code src/web/public/tailwind.css`; `prisma migrate diff` clean; the migration check on a throwaway DB (quickstart step 7); `npm run build && npm run smoke:routes` against a throwaway DB. Browser check (viewport 375 and 1280) of the match form, the editor Save as vN and `/letter`. Record real output; list anything not verifiable.
- [ ] T028 Mark `tasks.md` boxes complete and commit: `Mark #55 verification tasks complete`.

## Dependencies & Execution Order

- Phase 2 → Phase 3 (MVP, independent of the rest) → Phase 4 (needs T002) → Phase 5 → Phase 6 (needs 4 and 5: nothing may still import `resolveResumeSource`) → Phase 7 → Phase 8.
- Within Phase 6: T013 → T014 → T015/T016 → T017/T018 → T019 → T020/T021.
- Parallel: T008, T011, T020, T023, T024 touch separate files from their neighbours.

## Implementation Strategy

MVP is Phase 3 (the length control on the one front door). Each later phase removes a piece while the tree stays green; the migration lands in Phase 6 together with the code that stops reading `hidden`.
