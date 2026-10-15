# Quickstart: validating the page target (#38)

Prerequisites: dependencies installed in the worktree; `npm run lint:types && npm test` green.

## 1. Pure and mirror checks (no AI, no database)
```
npm --prefix <wt> test -- src/resume/length.test.ts src/web/length.test.ts src/resume/match-mode.test.ts src/resume/match-reuse.test.ts src/resume/prompts.test.ts
```
Expect: estimate and overshoot cases; browser mirror equals the TypeScript module on the same inputs; a stored row with no marker reads `keep`; a `keep` request does not reuse a `2` row and the reverse; `buildMatchPrompt`/`buildSuggestionsPrompt` output for `keep` is identical to a pinned snapshot, and for `2` contains the LENGTH TARGET block with the overshoot and the raised cap.

## 2. Full suite and CI gates
```
npm --prefix <wt> run lint:types && npm --prefix <wt> test && npm --prefix <wt> run exports:audit
```
Includes the i18n catalog test (every new key in every language) and `docs-paths.test.ts`.

## 3. Route smoke (throwaway database only, per CLAUDE.md)
`npm run build && npm run smoke:routes` — `/target` renders with the Length control, and the pseudo-language pass finds no English outside the catalog.

## 4. Manual, with a live engine
1. `/target`: paste a posting, choose a resume of ≥ 3 pages, Length = 2 pages, Compare.
2. Open the result: suggestions include removals and condensed rewrites; the meter reads e.g. `≈ 3.4 of 2 pages`.
3. Apply all (include removals): the meter falls and reads met at or under 2.
4. Repeat with Keep as is: no meter target, suggestions as before.
5. Check no strike-through touches the contact line or a wanted keyword.

Unverifiable without the user's engine and resume: SC-001 (typical-case outcome). Report it as such.
