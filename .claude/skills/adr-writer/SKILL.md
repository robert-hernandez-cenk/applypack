---
name: adr-writer
description: Use when a decision changes architecture, interfaces, the Prisma schema, dependencies, sources policy, or supersedes a prior decision. Contains the ADR template used in docs/adr/ and the register of standing decisions.
---

# ADR Writer

Architecture Decision Records live in `docs/adr/NNNN-slug.md` and are
indexed in `docs/adr/README.md` — add the index line in the same commit.

## When an ADR is required

- New process boundary, HTTP framework, queue, or scheduler choice
- New job source family or a change to the "never scrape" policy (ADR 0005)
- A new seam that swaps implementations (like the AI provider, ADR 0007)
- New dependency with operational weight (a CLI in the image, a DB)
- Superseding any prior ADR

Not required: a new fetcher that follows an existing template, a settings
toggle, UI changes, refactors that keep contracts.

## Template (as short as the decision allows)

```markdown
# NNNN — <decision, stated as a sentence>

**Status:** Accepted (YYYY-MM-DD) | Superseded by NNNN

## Context
What forces the decision; the facts that shaped it (numbers, measured
behaviour, external constraints).

## Decision
What we do, stated so a reviewer can check the code against it. A small
table or interface signature is welcome.

## Consequences
✅ what becomes easier   ❌ what we accept

## When to revisit
The concrete trigger that would reopen this.
```

## Supersede mechanics

The new ADR says `Supersedes NNNN` (or `Amends` / `Extends NNNN`) in its
status line; the old one's status line links back (`Superseded by MMMM`,
`amended by MMMM (what changed)`), and the register line in
`docs/adr/README.md` carries the same note. Both link.

Never rewrite the substance of an accepted ADR. A new decision gets a new
ADR. A fact that changed without a new decision (a renamed symbol, a count
that grew, a behaviour a later release reversed) gets a dated addendum at
the end: `## Addendum (YYYY-MM-DD): <what changed>`, one short line per
statement, naming the version, file or ADR that changed it.

## Standing register

Generated from `docs/adr/README.md` on 2026-09-24; the README is the source
of truth when the two disagree.

- 0001 Hono not Express
- 0002 Worker and web as separate processes
- 0003 No queue, just node-cron
- 0004 One active profile, not multi-tenant — *superseded by 0028*
- 0005 No LinkedIn / Indeed / Workday — *amended by 0034, 0036*
- 0006 Discovery via HN parser, not ATS-vendor lists
- 0007 One AI provider seam: Messages API or Claude Code CLI — *extended by 0013, 0014, 0027, 0055*
- 0008 Resume module lives in the web process, files in Postgres — *amended by 0063*
- 0009 Web tools through the AI seam, for job verification only
- 0010 Two scores: live keyword coverage in the browser, AI match on demand — *amended by 0012, 0038*
- 0011 PDF resume text comes from unpdf, not a hand-rolled parser
- 0012 The resume-match score is computed by application code, not by the model — *amended by 0044, 0045*
- 0013 AI engine is chosen at runtime from AppSettings, with a Gemini CLI backend *(extends 0007)* — *amended by 0014; extended by 0027*
- 0014 AI engines form a priority chain with automatic failover *(extends 0013)* — *extended by 0027, 0060*
- 0015 The profile is drafted from the resume scan, never written by AI
- 0016 Job liveness via a free three-rung ladder before AI verify
- 0017 Starter-pack entries pin a hand-verified board — *extended by 0040*
- 0018 Cross-listing is annotated, never merged
- 0019 Source health is a per-company streak; `empty` resets it but does not prove health — *amended by 0035*
- 0020 The fact gate blocks fabrication, not imprecision
- 0021 Cover letters generate from stored inputs only — *extended by 0042*
- 0022 Fences make untrusted text data, and an attempt evidence
- 0023 Trust is apply-link flags, not a score
- 0024 Funnel history is an append-only stage ledger — *amended by 0025*
- 0025 Work columns are user-defined; fixed entry and exits — *amended by 0080*
- 0026 Database tables are snake_case, mapped with `@@map()`
- 0027 Per-engine AI keys live in the database, `.env` as fallback *(extends 0013 and 0014)*
- 0028 Several searches run in parallel, scored by one call per posting *(supersedes 0004)*
- 0029 A comparison is a quick check by default; suggestions are a second call — *amended by 0042, 0043, 0044*
- 0030 The strength review grades; the code scores
- 0031 A job's location is three columns next to the string, filled by hints and a parser
- 0032 A search hunts in countries and groups; the classifier's place may only narrow the parser's
- 0033 A search says where its candidate lives; the model decides whether a posting is open to them
- 0034 A vendor's own licence governs keyed access, and the vendor's terms are code
- 0035 Many installs, one set of boards: spread the tick, shuffle the walk, revalidate
- 0036 Watched companies are checked by reading what a site publishes for machines, never by rendering it — *addendum 2026-09-28: a page drawn in the browser is pasted*
- 0037 Suggestions carry replacement text; the fact gate decides what is applicable — *extended by 0042; amended by 0044*
- 0038 Save patches the user's .docx in place; text-only versions are the fallback *(supersedes the text-only consequence of 0010)* — *extended by 0039, amended by 0059*
- 0039 A resume that cannot be patched is re-typeset from JSON Resume, in the user's own typography *(extends 0038)* — *extended by 0059*
- 0040 The default source set is the aggregators; employer boards are starter packs *(extends 0017)*
- 0041 Alerts go through a channel seam; Telegram and Discord are its first two channels
- 0042 The verifier's company facts are context for the match, never evidence *(extends 0021 and 0037)*
- 0043 A posting refreshed from the company's own listing keeps its original and is re-judged
- 0044 The posting is read once, on its own, and the reading is kept — *amended by 0045*
- 0045 The resume text decides whether a keyword is present *(amends 0012 and 0044)*
- 0046 The resume's domains are read at scan time and compared with the posting's
- 0047 A screening scores evidence, not keywords, and a person decides — *extended by 0050, which supersedes its score formula*
- 0048 Applicants' resumes are redacted before any model reads them, and they expire
- 0049 Employer mode is a switchable mode, not a second product and not a card
- 0050 The rubric is a list of criteria the person chooses, answered one by one with a quote *(extends 0047; supersedes its score formula)*
- 0051 A shortlist is compared head to head, twice, and the comparison is never a score
- 0052 Calibration reports agreement with the person's decisions and never tunes the rubric by itself
- 0053 Uniqueness lives in the database, and a row's state is written with the row
- 0054 `npm start` runs ApplyPack with a built-in Postgres; Docker is the server option
- 0055 Every AI attempt is a ledger row, and a bill, a plan and a local model are never added together *(extends 0007)*
- 0056 A company can be muted, and a company applied to can rest, before any AI reads its postings
- 0057 A model on this machine is an engine of its own, and it is held to its window *(extends 0013/0014)* — *extended by 0060*
- 0058 How strongly the text shows a term counts, a little (score v6) *(amends 0012/0045)*
- 0059 The Tailor page edits the resume as a document, and a save is always one *(extends 0038/0039)*
- 0060 An engine takes the tasks it is given, and the order decides among those that take one *(extends 0014/0057)*
- 0061 The interface speaks several languages; what a model writes stays English — *addendum 2026-10-06: the worker and the browser modules follow later*
- 0062 Rows the user brings are read from what they hand over, and nothing is fetched
- 0063 The worker prepares an application pack for a strong new match *(amends 0008)*
- 0064 The dashboard can sign in through an OpenID Connect provider
- 0065 An install has users; the catalog is shared, the workspace is private *(supersedes 0004's single-user stance for the workspace)*
- 0066 Searches belong to a person; scoring still covers everyone's *(amends 0028: the primary lives on the user)*
- 0067 What a person does with a posting is their own row; the posting is shared *(amends 0028: the best-of lives on `UserJob`)*
- 0068 A resume, and everything written with it, is its owner's *(amends 0063: a pack is per person)*
- 0069 What a person is told, where, and what they muted is their own; what runs the install is the install's *(amends 0041, 0056, 0061, 0063: destinations, mutes, language and pack settings are per person)*
- 0070 Administrators run the install; members work in their own space *(completes 0065 and 0069: roles, the users page; employer mode is administrators' only)*
- 0071 Job leads are read from the person's own mailbox, read-only, and are theirs alone *(builds on 0005, 0062, 0067: Gmail label → that person's jobs; the refresh token is a new accessor-only secret)*
- 0072 A running job reports its progress through its own run row *(builds on 0003, 0069, 0070: `cron_run.progress`, a throttled reporter, a polled fragment on /runs)*
- 0073 A Reactive Resume resume is read from its export file or from the owner's own instance *(builds on 0005, 0011, 0070: Markdown as the stored form, `.json` handled in `readResumeUpload`, an API-key pull with the key in memory only, members kept off private addresses)*
- 0074 A page target steers the cuts in resume tailoring *(builds on 0022, 0029, 0037: `breakdown.pages`, a LENGTH TARGET block in the full match and suggestions user messages, cuts still gated in code, an editor meter)*
- 0075 The Reactive Resume connection is a saved setting *(supersedes the in-memory key of 0073; builds on 0070, 0071: one row per person, one accessor, checked on save, a stash with no key, a new-version source)*
- 0076 One tailoring front door *(amends 0074, 0029: the Resume match tab is the only way to compare, `/target` and the hidden scratch resume are removed, `/letter` takes a stored job and a saved resume, evidence is always `own` and legacy `text` rows still read)*
- 0077 Tailored resume copies *(amends 0038, 0076: the editor's save writes a copy for the posting, never the resume; the copy's comparisons stay out of the resume's count and coverage; promote to master is the deliberate overwrite)*
- 0079 A tailored copy goes back to Reactive Resume as a new resume *(builds on 0073, 0075, 0077: the resume keeps its source id and format, not its JSON; a send duplicates the source on the instance and patches only words inside fields; what cannot be placed is reported, never guessed)*
- 0080 Consider and Applying before Applied; Expired and one No Offer column after *(amends 0025: three fixed entry stages and three fixed end states; No Offer is a column over the end states, not a stage; one rule, `hasApplied`, decides "applied")*
- 0081 A form can change part of a page in place: the post follows its redirect, named regions are swapped *(builds on 0061: `data-inline` forms, `data-region` ids, `inline-post.mjs`, a `refresh()` for the tailor page's live scorer; no new endpoint)*
- 0082 A result message is a toast: the server keeps rendering the banner, one browser module pins it to the corner *(builds on 0081, 0061: `public/toast.mjs`, `data-toast` on the flash slot, sticky for warnings, errors and messages with an action; no second rendering)*
- 0083 The page target is set in the Condense panel, not on the compare form *(amends 0074, 0078: `updateMatchPages`; a later comparison of the same posting and resume inherits it)*
- 0084 With a tailored copy saved, the editor opens on the copy's comparison *(amends 0077: `staleBaseMatch`; `base=1` keeps an older base run viewable)*

Check a proposal against these before touching process layout, sources,
scheduling, profiles, how the AI is called, the resume score or employer
mode.
