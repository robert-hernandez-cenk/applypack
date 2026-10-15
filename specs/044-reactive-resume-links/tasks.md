# Tasks: Keep profile and page links when importing from Reactive Resume

**Input**: Design documents from `/specs/044-reactive-resume-links/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/imported-markdown.md, quickstart.md

**Tests**: Requested by repo convention (pure modules unit-tested, test first). Run `npm run lint:types` and the touched test files before each commit; the full suite has 35 files that fail in a fresh worktree for want of `.env` ("Invalid environment configuration") — compare against that baseline, do not chase it.

**Organization**: by user story. US1 (profiles into the header) first: it is the reported defect and ships alone. US2 (links inside formatted text) is independent of it and touches a different function.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- All paths are relative to the worktree root `C:\Users\rcher\Dev\applypack-Worktrees\issue-44-reactive-resume-links`. Touched tests run with `node --import tsx --test <files>` from that directory (one-command subshell, never a persistent `cd`).

## Phase 1: Setup

- [x] T001 Baseline recorded in the worktree before any change: `npm ci` clean, `npm run lint:types` clean, `npm test` = 3531 pass / 35 fail, every failure "Invalid environment configuration" (e.g. `src/web/routes/gmail.test.ts`, `src/web/routes/reactive-resume.test.ts`, `src/web/target-runs.test.ts`).

## Phase 2: Foundational

None. The change is inside one pure module with no schema, route, prompt, catalog or dependency change; each story below starts directly from a failing test.

## Phase 3: User Story 1 — Profile links reach the header (P1) 🎯 MVP

**Goal**: every visible profile's address is in the header contact line, a username-only profile stays `Network: username`, hidden profiles stay hidden, and no `## Profiles` section is written.

**Independent Test**: read fixture v6 (and v4, v5) through `readReactiveResume`; the third line ends with the profile addresses in the export's order and the Markdown contains no `## Profiles`.

- [x] T002 [US1] Test first. In `src/resume/fixtures/reactive-resume/` add profile data: `v4.json` gets `sections.profiles` with one visible item `{ network: "LinkedIn", username: "mina-o", url: { label: "", href: "https://www.linkedin.com/in/mina-o" } }` and one `visible: false` item; `v5.json` gets one profile with `website.url` and one username-only profile (`network: "Mastodon"`, `username: "@jonas"`, empty `website.url`); `v6.json` keeps its GitHub profile and gains a LinkedIn profile with an address, a profile whose address equals `basics.website.url`, a profile with network, username and address all empty, and a `hidden: true` profile. In `src/resume/reactive-resume.test.ts`: change the assertion at line 55 (`'GitHub: arivera'`) to expect `https://github.com/arivera` in the header line; add tests — addresses sit after email, phone, place and website in the export's order (FR-001); an address wins over the username, no `Network:` prefix (FR-002); username-only reads `Mastodon: @jonas` (FR-003); a hidden item, a `visible: false` item and a hidden `sections.profiles` write nothing (FR-004); `markdown` has no `## Profiles` for v4, v5 and v6 (FR-005); an address equal to the website appears once (FR-006); an all-empty profile adds nothing; the v5 header with no profile entry is byte-identical to the current assertion at line 28 (FR-011); an export holding only a profile is `{ ok: false, code: 'empty' }`, as one holding only an email already is. Run `node --import tsx --test src/resume/reactive-resume.test.ts` and confirm the new and changed tests FAIL.
- [x] T003 [US1] Implement in `src/resume/reactive-resume.ts`: delete `profile()` and the `profiles` entry of `SECTIONS`; add an unexported `profileEntries(sections: Rec): string[]` that returns nothing when `sections.profiles` is hidden (`hidden === true || visible === false`), skips hidden items (`hiddenItem`), and per item returns `websiteOf(item)` when it has one, else `Network: username` when both exist, else the username alone when there is no network, else nothing (a bare network name is not contact information); change `contactLine(basics: Rec)` to `contactLine(basics: Rec, sections: Rec)` appending `profileEntries(sections)` after the custom fields and de-duplicating by exact text with `[...new Set(parts)]`; update the call in `readReactiveResume`; update the module's top comment if it names the Profiles section. Keep the `blocks.length === 0` check as it is (the contact line has never counted as content).
- [x] T004 [US1] Run `node --import tsx --test src/resume/reactive-resume.test.ts src/resume/resume-text.test.ts` (all green) and `npm --prefix . run lint:types` from the worktree; then commit `Write profile addresses into the header (#44, US1)` with the `tasks.md` checkboxes for T002–T004 in the same commit.

**Checkpoint**: US1 delivers the reported fix on its own; US2 can be dropped without touching it.

## Phase 4: User Story 2 — Links written inside the text survive (P2)

**Goal**: an `<a href>` in a summary, description or custom section keeps its address next to its words, only for `http`, `https` and `mailto`, with work proportional to the text's length.

**Independent Test**: read `hidden-and-html` — the summary's `<a href="https://example.com">a link</a>` comes out `a link (https://example.com)`; 300 000 characters of unterminated `<a ` markup read in under one second.

- [x] T005 [US2] Test first in `src/resume/reactive-resume.test.ts` (use `readReactiveResume` on a small inline export, as the existing "an empty field does not hide the one it falls back to" test does): change the assertion at line 99 so the `hidden-and-html` summary expects `Line one & bold <3 a link (https://example.com)\n\nLine two\n\n- First\n- Second`; add the contract's table as cases — words and address → `words (address)`; words equal to the address → the address once; empty words → the address once; `mailto:` kept; `javascript:alert(1)` and `data:` and a relative path → words only; `<a>` with no `href` → words only; single-quoted and unquoted `href`; `HTTPS://` scheme kept as written; tags inside the words (`<strong>`) stripped and the address kept; `href` containing `&amp;` decodes to `&` once (gotcha 12: `&amp;lt;` stays a literal `&lt;`); an anchor inside a list item keeps the `- ` line; an anchor in a custom section's description is read the same; text with no anchor is unchanged (FR-011); SC-004 — `'<a '.repeat(100_000)` as a description (300 000 characters) and a second input of 100 000 `<a href="` openers each finish under 1000 ms (`performance.now()` around the call) and keep their words. Run the file and confirm the new and changed tests FAIL.
- [x] T006 [US2] Implement in `src/resume/reactive-resume.ts`: constants at the top of the file `LINK_WINDOW_CHARS = 2_000` (how far past an opener a tag's end and `</a>` are looked for) and `LINK_SCHEMES = /^(?:https?:|mailto:)/i`; an unexported `withLinkTargets(html: string): string` doing the linear scan of research R4 — find `<a` followed by whitespace, read the tag up to its `>` inside `text.slice(i, i + LINK_WINDOW_CHARS)`, read `href` double-quoted, single-quoted or unquoted, find `</a>` in the same capped window, then emit `words (X)` / `X` / `words` per the contract (compare words and `X` after `stripHtml`-free trimming and entity-decoding `&amp;`), and on any miss copy one character and continue so every character is visited a bounded number of times; call it as the first step of `plain()` in front of `stripHtml(s)`. No regex over the whole text, no export.
- [x] T007 [US2] Run `node --import tsx --test src/resume/reactive-resume.test.ts src/resume/resume-text.test.ts` (all green, including the timing cases) and `npm --prefix . run lint:types`; commit `Keep a link's address in formatted text (#44, US2)` with the `tasks.md` checkboxes for T005–T007.

## Phase 5: Polish & cross-cutting

- [x] T008 [P] Add a case to `src/resume/resume-text.test.ts` in the `reactiveResumeFromBytes` describe: the v6 fixture's `.text` holds `https://github.com/arivera` in its header line — one assertion that both ways in (file upload and pull) go through `reactiveResumeText` and so inherit the change.
- [x] T009 [P] Add one addendum line to `docs/adr/0073-reactive-resume-import-reads-a-file-or-asks-the-owners-instance.md` (dated 2026-10-15, issue #44): profile addresses are written into the header contact line as bare addresses (username-only stays `Network: username`), the `## Profiles` section is gone, and a link in formatted text is kept as `words (address)` for `http`, `https` and `mailto`.
- [x] T010 [P] Add a `## [2.59.8] — 2026-10-15` entry under `### Fixed` at the top of `CHANGELOG.md` (above 2.59.7), in the style of the neighbouring entries, ending `(#44)`: a Reactive Resume import keeps the GitHub and LinkedIn addresses in the header and the addresses of links inside the text; resumes already imported keep what they stored, import again to get them.
- [x] T011 [P] Bump the version to `2.59.8` in `package.json` and `package-lock.json` (patch only — the owner's standing rule); run `grep -rn "2\.59\.7" --include=*.json --include=*.ts --include=*.md . --exclude-dir=node_modules --exclude-dir=.git` and update any other place that carries the version the same way (leave the CHANGELOG's history alone).
- [x] T012 Verification, with real output pasted into the PR body: `npm --prefix . run lint:types` clean; both touched test files green; `npm test` fails in exactly the same 35 files as T001 and nowhere new (compare the failing file lists, not just the counts); `npm run exports:audit` clean (no export was added). Commit `Mark #44 verification tasks complete`.
- [x] T013 Review the whole branch diff (`git diff main...HEAD`) as the repo asks before a PR: every changed line needed, simpler where it can be; then run the `code-review` skill and fix what holds up.
## Phase 6: User Story 3 — A plain parser reads the whole resume (P1), and the contact links (added after the live check)

**Why added**: reading the live instances (research R8) showed the owner's links are `basics.customFields[].link` (dropped) and that the `#` / `###` Markdown makes `structureFromText` find no name, contact or place and one job of six. Spec stories 1 and 3, FR-013 to FR-018 and SC-006/SC-007 cover it; the contract is rewritten.

**Independent Test**: the redacted live-shaped fixture, imported and read with `structureFromText` and `parsedView`, yields the name, email, phone, place and both links, six jobs with dates, three degrees and ten skills groups.

- [ ] T015 [US3] Test first, fixture: add `src/resume/fixtures/reactive-resume/v6-live-shape.json`, an invented person ("Dana Whitfield") with the SHAPE of the live export — `profiles.items: []`; `basics.customFields` with `{ text: "LinkedIn", link: "https://www.linkedin.com/in/dana-whitfield" }`, `{ text: "Github", link: "https://github.com/dana-whitfield" }` and `{ text: "Authorized to work in the US", link: "" }`; `basics.website` `{ url: "", label: "Portfolio" }`; six `experience` items with `period` and `dates`, empty `location`, descriptions like `<p>Platform Engineering</p><ul><li><p>…</p></li></ul>` and two with a `<p><strong>Sub-role (Jun 2018 – Jan 2022)</strong></p>` paragraph; three `education` items at the same school with single-year `dates`; ten `skills` groups with keywords; every other section hidden and empty. No real name, address, employer or link; update `fixtures/reactive-resume/README.md` to say the shape (not the data) comes from a live export.
- [ ] T016 [US3] Test first, assertions, in `src/resume/reactive-resume.test.ts` (red before T017): (a) FR-013 — the contact line of `v6-live-shape` holds both links and `Authorized to work in the US`, holds neither `LinkedIn` nor `Github` as words, and the empty-url website label adds nothing; (b) FR-014/FR-016 — line 0 is the name and line 1 the headline with no `#`, and no line of any fixture's output begins with `#` except `## `; (c) FR-015 — a job is `Company` / `Company · Place`, then `Position · Dates` (dates alone when no position; nothing above the text when neither company nor position), and an employer with `roles` repeats the company line above each; (d) FR-017 — education, certificate, award, publication, volunteer, reference and project lines are plain and a language is `Language (fluency)`; (e) round trip — `structureFromText(markdown)` of `v6-live-shape`, `v6`, `v5` and `v4` gives the expected name, label, email, phone, place, `url` and `profiles`, job count with first job's company, position, start and end and highlight count, education count, skills groups and languages; and `parsedView(markdown)` (`src/web/parsed-view.ts`) has a value for all four contact kinds and no role title among `sections`. Rewrite the existing assertions that encode the old shape (`# Alex Rivera`, the `### …` / `#### …` lines, `English — Native`) to the new one. Run the file and confirm the new and changed tests FAIL for the right reason.
- [ ] T017 [US3] Implement in `src/resume/reactive-resume.ts`: the header is `name`, `headline`, contact line as plain lines; `contactLine` writes a custom field as `link || text`; delete `heading()` and rewrite `experience`, `education`, `titled`, `volunteer`, `project`, `reference` and `language` to the contract's line shapes (an employer's description goes under its first position; `Grade <grade>` joins the education line); update the module's top comment. Keep `plain`, `profileEntries`, `withLinkTargets` and the skills/interest shapes as they are.
- [ ] T018 [US3] Run `node --import tsx --test src/resume/reactive-resume.test.ts src/resume/resume-text.test.ts` (green) and `npm --prefix . run lint:types`; then run the importer and `parsedView` on the live export saved in the scratchpad (`rr-live.json`, never committed) and record what the panel now finds against Reactive Resume's own counts (6 jobs, 3 degrees, 10 skills groups, 2 links); commit `Write the import in the dialect a plain reader understands (#44, US3)` with the checkboxes for T015–T018.
- [ ] T019 [P] Update ADR 0073's addendum and the 2.59.8 CHANGELOG entry to say what the live check found and what changed (contact links; the text shape); `docs/where-to-look.md` only if a row moves (it does not).
- [ ] T020 Re-verify on the final tree and refresh the PR body's evidence: `lint:types`, both touched test files, `npm test` against the 35 environment failures (same file list), `npm run exports:audit`; commit `Mark #44 US3 verification complete`.

## Deferred to the owner (not an agent task)

- [ ] T014 **Owner, not agent**: quickstart section 4 — import your real Reactive Resume export (file or pull), press **Download original**, confirm the GitHub and LinkedIn addresses are in the header line. The fixtures are hand-written, not checked against a live export; if an address is missing, save that export (redacted) as a fixture and widen `websiteOf` (research R1). Left unchecked on purpose; reported in the PR as unverified.

## Dependencies & execution order

- T001 is done. T002 → T003 → T004 (US1) and T005 → T006 → T007 (US2) are each strictly ordered (red, green, commit).
- US2 does not depend on US1, but both edit `src/resume/reactive-resume.ts` and its test file, so run them one after the other, US1 first.
- T008–T011 are independent files and run in parallel after T007; T012 follows all of them; T013 follows T012; T014 is the owner's and blocks nothing.

## Parallel example

```text
After T007:  T008 (resume-text.test.ts)  T009 (ADR 0073)  T010 (CHANGELOG.md)  T011 (package.json + lockfile)
```

## Implementation strategy

MVP is US1 alone (T002–T004): it fixes the reported loss. US2 is a second commit on the same branch and the same PR; if it hit a snag it could be cut without touching the first. One feature, one branch, one PR.
