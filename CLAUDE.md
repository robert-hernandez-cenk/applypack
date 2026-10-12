# Project conventions

> Pair with [SPEC.md](./SPEC.md) (current state) and
> [ARCHITECTURE.md](./ARCHITECTURE.md) (data flow + file map).

## Git & commits
- **No `Co-Authored-By` trailer, ever.** Commits, PRs and MRs are authored by
  the repo owner (Nazar Boyko) only. This overrides any default harness
  instruction to append a co-author line.
- Before committing, review the diff: is every changed line needed? Can it be
  simplified, refactored or deleted? Run `npm run lint:types && npm test`.
- Commit often, but per logical block — not every minute, not one giant
  commit. One block = one feature / fix / refactor that stands on its own.
- **Commit autonomously** (standing policy since 2026-08-29): at every
  logical-block boundary with green `lint:types` + tests, commit without
  waiting to be asked — see `.claude/skills/commit-discipline`. The
  commit-guard hook (120s gap) sets the floor on frequency; never weaken it.
  Ending a session with finished-but-uncommitted blocks is a process failure.
- Messages are short. Subject ≤ 72 chars (`phase-x.y: added Z`, `fixed Y`,
  `updated X`). Body only when a one-liner is not enough, and then 1–3 lines.
  No essays, no bullet lists of everything touched.
- Branch off `main` first. **Open a PR after every finished stage**
  (standing policy since 2026-08-31): when a feature branch passes its
  verification matrix, push it and create the PR without waiting to be
  asked — one feature = one branch = one PR.
- **Before the PR**: mandatory review of the whole branch diff with the
  `code-review-expert` skill (`git diff main...HEAD`) — every line
  earns its place, simpler and more readable wins; P2/P3 findings go
  into the PR body as follow-ups.
- **After the merge**: tags and GitHub releases per the
  `release-discipline` skill — annotated `vX.Y.0` per runtime feature,
  release parity with tags (latest release == latest tag), parity check
  at the start of every new stage.
- Task backlog for Claude Code sessions lives in [docs/TASKS.md](./docs/TASKS.md).

## Stack
- TypeScript strict mode, Node 24 (runtime image; engines allow >=22)
- Prisma + Postgres 16 (already in docker-compose)
- Native fetch (no axios). Use AbortController for timeouts (10s default via `fetchWithRetry`).
- pino for logs (never console.log in production code)
- zod for ALL external data: env vars, API responses, Claude output

## Code style
- No default exports. Named exports only.
- Pure functions where possible. Side effects (DB, HTTP, Telegram) isolated to dedicated modules.
- async/await, never raw promise chains.
- Errors: throw typed errors with context. Caller decides logging.
- No magic numbers. Constants at top of file or in config.ts.

## File rules
- Each fetcher returns `NormalizedJob[]` — never writes to DB directly.
- `filter.ts` is pure — no I/O. `passesBaseFilter` stays single-profile;
  `passesAnyBaseFilter` is the union wrapper every caller uses (ADR 0028).
  It reads the Job columns, not the string: callers pass stored rows or a
  `parseLocation` result; `placesOverlap` expands groups on both sides
  (ADR 0032) and everything unknown goes to the classifier. Title keywords
  match whole words through `titleHasKeyword`, never a run inside one.
  `baseFilterReason` / `anyBaseFilterReason` are the same gates naming the
  one that turned a posting away — the search funnel counts them.
- `employer.ts` is pure — who hires (ADR 0056): `employerKey` is the one
  normaliser (accents, case, punctuation, trailing legal forms; never fuzzy),
  `hiringKey` reads `NormalizedJob.employer` — set by every aggregator's
  mapper from its own field, null when the feed does not say, ABSENT on a
  source that is the employer — and `employerGate` is the tick's mute /
  re-apply decision. `Job.employerKey` is written at every insert;
  `jobs/employer-store.ts` is the only file that touches `company_mute`, and
  its `fillEmployerKeys` is the one-time fill `init.ts` runs. A page that
  names a posting's company reads `companyOnPage` (who hires, and apart from
  it the source the row came through) or, for one slot, `companyForPage`: a
  row that names nobody says "Company not named" and never borrows its
  source's name (#444); a prompt and a
  message read `companyForPrompt` / `companyForMessage` (a stored row) or
  `fetchedHiringName` (the tick), which say "not named" for a row from an
  aggregator, an import or a folder that names no company — never the
  source's own name. A call about a stored job takes the posting whole from
  `postingForPrompt(job)`, never built by hand: its type asks for the
  source's `atsType`, so a handler that did not load it does not compile
  (#444). A screening's calls read `screening/store.ts:postingOf`.
- `apply-link.ts` is pure — no I/O. It flags apply links, never rejects a
  row, and the company name is deliberately not an input (ADR 0023).
  `withApplyLinkFlags` is called at every site that persists `redFlags`.
- `location.ts` is pure — no I/O. `parseLocation(text, hints)` fills
  `Job.workplace / countries / regions / locationSource` at every site that
  persists a Job (`process-jobs.ts`, `manual-job.ts`); it never rewrites
  `Job.location` (ADR 0031). The gazetteer is `countries.json` +
  `countries.ts` (pure); fetchers pass structured fields as
  `NormalizedJob.locationHints`. The 250-string corpus in
  `location-corpus.json` is a test — a parser change that moves a row says why.
- `classifier.ts` (and `classifier-prefilter.ts`) build prompts and parse
  replies; the only thing that talks to the AI is `ai-provider.ts` — no DB.
  Both take a `Profile[]`: ONE call scores a posting against every running
  search and returns a verdict each (ADR 0028). `jobs/verdict-merge.ts` is
  pure — per-search thresholds, the winner, the score line;
  `jobs/score-store.ts` is the single write path for a re-score.
  Engine choice (provider + models) resolves per call via `ai-runtime.ts`
  (DB row → `.env` fallback, pure merge in `ai-engine.ts` — ADR 0013), and
  so does the credential (`ai-keys.ts`, pure — ADR 0027).
- `jobs/process-jobs.ts` is the single source of truth for the inner
  filter → dedupe → classify → persist → alert sequence. Reused by
  `runFetchJob` and `runHnHiringJob`. `{ classify: false }` stores what
  passes the filter unscored (no AI, no alert) — "Fetch now" while paused.
- `AiProvider` calls are tool-free unless the request sets `webTools`; only
  `src/verification/verify.ts` does (ADR 0009). Never turn it on for the classifier.
- `AiProvider.complete()` returns an attempt `{ text, outcome, spend }`, and
  `ai-runtime.ts` writes every chain attempt to the `ai_call` ledger, the
  failed ones too (ADR 0055). A call site's `label` is its ledger feature and
  must be one of `ai-usage.ts`'s set; a count the vendor did not report is
  NULL, never 0; billed, plan and local money are three totals, never one.
- A fetcher that makes ONE request per tick sends `conditionalHeaders(id, url)`
  and calls `rememberResponse(id, url, resp, jobs.length)` after parsing
  (ADR 0035). It is a no-op for a vendor that offers no validator, so it goes
  in unconditionally; a 304 propagates as `HttpError` and `runAllFetchers`
  reads it as `not_modified`. Sources that make SEVERAL requests for one row
  (Arbeitnow's pages, Jobicy/Himalayas per place, the keyed sources) are left
  out on purpose. Never store a validator before the jobs are persisted.
- Every AI call site takes its prompt from an exported `build*Prompt`, and
  every builder wraps outside text with `fence()` from `src/prompt-fence.ts`
  (ADR 0022). `src/prompt-fence-registry.test.ts` derives both rosters, so a
  new builder or call site fails CI until it is covered. Operator input
  (`Profile.notes`, cover angles, confirmed facts) stays OUTSIDE the fence —
  that is the user's own instruction channel.
- `src/watchlist/` is the company-watchlist module (ADR 0036): `interval.ts`
  (intervals, due-ness, the ★ and the alert policy), `parse-input.ts` (the
  textarea), `scan.ts` (what a careers page publishes), `page-hash.ts` (the
  change watch: what the hash ignores, and the once-a-day rule), `paste.ts`
  (a page drawn in the browser, pasted by the user: its lines, what is new,
  the lines a search would take — TASKS N8) are pure and tested;
  `resolve.ts` is the ladder with its I/O injected, so the ladder itself is
  tested on recorded answers and only `liveResolveIo()` touches the network.
  Every `ats` verdict is confirmed by `probeAts` before it is offered — a URL
  match is a hypothesis, the vendor's answer is the evidence. `src/robots.ts`
  is the RFC 9309 reader it calls first: it is stricter than the protocol in
  two places, and both are deliberate (an AI-agent group binds us; a 5xx on
  robots.txt means "not allowed").
- `src/screening/` is employer mode (TASKS §19, ADR 0047–0052): `rubric.ts`,
  `redact.ts`, `dates.ts`, `prompts.ts`, `anchor.ts`, `score.ts`,
  `trajectory.ts`, `comparison.ts`, `calibration.ts`, `bench.ts`,
  `intake.ts`, `export.ts`, `notice.ts`, `sectors.ts` are pure (tested); `store.ts` is
  the only file in the module that touches Prisma (the worker's
  `cleanup-job.ts` deletes expired screenings with its own query, because
  the worker may not import this module); `batch.ts` and `compare.ts` run the
  calls; `scripts/screen-bench-once.ts` runs a gold folder through the
  same path and writes no verdict (it still needs `DATABASE_URL`: the engine
  is read from `AppSettings`, with the `.env` fallback). Web-only behind
  `AppSettings.employerMode` — the worker never imports it, and nothing in
  `src/resume/` reads an `Applicant`. Redaction (`redactApplicant`) runs at
  intake and cannot be switched off; the model sees "Applicant №N" only.
- `src/local/` is `npm start` without Docker (ADR 0054): `data-dir.ts`,
  `db-state.ts`, `postgres-setup.ts`, `supervise.ts` are pure (tested);
  `postgres.ts` runs the built-in Postgres 16 through `pg_ctl` (own session,
  UTF-8 + `C.UTF-8`, UTC, loopback, no socket); `launcher.ts` takes the data
  folder's lock, starts the database, then the worker, then the dashboard,
  and stops them in reverse. Who a pid file names is asked of the system
  (`postgres.ts:commandLineOf`: PowerShell on Windows, `ps` elsewhere) and
  has three answers — a command line, no such process, `NO_ANSWER` when it
  said nothing in time; the last is never read as the second
  (`supervise.ts:lockHolder`, `postgres-setup.ts:leftoverAction`, #470).
  The launcher never imports `config.ts` or
  `db.ts` — the URL does not exist until it has started the database. The
  worker and the dashboard only call `child.ts` (`announceReady`,
  `onLauncherStop`, `underLauncher`), a no-op without a launcher;
  `install.ts:localInstall` is the wider question the folder rules ask — the
  launcher started this process, or it found the built-in database through
  `db.json` (a once-script, a dev watcher; #398); the
  dashboard's login entry (`web/login-item-io.ts` over the pure
  `src/login-item.ts`) also reads the pure `data-dir.ts`. `snapshots.ts`
  (pure) plans the daily copy the launcher takes before Postgres starts. `config.ts` fills an empty
  `DATABASE_URL` from `db.json`, so dev watchers and once-scripts find it.
- `src/pack/` is the application pack (ADR 0063) — what the worker prepares
  for a strong new match with nobody watching: `settings.ts` (the person's
  choices, off by default), `trigger.ts` (whether the tick queues one —
  asked only where a NEW match is stored, so the backlog is never walked;
  never for a posting whose date the source did not give —
  `NormalizedJob.undated`, said by the row mapper and marked for every
  other source by `fetchers/dates.ts:markClockDated` where its read ends, #379),
  `gate.ts` (where preparing stops: closed, a failed requirement, a ceiling
  under the floor, a fake), `policy.ts` (what an unattended edit may touch,
  and `planEdits`: a comparison's suggestions held to it, each one left out
  kept in `held` with its reason), `tailor.ts` (the plan run through
  `apply-all.mjs`, the score of the text it leaves, and `tailorChecks`:
  undoing every recorded change must give the original back, and no change
  may take out words its suggestion did not quote), `view.ts` and
  `dry-report.ts` are pure (tested); `prepare.ts` is the only file that
  spends AI — one pipeline for the worker and the dry run; `store.ts` is the
  only one that touches `application_pack`. The dashboard never prepares a
  pack: it queues a row, and `jobs/pack-job.ts` takes it. The limits are
  code, never a prompt rule (gotcha 11), and a pack never changes a resume.
- `src/starter-packs/` is the curated-pack module: `catalog.json` (data),
  `catalog.ts` and `resolve.ts` are pure (tested), `probe.ts` calls
  `probeAts`. Web-only — the worker never imports it. Every catalog entry
  pins a hand-verified board; a probe hit is not proof of identity (ADR 0017).
- `src/i18n/` is the interface's languages (ADR 0061): `locale.ts`,
  `message.ts`, `catalog.ts`, `t.ts`, `format.ts`, `places.ts`, `pseudo.ts`
  are pure (tested) and the worker may import them. A string a person reads is a key
  in `catalog/en.json`, worded through `t()`; it ships with its line in every
  other catalog, in the same PR (`catalog.test.ts`). `t()` reads the language
  of the moment, so a module-level constant that holds words reads English
  for ever: make it a function or keep the key. A sentence is one message,
  never glued from translated pieces; a message with a link goes through
  `web/rich.ts:tRich`. Not translated: prompts, anything a model writes
  (render it inside `lang="en"`), resume and letter content, logs, CSV
  values, `screening/notice.ts`, and values the code compares
  (`resume/facts.ts:DENIED_NOTE` / `UNSURE_NOTE`, the ` · not applied — `
  that `replacement-gate.ts` writes into `why`). Data in a page (a posting's
  title, a company, a file name) takes `translate="no"`; a page title that is
  data, `PageHeader`'s `titleIsData`. A value the code stores or compares
  keeps its English and is worded on the way out: `places.ts:placeName` /
  `workplaceName` beside `countries.ts:placeLabel` / `WORKPLACE_LABEL`; an
  error a page shows and the code stores keeps an English `message` and a
  `reason()` in the reader's language (`resume/docx-text.ts:ResumeTextError`,
  a stored note read back by `storedReadNote` and `screening/redact.ts:noteWords`);
  a reason a worker run stores verbatim (a pack's `why`, a folder file's note, a
  probe's error) is written in that run's language, and code that acts on a
  failure reads a code or a status, never the words (`ats-probe.ts:isDeadToken`).
  The browser modules word through `public/i18n.mjs` — the `message.ts`
  mirror, held to it by `web/i18n-mirror.test.ts` — over the generated
  `public/i18n-en.mjs` (every `browser.*` key: `npm run i18n:browser` after an
  English change, and the copy in `site/public/demo/`) and the page's language
  that `layout.tsx` embeds (`web/browser-messages.ts`). Every worker run reads
  the stored language (`run-locale.ts:inRunLocale`, around each cron beat and
  once-script); Telegram and Discord word a tagged message through
  `notify/markup.ts:tMarkup`, which escapes every part.
- `src/web/public/tailwind.css` is generated: `npm run css` (Tailwind CLI over
  `tailwind.config.js` + `src/web/tailwind.css`) and committed, so the runtime
  has no build step and no page fetches from a third party
  (`self-contained.test.ts`). A new utility class = rerun it.
- `src/web/public/` holds browser code served as-is (no build step). Keep it
  dependency-free ES modules with pure functions, tested through `import()`
  from `src/web/*.test.ts`. The Dockerfile copies the directory into the image.
  The one exception is `public/vendor/` (ADR 0059): docx-preview and JSZip as
  npm built them, pinned by hash in `vendor/README.md` and `vendor.test.ts`,
  loaded only by the document pane.
- `data-ui` attributes in `src/web/` are the redesign's measuring hooks:
  `data-ui="hint"` marks helper prose (the `Hint` primitive, the header's
  intro and meta, a radio's body, and any raw faint paragraph or label span),
  `mode-card` / `mode-body` mark a launcher's input modes, and `alert-modes` /
  `alert-window` the alert-timing form's window (Notifications tab) — two `:has()` rules in
  `layout.tsx` fold what belongs to a mode that is not the chosen one.
  `docs/ui-redesign/measure.js` counts them and `shoot.js` runs it over the
  pages (docs/ui-redesign-plan.md §4.2). Helper prose written outside `Hint`
  takes the hook, or the number a UI change reports reads low.
- `AtsType.MANUAL` companies are inactive rows for pasted jobs — `fetchOne`
  returns `[]`, `/companies` and the source toggles hide them.
- `src/datasets/` is the rows the user brings (ADR 0062): `decode.ts`
  (`decodeText`: bytes → text, UTF-8, marked UTF-16, a page's declared
  charset, else Windows-1251 or -1252), `delimited.ts` (the CSV / TSV
  reader), `rows.ts` (`findRows`: a JSON array, a wrapper object, rows held
  by key, JSON Lines, CSV or TSV, the format read off the text, under the
  5 MB and 2 000-row ceilings), `read-notes.ts` (what of a file was lost in
  reading, in words), `map.ts` (`detectMapping` from the names, then the
  values; `mapRow` / `mapRows` → `NormalizedJob`; the zod schema of the
  mapping kept in `Company.sourceConfig`) and `preview.ts` are pure (tested,
  hand-written rows in `fixtures/`). Only mapped columns are read: a column
  about a person never appears in `columnsOf`, so it is never kept, and a
  link survives only as http(s). The mapper sets `employer` on every row — a
  name or null, never absent — because these rows carry many employers
  (ADR 0056); `source-groups.ts:bringsRows` is what makes `sourceIsEmployer`
  answer false for a type `sourceFamily` files under the user's own.
  `AtsType.IMPORT` companies are inactive rows like MANUAL: `fetchOne` returns
  `[]`, `/companies` and the source toggles hide them, `/jobs/import` lists
  and deletes them. The import is `jobs/import-job.ts:runImportJob` →
  `processNormalizedJobs` under the fetch lock; between the preview and the
  import the rows wait in `web/import-stash.ts`, in memory only. Nothing here
  makes a request, and no site a row may have come from, and no tool that
  wrote it, is named in code, copy or docs.
- A folder a tool writes into is the same rows read on the tick
  (`AtsType.FOLDER`, ADR 0062 addendum). `datasets/folder-path.ts` (which
  folder may be read: inside home under the launcher, inside
  `APPLYPACK_INBOX_ROOTS` anywhere else, asked on every look) and
  `datasets/folder-scan.ts` (`planScan`: read, wait or leave alone; the
  ceilings; `judgeFile` → jobs and the ledger row) are pure.
  `datasets/folder-io.ts` is the ONLY module that touches a user's folder and
  it only reads — no write, move, rename or delete, ever, and
  `folder-io.test.ts` fails the file if one appears; links are not followed,
  a file's real path must lie beneath the folder's before it is opened and
  again after, and a file with a second name on the disk is passed over. `fetchers/folder.ts`
  returns `NormalizedJob[]` and writes nothing: the look is staged in
  `fetchers/folder-ledger.ts` and `jobs/fetch-job.ts` hands it to
  `jobs/source-file-store.ts` (the only file that touches `source_file`) once
  the tick ran to its end, a folder at a time (`folder-ledger.ts:looksToKeep`,
  #396): a folder keeps its look unless one of its own postings went without
  a verdict. Never mark a file read before its jobs are stored. A look takes
  its own clock, never the walk's, and a table's last row with no line end
  waits until the file has been still for `OPEN_ROW_SETTLE_MS`.
- A folder may hold postings the user saves instead (`sourceConfig.holds =
  'postings'`, ADR 0062 addendum 2026-10-06): one file, one posting.
  `datasets/saved-page.ts` (a saved page's text, its own address, its
  `JobPosting` block — markup only ever becomes text, an address is never
  followed) and `datasets/posting-file.ts` (bytes → text by kind, the PDF and
  `.docx` readers of `src/resume/`; `identifyPosting`, `savedPostingJob`) are
  pure. A change to what a saved posting's id is made of re-keys stored
  rows: `identifyPosting` has to find the job under the id it had. A model is
  asked (`extractPostingFacts`) only when the page did not state its title
  and company, never while paused. The job carries `handPicked`:
  `processNormalizedJobs` skips the base filter and the employer gate for it,
  as for a paste, and stores a turned-down one Saved, never Dismissed; a
  re-score keeps both promises (`jobs/rescore-status.ts`).
  `Job.sourceFile` names the file for every folder row. Under the launcher
  the worker watches these folders (`jobs/folder-watch.ts`, plan
  `folder-watch-plan.ts`) and runs the scoped fetch a few seconds after a
  save; never while paused, never on a server.
- `src/resume/` is the resume module: `zip.ts`, `docx-text.ts`, `pdf-text.ts`
  (unpdf, ADR 0011), `resume-text.ts`, `prompts.ts`, `pick.ts`, `score.ts`
  (ADR 0012), `facts.ts`, `diff.ts`, `parse-warnings.ts`, `match-mode.ts`,
  `match-reuse.ts`, `bench-report.ts`,
  `profile-draft.ts` (ADR 0015), `fact-check.ts` (ADR 0020),
  `keyword-overrides.ts`, `keyword-frame.ts`, `review-score.ts` (ADR 0030),
  `change-sheet.ts`, `replacement-gate.ts` (ADR 0037),
  `docx-structure.ts`, `docx-patch.ts`, `docx-props.ts` (ADR 0038),
  `json-resume.ts`, `structure-from-text.ts`, `structure-anchor.ts`,
  `structure-complete.ts`,
  `style-infer.ts`, `render/` (ADR 0039), `posting-orientation.ts`,
  `coverage.ts`, `duplicate.ts`, `review-gate.ts`, `usage.ts`,
  `draft-document.ts`, `pdf-geometry.ts`, `pdf-layout.ts` (ADR 0059), `summary-guide.ts` are pure (tested);
  `scan.ts` / `match.ts` / `suggestions.ts` / `review.ts` / `cover-letter.ts`
  call the AI provider (the letter is gated by `fact-check.ts` and generates from stored
  inputs only — ADR 0021); `store.ts` is the only file that touches Prisma.
  Called by the dashboard and, since ADR 0063, by the worker's pack runner
  (`src/pack/prepare.ts`); no other worker job imports it (ADR 0008).
- A comparison has two shapes (ADR 0029): `matchResumeToJob(..., {mode})`
  runs the quick check (`fast`, the function's default: keywords + alignment
  + gates + red flags — everything `score.ts` reads) or the full report
  (`full`, which also writes actions/removals/strengths/cautions). Every
  Compare button in the dashboard posts `full` (since v1.70.0); `fast` is
  left for rows stored before that (Rebuild keywords re-runs such a row as
  `fast`), for Save as vN with a posting (it re-scores the saved text as a
  quick check) and for the bench. Both variants are built
  from the SAME rule constants in `prompts.ts` and parsed by the same
  `MatchSchema`; `suggestions.ts` fills a fast row in later from its stored
  verdicts. The mode marker rides in the `breakdown` JSON, never in the schema.
  The verifier's `companySnapshot` reaches `full` and the suggestions call
  ONLY, as a fenced COMPANY CONTEXT block — context for emphasis and `why`,
  never evidence for a status, a gate or a replacement (ADR 0042); the
  fourth `breakdown` marker, `verificationId`, is the memo key that makes a
  full row stale after a new verification. The fifth, `evidence` (`own` /
  `text`, `match-mode.ts:readMatchEvidence`), says whether the owner's
  confirmed facts and other resumes joined the judgment: a file or a paste on
  a launcher is judged on its text alone unless the person ticks "my own
  resume" or it reads exactly like one of theirs (TASKS R1), and a memo never
  answers across the two.
- `src/web/public/score.mjs` mirrors `src/resume/score.ts` line for line —
  change one, change the other; `src/web/score.test.ts` enforces parity.
  `src/web/public/evidence.mjs` mirrors `src/resume/evidence.ts` the same
  way (`src/web/evidence.test.ts`): since score v6 the live ring reads the
  evidence grade too (ADR 0058).
- The cron worker (`src/index.ts` + `src/jobs/*`) MUST NOT run an HTTP server.
- The dashboard lives in `src/web/` as a SEPARATE service (Hono). It shares
  Postgres with the worker but runs in its own container/process. It is
  read-mostly with limited writes (status changes, profile/settings edits,
  re-classify, candidate promote, resume upload / scan / match).

## DO NOT
- Do not add Express, Next.js, or any HTTP server to the worker process.
- Do not add Redis, BullMQ, or other queues — node-cron is sufficient.
- Do not expose the dashboard on a public interface by default — bind to `127.0.0.1` in compose.
- Do not store secrets anywhere except `.env` (gitignored). Three carve-outs, all deliberate: Telegram tokens and Discord webhook URLs belong in `NotificationTarget` rows once `init.ts` has bootstrapped them (ADR 0041), per-engine AI keys belong in `AppSettings.aiKeys` (ADR 0027) — in both cases `.env` becomes optional after first boot — and the built-in database's password lives in `db.json` (mode 0600) beside the database it guards (ADR 0054). A secret in the DB is read only through its own accessor, never rendered in full, never logged.
- Do not commit `node_modules`, `dist`, or `.env`.
- Do not use any `--save-dev` that isn't necessary.
- Do not scrape LinkedIn / Indeed / Glassdoor / Workday / Wellfound — see [ADR 0005](./docs/adr/0005-no-linkedin-indeed-workday.md).

## Testing
- `npm test` runs Node's built-in test runner across `src/**/*.test.ts`.
- Tests cover **pure modules only** (filter, text-utils, http, hn-parser,
  notifier helpers, stale-applications-format, fetcher mappers, prefilter
  parser). Modules that import Prisma or the Anthropic SDK are NOT
  unit-tested — they're verified via smoke runs (`npm run fetch:once`
  etc.) and integration testing through the dashboard.
- Adding a test: extract the pure piece into a separate file if needed
  (we did this for `formatStaleMessage`, `parsePrefilterResponse`,
  `decideStageStrategy`, `mapXFeed` mappers). The unit-test file lives
  next to the source as `*.test.ts`.
- CI runs `npm run lint:types` (`tsc --noEmit`) + `npm test` on every
  push and PR, around three gates: `npm audit --omit=dev
  --audit-level=high` (a fix the parent package has not shipped goes in
  `overrides` — deepmerge-ts 8 under prisma 6 today, GHSA-ggr8-5vv4-36mx;
  drop it once prisma releases the fix), `npm run exports:audit` (a dead or
  over-exported export fails) and `src/env-example.test.ts` (`.env.example`
  against `config.ts` and every `process.env` read). It then migrates a
  Postgres service, fails when `prisma migrate diff` finds the schema and
  the migrations apart, and runs the **route
  smoke** (`npm run smoke:routes` after `npm run build` —
  `src/scripts/route-smoke.ts`): fixtures in, every GET route one
  in-process request through `app.request()`, the first run's POSTs, a
  cross-origin POST refused, one clean PDF render, a file of rows through its
  preview and its import, then every page again in the pseudo-language, where
  one run of English outside the catalog fails the build as a 500 does (ADR
  0061, #356). Run it locally on a throwaway database only — it inserts rows and
  switches employer mode on (see `.github/workflows/test.yml`).
- The `local-start` job runs the default install on Linux (Node 22 and 24),
  macOS and Windows: `npm start` with a temporary `APPLYPACK_DATA_DIR`, the
  route smoke against the built-in database, `npm run stop`, nothing left.
  The `docker` job builds the image (never pushed), so the server option
  cannot rot between releases. `.github/dependabot.yml` opens the weekly
  update PRs: minor and patch together, each major on its own.

## Running
- `npm start` is the default install (ADR 0054): `npm run build` (tsc + the
  PDF fonts into `dist/`), then `dist/local/launcher.js`. Data lives in the OS
  app-data folder (`APPLYPACK_DATA_DIR` moves it). `npm run db` runs the
  database alone; `npm run stop` stops a running launcher.
- Docker is the server option and does not use the launcher: compose sets
  `DATABASE_URL` and runs `node dist/index.js` / `node dist/web/server.js`.
  `NODE_ENV=production` there makes the logs JSON (`logger.ts`); both
  services carry a healthcheck, `node dist/scripts/health-check.js web|worker`
  (`/health` with the Basic Auth credentials, or the age of the worker's
  `HEARTBEAT_FILE` — `src/heartbeat.ts`).
- Multi-stage Dockerfile: `deps → build → runtime`; `npm ci` from the
  lockfile, the build stage prunes the dev dependencies and deletes the
  built-in database's binaries, and the three CLI engines are pinned
  (`ARG CLAUDE_CODE_VERSION` …) — bump them together.
- Runtime image: `node:24-alpine`.
- `init.ts` runs `prisma migrate deploy` if `prisma/migrations/` exists,
  else falls back to `prisma db push`. Real migrations exist from
  `phase-3.0` onward.
- Use `.dockerignore` to exclude `node_modules`, `.env`, `dist`, `.git`.

---

## Where to look

The two lookup tables ("where does X live?" and "how does the user
toggle / configure X?") live in [docs/where-to-look.md](./docs/where-to-look.md).
**Grep it before any `find`** when you need the file, function or settings
page behind a feature; add a row there when a change adds or moves one.

---

## Gotchas (real bugs we paid for, codified so we don't pay again)

### 1. Hono `parseBody()` collapses multi-value form fields
Multiple checkboxes with the same name (e.g. `<input type="checkbox" name="seniority">` x4) collapse to **just the last value** with `c.req.parseBody()`. Use `parseBody({ all: true })` to get arrays. We hit this on the profile save form — it silently dropped 3 of 4 seniority values until we noticed.
- Pattern: any time the form contains `<input type="checkbox" name="X" multiple>` or repeated fields, the route handler MUST call `parseBody({ all: true })`.
- Test it: see `text-utils.test.ts:toStringArray` — the helper that wraps single → array.

### 2. `tsx` ignores `jsxImportSource` in tsconfig when entry is `.ts`
We use `hono/jsx` (server-side JSX). The `.tsx` files have a `/** @jsxImportSource hono/jsx */` pragma and tsconfig has `jsx: "react-jsx", jsxImportSource: "hono/jsx"`. **`tsc` honors both, `tsx` (the runner) does not** when a `.ts` entry-point imports a `.tsx` file. Symptoms: runtime "React is not defined" errors at request time.
- Fix: `npm run dev:web` does `tsc && node --watch dist/web/server.js`. Don't switch it back to `tsx watch`.
- Production runs `node dist/web/server.js` and is fine.

### 3. Anthropic deprecated Haiku 3.5 in 2026
Naming convention changed at the 4.x boundary:
- 4.x: `claude-haiku-4-5-20251001` (kebab-case, version-then-date)
- 3.x: `claude-3-5-haiku-20241022` (different pattern!)

Both stages of our two-stage classifier now use Haiku 4.5. Savings come from a much shorter prefilter prompt + tiny `max_tokens`, **not** from a cheaper model. See [classifier-prefilter.ts:7-12](src/classifier-prefilter.ts#L7-L12) for the comment that explains this.

**The prompt cache is not part of that, and never was.** Measured 2026-09-02:
`cache_creation_input_tokens` is **0 on every call**. The minimum cacheable
prefix is per-model and not monotonic — **4096 tokens on Haiku 4.5** against 512
on Opus 5 — and our classifier system prompt is 1216. Even the multi-search
prompt at 8 searches (~2100) stays under it, and the `claude_code` CLI sets no
`cache_control` at all. Never justify a design by caching without checking the
model's floor and reading `usage.cache_read_input_tokens` back.

### 4. RemoteOK puts a meta object at `array[0]`
Their `/api` returns `[{legal: "…", last_updated: …}, …jobs]`. **`.slice(1)` is mandatory** before zod-validating jobs. See [remoteok.ts:52-53](src/fetchers/remoteok.ts#L52-L53).

### 5. `stripHtml` had to learn numeric entities
HN comments use `&#x2F;` (`/`), `&#x27;` / `&#39;` (`'`), `&#x26;` (`&`). The first version of `stripHtml` only knew named entities (`&amp;`, `&lt;` …) and let numeric ones leak into title/location. We now decode `&#xHH;` and `&#NN;` patterns generically — see [http.ts:stripHtml](src/http.ts).

### 6. Greedy regex backtracking in HN parser
The "Company is hiring …" pattern initially captured "Sumble is the newco from the founders of Kaggle. We" because the regex backtracked across a sentence boundary to find a working `\s+(is|are)\s+hiring` anchor. Three fixes applied together:
- Length cap on capture group (`{1,30}?`)
- Pronoun blocklist on captured value (`We`, `I`, `Our`, …)
- `/\.\s/` post-check rejects captures spanning a sentence

See [hn-parser.ts:27-40](src/fetchers/hn-parser.ts#L27-L40) and the sentence check at [hn-parser.ts:78](src/fetchers/hn-parser.ts#L78).

### 7. Prisma migrations baseline isn't automatic
When the project switched from `db push` to real migrations in phase-3.0, we couldn't just run `prisma migrate dev --name baseline` — it would have wiped the database. The procedure was:
- Create the migration directory by hand
- `prisma migrate diff --from-empty --to-schema-datamodel … --script` to generate the SQL
- `prisma migrate resolve --applied <name>` to mark it without running

`init.applySchema()` still has a fallback to `prisma db push` if `prisma/migrations/` is missing — Phase 1 deployments without migrations still work.

### 8. `claude-haiku-4-5` is a strict role-type vs tech-stack judge — but only if you tell it
We split `Profile.stackRequired` and `Profile.roleTypes` because Claude was scoring "Senior Full-Stack Rails Engineer" at fit=92 for a PHP/Laravel candidate (because `full-stack` was in stackRequired). The fix is mostly in the prompt — a paragraph of explicit `CRITICAL — TECH STACK MATCHING` rules in [classifier.ts:buildSystemPrompt](src/classifier.ts).

The same paragraph also handles location: `Remote · Germany` / `🇩🇪 …` / `(m/w/d)` are explicit country-lock signals, NOT a US-eligible match even when the profile lists "Worldwide".

### 9. Worker and web are separate processes — read settings on every tick
A toggle in `/settings` writes to Postgres immediately. Worker reads it at the start of the next cron tick (so changes are visible within at most an hour). Don't try to short-circuit by caching settings in the worker — that defeats the live-toggle UX.

### 10. There is NO "all Greenhouse jobs" API — coverage is two-tier by design
Greenhouse / Lever / Ashby / Workable / SmartRecruiters are **HR vendors, not job boards**. Their public APIs only expose `/v1/boards/<slug>/jobs` — you have to know the company slug. There is no global "list every Greenhouse posting" endpoint, and crawling vendor customer lists is grey-zone scraping (ADR 0005 forbids it: no LinkedIn / Indeed / Workday / Wellfound / JobSpy).

Coverage is therefore **two-tier**:

1. **Direct boards** (per-company, narrow but precise) — `Company` rows with `atsType ∈ {GREENHOUSE, LEVER, ASHBY, WORKABLE, SMARTRECRUITERS, RECRUITEE, BREEZY, BAMBOOHR, PINPOINT, RIPPLING, PERSONIO, TEAMTAILOR}`. Curated by the user via `/companies` (paste a board URL → manual probe → save) or seeded in `src/seed.ts`. Catches every job at the companies you've added; misses everything else.
2. **Cross-company aggregators** (broad but noisy) — `LARAJOBS_RSS`, `REMOTEOK`, `REMOTIVE`, `JOBICY`, `WEWORKREMOTELY`, `HN_HIRING`, `HN_JOBS`, `ARBEITNOW`, `GOLANGPROJECTS`, `WORKINGNOMADS`, `HIMALAYAS`, `FOURDAYWEEK`, `SOLIDJOBS`, `DEVITJOBS`, `LANDINGJOBS`, `JOBTECH`, `DOU`, `DJINNI`, `ADZUNA`, `FRANCETRAVAIL` (the last two need the user's key). Each is a single synthetic Company row that ingests jobs from many employers we'd never seed individually (PSI CRO, ManTech, DoorDash, Lemon.io, …). Catches the long tail; lets `passesBaseFilter` + Claude cull the noise.

Common user trap: disabling all aggregators in `/settings → Job sources` because "I want only Greenhouse" produces near-zero new jobs (a fresh install has no employer board switched on — they arrive as starter packs, and most post a matching role rarely; ADR 0040). The cure is to **leave aggregators enabled** and let the profile filter narrow scope. Document this in any user-facing copy that talks about "monitoring".

When a user finds a job at a company we don't track (e.g. via LinkedIn), the right path is:
- Paste the board URL into `/companies → Add company` — the form runs `extractAtsToken` + `probeAts` and refuses to save if the slug doesn't resolve. One-click promote into the rotation.
- Or, the HN parser harvests ATS URLs from comments automatically (when `discoveryEnabled` is on) — they show up on `/discovery` as PENDING candidates.

### 11. Claude scores stack mismatches generously unless the rubric caps them — in EVERY prompt

The same failure as gotcha 8, but in the resume-match rubric: a Laravel/Vue
resume scored **82/100** against a Node.js/React posting, because "add"
credit leaked to sibling tech and the only penalty was −10 per red flag.
The fix mirrors the classifier's: `MATCH_SYSTEM` step 3 is a **primary-stack
gate** (share of the posting's core languages/frameworks "present" caps the
score — none → ≤30), "add" is forbidden for sibling technologies
(Vue ≠ React, PHP ≠ Node.js), and the summary must open with the stack
verdict ("Primary stack 0/5 …"). Verified: same resume, 10/100 vs a Node
posting and 92/100 vs a Laravel posting. Rule of thumb: any new scoring
prompt needs an explicit hard-cap rule, or Claude will average its way to a
flattering number. Guard test: `prompts.test.ts` "primary-stack gate".
Since ADR 0012 the model does no arithmetic at all: it marks `primary` /
`requirement` / `status` facts and `src/resume/score.ts` applies the caps —
the gate is now a unit-tested code path (`score.test.ts`), not a prompt rule.

Same prompt, second lesson: removal "quote" spans leaked into protected
text — one highlighted the contact line (with the email) to advise dropping
a ZIP code, another highlighted a whole skills line containing Docker and
GitLab CI/CD the posting wanted. Removals carry two hard rules (PROTECTED
contact line; KEEP WANTED KEYWORDS with itemised drop/keep lists) — guard
test "removals rules protect the contact line".

Third lesson, 2026-09-06: **the prompt rule alone did not hold.** The same
model quoted `"Symfony, React, Vue, Laravel, Lumen, Phalcon"` whole to
advise dropping three of the six, with React (must, primary) and Vue.js
(must) inside the span the editor strikes through and deletes in one press.
Both rules are `replacement-gate.ts:gateRemovals` now (ADR 0044) — a quote
covering contact details or a wanted keyword loses its `quote` and keeps its
advice. Rule of thumb, third time: a rule the user can lose data to belongs
in code, and the prompt keeps it only as an explanation.

### 13. `empty` from a fetcher is not proof the board is alive

Measured 2026-08-30 across all 71 active sources. Two failure modes hide
behind a zero count, and a naive "no jobs = healthy" rule marks both green
forever:

- **7 of 10 per-company vendors `return []` on a malformed top-level
  payload** (Workable, Recruitee, BambooHR, Pinpoint, Breezy, Rippling,
  SmartRecruiters). Only Greenhouse / Lever / Ashby throw on shape drift.
  *(2026-09-24: six of twelve now. SmartRecruiters throws since v2.6.2,
  and Personio and Teamtailor, added later, throw on a body that is not
  their feed.)*
- **SmartRecruiters answers HTTP 200 with `totalFound: 0` for every
  identifier** — `Visa`, `Bosch`, `IKEA`, and a random non-existent string
  alike, under our UA and a browser UA. A dead slug there is byte-identical
  to a live board.

Hence ADR 0019 keeps two signals, not one: the failure streak (`ok`,
`empty` and, since ADR 0035, `not_modified` reset it, everything else
increments) *and* `lastOkAt`, which advances on `ok`, and on
`not_modified` only when the last full read carried rows
(`source-health.ts:advancesLastOk`). A source stuck on `empty` ages into
"silent" without ever touching the streak.

Two related traps in the same area:

- **Status must come from the RAW pre-filter count.** 46 of 65 active
  companies hold zero `Job` rows — that is `passesBaseFilter` doing its job,
  not a broken board. Reading health off stored jobs makes the feature noise.
- **A timeout does not arrive as an `AbortError`.** `fetchWithRetry` rewrites
  it into a plain `Error` whose only marker is the message
  `… timed out after Nms`. And a dead BambooHR slug arrives as a *refused
  redirect* (302 → `redirect: 'error'`), not a 404.

### 14. The prompt is a CLI argument — untrusted text can become a flag

`buildClaudeCodeArgs` passes the user prompt as the **last positional
argument** of `claude --print`. When F12 fenced the prompts, the markers were
`--- BEGIN UNTRUSTED X ---`, so every prompt now *started* with `---` and the
CLI answered `error: unknown option '--- BEGIN…'`. All five `bench:resume`
fixtures failed at once.

Two fixes, both kept:

- `'--'` before `req.user` ends option parsing. This was a **pre-existing**
  hole: the prompt carries attacker-controlled text, so any description
  starting with `-` could already have become a flag — the classifier only
  escaped it by accident, because its user prompt opened with `Title: `.
- Markers moved to `=== BEGIN UNTRUSTED X ===`. Marker shape is constrained
  from two directions: `<UNTRUSTED X>` has a tag shape and `stripHtml` eats it
  (gotcha 12), `--- … ---` has a flag shape. `===` is inert to both.

`gemini_cli` passes the prompt as a flag *value* and `codex_cli` as a
positional that begins with our system text, so neither was exposed. Both
were closed anyway on 2026-09-28 (H46): on gemini 0.46.0, `--prompt "--- x"`
exits *"Not enough arguments following: prompt"* — yargs reads a separate
value that opens with `-` as the next flag — so the value rides as
`--prompt=…`, which keeps any text one argument; Codex's `PROMPT` is a plain
clap positional (no `allow_hyphen_values`), so `--` goes before it as it does
for Claude. Every CLI child also gets its stdin closed at spawn: Codex and the
Gemini CLI read stdin when it is not a terminal, and an open pipe would hold
them until the timeout.

### 15. Node's `fetch` sabotages conditional requests unless you set Cache-Control

Conditional requests (ADR 0035) shipped green — unit tests passing, `If-None-Match`
demonstrably on the wire — and revalidated **nothing** on two of the vendors
that `curl` got a 304 from. Lever and SmartRecruiters returned 200 with a
byte-identical ETag.

The cause is in the fetch spec, not the vendors. A request carrying
`If-None-Match` / `If-Modified-Since` has its cache mode flipped to
"no-store", and a no-store request gets `Pragma: no-cache` **and
`Cache-Control: no-cache`** appended — unless the caller already set them.
Express's `fresh()` reads that *request* directive exactly as written and
refuses to answer 304. `conditionalHeaders` therefore sends
`Cache-Control: max-age=0` with every validator: a stored copy is fine once
revalidated, which is what we actually mean. (`Pragma` makes no difference —
`fresh` ignores it — so it is left alone.)

Two lessons, both cheap:

- **Read what the server sees.** `fetch('https://postman-echo.com/get')`
  printed the two headers nobody wrote, in one call. Guessing at
  encodings and user agents took longer and found nothing.
- **A live double-tick is the only proof.** Unit tests cover the cache, not
  the vendor's answer, and this would have shipped as "conditional requests
  are on" while every feed was still downloaded in full. See
  `docs/scale-plan.md` §6 for what the run has to show.

A related measurement from the same run: **We Work Remotely's ETag is a hash
of a body that is not byte-stable** — four consecutive requests, four
different ETags. Its `Vary: Accept-Encoding, Origin` and a 304 on a lucky
pair of requests make it look like a revalidating source; it is not. A
vendor that "supports ETag" is not the same as a vendor whose feed is stable
enough for it to fire.

### 16. `max_tokens` counts the thinking, and the default resume model thinks

Found on a fresh install with four resumes (#159, 2026-09-04): every
comparison failed in both modes, and the log said *"no JSON object in
reply"* about a reply that was 96 % a JSON object. `stop_reason` was
`max_tokens` — 6 078 of the 8 000 output tokens had gone to thinking and
the JSON was cut off mid-string. Claude Opus 5 (the `CLAUDE_MODEL_RESUME`
default) thinks by default, `max_tokens` includes the thinking, and every
budget in `prompts.ts` was sized against a non-thinking answer. It surfaced
with the fourth resume because the prompt grew (122 "other resume" hints),
and the thinking grew with it.

Three rules, all in code now:
- A budget constant is the ANSWER's size. `anthropicMaxTokens` adds the
  headroom on the Anthropic path, as the OpenAI path already did for gpt-5 /
  o-series; the sum stays under the SDK's non-streaming ceiling (~21 300).
- The provider reads `stop_reason`: `max_tokens` and `refusal` are failures
  with a reason, never text handed to a parser.
- A reply that stopped inside the JSON is not retried (`ai-json.ts`) — the
  identical call stops in the identical place, so the retry was pure cost.

### 17. A status is the model's verdict on the analysed text — the text outranks it

Found 2026-09-08 on the targeted view: typing `Ajax` moved the ring +3,
typing `WordPress` or `BEM` moved nothing — and that WordPress already sat on
the resume's own title line while the stored row called it `cannot_claim`
("no WordPress work anywhere in resume") and capped the score at 70 as a
missing primary. `entriesFromLive` gave a typed `cannot_claim` zero "for
claim safety" and `anchorStatuses` never revisited one, so the number under
the editor and the number the next analysis stored disagreed about the same
text; the first fix that morning (a confirm tier, "I have it") asked the
candidate to restate what their resume already said. ADR 0045: presence is
read off the text on both sides, for every status, and the model's "named,
nothing behind it" is the `evidence` grade, never the status. Measured before
deciding: 29 of 1 215 stored `cannot_claim` rows were written, and the 8
homonyms among them (GCP = Good Clinical Practice) all sat on comparisons
scoring 0.

### 18. A located quote proves the line exists, not what it says about the term

Found 2026-09-09 on the first real screening: the same resume uploaded as
.docx and as .pdf scored 78 and 69. Every difference sat on a LIST line.
The model called the same "Technology Stack: Node, TypeScript, AWS…" line
"production" in one run and "role" in the next; it quoted the stack line
of one job for "Sentry / New Relic" because Datadog was on it; and the
.docx skills table came out of the reader as one line — label cell,
` | `, values cell — which `isTermList` read as prose, so CSS3 on it was
"production" 3/3 in the .docx and "listed" 0.9/3 in the .pdf, where the
same table is eight short lines. The anchor accepted all of it because the
quote was in the text.

Three rules, all in code (`anchor.ts:listCap`, `evidence.ts:segmentAt`):
a quote that is a list of terms carries at most `listed`, or `role` when
the list is a job's own stack line — `production` is a work bullet with an
outcome; a flattened table row is judged around the term's own cell; and a
term the matcher cannot find anywhere in the text is `absent` whatever the
model quoted (ADR 0045, applied to the employer side). Rule of thumb: the
anchor must check what the quote SAYS about the term, not only that the
quote exists — and any evidence rule that reads "the line" has to survive a
table row rendered as one line.

### 12. stripHtml: decode entities FIRST, and never re-run it on its own output

Three lessons paid for with one broken evening (2026-08-30):

- **Greenhouse ships job bodies HTML-escaped** (`&lt;p&gt;…`). The old
  strip-tags-then-decode order found no tags to strip, then the decode step
  rematerialised them — all 535 stored Greenhouse descriptions carried raw
  `<div class="content-intro">…` markup as visible text. Decode first,
  and decode `&amp;` LAST so `&amp;lt;` stays a literal `&lt;` instead of
  double-decoding into a phantom tag.
- **Line structure comes from block tags, not source newlines.** Raw `\n`
  in HTML is whitespace; stripHtml collapses it, then rebuilds paragraphs
  from `<p>/<div>/<h*>` boundaries, `<br>` and `<li>` (→ `• `). That is what
  makes descriptions readable — see the tests in `src/http.test.ts`.
- **stripHtml is NOT idempotent on its own plaintext output** — a second
  pass reads the newlines it just created as whitespace and flattens them.
  `backfill-descriptions.ts` therefore only strips rows that still match a
  markup regex; everything else gets entity decoding only. When structure
  is already lost, `refetch-descriptions.ts` re-pulls the boards and updates
  descriptions in place (no inserts). Never point either script at MANUAL
  rows with tag stripping — pasted prose like "salary < 100k" is not markup.

---

## ATS templates (when adding a new source)

Reference patterns, one per feed shape — copy whichever fits the new source:

| Shape of the new ATS | Reference file | Examples |
| --- | --- | --- |
| Single curated RSS | `src/fetchers/larajobs.ts` | RSS one feed for the whole site, no per-company config |
| RSS whose title carries the structure, one row per query | `src/fetchers/dou.ts` + `dou-title.ts` | atsToken = the feed's query string; a pure title-grammar parser; fetched with the project UA because the board blocks rss-parser's |
| RSS whose LOCATION lives in the filter, not the items | `src/fetchers/djinni.ts` | atsToken = the filter string; `djinniPlace(token)` writes the location + hints from it; rows whose category ≠ the requested keyword are the bare-feed fallback and are dropped |
| Per-category RSS, atsToken = category slug | `src/fetchers/weworkremotely.ts` | Same pattern, atsToken changes per Company row |
| Single JSON aggregator | `src/fetchers/remotive.ts` | One feed, structured JSON, all jobs under one synthetic Company |
| Per-company GET JSON | `src/fetchers/ashby.ts` | atsToken = company slug, GET endpoint, no auth |
| Per-company POST JSON (no description in list) | `src/fetchers/workable.ts` | POST with body, list-only data |
| Per-company list + per-job detail | `src/fetchers/smartrecruiters.ts` | List + N detail fetches with rate limit |

Always:
1. Add the new value to `AtsType` enum in `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_<X>` to generate the migration
3. Wire into `src/fetchers/index.ts:fetchOne` switch
4. Add ONE reference board to `src/seed.ts`, `active: false` (the seed ships no employer board on — curated ones go to `src/starter-packs/catalog.json`, ADR 0040)
5. Extend `src/text-utils.ts:extractAtsToken` if discoveryEnabled should pick up URLs from this ATS
6. Extend `src/ats-probe.ts:probeAts` if the new ATS is per-company (so manual /companies add validates tokens)
7. Add a unit test for the pure mapper if you have a `mapXFeed(parsed, companyId)` helper
8. An aggregator (one row, many employers) sets `employer` from the feed's own field through `cleanEmployer` — `null` when the feed does not say, never the aggregator's name (ADR 0056); a per-company source leaves it out

---

## Common operational tasks (one-line answers)

| Task | Command |
| --- | --- |
| Run ApplyPack without Docker | `npm start` (Ctrl+C or `npm run stop` to stop); for watchers `npm run db` + `npm run dev` + `npm run dev:web` |
| Back up a local install | automatic: `snapshots/<date>` in the data folder, the newest three; for a copy elsewhere stop it and copy the data folder (`~/Library/Application Support/ApplyPack`, `%APPDATA%\ApplyPack`, `~/.local/share/applypack`) |
| Move a Docker install into `npm start` | on Docker: `docker compose exec -T postgres pg_dump -U jobhunter --data-only --inserts --column-inserts jobhunter > data.sql`; here, with only `npm run db` running: `npm run db:import -- data.sql --yes` |
| Test the launcher on a scratch folder | `APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start` — never the live data folder |
| Run one fetch tick now | UI: Overview → "Fetch now" (live progress, row on `/runs`; runs outside the schedule, and while paused stores the jobs unscored); or `docker compose exec app node dist/scripts/fetch-once.js`, which does the same without the dashboard and is recorded as a `fetch-now` run |
| Run discovery probe now | `docker compose exec app node dist/scripts/discovery-once.js` |
| Pull HN Who-is-hiring now | `docker compose exec app node dist/scripts/hn-once.js` |
| Run the application-pack queue now | `docker compose exec app node dist/scripts/pack-once.js` (the worker does this every minute; recorded as a `pack` run) |
| Send the stale-applications digest now | `docker compose exec app node dist/scripts/stale-once.js` |
| Send 4 test Telegram messages | `npm run test:telegram` (locally, .env loaded) |
| Tail the worker | `docker compose logs -f app` (JSON; add `--no-log-prefix … \| npx pino-pretty` for lines) |
| Tail the dashboard | `docker compose logs -f web` |
| psql into the DB | `docker compose exec postgres psql -U jobhunter -d jobhunter` |
| psql / Prisma from the HOST | port **5433** (`postgresql://jobhunter:jobhunter@localhost:5433/jobhunter`) — compose publishes the DB on loopback only, on 5433 so a host Postgres on 5432 cannot shadow it |
| Back up the database | `docker compose exec -T postgres pg_dump -U jobhunter jobhunter > applypack-$(date +%F).sql` (verified: 8.7 MB, 16 tables; restore into an empty DB with `psql < dump`) |
| Re-clean stored descriptions (rows with leftover markup) | `docker compose exec app node dist/scripts/backfill-descriptions.js --dry-run`, then without the flag |
| Fingerprint existing jobs + link cross-listings | `docker compose exec app node dist/scripts/backfill-fingerprints.js --dry-run`, then without the flag |
| Flag apply links on already-stored jobs | `docker compose exec app node dist/scripts/backfill-apply-link-flags.js --dry-run`, then without the flag |
| Re-pull descriptions from the boards (structure lost) | `docker compose exec app node dist/scripts/refetch-descriptions.js --dry-run`, then without the flag |
| Migrate after a schema change | `DATABASE_URL=… npx prisma migrate dev --name <name>` |
| Re-classify everything against the active profile | UI: `/settings` → Job search → "Save & re-classify" |
| Pause all alerts temporarily | UI: `/settings` → Notifications → "Alerts" → Disable (what is found meanwhile waits, then arrives in one message per chat) |
| Pause new-job fetching entirely (no docker) | UI: `/settings` → Job search → "Automatic job search" → Pause, or the Pause button in the Overview header |
