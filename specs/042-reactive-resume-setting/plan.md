# Implementation Plan: Reactive Resume connection as a saved setting

**Branch**: `issue-42-reactive-resume-setting` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-reactive-resume-setting/spec.md`

## Summary

#39's live pull asked for the address and key on every use and kept the key for ten minutes in memory. This makes the pair a per-person saved setting: one new table, one store file that alone reads the key, a Settings card to save (after a live check), replace and remove it, and two uses of it: the Resumes page's "import as a new resume" (the typed form goes away) and a new "From Reactive Resume" source on a resume's "Upload a new version" card. The pull stash stops holding the key and instead carries the target (a new resume, or the next version of one resume); the key is read from the store when the import runs. The new-version save is extracted from the file-upload route so both sources share it.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: none new. Reuses `reactive-resume-url.ts` (`parseInstanceUrl`, `reachable`), `reactive-resume-api.ts` (`listInstanceResumes`, `getInstanceResume`, `InstanceError`) and `reactive-resume.ts` (`reactiveResumeText`) unchanged.

**Storage**: Postgres via Prisma: new table `reactive_resume_connection` (hand-written migration). The key is stored as text in that table, as `gmail_connection.refreshToken` is; read through one accessor only.

**Testing**: `npm test`. Pure helper unit-tested; the store is covered by a closed-list source test (like `gmail/secret-access.test.ts`) and exercised by the route smoke; routes tested with a faked store and the #39 stand-in server pattern; pull-stash tests updated; route smoke gets steps for save, list, import-as-version, remove.

**Target Platform**: the dashboard (`src/web/`). The worker never imports any of this.

**Project Type**: web-service (Hono dashboard) plus pure library modules.

**Performance Goals**: none beyond #39's (one bounded request per list/import/save).

**Constraints**: key never rendered in full, logged, put in a link, flash, form value or the pull stash; #39's address rules (http/https, no credentials, no redirects, 10 s, 5 MB, private addresses admin-only) apply at save, list and import.

**Scale/Scope**: at most one row per person.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template; the binding rules are the repo's `CLAUDE.md`.

| Rule | Status |
| --- | --- |
| Pure functions, side effects in a dedicated module | Pass: `reactive-connection.ts` pure; `reactive-connection-store.ts` the only file touching the table |
| Secrets only in `.env` except listed carve-outs | **Deliberate exception**, recorded: the carve-out list in `CLAUDE.md` gains this key, read only through its own accessor, never rendered in full, never logged (ADR 0075) |
| zod for external data | Pass: unchanged from #39; the form fields are trimmed and length-checked |
| Every new route in exactly one policy list | Pass: the three new POSTs go in `PERSONAL_ROUTES` |
| i18n in every catalog in the same PR | Pass: planned, held by `catalog.test.ts` |
| Worker must not import it | Pass |
| `exports:audit` | Watch: export only what another file imports |
| Schema change → hand-written migration, `prisma migrate diff` clean | Pass: planned |
| ADR for schema / secret handling changes | Pass: ADR 0075 (supersedes the not-stored part of 0073) |
| Patch releases only (fork policy) | Pass: 2.59.7 |

Re-check after design: no new violation.

## Project Structure

### Documentation (this feature)

```text
specs/042-reactive-resume-setting/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── routes.md
└── tasks.md            # speckit-tasks
```

### Source Code (repository root)

```text
prisma/schema.prisma                                  # model ReactiveResumeConnection + User back-relation
prisma/migrations/20261015120000_reactive_resume_connection/migration.sql
src/resume/reactive-connection.ts                     # pure: cleanKey, MAX_KEY_CHARS, ConnectionView, viewOf
src/resume/reactive-connection.test.ts
src/resume/reactive-connection-store.ts               # ONLY file touching the table; readInstanceKey is the key's one accessor
src/resume/reactive-connection-access.test.ts         # closed list of files that may name the key accessor / table; select present; view has no key
src/web/pull-stash.ts                                 # Pull = { userId, ids, target }; no base, no key
src/web/pull-stash.test.ts
src/web/routes/reactive-resume.ts                    # POST /settings/reactive-resume (save), /settings/reactive-resume/remove
src/web/routes/resumes.tsx                            # list (new + per-resume), import (target-aware); extract saveNewVersion shared with /replace
src/web/pages/reactive-card.tsx                       # Settings card body
src/web/pages/settings.tsx + routes/settings.tsx      # section next to Gmail, view passed in
src/web/pages/resumes.tsx                             # typed form → List button / Settings pointer; pick page takes target
src/web/pages/resume-detail.tsx                       # "From Reactive Resume" part of the new-version card
src/users/admin-policy.ts                             # three routes in PERSONAL_ROUTES
src/web/app.ts                                        # mount the new route
src/scripts/route-smoke.ts                            # save / list / version / remove steps
src/i18n/catalog/{en,es,fr,uk}.json                   # new keys; #39's typed-form keys that go unused removed
docs/adr/0075-*.md  docs/where-to-look.md  CLAUDE.md (secrets carve-out + bullet)  CHANGELOG.md  package.json (2.59.7)
```

**Structure Decision**: single project, the Gmail card's shape (store + pure view + card + personal routes). The list/import routes stay in `resumes.tsx` because they end in the resume flows; the setting's own routes get their own file so `resumes.tsx` (already large) does not grow a second concern.

## Complexity Tracking

| Departure | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Storing a secret | "Set once" cannot work without it | Re-asking each time is the problem being solved; encrypting at rest adds key management the install has no home for (Gmail's token sets the precedent) |
