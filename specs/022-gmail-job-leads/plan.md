# Implementation Plan: Gmail Job Leads

**Branch**: `issue-22-gmail-job-leads` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-gmail-job-leads/spec.md` (issue #22)

## Summary

Each person connects their own Gmail (Google OAuth, `gmail.readonly`, authorization code + PKCE + state). A per-person worker job reads mails under their chosen label (default "Job Leads"), asks a fenced, tool-free AI call for the listings each mail contains, and feeds them as `NormalizedJob[]` through `processNormalizedJobs` with `ownerId` set, under a hidden per-person `GMAIL` source row. Nothing is fetched from any link. Design record: ADR 0071. Decisions and rejected alternatives: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: none new. `openid-client` (already present, ADR 0064) supplies PKCE/state helpers; Google's token, revoke and Gmail REST endpoints are called with native `fetch` through `fetchWithRetry`; `zod` for every external payload and the model reply.

**Storage**: Postgres via Prisma. New `GmailConnection` and `GmailMessage` tables, `AtsType.GMAIL`, hand-written migration (`prisma migrate diff` must be clean). See [data-model.md](./data-model.md).

**Testing**: Node built-in runner. Pure modules tested with hand-written, redacted fixtures shaped like the documented Gmail API responses. I/O modules are not unit-tested; the job is exercised through injected IO. Route smoke covers the card in the "not configured" state and a refused cross-origin POST.

**Target Platform**: `npm start` (launcher) and Docker, identical. Web (Hono) owns connect/disconnect/label/check-now request; worker owns every read. The worker never serves HTTP.

**Project Type**: existing two-process service (cron worker + Hono dashboard).

**Performance Goals**: a check handles at most `MAX_MAILS_PER_RUN` (20) mails and `MAX_LISTINGS_PER_MAIL` (30) listings; no mail is paid for twice.

**Constraints**: read-only scope; token never rendered/logged; no request to any link in a mail (ADR 0005); mail bodies not persisted; per-person isolation; respects fetch pause and the fetch lock.

**Scale/Scope**: a handful of people per install, one account and one label each.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no project-specific constitutional gates. The binding rules are the repo's `CLAUDE.md`, checked here:

| Rule | Status |
| --- | --- |
| Named exports only; pure logic separate from I/O | `src/gmail/*` pure; `google-io.ts` and `store.ts` isolate side effects |
| zod for all external data (env, API, model output) | env in `config.ts`; Google replies and model reply parsed with zod |
| Native fetch + AbortController (`fetchWithRetry`) | yes; no Google SDK |
| pino only; no `console.log` | yes |
| Secrets only where carved out | **New carve-out**: the refresh token in `GmailConnection` (accessor-only), recorded in ADR 0071 and the CLAUDE.md DO NOT list |
| Worker runs no HTTP server | OAuth redirect and callback live in the dashboard |
| Every AI builder fenced; registry derived | `buildGmailExtractPrompt` fences mail text; added to `prompt-fence-registry.test.ts` |
| AI label in `ai-usage.ts` set | `gmail-extract` added (+ `ai-tasks.ts`, spend label key) |
| i18n key per sentence in every catalog | `en/es/fr/uk` updated together |
| ADR for architecture/schema/dependency changes | ADR 0071 |
| `exports:audit`, `env-example.test.ts`, route smoke | planned, see tasks |
| No LinkedIn/Indeed scraping (ADR 0005) | reading the person's own mail is not scraping; no link followed |

Re-checked after design: no violations; one deliberate secret carve-out documented.

## Project Structure

### Documentation (this feature)

```text
specs/022-gmail-job-leads/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── web-routes.md
│   └── google-and-model.md
├── checklists/requirements.md
└── tasks.md            # speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # GmailConnection, GmailMessage, AtsType.GMAIL, User.gmailConnection
└── migrations/20261014120000_gmail_job_leads/migration.sql

src/gmail/                              # pure, tested
├── settings.ts   # label default/validation, GoogleSettings from env (zod), redirect URI
├── pending.ts    # in-memory connect state: state+verifier+userId, TTL, single use
├── query.ts      # window start, Gmail search params, which message ids to take
├── message.ts    # messages.get payload -> {subject, from, date, text, links}; MIME walk, base64url, stripHtml
├── listing.ts    # zod listing schema, parse model reply, caps, in-mail dedupe
├── prompt.ts     # buildGmailExtractPrompt (fence)
├── map.ts        # listing -> NormalizedJob (externalId, employer, postedAt)
└── status.ts     # error kinds -> status codes -> card words

src/gmail/google-io.ts   # the ONLY file that talks to Google (token, refresh, revoke, labels, messages); fetch injected
src/gmail/store.ts       # the ONLY file that touches gmail_connection / gmail_message and the GMAIL Company row
src/jobs/gmail-job.ts    # runGmailJob(userId): lock, pause, read, extract, processNormalizedJobs(ownerId)
src/jobs/gmail-live.ts   # the real Google, store, model and pipeline behind runGmailJob
src/jobs/gmail-tick.ts   # runForUsers over connected people (hourly) or those who asked (every minute); takes the fetch lock once
src/index.ts             # wire the tick (hourly beat) and the minute heartbeat for queued checks

src/web/routes/gmail.ts      # /gmail/connect, /gmail/callback, POST /gmail/label, /gmail/check, /gmail/disconnect (deps injected)
src/web/gmail-live.ts        # the routes wired to the real Google, store and current user
src/web/pages/gmail-card.tsx # the card, on Settings -> Job search (profile tab)
src/web/pages/settings.tsx   # mounts the card
src/web/source-groups.ts, source-names.ts, fetchers/source-health.ts, fetchers/index.ts  # GMAIL treated like IMPORT (hidden, not fetched)

src/config.ts, .env.example            # GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (the redirect URI derives from WEB_PUBLIC_URL, else localhost:WEB_PORT)
src/ai-usage.ts, ai-tasks.ts, ai-spend.ts, i18n/catalog/{en,es,fr,uk}.json
src/prompt-fence-registry.test.ts
src/scripts/route-smoke.ts, src/scripts/gmail-once.ts
docs/adr/0071-*.md, docs/where-to-look.md, ARCHITECTURE.md, CLAUDE.md, docs/gmail-setup.md
```

**Structure Decision**: follow the established split: pure module directory + single I/O file + single Prisma file + job + route + card. No new process, queue or dependency.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| New secret carve-out (refresh token in DB) | A background reader needs the token without the person present | Asking per check defeats the feature; the repo already stores `botToken`/`aiKeys` this way |
| AI extraction per mail | Senders differ and change layouts; "others" is open-ended | Per-site parsers are brittle, need real samples per sender, and cover only named sites |
| Hidden `GMAIL` Company row per person | `Job.companyId` is required and de-dup/listing hang off it | A nullable company would touch every query; `IMPORT` already proves the pattern |
| Queued Check-now (column the worker polls) | Scoring runs only in the worker | Running AI in the web process breaks the lane split |
