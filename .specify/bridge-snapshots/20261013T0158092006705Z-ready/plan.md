# Implementation Plan: Per-user resumes and dependents (issue #10)

**Spec**: [spec.md](./spec.md) · **ADR**: 0068 · **Builds on**: 0065 (identity), 0066 (searches), 0067 (per-user job rows)

## Summary
`Resume.userId` is the root. Comparisons, reviews and letters belong to the person through their resume (no new column: every reader goes `resume: { userId }`). `CandidateFact` and `ApplicationPack` get their own `userId` because they are not reached through a resume. The posting brief and the company verification stay shared. The store layer takes `userId` explicitly (never `currentUser()` inside a store), so the web passes `currentUser().id` and the worker passes the pack's owner.

## Technical context
TypeScript strict, Prisma + Postgres 16, Hono JSX dashboard, node test runner (pure modules only). Verification (testing-gate): schema change -> hand-written migration applied over seeded old-shape data, `prisma migrate diff` empty, route smoke on a scratch DB with two-user isolation checks; pure code -> unit tests; `tsc` does not catch stale `select:` keys, so readers are audited by grep.

## Design
- **Schema**
  - `Resume.userId Int @default(1)` -> `users` (cascade), `@@index([userId])`; `User.resumes`.
  - `CandidateFact.userId Int @default(1)` (cascade), `@@unique([userId, term])` replaces `@unique term`.
  - `ApplicationPack.userId Int @default(1)` (cascade), `@@unique([userId, jobId])` replaces `jobId @unique`, `@@index([userId, status])`.
  - Unchanged on purpose: `ResumeMatch`, `ResumeReview`, `CoverLetter` (owner = `resume.userId`, cascade through the resume), `PostingBrief`, `JobVerification` (shared), `AiCall.resumeId` (ledger, no FK), `Profile.resumeId` (SetNull; the owner check is in the save path), `UserJob.appliedResumeId`.
- **Resume store** (`resume/store.ts`): every function that finds a resume by id, lists, counts, picks default, takes `userId` first. Matches/letters/reviews are read with `resume: { userId }`; `getMatch`, `getCoverLetter`, `getLatestMatchForJob`, `listMatchesForJob`, memo lookups, `listLatestKeywordTables`, `deleteImpact`, `matchStatsByResume`, `latestReviewByResume`, `listOtherResumeSkills`, `findResumeWithText`, facts, scratch resume all filter by the person. Writers that only get an id from a route that just loaded the resume through the scoped getter keep their id-only shape, except `replace*`, `rename`, `delete`, `setDefault`, `saveReviewAnswer`, `saveResumeTextVersion` which take `userId` (defence in depth: `updateMany`/`where userId`).
- **Posting-keyed shared data**: `getPostingBrief`, `createPostingBrief`, `getLatestVerificationContext`, `getLatestCompanySnapshot` unchanged. Reasoning: no resume text in their prompts, they are properties of the posting, and sharing them is the cost saving the catalog exists for (SC-003). Caller routes already require a held posting.
- **Searches**: `listProfilesForResume(userId, resumeId)`; the search save path rejects a `resumeId` the person does not own (treated as no resume); `profile.count({resumeId})` in deleteImpact adds `userId`.
- **Packs**: `pack/store.ts` functions that are web-facing take `userId` (`getPack`, `packFiles`, `getPackFile`, `queuePack`, `cancelQueuedPack`, `markPackSent`, `packIsKept` as the person's, `packOfSameRole`, `loadPackView`); the runner functions return the owner (`claimNextPack` -> `{id, jobId, userId, trigger}`), `autoPacksToday(userId, now)`, `sameRole(userId, jobId)`, `cancelQueuedAutoPacks()` stays install-wide (the switch is install-wide until #11), `loadPackInputs(userId, jobId, primaryResumeId)` picks among the owner's resumes only. `process-jobs.ts` loops over every keeper who does not skip alerts: per owner `autoPack(...)` with that owner's fit and own `packsToday` counter, then `queuePack(userId, jobId, 'auto')`. `pack-job.ts` runs each claimed pack as its owner: their primary search (`getActiveProfile(owner)`), their `packJobState`, install-wide pack settings, mute list and notices (#11). `listUnnotifiedPacks` stays install-wide (message goes to the install's chats).
- **Pure additions**: none needed in `pack/trigger.ts`; per-owner state is a `Map<number, number>` in the tick. Small pure helper `resume/ownership.ts`? Not needed: ownership is a Prisma `where`.
- **Web**: every route that reads a resume id uses the scoped getter, so a foreign id is "not found"; job-level routes keep requiring a held job. `resume-source.ts`, `profile-from-resume.ts`, welcome/settings/target/letter/keywords/facts/applications/overview/job-detail/resume-detail/resume-render/document routes updated by compiler worklist.
- **Scripts** (`scripts/*`) take the owner from the resume row or `DEFAULT_USER_ID`; they are operator tools run on the whole install and may read any row (documented).
- **Install-wide counts forced by the split**: `companies.tsx` and `jobs-import.tsx` count matches and letters per source; they are scoped to the person's resumes. `overview.tsx` comparison and resume counts are the person's.

## Constitution / convention checks
No new dependency, no default exports, store is the only Prisma writer, worker imports `resume/store` only through the pack runner (ADR 0063). Not translated strings: none added (user-facing wording unchanged).

## Risks
- Surface is wide (about 45 files): compiler worklist plus a grep audit for `resumeMatch|coverLetter|resumeReview|candidateFact|applicationPack|resume\.` readers.
- Migration swaps two unique indexes; must keep `migrate diff` empty and be lossless over seeded old data.
- A pack unique key change alters `queuePack` race handling (`isUniqueViolation` still applies).
