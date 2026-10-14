# Quickstart: validating the local engine address check

Run from the worktree root. Tests need any `DATABASE_URL` (the unit tests are pure; `config.ts` throws without one).

## Automated

```sh
export DATABASE_URL=postgresql://x:x@localhost:5433/x
npm run lint:types
npm test
npm run exports:audit
```

Expected: no type errors; all tests pass (baseline before this change: 3795 pass, 3 skipped, 0 fail); the audit lists nothing dead or over-exported.

The new behavior is covered without a network:

- `src/local-ai-url.test.ts` — a fake resolver answers `ollama.lan` with private addresses (accepted), a mix with a public one (refused), only public (refused), `[]` / a rejection / a hang past the timeout (refused as not found); a local-by-text address never calls the resolver; `/v1` and `/api` are dropped; credentials, a bad scheme and a malformed address are refused before any lookup; plain `http://` to a resolved name is accepted.
- `src/ai-usage.test.ts` — the 100.64/10 edges (`100.63.255.255` and `100.128.0.0` are not local; `100.64.0.0` and `100.127.255.255` are) through `isLocalUrl`, `billingOf` and `checkOpenAiBaseUrl`.
- `src/ai-engine.test.ts` — an OpenAI-compatible server on a 100.64/10 address drops OpenAI's crawler tokens.
- `src/i18n/catalog.test.ts` — `engine.url.noHost` exists in all four languages.

## Route smoke (CI only, needs a throwaway database)

```sh
npm run build && npm run smoke:routes
```

The existing `POST /settings/ai/local` and `POST /welcome/ai/local` steps use `http://127.0.0.1:9` and must still pass, including in the pseudo-language pass.

## Not verifiable here

A real name on a real network resolving through the operating system's resolver. The resolver is injected in every test; the default (`lookupAddresses`) is the one `jobs/posting-url.ts` already runs in production for the posting guard.
