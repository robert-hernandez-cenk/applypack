# Tasks: Local engine address that resolves to a local machine

**Input**: `specs/031-local-ai-dns-check/` — plan.md, spec.md, research.md, quickstart.md

**Tests**: Requested (TDD per the plan): each story's pure behavior is tested first, on a fake resolver, no network. The two routes import Prisma and are covered by the route smoke (CI), not by unit tests.

**Format**: `[ID] [P?] [Story] Description` — repo root is the worktree `C:\Users\rcher\Dev\applypack-Worktrees\issue-31-local-ai-dns-check`. Test commands need `DATABASE_URL` set to any value (`export DATABASE_URL=postgresql://x:x@localhost:5433/x`).

## Phase 1: Setup

- [x] T001 Confirm the baseline: `npm run lint:types` and `npm test` pass on the untouched branch (recorded at worktree creation: 3795 pass, 3 skipped, 0 fail with `DATABASE_URL` set)

## Phase 2: Foundational — one range rule, one cleanup (behavior-preserving)

**Purpose**: the shared pieces every story builds on. No behavior changes here: the existing `src/ai-usage.test.ts` and `src/ai-engine.test.ts` must pass unchanged.

- [x] T002 In `src/ai-usage.ts` extract `export function isLocalHost(hostname: string): boolean` — the body of today's `isLocalUrl` after the URL parse (lowercase, strip `[`/`]`, then `localhost` / `*.localhost` / `*.local` / `host.docker.internal`, the IPv6 branch `::1` or `^(fe80|fc|fd)`, the four-octet IPv4 ranges 127/8, 10/8, 192.168/16, 172.16/12); make `isLocalUrl(url)` parse the URL (false on a throw) and return `isLocalHost(new URL(url).hostname)`
- [x] T003 In `src/ai-usage.ts` add `export function cleanServerUrl(input: string)` returning `{ ok: true; url } | { ok: false; reason }` — the parse / scheme (`engine.url.scheme`) / credentials (`engine.url.noKey`) / `${origin}${pathname minus trailing slashes}` half of today's `checkOpenAiBaseUrl`; make `checkOpenAiBaseUrl` call it and add only the `engine.url.https` rule (an `http:` address that is not `isLocalUrl`). Leave `checkLocalAiUrl` where it is for now (it still calls `checkOpenAiBaseUrl`); US2 removes it
- [x] T004 Run `npm run lint:types && npm test`: all green with no test edited

**Checkpoint**: tree green, no behavior changed; commit `Share the local-address rule and the server-address cleanup (#31)`.

---

## Phase 3: User Story 1 - Use a model server by its network name (Priority: P1) 🎯 MVP

**Goal**: an async `checkLocalAiUrl(input, resolve)` that accepts a name only when every address it resolves to is local.

**Independent Test**: on a fake resolver, `ollama.lan` → private addresses is accepted over plain http; a public or mixed answer, an empty answer, a rejection and a hang are refused; a local-by-text address never calls the resolver.

### Tests first

- [ ] T005 [US1] Create `src/local-ai-url.test.ts` (it FAILS first — the module does not exist) with a `fake(answers)` resolver that records the hosts it was asked. Cases: `http://ollama.lan:11434` → `['192.168.1.20']` accepted and returned as `http://ollama.lan:11434`; `https://ollama.home` → `['10.0.0.5','fd12::1']` accepted; mixed `['192.168.1.20','93.184.216.34']` refused with `engine.url.notLocal`'s text; only `['93.184.216.34']` refused (same text); `https://ollama.example.com` → public refused; `[]` refused with `engine.url.noHost`'s text; a resolver that rejects refused with the `noHost` text; a resolver that never settles refused with the `noHost` text after `LOOKUP_TIMEOUT_MS` (use `mock.timers` or a tiny `timeoutMs` argument — pick whichever the file's neighbours use, and say which in a comment); local-by-text inputs (`http://127.0.0.1:11434`, `http://localhost:11434`, `http://host.docker.internal:11434/api`, `http://ollama.local:11434`) accepted with the resolver NEVER called; a pasted `/v1/` or `/api` is dropped from the returned url; `localhost:11434` (no scheme), `ftp://x`, `http://user:pw@ollama.lan` refused with their existing texts and the resolver NEVER called; an IPv4-mapped answer `['::ffff:10.0.0.5']` is refused (research D4)
- [ ] T006 [US1] Move the "the local engine's address is Ollama's root, on this machine or the user's network" test (the four `checkLocalAiUrl` asserts) out of `src/ai-usage.test.ts` into T005's file as synchronous-looking cases on `await`; delete the now-unused `checkLocalAiUrl` import from `src/ai-usage.test.ts`

### Implementation

- [ ] T007 [P] [US1] Add `engine.url.noHost` to `src/i18n/catalog/en.json` right after `engine.url.notLocal`: `"That name could not be found — check the address, and that the server is on this network."` (no arguments)
- [ ] T008 [P] [US1] Add the same key in the same position to `src/i18n/catalog/es.json` (`"No se encontró ese nombre: revisa la dirección y que el servidor esté en tu red."`), `fr.json` (`"Ce nom est introuvable — vérifiez l'adresse et que le serveur est sur votre réseau."`) and `uk.json` (`"Такого імені не знайдено — перевірте адресу й те, що сервер у вашій мережі."`)
- [ ] T009 [US1] In `src/jobs/posting-url.ts` change `const lookupAddresses: Resolver` to `export const lookupAddresses: Resolver` (nothing else in the file changes)
- [ ] T010 [US1] Create `src/local-ai-url.ts`: `const LOOKUP_TIMEOUT_MS = 5_000` (named, with a one-line why); `export async function checkLocalAiUrl(input: string, resolve: Resolver = lookupAddresses): Promise<{ ok: true; url: string } | { ok: false; reason: string }>` — `cleanServerUrl(input)` (return its refusal as is) → if `!isLocalHost(new URL(url).hostname)`: resolve the hostname (brackets stripped) raced against the timeout, catching a rejection, `[]` → `{ ok: false, reason: t('engine.url.noHost') }`; any address failing `isLocalHost` → `t('engine.url.notLocal')` → return `url.replace(/\/(v1|api)$/, '')`. Header comment states the rule (every address), that it is judged at save time only, and the DNS-rebinding residual by pointing at `jobs/posting-url.ts`. Make T005/T006 pass
- [ ] T011 [US1] Run `npm run lint:types && npm test` (the routes still import the OLD `checkLocalAiUrl` from `ai-usage.ts`, so the tree stays green; T012–T013 switch them)

**Checkpoint**: the new function works on fakes; commit `Resolve a hostname before calling it local (#31, US1)`.

---

## Phase 4: User Story 2 - Both places that save the address agree (Priority: P2)

**Goal**: `/settings` and the welcome wizard use the new check; the old sync one is gone.

**Independent Test**: both routes `await` the same function; the wizard's OpenAI-compatible path still requires a local address by its text; the route smoke's `http://127.0.0.1:9` posts still pass.

- [ ] T012 [US2] In `src/web/routes/settings.tsx` replace the `checkLocalAiUrl` import from `../../ai-usage` with one from `../../local-ai-url` (keep `billingOf`, `checkOpenAiBaseUrl`, `isLocalUrl`, `type AiBilling` from `../../ai-usage`) and `await` it in `POST /settings/ai/local`
- [ ] T013 [US2] In `src/web/routes/welcome.tsx` import `checkLocalAiUrl` from `../../local-ai-url` (keep `checkOpenAiBaseUrl`, `isLocalUrl` from `../../ai-usage`); in `POST /welcome/ai/local` read `base` once, `await checkLocalAiUrl(base)` for `local_api` and `checkOpenAiBaseUrl(base)` otherwise, and apply `!isLocalUrl(checked.url)` ONLY for `openai_api` (a comment says why: for `local_api` the check already proved the server local, possibly through a name)
- [ ] T014 [US2] Delete `checkLocalAiUrl` (and its doc comment) from `src/ai-usage.ts`; grep `src/` for any remaining import of it from `ai-usage` and fix; run `npm run lint:types && npm run exports:audit`

**Checkpoint**: green; `lookupAddresses`, `isLocalHost`, `cleanServerUrl` all read outside their file (audit passes); commit `Save the local engine's address through the lookup (#31, US2)`.

---

## Phase 5: User Story 3 - The wider "local" range is applied the same everywhere (Priority: P3)

**Goal**: 100.64.0.0/10 counts as local for every use of the shared rule.

**Independent Test**: `100.64.0.0` and `100.127.255.255` are local; `100.63.255.255` and `100.128.0.0` are not — through `isLocalUrl`, `billingOf`, `checkOpenAiBaseUrl` and the crawler-token flag.

### Tests first

- [ ] T015 [US3] In `src/ai-usage.test.ts` extend the "a local server is this machine or a private network" test: `http://100.64.0.0/v1`, `http://100.100.1.5:11434`, `http://100.127.255.255` local; `http://100.63.255.255`, `http://100.128.0.0` not local. Add `billingOf('openai_api', { openAiBaseUrl: 'http://100.100.1.5:1234/v1', geminiKey: false })` → `'local'` and the `http://100.128.0.1/v1` twin → `'billed'`. In the `checkOpenAiBaseUrl` test: `http://100.100.1.5:1234/v1` is accepted, `http://100.128.0.1/v1` refused with the https text. Run: these FAIL first
- [ ] T016 [US3] In `src/ai-engine.test.ts` next to the existing OpenAI-compatible-server crawler-token cases, add one whose `openAiLocal` flag is built the way `ai-runtime.ts:getAiEngineEnv` builds it — `isLocalUrl('http://100.100.1.5:1234/v1')` — asserting `aiCrawlerTokens` then drops `gptbot`, and the `http://100.128.0.1/v1` twin keeps it (mirror the neighbours' fixture shape; `getAiEngineEnv` itself imports `config` and is not unit-tested)

### Implementation

- [ ] T017 [US3] In `src/ai-usage.ts:isLocalHost` extend the IPv4 line with `|| (a === 100 && b >= 64 && b <= 127)` and the comment "carrier-grade NAT — Tailscale and similar"; make T015/T016 pass; also add `100.64.0.0/10` to the `isLocalUrl` doc comment's list of what counts
- [ ] T018 [US3] In `src/local-ai-url.test.ts` add `['100.100.1.5']` as an accepted answer and `['100.128.0.1']` as a refused one (the range through the lookup path)

**Checkpoint**: green; commit `Count 100.64.0.0/10 as the person's own network (#31, US3)`.

---

## Phase 6: Docs and polish

- [ ] T019 [P] In `src/ai-engine.ts` change the comment pointer `(ai-usage.ts:checkLocalAiUrl)` to `(local-ai-url.ts:checkLocalAiUrl)`
- [ ] T020 [P] In `docs/where-to-look.md` change `ai-usage.ts:checkLocalAiUrl` in the local-engine row to `local-ai-url.ts:checkLocalAiUrl` and add "a name is resolved first: every address must be local" to that row; add one row for "what counts as a local address" → `ai-usage.ts:isLocalHost` / `isLocalUrl` (100.64/10 included) if no row names it
- [ ] T021 In `docs/adr/0057-a-local-model-is-an-engine-of-its-own.md` change the reference on line 39 to `local-ai-url.ts:checkLocalAiUrl` and append a dated addendum `**Addendum, 2026-10-14 (#31).**` recording: the address is looked up when saved (every returned address must be local; an unresolvable name is refused; a local-by-text name is not looked up), the 100.64.0.0/10 widening and its reach (`isLocalUrl` is shared, so the LM Studio http rule, its "local" cost and the crawler tokens follow), and the limits (save time only / DNS rebinding not pinned, `OLLAMA_URL` unchecked, IPv4-mapped answers refused). Wording as the file's other addenda, no real hostnames
- [ ] T022 Grep `README.md`, `SPEC.md`, `ARCHITECTURE.md`, `docs/ai-engines.md`, `docs/TASKS.md` and the catalog's `engine.url.notLocal` neighbours for prose saying the local engine only accepts addresses "on this machine or your own network" by text/IP; update any that now misdescribe the rule (a name that resolves locally counts); if `CHANGELOG.md` carries per-PR `Unreleased` entries, add one line there

## Phase 7: Verify

- [ ] T023 Run `export DATABASE_URL=postgresql://x:x@localhost:5433/x && npm run lint:types && npm test && npm run exports:audit` and keep the output; every task above is ticked
- [ ] T024 Review the whole diff (`git diff main...HEAD`): every changed line needed, nothing else touched (`server-models.ts` hosts, `OLLAMA_URL`, the route smoke); record in this file anything left unverified (the real-network lookup, the route smoke which needs a database)

---

## Dependencies

- Phase 2 → everything. US1 → US2 (the routes need the new function) → US3 is independent of US2 in code but its T018 needs US1's test file; run in order P1 → P2 → P3.
- Parallel: T007 ∥ T008; T019 ∥ T020.
- Commit points: after T004, T011, T014, T018, then docs (T019–T022), then verification (T023–T024).

## Implementation strategy

MVP is US1 + US2 (a name that resolves locally can be saved from both places). US3 ships in the same PR because the owner chose it, but it is isolated to one line in `isLocalHost` and its tests, so it can be reverted alone.
