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

## R8 — What the live instances showed (2026-10-15)

Read from the owner's ApplyPack (resume 5, 2.59.7) and the Reactive Resume resume it was pulled from, through Bellhop (read-only; the key never printed).

- **Profiles are empty; the links are contact fields.** `sections.profiles.items` is `[]`. `basics.customFields` holds `{ icon, text: "LinkedIn", link: "https://…" }` and `{ icon, text: "Github", link: "https://…" }`; `basics.website` is `{ url: "", label: "GitHub" }` (a label, no address). The importer read `text` only, so the stored header was `… · Morrisville, NC · LinkedIn · Github`. **Decision**: a custom field is written as its `link` when it has one, else its `text`. This is the cause of the owner's loss; the profile work of US1 covers the other place Reactive Resume keeps a link.
- **The stored Markdown defeats the plain reader.** On the stored text, `parsedView` returns name `null`, all four contacts `null`, and one role of six; `Robert Cenk Hernandez` and every `### Role — Company · Dates` line appear as section headings. Cause: `structure-from-text.ts` `MD_HEADING` treats any `#`-level line as a heading (it was written for `## ` from Word heading styles), and a role is read from a company line followed by a dated position line, not from a heading. **Decision**: write the dialect the reader (and an ATS that extracts text) already gets from a `.docx`/`.pdf`: name, headline, contact line as plain lines; `## ` section headings; per job a company line then a `Position · Dates` line then bullets; plain lines for every other item. The reader is not changed.
- **Shape of a real export** (v6): six experience items with `period` and `dates`, descriptions as `<p>Team</p><ul><li><p>…</p></li></ul>` (some with `<p><strong>Sub-role (dates)</strong></p>` paragraphs), three education items with single-year dates, ten skills groups with keywords, the other sections hidden and empty. `roles` is empty on every item; the fixtures' multi-role case is kept.
- **The page's "missing" list was the reader, not the data**: `parseWarnings` checks email and phone on the text and found both; the missing name, phone, place and link are `parsedView` reading the Markdown shape.

## R9 — Limits of the plain reader this does not remove (follow-ups)

- A company written in capitals with no lower-case letter ("IBM") is read as a section heading by `headingOf`, as it is in any `.docx` or `.pdf`; the role under it loses its company. Not changed here (the reader is shared).
- A company or a position that begins with a lower-case letter or a digit ("iOS Engineer", "3M") is joined to the line above it by `joinWrapped`'s wrapped-line rule, as in any extracted text.
- A single date ("2006") is not a range, so it stays in the education line's text; `withDates` only strips ranges.
- A description paragraph that opens with a bold sub-role and its dates reads as a further job without a company, as it does in a `.docx`.
- Two jobs in a row where the first has no bullets merge into one: the reader starts a new job only after a bullet block, as in any extracted text.
- A text line that itself begins with `# ` ("# of users up 40%") would be read as a heading; the importer does not escape it.

**Measured on the live export after the change** (the saved export, never committed): the page's reader finds the name, headline, email, phone, both links and the place; sections `Summary`, `Skills (10 groups)`, `Experience`, `Education` and no stray heading; all six employers; 10 roles (the sub-role paragraphs), 58 of the export's 58 bullets, 3 degrees, 10 skills groups; 0 lines beginning with `#` other than `## `. Before: no name, no contact, one role.

## R10 — Independent review of the rewrite (2026-10-15)

A reviewer with no stake in the code ran the importer's output through `structureFromText` on inputs beyond the fixtures. **Fixed** (tests first, FR-019 to FR-022): a position in capitals with year-only dates (`CTO · 2020 – 2021`) was read as a section heading and swallowed the rest of Experience; an education line with a range was mis-split because `withDates` replaced the first separator in the line, not the one beside the range; a section title with two or more commas or past 80 characters lost its `##` to the previous section; jobs described only in paragraphs merged into one; volunteer, written unlike a job, broke when the section was titled "Volunteer Experience"; a v4 contact field (`name`/`value`) was dropped; `a@b (mailto:a@b)` said the address twice. The two reader fixes are the only change to `structure-from-text.ts`; both are wrong for a .docx or .pdf line as well, and the reader's own tests cover them.

**Deferred** (reader limits that already exist for extracted text, or unchanged from before this issue): an all-caps name, headline, one-word company or short location line (`ADA LOVELACE`, `NYC`) is read as a heading; section titles the reader's words do not match ("Work", "Spoken", "Open Source Experience", "Certifications") become headings of their own instead of the usual kinds; a job with an intro paragraph and a list keeps the intro as written, so a lower-case first letter there still joins the position line; a skill's proficiency, and a custom section item's dates, place, link and keywords, are not written (as before); a custom field with both words and a link keeps the link only (FR-013, by design); an upper-case `<A HREF>`, a `>` inside an earlier attribute, unclosed nested anchors and an entity-hidden `<` in a target are not handled by `withLinkTargets` (the editor writes none of them).
