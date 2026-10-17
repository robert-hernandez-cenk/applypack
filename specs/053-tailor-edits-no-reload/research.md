# Research: Keyword edits that keep your place

## What the code does today

- `LevelControls` and `AddKeywordForm` (`src/web/pages/resume-match-card.tsx`) are `<form method="post">` to
  `/jobs/:id/matches/:matchId/keywords`; the level select commits through `select-commit.mjs`
  (`data-commit="submit"` → `requestSubmit()`), and the row buttons set a hidden `op` in `onclick` before submitting.
- `routes/keywords.ts` always answers `flashRedirect(back, kind, text)`: 303, `Location: back`, a 5-second
  one-shot cookie. `back` is the page the form sat on (`/jobs/:id/target?match=…` or `/jobs/:id?match=…#resume-match`).
- `KeywordTable` is on the tailor page (inside `details.kw-fold`) and on the job's Resume match tab. Both are
  covered. (#55 removed the `/target` launcher only; `/jobs/:id/target` is the editor.)
- The tailor page's `init(data)` in `target-page.mjs` reads `data.keywords`, `data.scoring`, `data.actions`, … at
  every `render()` and never copies them at init, so replacing the properties and calling `render()` repaints the
  ring, highlights, chips and bulk list.

## Decisions

### D1 — Follow the existing redirect with `fetch`; no new server response
- **Decision**: post with `fetch`, let it follow the 303, read the returned page.
- **Rationale**: the flash cookie is set on the POST and consumed on the followed GET, so the message arrives in the
  page with no server change; the issue asked for non-fetch clients to be unchanged; one code path to test.
- **Alternatives**: a JSON/fragment response for fetch requests (a second response shape per route, drift between
  the fragment and the page); `X-Requested-With` branching in the route (same).

### D2 — Regions by id, matched between current and returned page
- **Decision**: elements marked `data-region` with an `id` are replaced as a whole.
- **Rationale**: explicit, greppable, tolerates unrelated markup changes; a missing counterpart means the page is
  not the one being edited, which is exactly when to navigate.
- **Alternatives**: swap `<main>` (would reset the live editor and everything with client state); diff the DOM
  (a dependency or a lot of code).

### D3 — Do not swap what the script holds references to
- **Decision**: the ring, `#length-meter`, the editor and the sticky bar are not regions. The ring follows `refresh()`.
- **Rationale**: `init()` captured those elements; replacing them would leave it painting detached nodes.

### D4 — Known stale-until-reload pieces
- The confirm-fact lists (`ConfirmFacts`) depend on keywords (a term the person ignores may still be asked about)
  and the Suggestions/reach block derives from the same breakdown. They hold client state or their own forms, are
  out of scope (spec FR-013) and refresh on the next load. A refused or no-op edit never changes them.

### D5 — Focus
- A swapped region loses focus. Key the control by form action + hidden `term` + control name; fall back to the first
  control of the same term, then the add field. Never leave focus on `body` at the top.

### D6 — Messages in four languages
- `browser.inline.failed` in `en/es/fr/uk` (catalog completeness test); `npm run i18n:browser` mirrors it into
  `public/i18n-en.mjs`. Server-rendered words are unchanged, so the pseudo-language pass sees nothing new.

### D7 — Release
- Patch release 2.59.16 (project rule: patch only). CHANGELOG entry under Fixed.
