# Research: Local engine address that resolves to a local machine

Facts checked in the worktree before planning (2026-10-14).

## D1 — Where "local" is decided today, and who depends on it

`isLocalUrl` (`ai-usage.ts`) is called from: `billingOf` (openai_api cost "local" vs "billed"), `checkOpenAiBaseUrl` (plain http only if local), `ai-runtime.ts` (`getAiEngineEnv` → `openAiLocal`; the openai_api probe path), `settings.tsx` (two places), `welcome.tsx`. `aiCrawlerTokens` does not call it: it reads the `openAiLocal` flag that `getAiEngineEnv` computes from it (`ai-engine.ts`, `ai-runtime.ts:46`).

**Decision**: widen the range in the one shared function and let every caller follow. Splitting a "local engine" range from a "LAN server" range would make a Tailscale host "local" for one engine and "billed" for the other.
**Alternative rejected**: a separate CGNAT rule only in the new check — leaves `http://100.x` refused for LM Studio and its cost "billed".

## D2 — Why the lookup cannot live in `ai-usage.ts`

The file's header says "Pure"; the worker and the dashboard both import it. A `node:dns` import there breaks the contract the module states, and a test of `checkLocalAiUrl` would need the network.

**Decision**: new `src/local-ai-url.ts` with the resolver as an argument, default `lookupAddresses` from `jobs/posting-url.ts` (the same `dns.lookup(host, { all: true })` the SSRF guard uses).
**Alternative rejected**: a second `dns` call written in the new file — two resolvers to keep in step.

## D3 — The lookup has no timeout of its own

`dns.lookup` waits on the system resolver, which can take many seconds on a broken network, and the route awaits it inside a form post. The model-list calls elsewhere carry timeouts (`server-models.ts`, `LOCAL_LIST_TIMEOUT_MS`).

**Decision**: race the resolver against a named constant (`LOOKUP_TIMEOUT_MS`, 5 s — the same as `LIST_TIMEOUT_MS`); a timeout reads as "could not be found" (FR-002). A lookup that finishes after the timeout is ignored.

## D4 — What counts as an answer

- `[]`, a rejection (`ENOTFOUND`), or a timeout → refused with the new `engine.url.noHost`.
- Every address through `isLocalHost`. An IPv4-mapped IPv6 answer (`::ffff:10.0.0.1`) is treated as not local: the IPv6 branch accepts only `::1`, `fe80…`, `fc…`, `fd…`. This is the stricter side and stays so; `posting-url.ts` handles mapped forms for the opposite purpose.
- A name local by its text (`localhost`, `*.local`, `*.localhost`, `host.docker.internal`, an in-range IP literal) is not looked up. That is today's behavior and keeps `localhost` working offline.

## D5 — `npm run exports:audit`

The audit (`src/scripts/dead-exports.ts`) fails on an export used only inside its own file. `lookupAddresses` (newly exported) is read by `local-ai-url.ts`; `isLocalHost` and `cleanServerUrl` are read by `local-ai-url.ts`; `checkLocalAiUrl` by the two routes. None is tests-only or file-local. `Resolver` is a type (types are not audited).

## D6 — i18n and the smoke

`catalog.test.ts` requires every key in `en.json` in every language with the same arguments; a key missing in one fails CI. New key: `engine.url.noHost` ("That name could not be found — check the address and that the server is on this network", no arguments, translated). The route smoke's pseudo-language pass fails on English outside the catalog, so the message is worded through `t()` and not hard-coded. The smoke's `POST /settings/ai/local` and `/welcome/ai/local` use `http://127.0.0.1:9`, local by text, so they never reach the resolver.

## D7 — Docs that name the check

`docs/adr/0057-…md` line 39 and `docs/where-to-look.md` (the local-engine row) say `ai-usage.ts:checkLocalAiUrl`; `src/ai-engine.ts` carries the same pointer in a comment. All three move to `local-ai-url.ts:checkLocalAiUrl`. ADR 0057 gets a dated addendum recording: save-time lookup, every-address rule, the 100.64/10 widening and its reach, and the limits (rebinding, `OLLAMA_URL`).

## D8 — What is deliberately not done

- No lookup of `OLLAMA_URL` (it is the operator's own `.env`, trusted like the rest of it).
- No change to `server-models.ts`'s scan hosts.
- No pinning of the resolved address to the later request (needs a custom dispatcher; same residual as `posting-url.ts`).
