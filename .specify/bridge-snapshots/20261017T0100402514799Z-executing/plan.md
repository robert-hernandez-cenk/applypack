# Implementation Plan: Write Tailored Edits Back to Reactive Resume

**Branch**: `issue-50-reactive-resume-writeback` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-reactive-resume-writeback/spec.md`

## Summary

A resume imported from Reactive Resume (RR) remembers its source (`remoteId`, `remoteGeneration`). From a tailored
copy, one button creates a **new** RR resume: the source is fetched afresh and re-read with a line→field
provenance map, refused if its text no longer equals the stored text, duplicated on the instance
(`POST /resumes/{id}/duplicate`), and the person's edits are applied to the clone as JSON Patch
(`PATCH /resumes/{id}`). Only field-level text is changed; layout, design and every untouched field stay because
the clone's own data is edited. Edits that cannot be placed are reported per edit, never guessed. The raw JSON is
never stored. Technical approach and decisions: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: existing only — Hono (JSX), Prisma 6, zod, pino, native fetch. No new package. Line diff
through the existing `resume/line-diff.ts` (`diffLines`).

**Storage**: Postgres 16 via Prisma — two nullable columns on `Resume` (`remoteId`, `remoteGeneration`), one
migration checked with `prisma migrate diff`.

**Testing**: `node --test` on pure modules (`reactive-resume.test.ts`, new `reactive-resume-apply.test.ts`,
`reactive-resume-api.test.ts` with an injected `fetch`), a redacted live v6 fixture, the secret-access closed-list
test, i18n catalog test, route smoke (`npm run smoke:routes`) on a throwaway database. Modules that import Prisma are
verified by smoke and the live roundtrip, as the project rules say.

**Target Platform**: the dashboard (Hono) service; the worker never imports any of this.

**Project Type**: web service (existing dashboard).

**Performance Goals**: a send is four requests (GET source, POST duplicate, GET clone, PATCH) with the existing 10 s
per-request limit; the whole action well under a minute.

**Constraints**: API key only as `x-api-key`, never logged/rendered; no redirect followed; 5 MB body cap; mutations
never retried after a timeout (the instance's own guidance); only the verified generation (v6) is written; one
file (`reactive-resume-api.ts`) calls the instance; one accessor (`readInstanceKey`) reads the key.

**Scale/Scope**: one person's resume (tens of KB); a handful of edits per send.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template — no project principles to gate against. The binding
rules are `CLAUDE.md`'s; each is checked here:

| Rule | How the plan meets it |
| --- | --- |
| Pure modules tested, I/O isolated | `reactive-resume.ts` (provenance) and new `reactive-resume-apply.ts` are pure; only `reactive-resume-api.ts` calls the instance; only `resume/store.ts` touches `resume` |
| zod for external data | the instance's responses (`id` string, patched resume) parsed with zod in the client |
| Typed errors, caller logs | `InstanceError` gains codes (`locked`, `conflict`, `badPatch`); the route decides logging |
| Key never rendered/logged; closed list | no new file names the key accessor except the route that already may (`web/routes/resumes.tsx`); the secret-access list changes only if a new route file is used (then added with its reason) |
| i18n: every string in every catalog, same PR | new keys in `en/es/fr/uk`; reasons through functions of a code, not stored words; link flashes via `tRich` |
| Route lists | the new POST goes in exactly one list (`PERSONAL_ROUTES`) in `users/admin-policy.ts` |
| `exports:audit` | no dead/over-exported symbol |
| Migration vs schema | `prisma migrate diff` clean (CI gate) |
| Patch release only | `2.59.12` → `2.59.13`, CHANGELOG, ADR 0079 |

No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/050-reactive-resume-writeback/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── instance-api.md      # the calls made to the Reactive Resume instance
│   └── web-route.md         # the dashboard route + page contract
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # Resume.remoteId, Resume.remoteGeneration
└── migrations/20261017000000_resume_remote_origin/migration.sql

src/resume/
├── reactive-resume.ts                    # + readReactiveResumeMapped(): same markdown, plus per-line source
├── reactive-resume-apply.ts              # NEW, pure: planWriteBack(json, mapped, masterText, copyText) → ops + per-edit report
├── reactive-resume-api.ts                # + duplicateInstanceResume, patchInstanceResume; getInstanceResume also returns updatedAt/locked
├── reactive-resume-writeback.ts          # NEW: orchestrates fetch → verify → plan → duplicate → patch (I/O injected for tests)
├── store.ts                              # createResume / replaceResumeFile accept the origin; ResumeSummary exposes it
└── fixtures/reactive-resume-v6.json      # NEW: redacted live v6 response (same shape)

src/web/
├── routes/resumes.tsx                    # import records the origin; POST /tailored/:id/reactive-send
├── pages/resume-detail.tsx               # button + origin line on TailoredCard
├── pages/target.tsx                      # button beside the copy's download
└── reactive-failures.ts                  # + write failure words

src/i18n/catalog/{en,es,fr,uk}.json       # new keys
src/users/admin-policy.ts                 # route listed as personal
docs/adr/0079-reactive-resume-write-back.md
docs/where-to-look.md, ARCHITECTURE.md, SPEC.md, CLAUDE.md   # rows/lines for the new module
CHANGELOG.md, package.json, package-lock.json                 # 2.59.13
```

**Structure Decision**: extend the existing `src/resume/reactive-*` family. The plan/apply logic is pure and in its
own file; the orchestration takes its I/O as arguments (like `jobs/gmail-job.ts`), so it is tested with fakes and the
route stays thin.

## Phases

- **Phase 0 — research.md**: endpoints confirmed (public v6.0.3 spec + live read-only probe); mapping strategy;
  what is stored; failure model; unresolved items: none.
- **Phase 1 — data-model.md, contracts/, quickstart.md**: written alongside this plan.
- **Live gate (verification stage)**: duplicate → patch → verify → trash of a clearly named test resume on the
  person's instance, with their permission; recorded in the PR. See quickstart.

## Post-design Constitution Check

Unchanged: no new dependency, no new process, no new secret location, no worker import.
