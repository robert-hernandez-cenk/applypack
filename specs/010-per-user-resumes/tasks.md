# Tasks: Per-user resumes and dependents

Format: `- [ ] Tnn [P?] [USn] description (file)`.

## Phase 1: Setup
- [x] T001 Scratch Postgres via `npm run db` with a throwaway `APPLYPACK_DATA_DIR`; baseline `lint:types` and tests (no files)

## Phase 2: Foundational (blocks all stories)
- [x] T002 Schema: `Resume.userId Int @default(1)` (cascade, index), `CandidateFact.userId` + `@@unique([userId, term])` replacing `@unique term`, `ApplicationPack.userId` + `@@unique([userId, jobId])` replacing `jobId @unique` + `@@index([userId, status])`, `User` back-relations (prisma/schema.prisma)
- [x] T003 Hand-written migration; seed old-shape data (resume, match, review, fact, letter, pack, applied link) and verify; `prisma migrate diff` empty (prisma/migrations/)
- [x] T004 `resume/store.ts`: `userId` first parameter on every id lookup, list, count, default, scratch, memo and fact function; matches/letters/reviews read through `resume: { userId }`

## Phase 3: US1 resumes are mine
- [x] T005 [US1] Compiler worklist for callers of the resume store: resumes, resume-document, resume-render, resume-detail, resume-source, profile-from-resume, welcome, settings (search save rejects a foreign resumeId; `listProfilesForResume(userId, ...)`), target, overview (src/web/routes/*, src/web/*.ts, src/profiles.ts)
- [x] T006 [US1] AI-side modules that load a resume by id (scan, match, review, brief, rewrite, suggestions, structure, cover-letter) take the owner (src/resume/*.ts)

## Phase 4: US2 comparisons, facts, letters
- [x] T007 [US2] Job page, letter, keywords, facts, applications, comparison-run, companies/jobs-import counts read the person's matches/letters/facts (src/web/routes/*, src/web/pages/*)
- [x] T008 [US2] Shared brief/verification confirmed unchanged; callers require a held posting (grep audit)

## Phase 5: US3 packs per person
- [x] T009 [US3] `pack/store.ts`: userId on the web-facing functions, `claimNextPack` returns owner, `autoPacksToday(userId)`, `sameRole(userId)`, `loadPackInputs(userId, ...)` picks among the owner's resumes (src/pack/store.ts)
- [x] T010 [US3] `process-jobs.ts` queues per keeper with own daily counter; `pack-job.ts` runs each pack as its owner; `web/routes/pack.ts` scoped (src/jobs, src/web/routes/pack.ts)
- [x] T011 [US3] Scripts compile and state their scope (src/scripts/*)

## Phase 6: US4 upgrade safety and polish
- [ ] T012 [US4] Route-smoke second user with isolation checks (resume, match, letter, fact, pack, search link); tests for any pure code added (src/scripts/route-smoke.ts)
- [ ] T013 ADR 0068, CLAUDE.md paragraph, docs/where-to-look.md, spec/ARCHITECTURE touch-ups
- [ ] T014 Verification matrix: `lint:types`, full tests, `exports:audit`, migration over seeded data, `migrate diff`, route smoke on a scratch DB

## Dependencies
T002 -> T003, T004 -> T005..T011 -> T012 -> T014. T013 any time after T004.
