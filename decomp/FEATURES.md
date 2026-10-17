# Feature catalog (consolidated, 768 features)

Generated from the feature tables in sections 01-09. The full row (what it does, config) is in the linked section file. Use this as the rewrite checklist: every ID is either rebuilt, merged, or consciously dropped.

## 01 Data model & persistence (69)

Source: [01-data-model.md](./01-data-model.md)

| ID | Feature | Trigger |
|---|---|---|
| DAT-01 | Single database client | process start |
| DAT-02 | Unique-violation detection | any racy write |
| DAT-03 | Retry-once on unique race | racy writes (job insert, targets, etc.) |
| DAT-04 | Single-connection URL | worker start |
| DAT-05 | Global write lock | settings/resume/profile/user writes |
| DAT-06 | Install settings singleton | any settings access |
| DAT-07 | Per-user settings row | any personal setting access |
| DAT-08 | Column classification (global vs personal) | build/test |
| DAT-09 | Layered schedule | every heartbeat / alert decision |
| DAT-10 | Schedule save planning | settings form submit |
| DAT-11 | Display settings read | each page request |
| DAT-12 | Setup completion + language keep | wizard finish/skip |
| DAT-13 | Instance identity | worker boot |
| DAT-14 | AI engine config storage | AI settings tab |
| DAT-15 | AI key storage (atomic merge) | AI settings tab |
| DAT-16 | Source key storage (atomic merge) | Sources settings |
| DAT-17 | Classifier mode | settings |
| DAT-18 | Fetch pause / source toggles | settings, discovery page |
| DAT-19 | Discovery toggle | settings |
| DAT-20 | Source-health alert switch | settings |
| DAT-21 | AI budget | settings, per AI call |
| DAT-22 | Engine endpoints | AI tab |
| DAT-23 | Update check state | weekly cleanup |
| DAT-24 | Employer mode switch + retention | settings |
| DAT-25 | Employers-filled marker | boot |
| DAT-26 | Personal switches | settings |
| DAT-27 | Re-apply window | settings |
| DAT-28 | Cover-letter standing angles | letter generation |
| DAT-29 | Pipeline stage config | settings |
| DAT-30 | Pack settings | settings |
| DAT-31 | Locale | menu, settings, wizard |
| DAT-32 | Notification targets | settings |
| DAT-33 | Telegram target test | user clicks Test |
| DAT-34 | Company mutes | user |
| DAT-35 | Source catalog | seed, UI, import |
| DAT-36 | Folder-source ledger | worker tick |
| DAT-37 | Job storage | fetch / paste / import |
| DAT-38 | Per-profile scores | classifier |
| DAT-39 | Per-user job state | classifier, UI |
| DAT-40 | Stage history | UI |
| DAT-41 | Searches (profiles) | settings |
| DAT-42 | Resume storage | upload |
| DAT-43 | Resume review history | user |
| DAT-44 | Resume match storage | user, pack |
| DAT-45 | Tailored resume | user, pack |
| DAT-46 | Candidate facts | user |
| DAT-47 | Cover letters | user, pack |
| DAT-48 | Posting briefs | match flow |
| DAT-49 | Job verification | user |
| DAT-50 | Application packs | tick / user |
| DAT-51 | Screening (employer mode) | admin |
| DAT-52 | AI call ledger | every AI call |
| DAT-53 | Run history | every scheduled job |
| DAT-54 | Funnel rollup | each fetch tick |
| DAT-55 | Discovery candidates | HN parse, probes |
| DAT-56 | Gmail connection + ledger | worker hourly / Check now |
| DAT-57 | Reactive Resume connection | settings |
| DAT-58 | Users and roles | sign-in |
| DAT-59 | OIDC provisioning | sign-in |
| DAT-60 | Role/removal rules | admin UI |
| DAT-61 | User summaries | users page |
| DAT-62 | Route access classes | every request |
| DAT-63 | Fallback user | no-sign-in installs |
| DAT-64 | Seed sources | boot (init) |
| DAT-65 | Retention cleanup | daily cron |
| DAT-66 | SQL dump splitter | db-import |
| DAT-67 | Import planning | db-import |
| DAT-68 | Destructive import | CLI `db:import` |
| DAT-69 | Normalized job contract | all fetchers |

## 02 Job sourcing & ingestion (113)

Source: [02-job-sourcing.md](./02-job-sourcing.md)

| ID | Feature | Trigger |
|---|---|---|
| SRC-01 | Hourly fetch heartbeat | S |
| SRC-02 | User fetch schedule gate | S |
| SRC-03 | Global pause | U / S |
| SRC-04 | Single fetch lock | E |
| SRC-05 | Lock waiting | S |
| SRC-06 | Manual "Fetch now" | U |
| SRC-07 | CLI one-shot fetch | U |
| SRC-08 | Roster selection | S |
| SRC-09 | Randomised walk order | S |
| SRC-10 | Polite inter-source delay | S |
| SRC-11 | Per-source check interval | S |
| SRC-12 | Source family switches | U |
| SRC-13 | Search-place context | S |
| SRC-14 | Keyed-source credentials | U |
| SRC-15 | Conditional requests | S |
| SRC-16 | Source-health recording | S |
| SRC-17 | Quiet/silent detection | S |
| SRC-18 | Re-probe | U |
| SRC-19 | Delisting reconciliation | S |
| SRC-20 | Clock-dated marking | S |
| SRC-21 | Run record and stats | S / U |
| SRC-22 | Paused/abort handling | U |
| SRC-23 | Base filter union | E |
| SRC-24 | Employer identity | E |
| SRC-25 | Mute / recently-applied gate | E |
| SRC-26 | Exact dedupe | E |
| SRC-27 | Cross-listing annotation | E |
| SRC-28 | Location parsing at ingest | E |
| SRC-29 | Unscored storage mode | U / S |
| SRC-30 | Prefilter parking | E |
| SRC-31 | Per-person rows | E |
| SRC-32 | Classification concurrency | E |
| SRC-33 | Unstored tracking | E |
| SRC-34 | Alert routing hooks | E |
| SRC-35 | Greenhouse adapter | S |
| SRC-36 | Lever adapter | S |
| SRC-37 | Ashby adapter | S |
| SRC-38 | Workable adapter | S |
| SRC-39 | SmartRecruiters adapter | S |
| SRC-40 | Recruitee adapter | S |
| SRC-41 | Breezy adapter | S |
| SRC-42 | BambooHR adapter | S |
| SRC-43 | Pinpoint adapter | S |
| SRC-44 | Rippling adapter | S |
| SRC-45 | Personio adapter | S |
| SRC-46 | Teamtailor adapter | S |
| SRC-47 | LaraJobs | S |
| SRC-48 | RemoteOK | S |
| SRC-49 | Remotive | S |
| SRC-50 | Arbeitnow | S |
| SRC-51 | We Work Remotely | S |
| SRC-52 | Golang Projects | S |
| SRC-53 | Jobicy | S |
| SRC-54 | Working Nomads | S |
| SRC-55 | Himalayas | S |
| SRC-56 | 4 Day Week | S |
| SRC-57 | DOU.ua | S |
| SRC-58 | Djinni | S |
| SRC-59 | solid.jobs | S |
| SRC-60 | DevITjobs family | S |
| SRC-61 | Landing.jobs | S |
| SRC-62 | JobTech (Sweden) | S |
| SRC-63 | Hacker News /jobs | S |
| SRC-64 | Hacker News Who-is-hiring (walk) | S |
| SRC-65 | Adzuna | S |
| SRC-66 | France Travail | S |
| SRC-67 | Generic feed source | S |
| SRC-68 | Careers-page change watch | S |
| SRC-69 | Paste-the-page watch | U |
| SRC-70 | Page-change notices | S |
| SRC-71 | Add companies by URL (resolver) | U |
| SRC-72 | Watch / unwatch / interval / policy | U |
| SRC-73 | Add company by token | U |
| SRC-74 | Token probe | U / S |
| SRC-75 | Active toggle / delete | U |
| SRC-76 | Company mutes | U |
| SRC-77 | ATS URL harvesting | S |
| SRC-78 | Candidate review | U |
| SRC-79 | Weekly candidate probe | S / U |
| SRC-80 | HN monthly pull | S / U |
| SRC-81 | Seed data | E |
| SRC-82 | Starter packs | U |
| SRC-83 | Source suggestions by country | U |
| SRC-84 | Pack suggestions | U |
| SRC-85 | Manual paste | U |
| SRC-86 | Posting URL reader | U |
| SRC-87 | Posting fact extraction | U / E |
| SRC-88 | Description refresh | U |
| SRC-89 | Description edit | U |
| SRC-90 | File import upload | U |
| SRC-91 | Column mapping | U |
| SRC-92 | Import preview | U |
| SRC-93 | Import run | U |
| SRC-94 | Row mapper | U / S |
| SRC-95 | Folder source create/check | U |
| SRC-96 | Folder access rules | S |
| SRC-97 | Folder row files | S / E |
| SRC-98 | Folder saved postings | S / E |
| SRC-99 | Saved-page readers | S |
| SRC-100 | Folder ledger | S / U |
| SRC-101 | Folder watcher | E |
| SRC-102 | Folder alerts off | U |
| SRC-103 | Gmail connect | U |
| SRC-104 | Label and check-now | U |
| SRC-105 | Gmail hourly and requested checks | S |
| SRC-106 | Mail reading | S |
| SRC-107 | Mail extraction | S |
| SRC-108 | Gmail job mapping | S |
| SRC-109 | Gmail ledger and window | S |
| SRC-110 | Gmail status | U |
| SRC-111 | France Travail mirror | S |
| SRC-112 | Retention cleanup | S |
| SRC-113 | Backfill/refetch scripts | U |

## 03 Job pipeline, scoring & alerts (82)

Source: [03-job-pipeline-and-alerts.md](./03-job-pipeline-and-alerts.md)

| ID | Feature | Trigger |
|---|---|---|
| PIP-01 | Worker boot sequence | Worker start |
| PIP-02 | Cron scheduler | Worker start |
| PIP-03 | Per-install minute spreading | Worker start |
| PIP-04 | Graceful shutdown | Signal |
| PIP-05 | Worker heartbeat file | Timer |
| PIP-06 | Run tracking | Every cron beat |
| PIP-07 | Live run progress | During runs |
| PIP-08 | Per-person job runner | Digest/stale/gmail beats |
| PIP-09 | Single-fetcher advisory lock | Any fetch start |
| PIP-10 | Lock waiting | Fetch/gmail beats |
| PIP-11 | Hourly fetch tick | Cron `5 * * * *` (minute spread) |
| PIP-12 | Manual / scoped fetch | User, folder watcher |
| PIP-13 | Fetch schedule gate | Each hourly beat |
| PIP-14 | Pause switch and mid-run abort | Settings toggle |
| PIP-15 | Source walk selection | Inside tick |
| PIP-16 | Conditional-request cache | Tick end |
| PIP-17 | Candidate prep: date and place | Per posting |
| PIP-18 | Location text parser | Per posting |
| PIP-19 | Base filter (per search) | Per posting |
| PIP-20 | Union filter + furthest reason | Per posting |
| PIP-21 | Whole-word title keyword matching | Per keyword |
| PIP-22 | Blank-search exclusion | Every tick/re-score |
| PIP-23 | Employer gate (mute / re-apply window) | Per posting |
| PIP-24 | Employer key normalization | Ingest |
| PIP-25 | Dedup on store | Per posting |
| PIP-26 | Cross-listing fingerprint | On store |
| PIP-27 | Unscored store | Manual fetch while paused |
| PIP-28 | Prefilter (stage 1) | Per posting |
| PIP-29 | Full classification | Per posting |
| PIP-30 | Prompt contract | Per call |
| PIP-31 | No-stack score cap | Post-parse |
| PIP-32 | AI location merge | After classify |
| PIP-33 | Priority rules | techs |
| PIP-34 | Dismiss reason per search | Per verdict |
| PIP-35 | Verdict merge | After verdicts |
| PIP-36 | Per-person persistence | After merge |
| PIP-37 | Watchlist policy "all" | Per posting |
| PIP-38 | Currency/period normalization | Dismiss logic, messages |
| PIP-39 | Apply-link flags | On persist |
| PIP-40 | Auto application pack queueing | After store |
| PIP-41 | Alert decision per keeper | After store |
| PIP-42 | Alert modes | Per match |
| PIP-43 | Instant alert message | Per match |
| PIP-44 | Send failure handling | Per send |
| PIP-45 | Target resolution | Per send |
| PIP-46 | Held-alert delivery | Each tick |
| PIP-47 | Held release rule | Each tick |
| PIP-48 | Page-change notices | Tick |
| PIP-49 | Daily recap (digest) | Hourly beat, gated by digest hour |
| PIP-50 | Stale-applications nudge | Hourly beat, first digest hour |
| PIP-51 | Digest hour gating | Hourly |
| PIP-52 | Weekly cleanup | Sunday 03:00 |
| PIP-53 | Monthly HN thread pull | 06:xx on the 1st |
| PIP-54 | Weekly discovery probe | Sunday 04:xx |
| PIP-55 | Slug discovery from fetched postings | Fetch tick |
| PIP-56 | Pack runner beat | Every minute |
| PIP-57 | Gmail beats | Cron |
| PIP-58 | Reclassify all | "Save & re-classify" (profile save) |
| PIP-59 | Status after re-score | Re-score |
| PIP-60 | Score unscored (wizard) | Wizard step |
| PIP-61 | Per-job re-classify | Job page, paste, edit, description refresh |
| PIP-62 | Posting edit | User edit |
| PIP-63 | Location mismatch explanation | Job page |
| PIP-64 | Residence coverage | Explanations |
| PIP-65 | Search profile management | Settings |
| PIP-66 | Filter-change detection | Settings save |
| PIP-67 | Liveness ladder (free) | User "verify" (free first) |
| PIP-68 | Page classification | In ladder |
| PIP-69 | Delisting tracking | Fetch walk |
| PIP-70 | Deep verification (AI) | User "Deep check" or when free rungs uncertain |
| PIP-71 | Search funnel rollup | After runs |
| PIP-72 | Source yield | Dashboard |
| PIP-73 | Telegram delivery | Any send |
| PIP-74 | Discord delivery | Any send |
| PIP-75 | Alert channel state | Everywhere |
| PIP-76 | Operator notices | Event |
| PIP-77 | Pack-ready notice | Pack runner |
| PIP-78 | AI engine cooldown (consumer) | Within AI calls |
| PIP-79 | Once-scripts | Operator |
| PIP-80 | Health check | worker`: worker healthy iff heartbeat file age <= 180 s. |
| PIP-81 | Per-user alert schedule defaults | Settings |
| PIP-82 | Folder-watch quick check | File event |

## 04 AI layer (60)

Source: [04-ai-layer.md](./04-ai-layer.md)

| ID | Feature | Trigger |
|---|---|---|
| AIL-01 | Unified completion seam | event (every AI call) |
| AIL-02 | Seven provider backends | event |
| AIL-03 | Ordered engine chain | user (edit) / event |
| AIL-04 | Enable/disable engine | user |
| AIL-05 | Reorder engine | user |
| AIL-06 | Per-engine model slots by role | user |
| AIL-07 | Model-family validation | user (save) |
| AIL-08 | Curated model suggestions | user |
| AIL-09 | Task registry (6 tasks) | event |
| AIL-10 | Per-engine task routing | user |
| AIL-11 | Task fallback to whole chain | event |
| AIL-12 | Hidden screening task | user |
| AIL-13 | Last-resort engine | event |
| AIL-14 | Usability detection | event |
| AIL-15 | Failover chain runner | event |
| AIL-16 | Web-tool preference | event (verify) |
| AIL-17 | Engine cooldown | event |
| AIL-18 | Retry on transient failure | event |
| AIL-19 | Failure classification | event |
| AIL-20 | Error redaction | event |
| AIL-21 | Anthropic web tools | event |
| AIL-22 | Anthropic output budgeting | event |
| AIL-23 | Incomplete-reply handling | event |
| AIL-24 | OpenAI-compatible provider | event |
| AIL-25 | Local (Ollama) provider | event |
| AIL-26 | Local context window setting | user |
| AIL-27 | CLI provider runner | event |
| AIL-28 | CLI environment allowlist | event |
| AIL-29 | Claude Code isolation and thinking cap | event |
| AIL-30 | Windows CLI shim resolution | event |
| AIL-31 | Graceful shutdown of CLI children | event (SIGINT/SIGTERM) |
| AIL-32 | Credential storage | user |
| AIL-33 | Server address settings | user |
| AIL-34 | Local-address rule | event |
| AIL-35 | Engine probe | user (page view) |
| AIL-36 | Engine Test button | user |
| AIL-37 | Local server discovery | user (wizard) |
| AIL-38 | "Use it" local-first | user |
| AIL-39 | Prompt-injection fence | event |
| AIL-40 | Tolerant JSON parse with one reparse | event |
| AIL-41 | Per-attempt ledger | event |
| AIL-42 | Billing kinds | event |
| AIL-43 | Price table | event |
| AIL-44 | Monthly budget and alerts | user (set) / event |
| AIL-45 | Spend aggregation | user (page view) |
| AIL-46 | Spend periods | user |
| AIL-47 | AI usage page | user |
| AIL-48 | Usage hints | user (page view) |
| AIL-49 | Engine health detection | user (page view) |
| AIL-50 | AI plan table | user |
| AIL-51 | Billing trap notes | user |
| AIL-52 | Cost hints on buttons | user (page view) |
| AIL-53 | Per-posting spend | user |
| AIL-54 | Spend report script | user (CLI) |
| AIL-55 | Crawler-token binding | event (fetch) |
| AIL-56 | Concurrency cap for batch AI work | event |
| AIL-57 | Welcome-wizard AI step | user |
| AIL-58 | Tasks catalog: scoring tasks (classifier, prefilter, posting-extract, gmail-extract) | event |
| AIL-59 | Tasks catalog: resume tasks (13 features) | user/event |
| AIL-60 | Tasks catalog: verify and screening tasks | user/event |

## 05 Resume intake & matching (51)

Source: [05-resume-intake-and-match.md](./05-resume-intake-and-match.md)

| ID | Feature | Trigger |
|---|---|---|
| RES-01 | Resume file upload | User (resumes page, wizard, settings "fill from resume", job editor re-upload) |
| RES-02 | DOCX text reader | "; table rows flattened to "cell |
| RES-03 | PDF text reader | Upload |
| RES-04 | Plain text/markdown intake | Upload, "paste edited text" |
| RES-05 | Reactive Resume intake as Markdown | User (upload .json, "pull from Reactive Resume", pick page) |
| RES-06 | Duplicate-resume detection | Every create/replace path |
| RES-07 | Resume library management | User |
| RES-08 | Upload new version | User |
| RES-09 | Save edited text as a version | User (draft save from resume page) |
| RES-10 | Promote tailored copy to master | User |
| RES-11 | AI resume scan | Upload, new version, rescan, wizard, settings "fill from resume" when unscanned or primarySkills empty |
| RES-12 | Background scan | Event |
| RES-13 | Manual rescan | User |
| RES-14 | ATS parse warnings | View resume |
| RES-15 | DOCX template check | View resume / target page |
| RES-16 | DOCX document properties fix | User |
| RES-17 | Format comparison | User |
| RES-18 | Deterministic structure from text | System |
| RES-19 | AI structure extraction with verbatim guard | Render page first visit (lazy) |
| RES-20 | Typography/layout inference | Render page |
| RES-21 | Search (profile) draft from resume | User ("Create a search from this resume", wizard, settings) |
| RES-22 | Default resume choice per job | Page render |
| RES-23 | Posting brief | Start of any comparison, pack prep |
| RES-24 | Posting depth and orientation | Target page |
| RES-25 | Resume-vs-posting comparison (fast / full) | User (job page Compare, editor re-check/re-upload, draft), pack worker, cover-letter launcher |
| RES-26 | Deterministic score | Every comparison, every re-score |
| RES-27 | Keyword post-processing pipeline | Every comparison |
| RES-28 | Keyword-frame stability | Automatic; "Rebuild keywords" button |
| RES-29 | Comparison memo (reuse) | Every comparison start |
| RES-30 | Lazy suggestions call | User ("Get suggestions"), full-mode floor retry |
| RES-31 | Required-coverage floor | Automatic after full match |
| RES-32 | Replacement gating (interface) | Automatic |
| RES-33 | Applied-wording churn control | Automatic on full runs/suggestions |
| RES-34 | Keyword overrides | User |
| RES-35 | Candidate facts ("Confirm your experience") | User |
| RES-36 | Elsewhere hints | Automatic |
| RES-37 | Domain verdict | Automatic; target page |
| RES-38 | Hard requirements (gates) | Automatic |
| RES-39 | Missing-across-postings coverage | View resume |
| RES-40 | Term usage at work | Match card |
| RES-41 | Shared keyword matcher and live score | Server and browser |
| RES-42 | Comparison history and delta | View |
| RES-43 | Draft and re-upload comparison | User |
| RES-44 | Run registry and in-flight dedupe | Event |
| RES-45 | Resume hub statistics | List page |
| RES-46 | Review answers store | User |
| RES-47 | Cover-letter addressee guess | Letter generation |
| RES-48 | Applied-resume record rules | User |
| RES-49 | Tailored copy storage rules (hand-off) | Save in editor |
| RES-50 | Ownership scoping | All |
| RES-51 | Quality harnesses (dev) | Developer |

## 06 Resume tailoring, review & rendering (88)

Source: [06-resume-tailoring-and-render.md](./06-resume-tailoring-and-render.md)

| ID | Feature | Trigger |
|---|---|---|
| TLR-01 | Suggestions call (lazy second half) | User ("Get suggestions" on quick check, Rewrite them all, Condense refresh); floor retry |
| TLR-02 | Full report actions | User or pack (Compare full) |
| TLR-03 | Action schema | Model output contract |
| TLR-04 | Replacement gate (gateActions) | Every time actions are stored or rewritten |
| TLR-05 | Fact check engine | Called by TLR-04, letters, review examples |
| TLR-06 | Instruction-in-wording detector | Part of TLR-04; also unattended policy |
| TLR-07 | Required-coverage floor | Automatically after a full comparison |
| TLR-08 | Refused-lead auto-rewrite | After suggestions/full report |
| TLR-09 | Rewrite one card | User (Rewrite button) |
| TLR-10 | Applied-wording memory | Inside TLR-01 and full report |
| TLR-11 | Prompt trust boundaries | All AI calls here |
| TLR-12 | Proposal extraction + change sheet | User (Copy as Markdown) |
| TLR-13 | Suggestion identity key | Editor |
| TLR-14 | Editor Apply / Apply all / Undo | User |
| TLR-15 | Missing-keyword add | User / unattended |
| TLR-16 | Live score on edited text | Editor edits; unattended runner |
| TLR-17 | Summary guide | Tailor page render |
| TLR-18 | Verification hint and cautions | Page render |
| TLR-19 | Comparison run orchestration | User |
| TLR-20 | Version delta | Page render |
| TLR-21 | Countable red flags | During scoring |
| TLR-22 | Posting-reading orientation inputs | Inside TLR-01 |
| TLR-30 | Page target | User (select beside Find cuts) |
| TLR-31 | Find cuts (step one) | User (Find cuts / again) |
| TLR-32 | Removal gate (gateRemovals) | Inside Find cuts |
| TLR-33 | Wording (step two) | User (Shorten wording) |
| TLR-34 | Shorter-only filter | Inside wording step |
| TLR-35 | Step ordering and stage marker | Server |
| TLR-36 | Refresh suggestions on condensed text | User (Refresh) |
| TLR-37 | Carry cuts to the next comparison | Save of working copy |
| TLR-38 | Condense runs | Server |
| TLR-39 | Condense panel | UI |
| TLR-40 | One working copy per resume and job | Save in editor |
| TLR-41 | Save as copy (draft route) | User (Save) |
| TLR-42 | Patch-source selection | Server |
| TLR-43 | Working comparison selection | Page render |
| TLR-44 | Start over from master | User |
| TLR-45 | Promote to master | User |
| TLR-46 | Copy download / delete | User |
| TLR-47 | Draft document (own vs clean) | Document pane, downloads |
| TLR-48 | Document endpoint | Document pane, Download buttons |
| TLR-49 | Applied-resume recording | User (status change) |
| TLR-50 | File naming | Downloads |
| TLR-60 | In-place DOCX patcher | Save, document pane, pack |
| TLR-61 | Patcher refusals | Patcher |
| TLR-62 | Patcher read-back gates | Patcher |
| TLR-63 | Plain punctuation on patch | Patcher |
| TLR-64 | Template check | Upload and any page needing it |
| TLR-65 | Document properties fix | User ("Fix document properties") |
| TLR-66 | Render plan | Render |
| TLR-67 | Line-by-line plan | Draft/clean render |
| TLR-68 | Clean DOCX writer | Render, save, pack |
| TLR-69 | Clean PDF writer | Render, pack, document |
| TLR-70 | Render knobs | Render form |
| TLR-71 | Drawable-character folding | Render |
| TLR-72 | Render page | User |
| TLR-73 | Structure source for render | Render page load / button |
| TLR-74 | Clean save guard | Save copy |
| TLR-75 | Letter file writers | Letter download |
| TLR-76 | Two-file format comparison | User (compare formats) |
| TLR-77 | Parsed view block | Resume page, comparison page |
| TLR-80 | Generate letter | User (job card Generate/Regenerate; /letter; pack) |
| TLR-81 | Letter fact gate with one retry | Inside generation |
| TLR-82 | Plain punctuation | Letters, patcher, replacement gate |
| TLR-83 | Angles | User |
| TLR-84 | Addressee | User |
| TLR-85 | /letter launcher | User |
| TLR-86 | Manual edit with re-check | User |
| TLR-87 | Letter downloads | User |
| TLR-88 | Letter history and card | UI |
| TLR-90 | Strength review | User (Run strength review) |
| TLR-91 | Review score | Server |
| TLR-92 | Review example gate | Server |
| TLR-93 | Answers loop | User |
| TLR-94 | Review delta and staleness | Page render |
| TLR-100 | Connection card | User (Settings) |
| TLR-101 | Reach rule | Every call |
| TLR-102 | List and pick | User |
| TLR-103 | Import | User |
| TLR-104 | Export reader (v4/v5/v6) | Import; write-back |
| TLR-105 | Edit planner | Send |
| TLR-106 | Write-back as new resume | User (Send to Reactive Resume) |
| TLR-107 | Send result page | After send |
| TLR-108 | Instance client | All calls |
| TLR-109 | Failure messages | UI |
| TLR-110 | Edit policy plan | Pack |
| TLR-111 | Unattended safety checks | Pack |
| TLR-112 | Pack document and letter | Pack |

## 07 Packs, applications & screening (90)

Source: [07-packs-applications-screening.md](./07-packs-applications-screening.md)

| ID | Feature | Trigger |
|---|---|---|
| PKS-01 | Pack settings (per person) | User saves form |
| PKS-02 | Tailoring policy settings | User saves form |
| PKS-03 | Auto-queue on new posting | Event: posting stored |
| PKS-04 | Auto gate: fit, date, age, daily limit | Event |
| PKS-05 | Cross-listing dedupe | Event |
| PKS-06 | Manual "Prepare pack" | User (job page pack tab) |
| PKS-07 | Prepare again / Try again | User |
| PKS-08 | Cancel queued pack | User |
| PKS-09 | Switch-off cancels waiting auto packs | User saves form |
| PKS-10 | Queue runner | Schedule (every minute) / script |
| PKS-11 | Re-check before running auto pack | Runner |
| PKS-12 | Resume choice | Runner |
| PKS-13 | Step: liveness | Runner |
| PKS-14 | Step: brief + compare (with reuse) | Runner |
| PKS-15 | Feasibility gate: hard requirements | Runner |
| PKS-16 | Feasibility gate: ceiling floor | Runner |
| PKS-17 | Step: company verification | Runner |
| PKS-18 | Tailoring plan | Runner |
| PKS-19 | Edit application | Runner |
| PKS-20 | Safety checks on edits | Runner |
| PKS-21 | Local re-scoring | Runner |
| PKS-22 | Re-judge tailored text | Runner |
| PKS-23 | Document generation | Runner |
| PKS-24 | Optional cover letter | Runner |
| PKS-25 | Result recording | Runner |
| PKS-26 | Graceful shutdown | Process signal |
| PKS-27 | Pack tab on job page | User |
| PKS-28 | Progress polling endpoint | UI poll |
| PKS-29 | File download | User |
| PKS-30 | Mark pack file as sent | User |
| PKS-31 | Grouped "packs ready" message | Runner after queue |
| PKS-32 | "Ready to send" list | User (overview) |
| PKS-33 | pack-once script | CLI |
| PKS-34 | pack-dry measurement script | CLI |
| PKS-35 | Dry report (pure) | Script |
| PKS-40 | Tracking on/off | User |
| PKS-41 | Applications board | User |
| PKS-42 | Drag/drop and quick-move | User |
| PKS-43 | Custom work columns | User (settings) |
| PKS-44 | Consider | User |
| PKS-45 | Mark applied | User |
| PKS-46 | Application form | User |
| PKS-47 | Applied-resume snapshot | User |
| PKS-48 | Stage ledger | Every stage write |
| PKS-49 | Time-in-stage / stalled marker | Page render |
| PKS-50 | Applied-state predicate | Everywhere |
| PKS-51 | Board export | User |
| PKS-52 | Stale-applications digest | Schedule |
| PKS-53 | stale-once script | CLI |
| PKS-60 | Employer-mode switch | User (settings) |
| PKS-61 | Legal and applicant notice | User |
| PKS-62 | Retention setting and cleanup | User / schedule |
| PKS-63 | Engine warning | Page |
| PKS-64 | Create screening | User |
| PKS-65 | Rubric draft from posting | User / on create |
| PKS-66 | Rubric model and editor | User |
| PKS-67 | Rubric versioning | User |
| PKS-68 | Protected-trait refusal | User |
| PKS-69 | Rubric presets | User |
| PKS-70 | Posting editing | User |
| PKS-71 | Bulk intake | User |
| PKS-72 | Blind redaction | Upload |
| PKS-73 | Leak check and hold | Upload / viewing |
| PKS-74 | Release held applicant | User |
| PKS-75 | Duplicate handling | Upload |
| PKS-76 | Cover-letter attachment | Upload |
| PKS-77 | Applicant numbering | Upload |
| PKS-78 | Scoring run (batch) | User / upload |
| PKS-79 | Per-applicant model call | mode |
| PKS-80 | Evidence anchoring | Run |
| PKS-81 | Scoring | Run |
| PKS-82 | Caps | Run |
| PKS-83 | Gates and buckets | Run |
| PKS-84 | Confidence | Run |
| PKS-85 | Table order | Page / export |
| PKS-86 | Score adjustment | User |
| PKS-87 | Decisions | User |
| PKS-88 | Bulk actions | User |
| PKS-89 | Applicant scorecard | User |
| PKS-90 | Career trajectory | Render |
| PKS-91 | Date parsing | Scoring |
| PKS-92 | Sector vocabulary | Scoring |
| PKS-93 | Side-by-side compare | User |
| PKS-94 | AI shortlist comparison | User |
| PKS-95 | Calibration | Page / export |
| PKS-96 | Export | User |
| PKS-97 | Original and letter file download | User |
| PKS-98 | Delete | User |
| PKS-99 | Rescore script | CLI |
| PKS-100 | Screening bench | CLI |

## 08 Web app & UX (97)

Source: [08-web-app-and-ux.md](./08-web-app-and-ux.md)

| ID | Feature | Trigger |
|---|---|---|
| WEB-01 | Server-rendered shell | user (any GET) |
| WEB-02 | Grouped navigation | user |
| WEB-03 | Responsive sidebar | user |
| WEB-04 | Security headers and self-contained assets | every response |
| WEB-05 | Access lock modes | startup env |
| WEB-06 | OIDC sign-in/out | user |
| WEB-07 | User provisioning | event (callback) |
| WEB-08 | Role gate | every request |
| WEB-09 | User management page | user (admin) |
| WEB-10 | Cross-origin write guard | every non-GET |
| WEB-11 | Body size limits | every POST |
| WEB-12 | Per-request context | every request |
| WEB-13 | Request log line | every request |
| WEB-14 | Health endpoint | docker/health-check |
| WEB-15 | Flash messages | event (POST) |
| WEB-16 | Toasts | event |
| WEB-17 | Field-level error marking | event |
| WEB-18 | Safe redirects | event |
| WEB-19 | Double-submit protection | user |
| WEB-20 | Navigation progress bar | user (click/submit) |
| WEB-21 | Inline (no-reload) form posts | user |
| WEB-22 | Confirm popovers | user |
| WEB-23 | Switch rows | user |
| WEB-24 | Theme (system/light/dark) | user |
| WEB-25 | Language selection | user |
| WEB-26 | Pseudo-locale smoke | CI |
| WEB-27 | Display time zone | every request |
| WEB-28 | Update notice | event |
| WEB-29 | Overview dashboard | user |
| WEB-30 | Pipeline pause/resume quick control | user (admin) |
| WEB-31 | Finish-setup chip | event |
| WEB-32 | First-run wizard | first visit (admin) |
| WEB-33 | Wizard AI step | user |
| WEB-34 | Wizard test search | user |
| WEB-35 | Wizard profile step | user |
| WEB-36 | Wizard sources step | user |
| WEB-37 | Wizard score step | user |
| WEB-38 | Jobs list | user |
| WEB-39 | Jobs filter panel | user |
| WEB-40 | Column sorting | user |
| WEB-41 | Muted-company hiding | event |
| WEB-42 | Job detail with tabs | user |
| WEB-43 | Job status actions | user |
| WEB-44 | Per-search scores | view |
| WEB-45 | Re-classify one job | user |
| WEB-46 | Description refresh/restore/edit | user |
| WEB-47 | Manual job paste | user |
| WEB-48 | Edit manual job | user |
| WEB-49 | Cross-listing links | view |
| WEB-50 | Closed-posting flag | view |
| WEB-51 | Mute company from job | user |
| WEB-52 | Job verification run | user |
| WEB-53 | Resume comparison launcher | user |
| WEB-54 | Tailor editor entry | user |
| WEB-55 | Skill-fact memory | user |
| WEB-56 | Cover letter tab and launcher | user |
| WEB-57 | Application pack tab | user |
| WEB-58 | Applications board | user |
| WEB-59 | Tracking card | user |
| WEB-60 | Applications export | user |
| WEB-61 | Board column editor | user |
| WEB-62 | Stage ledger | event |
| WEB-63 | Resume library | user |
| WEB-64 | Resume to search | user |
| WEB-65 | Tailored copies | user |
| WEB-66 | Reactive Resume integration | user |
| WEB-67 | Resume render | user |
| WEB-68 | Companies/sources table | user (admin) |
| WEB-69 | Quiet-source panel | view |
| WEB-70 | Add company | user |
| WEB-71 | Suggested sources | user |
| WEB-72 | Starter packs | user |
| WEB-73 | Watchlist | user |
| WEB-74 | Watch controls | user |
| WEB-75 | Folder sources | user |
| WEB-76 | Muted companies | user |
| WEB-77 | Discovery page | user (admin) |
| WEB-78 | File import | user (admin) |
| WEB-79 | Runs page | user |
| WEB-80 | Running-now card | auto (5 s poll) |
| WEB-81 | Fetch-now | user (admin) |
| WEB-82 | Generic progress page | auto |
| WEB-83 | AI usage page | user (admin) |
| WEB-84 | Search editor | user |
| WEB-85 | Schedule editor | user |
| WEB-86 | Notification destinations | user |
| WEB-87 | AI engine admin | user (admin) |
| WEB-88 | Source family switches and keys | user (admin) |
| WEB-89 | Pack automation settings | user |
| WEB-90 | Re-apply window | user |
| WEB-91 | Employer mode and screening | user (admin) |
| WEB-92 | Gmail leads | user |
| WEB-93 | Local-install helpers | user (admin) |
| WEB-94 | Country picker data | auto |
| WEB-95 | Server-drawn charts with hover | view |
| WEB-96 | Clipboard helpers | user |
| WEB-97 | Select-commit autosave | user |

## 09 Platform, runtime & deploy (118)

Source: [09-platform-runtime-and-deploy.md](./09-platform-runtime-and-deploy.md)

| ID | Feature | Trigger |
|---|---|---|
| PLT-01 | Local launcher (`start`) | user: `npm start` |
| PLT-02 | Database-only mode (`db`) | user: `npm run db` |
| PLT-03 | Graceful stop command | user: `npm run stop` |
| PLT-04 | Single-instance lock | event: start |
| PLT-05 | Process supervision | event |
| PLT-06 | Signal handling | user/OS |
| PLT-07 | Bundled Postgres management | event: start |
| PLT-08 | Cluster bootstrap settings | event: first run |
| PLT-09 | Port selection | event: start |
| PLT-10 | Connection state file | event |
| PLT-11 | Daily snapshot | event: start |
| PLT-12 | External-DB mode | event |
| PLT-13 | Data directory resolution | event |
| PLT-14 | Browser auto-open | event: first run |
| PLT-15 | Port pre-check | event |
| PLT-16 | IPC child protocol | event |
| PLT-17 | Start-at-login entry | user: settings toggle |
| PLT-18 | Local-install detection | event |
| PLT-19 | Data import from Docker install | user: `npm run db:import -- file --yes` |
| PLT-20 | Worker process | event: start |
| PLT-21 | Web process | event: start |
| PLT-22 | Worker init: schema | event: worker start |
| PLT-23 | Worker init: interrupted runs | event: worker start |
| PLT-24 | Worker init: seeding | event: worker start |
| PLT-25 | Notification bootstrap from env | event: first boot |
| PLT-26 | Instance identity | event |
| PLT-27 | Cron registry | schedule |
| PLT-28 | Overlap protection | schedule/event |
| PLT-29 | Fetch lock wait | schedule |
| PLT-30 | Run bookkeeping | schedule/event |
| PLT-31 | Per-person scheduled jobs | schedule |
| PLT-32 | Quiet beats | schedule |
| PLT-33 | Graceful worker shutdown | signal/IPC |
| PLT-34 | Folder watcher | event |
| PLT-35 | Heartbeat | schedule |
| PLT-36 | Healthcheck CLI | worker`: web = GET `/health` (5 s timeout, Basic Auth header if configured); worker = heartbeat file age <= 180 s |
| PLT-37 | `/health` route | null}` |
| PLT-38 | Config loading and validation | event |
| PLT-39 | Built-in DB fallback for tools | event |
| PLT-40 | Structured logging | always |
| PLT-41 | Log redaction | always |
| PLT-42 | Request log | web |
| PLT-43 | Secure headers | web |
| PLT-44 | Auth: open | config |
| PLT-45 | Auth: shared Basic password | config |
| PLT-46 | Auth: OIDC sign-in | config |
| PLT-47 | OIDC + Basic combined | config |
| PLT-48 | Fail-closed auth config | startup |
| PLT-49 | Session cookie | auth |
| PLT-50 | Safe redirect target | auth |
| PLT-51 | Sign-out | user |
| PLT-52 | Auth gate behaviour | auth |
| PLT-53 | User provisioning | auth |
| PLT-54 | Current-user context | web |
| PLT-55 | Route access policy | web |
| PLT-56 | Admin guard | web |
| PLT-57 | User administration | admin |
| PLT-58 | Cross-origin write guard | web |
| PLT-59 | Body size limits | web |
| PLT-60 | Double-submit guard | web |
| PLT-61 | Flash messages | web |
| PLT-62 | Static asset caching | web |
| PLT-63 | Error handling | web |
| PLT-64 | Theme preference | user |
| PLT-65 | Display time zone | web |
| PLT-66 | Update notice (optional) | schedule/user |
| PLT-67 | App version/UA | always |
| PLT-68 | Outbound HTTP defaults | always |
| PLT-69 | i18n catalog | always |
| PLT-70 | Message syntax | always |
| PLT-71 | Locale registry | always |
| PLT-72 | Language resolution | web |
| PLT-73 | Language switcher / setting | user |
| PLT-74 | Locale formatting module | always |
| PLT-75 | Place/workplace names | web |
| PLT-76 | Worker-run locale | schedule |
| PLT-77 | Browser-side i18n | web |
| PLT-78 | Pseudo-locale audit | CI |
| PLT-79 | Posting-language detection | web |
| PLT-80 | Folder-source path policy | admin |
| PLT-81 | Blocked posting hosts | always |
| PLT-82 | Retention cleanup | schedule |
| PLT-83 | Script: fetch-once | user |
| PLT-84 | Script: digest-once | user |
| PLT-85 | Script: stale-once | user |
| PLT-86 | Script: cleanup-once | user |
| PLT-87 | Script: gmail-once | user |
| PLT-88 | Script: hn-once | user |
| PLT-89 | Script: discovery-once | user |
| PLT-90 | Script: pack-once | user |
| PLT-91 | Script: test-telegram | user |
| PLT-92 | Script: backfill-descriptions | user |
| PLT-93 | Script: backfill-fingerprints | user |
| PLT-94 | Script: backfill-apply-link-flags | user |
| PLT-95 | Script: backfill-locations | user |
| PLT-96 | Script: refetch-descriptions | user |
| PLT-97 | Script: reanchor-matches | user |
| PLT-98 | Script: rescan-resumes | user |
| PLT-99 | Script: rescore-screenings | user |
| PLT-100 | Script: ai-spend-report | user |
| PLT-101 | Script: keyword-audit | user |
| PLT-102 | Script: priority-rules-dryrun | user |
| PLT-103 | Script: bench/compare family | user |
| PLT-104 | Script: dead-exports | CI |
| PLT-105 | Script: i18n-browser | dev |
| PLT-106 | Script: route-smoke | CI/dev |
| PLT-107 | Script: health-check | docker |
| PLT-108 | Script: archive-traffic.sh | maintainer |
| PLT-109 | Docker image | build |
| PLT-110 | Compose stack | ops |
| PLT-111 | CI pipeline | push/PR |
| PLT-112 | Dependency policy | CI/schedule |
| PLT-113 | Generated stylesheet gate | CI |
| PLT-114 | Schema/migration parity gate | CI |
| PLT-115 | Env-example parity test | CI |
| PLT-116 | Marketing site | deploy |
| PLT-117 | Fetch-lock helper | event |
| PLT-118 | Unique-violation retry | event |

