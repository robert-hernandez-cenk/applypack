# Research: Keep profile and page links when importing from Reactive Resume

All unknowns in the plan's Technical Context are resolved here; none remain.

## R1 — Where a profile's address lives, per generation

**Decision**: keep `websiteOf(item)` as the one reader: `item.website` or `item.url`, each either a string or `{ url }` / `{ href }`. No new key is read.

**Rationale**: it already covers v6 (`website.url`), v5 (`website.url`) and v4 (`url.href`), and it is what `contactLine` uses for the person's own website. The fixtures and the published schema agree. The fixtures are hand-written, **not** checked against a real export (`fixtures/reactive-resume/README.md`), and the v4 fixture has no profile at all; this feature adds one per generation.

**Alternatives considered**: reading `network`-specific keys or building the address from `network` + `username` (`https://github.com/<user>`). Rejected: it invents an address the person never wrote, and the network list is open-ended.

**Risk**: if a real export keeps the address somewhere `websiteOf` does not look, the fix would still lose it. Mitigation: the verification step asks the owner to import their real export once; a miss becomes a new fixture and a one-line change to `websiteOf`.

## R2 — Header placement and the separator

**Decision**: `contactLine` appends one entry per visible profile after email, phone, place, website and custom fields, joined with ` · `, de-duplicated by exact text. A profile with an address contributes the bare address; a username-only profile contributes `Network: username`; a profile with neither a network, a username nor an address contributes nothing.

**Rationale**: `structure-from-text.ts` splits the header on `·` (`SEPARATORS`) and files a URL into `basics.url` / `basics.profiles` (`readContactPart`), so bare addresses are read the way a hand-written header is. `pdf-layout.ts`'s contact test already treats `linkedin` / `github` as contact. A `Network: username` part is not a URL, so the structure step keeps it as an unread header line (`basics.lines`), the same place any other non-URL header part goes. That is accepted: it is no worse than today, where the text sat in a late section.

**Alternatives considered**: keep a `## Profiles` section and also add the header (rejected: the address would appear twice, FR-005/FR-006); write `Network: address` (rejected: the structure step expects a bare address, and the network is readable from the address).

## R3 — Removing `## Profiles`

**Decision**: drop the `profiles` entry from `SECTIONS` and the `profile()` function; fold its logic into one small helper used by `contactLine`.

**Rationale**: a hidden profiles section must stay hidden, so the helper reads `sections.profiles` with the same `hidden` / `visible` checks the other sections use. Nothing else reads the `Profiles` heading (searched `src/`).

## R4 — Keeping a link's address in formatted text

**Decision**: before `stripHtml`, a linear scan rewrites each anchor: `<a … href="X" …>words</a>` becomes `words (X)`, or `X` alone when the words are empty or equal `X`. Keep `X` only when it starts with `http://`, `https://` or `mailto:` (case-insensitive, after trimming); otherwise the anchor becomes its words. `&amp;` and the other entities in `X` are left for `stripHtml`, which decodes entities first and then strips tags (gotcha 12) — the rewritten text goes through it once and is never re-run.

**Rationale**: Reactive Resume's editor writes `<a href="…">…</a>` with double-quoted attributes. The words may themselves hold tags (`<strong>`); they are kept in place and stripped by the same `stripHtml` pass.

**Alternatives considered**:
- A regex over the whole text. `src/http.ts` records that unbounded openers cost quadratic time: 300 kB of `<a ` took nine seconds (`replaceUpTo`). A bounded-quantifier regex still pays the bound at every opener; the scan below pays it once per opener with a native `indexOf` over a capped slice.
- Reusing `replaceUpTo` directly. It is private to `http.ts`, and exporting it for one caller would fail `exports:audit` unless a second use exists; the scan here is ten lines.

**Scan shape**: find `<a` followed by whitespace; look for the closing `>` of the tag and for `</a>` only inside a capped window (`LINK_WINDOW_CHARS`, named constant); on any miss, copy the opener character and move on, so every character is visited a bounded number of times. A single-quote or unquoted `href` is read as well; anything unparseable is left as its words.

## R5 — Fixtures and the existing assertions

**Decision**: add profiles to the v4, v5 and v6 fixtures (v6 already has one); add anchors to `hidden-and-html` where needed. The assertion at `reactive-resume.test.ts:55` (`GitHub: arivera`) becomes the address; the one at line 99 (`… a link\n\nLine two …`) becomes `a link (https://example.com)` because that fixture's summary already holds an anchor.

**Rationale**: both existing assertions encode the defect. Other assertions must stay green unchanged, which is SC-003.

## R6 — Release bookkeeping

**Decision**: version `2.59.8` (patch only, the owner's standing rule), a `CHANGELOG.md` entry under *Fixed*, and one addendum line to ADR 0073 saying profile addresses are written to the header and formatted-text links are kept. No new ADR: no interface, schema or dependency changes.

## R7 — Verification environment

**Decision**: run the touched tests directly (`node --import tsx --test src/resume/reactive-resume.test.ts src/resume/resume-text.test.ts`), plus `npm run lint:types` and the full `npm test`. A fresh worktree has no `.env`, so 35 files fail with "Invalid environment configuration" before any change (baseline 3531 pass / 35 fail); the plan is to compare against that baseline, not to chase it.
