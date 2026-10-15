# Tasks: Reactive Resume connection as a saved setting

**Input**: Design documents from `/specs/042-reactive-resume-setting/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md

**Tests**: Requested by repo convention (pure modules unit-tested, test first). Run `npm run lint:types && npm test` before each commit.

**Organization**: by user story. Execution order is US1 → US2 → US3: US1 creates the connection the other two read; US3 reuses the target-aware list/import that US2 builds.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- All paths are relative to the worktree root. Reference patterns: `src/gmail/store.ts`, `src/gmail/secret-access.test.ts`, `src/web/routes/gmail.ts`, `src/web/pages/gmail-card.tsx`.

## Phase 1: Setup

- [x] T001 Write ADR `docs/adr/0075-reactive-resume-connection-is-a-saved-setting.md` (status Accepted, issue #42; supersedes the not-stored part of 0073: why the key is now kept, one row per person in `reactive_resume_connection`, one accessor, never rendered/logged/linked/flashed/stashed, validated by a list call on save, address policy re-run at save, list and import, no encryption at rest and why, Gmail token as precedent) and list it in `docs/adr/README.md`. Mark the superseded promise in `docs/adr/0073-*.md` with a one-line pointer to 0075.

## Phase 2: Foundational (blocks every story)

- [x] T002 Add `model ReactiveResumeConnection` to `prisma/schema.prisma` per data-model.md (`userId Int @id`, FK `User` with `onDelete: Cascade`, `baseUrl String`, `apiKey String`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@map("reactive_resume_connection")`) and the back-relation on `User`; hand-write `prisma/migrations/20261015120000_reactive_resume_connection/migration.sql` (CREATE TABLE + FK ON DELETE CASCADE, matching what `prisma migrate diff --from-migrations … --to-schema-datamodel … --script` prints); run `npx prisma generate`.
- [x] T003 [P] Test first, then implement the pure helper `src/resume/reactive-connection.ts` with `src/resume/reactive-connection.test.ts`: `MAX_KEY_CHARS = 500`; `cleanKey(raw: unknown): { ok: true; key: string } | { ok: false; code: 'empty' | 'tooLong' }` (trim; "1 to 500 characters after trim; over-long refused whole, never truncated"); `interface ConnectionView { base: string; host: string }` (no key field); `viewOf(baseUrl: string): ConnectionView`.
- [x] T004 Implement `src/resume/reactive-connection-store.ts`, the ONLY file that touches `prisma.reactiveResumeConnection`: `getConnectionView(userId): Promise<ConnectionView | null>` (explicit `select: { baseUrl: true }`), `saveConnection(userId, base: string, key: string)` (upsert), `deleteConnection(userId)` (idempotent `deleteMany`), `readInstanceKey(userId): Promise<{ base: string; key: string } | null>` (the key's one accessor, explicit `select`). Every function takes `userId` first. Log only host and counts, never the key.
- [x] T005 [P] Write `src/resume/reactive-connection-access.test.ts` modelled on `src/gmail/secret-access.test.ts`: a closed list of files under `src/` (non-test) that may contain `reactiveResumeConnection` or `readInstanceKey` (the store, `web/routes/reactive-resume.ts`, `web/routes/resumes.tsx`, plus the settings route that reads the view); every `prisma.reactiveResumeConnection.find*` call has `select:`; the `ConnectionView` interface text has no `key`.
- [x] T006 [P] Test first, then change `src/web/pull-stash.ts` and `src/web/pull-stash.test.ts`: `Pull = { userId; ids: string[]; target: PullTarget }` with `type PullTarget = { kind: 'new' } | { kind: 'version'; resumeId: number }`; drop `base` and `key`; keep TTL 10 min, one-use `takePull`, owner check, per-user and global caps; update the header comment (no key any more).
- [x] T007 Extract `saveNewVersion(c, current, upload)` in `src/web/routes/resumes.tsx` from the body of `POST /resumes/:id/replace` after the upload is read (same-text check with `sameTextAs`, `replaceResumeFile`, `startScanRun` with the existing `resume.run.rescanSubtitle` / `resume.flash.versionUploaded` / `versionScanFailed` messages); the file route calls it. Behaviour unchanged; existing tests stay green.
- [x] T008 Add to `PERSONAL_ROUTES` in `src/users/admin-policy.ts`: `'POST /settings/reactive-resume'`, `'POST /settings/reactive-resume/remove'`, `'POST /resumes/:id/reactive/list'`.

**Checkpoint**: table, store, stash and shared version save exist; `npm run lint:types && npm test` green (stash and route code adjusted just enough to compile — T012 finishes it).

## Phase 3: User Story 1 — Save the connection once (P1) 🎯 MVP

**Goal**: Settings shows a Reactive Resume card; a person saves (after a live check), replaces and removes their connection; the key is never shown.

**Independent Test**: against the #39 stand-in server, save a good pair → card says connected to the host, page source has no key; save a bad key → error flash, old connection intact; remove → empty card. A member's loopback address is refused; an administrator's is allowed.

- [x] T009 [US1] Test first, then implement `src/web/routes/reactive-resume.ts` per contracts/routes.md: `createReactiveResumeRoute(deps)` (deps: store functions, `listInstanceResumes`, `reachable`, `userId`, `isAdmin`) with `POST /settings/reactive-resume` (parse → `cleanKey` → `parseInstanceUrl` → `reachable(base, { privileged })` → `listInstanceResumes` → `saveConnection`; the flash maps reuse `URL_FAILURE` / `REACH_FAILURE` / `INSTANCE_FAILURE` — move those three maps out of `resumes.tsx` into a shared `src/web/reactive-failures.ts` and import from both) and `POST /settings/reactive-resume/remove`. Redirect to `/settings?tab=profile#reactive-resume`. Guard with `onceGuard`. Tests in `src/web/routes/reactive-resume.test.ts`: success stores; each failure stores nothing and keeps the old pair; member loopback refused before any request; admin allowed; the key never appears in a redirect location or flash.
- [x] T010 [US1] Mount the route in `src/web/app.ts` (live wiring with the real store and `isAdmin(currentUser())`, as `gmailRoute` is mounted).
- [x] T011 [P] [US1] Build the card: `src/web/pages/reactive-card.tsx` (`ReactiveCardBody({ view })`: not saved → address + key form; saved → "Connected to **host**. A key is saved." with `translate="no"` on the host, a replace form with the address prefilled and an EMPTY key field, a confirmed Remove via `ConfirmAction`; `Hint` for helper prose). In `src/web/routes/settings.tsx` load `getConnectionView(currentUser().id)` and pass `reactiveResume` into `src/web/pages/settings.tsx`; add a `Section id="reactive-resume"` beside the Gmail section on the same tab.
- [x] T012 [US1] i18n: add the card keys (title, intro, urlLabel/hint, keyLabel/hint, save, replace, remove, removeConfirm, connectedTo, keySaved, flash.saved, flash.removed, fail.keyTooLong) to `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json` in the same commit; wording through `t()` / `tRich`; run `src/i18n/catalog.test.ts`.

**Checkpoint**: US1 works alone; the pull on `/resumes` still has its old form until US2.

## Phase 4: User Story 2 — Import a new resume from the saved connection (P1)

**Goal**: `/resumes` lists and imports with nothing typed.

**Independent Test**: with a saved connection, list → pick → a new resume exists; without one the page shows the Settings pointer and no address/key field; a revoked key says "replace it in Settings"; an expired pick says "list again".

- [x] T013 [US2] Change `POST /resumes/reactive/list` and `POST /resumes/reactive/import` in `src/web/routes/resumes.tsx` per contracts/routes.md: list takes no fields, reads the connection via `readInstanceKey` (none → flash to Settings), re-checks `reachable` for the person's standing, stashes `{ userId, ids, target: { kind: 'new' } }`; import takes the pull (always consumed), reads base and key from the store again (missing → "list again"), re-checks reach, fetches, and for `target.kind === 'new'` goes through `saveUploaded` as today. `unauthorized` adds the "replace it in Settings" wording (new key `resumes.reactive.fail.unauthorizedSaved`). Remove the `key` / `url` form parsing and `noKey`/URL handling from these two handlers.
- [x] T014 [US2] Change `src/web/pages/resumes.tsx`: replace `ReactiveImportForm` with a button form posting to `/resumes/reactive/list` when a connection exists, or a one-line pointer (link to `/settings?tab=profile#reactive-resume`) when not; `ResumesPage` takes `reactiveConnected: boolean` (route passes it from `getConnectionView`); `ReactivePickPage` takes `target` and a `cancelHref`, host from the stored base. Keep the v4 hint.
- [x] T015 [US2] i18n: add/replace keys for the button, pointer, `fail.noConnection`, `fail.unauthorizedSaved`; delete the now unused typed-form keys (`resumes.reactive.url`, `urlHint`, `key`, `keyHint`, `fail.noKey` if unused) from all four catalogs; `catalog.test.ts` green.

**Checkpoint**: US1 + US2 usable end to end.

## Phase 5: User Story 3 — New version from Reactive Resume (P1)

**Goal**: a resume's "Upload a new version" card can pull the next version from Reactive Resume.

**Independent Test**: resume at v1, saved connection, pick a resume with different text → v2 scanned with its own name; pick one with the same text → "same as current version", still v2; no connection → pointer; someone else's resume id → not found.

- [x] T016 [US3] Add `POST /resumes/:id/reactive/list` in `src/web/routes/resumes.tsx`: owned-resume check (404 otherwise, as `/replace`), same flow as the new-resume list with `target: { kind: 'version', resumeId }`, refusals redirect to `/resumes/:id`. Extend `POST /resumes/reactive/import` for `target.kind === 'version'`: reload the resume as the person (gone → flash, nothing changes), `markdownResume(name, text)` → `saveNewVersion(c, current, upload)`; the resume's `name` is untouched. Redirects after errors go to `/resumes/:id` for this target. `resumes.tsx` imports Prisma, so by repo convention it is not unit-tested: these paths (new version, same-text notice, foreign resume 404, connection removed between list and pick) are covered by the route smoke in T019.
- [x] T017 [US3] Edit `src/web/pages/resume-detail.tsx`: in the `resume.uploadANewVersion` card add the second source — when connected, a small form posting to `/resumes/${resume.id}/reactive/list` with a Button "From Reactive Resume"; otherwise a `Hint` with the Settings link. The route passes `reactiveConnected`. File form unchanged. Use `Hint` for helper prose; keep the 375px layout (no horizontal scroll).
- [x] T018 [US3] i18n: keys for the new-version source (button, pointer, pick intro for a version `resumes.reactive.pickIntroVersion`) in all four catalogs; `ReactivePickPage` shows it when `target.kind === 'version'`.

**Checkpoint**: all three stories work.

## Phase 6: Polish & cross-cutting

- [x] T019 Route smoke in `src/scripts/route-smoke.ts`: steps for save (stand-in), list from `/resumes`, import as new, list from a resume, import as a new version, remove; every new POST and the Settings card GET render clean, and the pseudo-language pass still finds no English outside the catalog.
- [x] T020 Docs: add a row to `docs/where-to-look.md` (connection store, card, routes), update `CLAUDE.md` — the `DO NOT` secrets carve-out list gains "a person's Reactive Resume API key lives in `ReactiveResumeConnection` … read only through `readInstanceKey`" (ADR 0075) — and the `src/resume/` / dashboard bullets that said the key is not kept; update `ARCHITECTURE.md` / `SPEC.md` lines that state the pull is key-less if any (grep "Reactive Resume").
- [x] T021 Release bookkeeping (fork rule: patch only): bump `package.json` and `package-lock.json` to `2.59.7`; add a `## [2.59.7] — 2026-10-15` entry to `CHANGELOG.md` (Added: saved connection on Settings, import and new-version from it; Changed: the typed address/key form is gone, the key is now stored per person — ADR 0075).
- [x] T022 Verification matrix, with real output pasted in the PR: `npm run lint:types`, `npm test`, `npm run exports:audit`, `npm run css` if a new Tailwind class was used (commit the generated file), `prisma migrate diff` clean against a throwaway Postgres (`--from-migrations` vs the schema), route smoke on a throwaway database, a local `npm start` on a scratch `APPLYPACK_DATA_DIR` walking quickstart.md steps 1–7 including a 375px check of the new-version card. Mark anything needing a live Reactive Resume instance as unverified.

## Dependencies

- Phase 2: T002 → T004 → T005; T003, T006, T007, T008 independent of each other (T006/T007 must leave the tree compiling).
- US1 (T009–T012) needs T002–T004, T008. US2 (T013–T015) needs T004, T006, T007, US1 for a way to create a connection in manual runs. US3 (T016–T018) needs T013 (shared import) and T007.
- Polish after the stories; T022 last.

## Parallel opportunities

T003 ∥ T005 ∥ T006 ∥ T007 ∥ T008 after T002/T004 are in view; T011 ∥ T009; catalog edits T012/T015/T018 touch the same four files, so do them with their story rather than in parallel.

## Implementation strategy

MVP is US1 plus US2 (the setting and its everyday use). US3 is the headline request but small once the target-aware import exists. Commit per story (`… (#42, US1)`), with `tasks.md` boxes ticked in the same commit.
