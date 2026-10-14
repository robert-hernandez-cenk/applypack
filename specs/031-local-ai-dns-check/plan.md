# Implementation Plan: Local engine address that resolves to a local machine

**Branch**: `issue-31-local-ai-dns-check` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Summary

Make the local engine's Server address check look the name up. A name that is local by its text is accepted as today; any other name is resolved, and accepted only if every address it answers with is local. The "is this address local?" rule gains 100.64.0.0/10 and stays ONE function, so billing, the https-unless-local rule and the crawler tokens widen with it. The pure module (`ai-usage.ts`) keeps no I/O: the lookup lives in a new `local-ai-url.ts` that takes the resolver as an argument. No schema change, no new dependency.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (>=22)
**Primary Dependencies**: none new — `node:dns/promises` through the resolver `jobs/posting-url.ts` already owns
**Storage**: unchanged (`AppSettings.localAiUrl` holds the checked root)
**Testing**: `node --test` over `src/**/*.test.ts` with `DATABASE_URL` set to any value (`config.ts` throws without it); `npm run lint:types`; `npm run exports:audit`; the route smoke covers the two POST routes with an address that is local by text
**Target Platform**: the dashboard (web) — the worker does not save addresses
**Project Type**: web dashboard + cron worker (separate processes)
**Performance Goals**: no lookup for a local-by-text address; one lookup, bounded by a timeout, for any other name
**Constraints**: CLAUDE.md — `ai-usage.ts` stays pure; named exports; no magic numbers (the timeout is a constant); a string a person reads is a catalog key in all four languages in the same PR; example hosts only
**Scale/Scope**: one function, two route call sites, one catalog key × 4, three doc lines

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template: no gates from it. The repo's `CLAUDE.md` rules apply and the plan honours them: pure module stays pure and the I/O module takes its resolver injected (tested on fakes, no network); `where-to-look.md` and ADR 0057 updated in the same PR; new catalog key ships with its line in `es`, `fr`, `uk`; `exports:audit` clean (see research.md D5).

## Project Structure

### Documentation (this feature)

```text
specs/031-local-ai-dns-check/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md   # next stage
```

No `data-model.md` (nothing is stored beyond the existing `localAiUrl`) and no `contracts/` (no new endpoint or schema: the two existing form posts keep their shape).

### Source Code

```text
src/ai-usage.ts                      # + isLocalHost (the range rule, + 100.64/10), cleanServerUrl;
                                     #   isLocalUrl delegates; checkOpenAiBaseUrl uses cleanServerUrl;
                                     #   checkLocalAiUrl leaves
src/local-ai-url.ts                  # NEW — async checkLocalAiUrl(input, resolve = lookupAddresses)
src/jobs/posting-url.ts              # lookupAddresses exported (was module-private)
src/web/routes/settings.tsx          # POST /settings/ai/local awaits the new check
src/web/routes/welcome.tsx           # POST /welcome/ai/local awaits it; isLocalUrl re-check only for openai_api
src/ai-engine.ts                     # comment: where the local address is checked
src/i18n/catalog/{en,es,fr,uk}.json  # + engine.url.noHost
src/local-ai-url.test.ts             # NEW — fake resolver
src/ai-usage.test.ts                 # CGNAT boundaries; checkLocalAiUrl cases move out
src/ai-engine.test.ts                # aiCrawlerTokens keeps OpenAI's tokens off for a 100.64/10 server
docs/adr/0057-…md                    # addendum + the moved reference
docs/where-to-look.md                # the checkLocalAiUrl pointer
```

**Structure Decision**: the single existing `src/` tree. The new file is a sibling of `ai-usage.ts` because it is that module's one impure half; putting the lookup inside `ai-usage.ts` would end its "pure" contract (ADR 0055 header) and make the worker's import of it pull in `node:dns`.

## Design

1. **One range rule.** `isLocalHost(hostname)` is today's body of `isLocalUrl` after the URL parse, plus `a === 100 && b >= 64 && b <= 127`. `isLocalUrl(url)` parses and delegates, so every existing caller (`billingOf`, `checkOpenAiBaseUrl`, `ai-runtime.ts` ×2, `settings.tsx` ×2, `welcome.tsx`) widens by construction.
2. **One cleanup.** `cleanServerUrl(input)` is the parse/scheme/credentials/trailing-slash half of today's `checkOpenAiBaseUrl`; that function then only adds the https-unless-local rule. The local check reuses the cleanup so its refusals are word-for-word the existing ones.
3. **The lookup.** `checkLocalAiUrl(input, resolve)`: clean → if the host is not local by text, resolve (bounded by `LOOKUP_TIMEOUT_MS`), refuse an empty/failed/timed-out answer with `engine.url.noHost`, refuse any non-local address with the existing `engine.url.notLocal` → drop a trailing `/v1` or `/api`. Plain `http://` to a resolved name is allowed because locality was proven; `https://` to a name resolving locally is allowed too.
4. **Callers.** Both await. In `welcome.tsx` the post-check `isLocalUrl(checked.url)` applies only when the engine is `openai_api`; for `local_api` the new check is the proof.

## Verification plan

- Unit: the fake-resolver matrix of spec User Story 1 and the edge cases; CGNAT boundaries (`100.63.255.255` no, `100.64.0.0` yes, `100.127.255.255` yes, `100.128.0.0` no) through `isLocalUrl`, `billingOf` and `checkOpenAiBaseUrl`; `aiCrawlerTokens` for a 100.64/10 OpenAI-compatible server.
- Gates: `npm run lint:types`, full `npm test`, `npm run exports:audit`.
- Route smoke: unchanged posts use `http://127.0.0.1:9`, local by text, so they need no DNS (CI-only: needs a database).
- Manual: not possible without a network name to resolve; covered by the fake resolver, and listed as unverified live in the PR body.

## Complexity Tracking

No violations.
