# 0071 — Job leads are read from the person's own mailbox, read-only, and are theirs alone

**Status:** Accepted (2026-10-14). Issue #22. Builds on [0005](./0005-no-linkedin-indeed-workday.md)
(no scraping of job sites), [0062](./0062-rows-the-user-brings-are-read-never-fetched.md) (rows the
user brings are read, never fetched), [0067](./0067-a-person-holds-their-own-rows.md) (a posting is
shared, what a person does with it is theirs) and [0022](./0022-prompt-fences-for-untrusted-text.md) (outside text is
fenced).

## Context

Indeed, LinkedIn and others are where most listings are, and ADR 0005 keeps them closed to the
fetchers. Their alert emails are different: they arrive in the person's own mailbox, addressed to
them, and carry the title, company and place of each listing. A person who files those mails under
a Gmail label has already done the selecting.

## Decision

- **Each person connects their own Gmail, read-only.** Google OAuth (authorization code, PKCE,
  `state`), scope `gmail.readonly` plus `openid email` for the account address. The install brings
  its own Google client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`); without it the card says the
  feature is not set up. A grant that lacks the mail permission (Google lets a person untick it) or
  holds more than read-only is refused (`google-reply.ts`). One account and one label per person.
- **The refresh token is a new, deliberate secret in the database** (`GmailConnection.refreshToken`),
  next to `botToken`, `aiKeys` and `db.json`. It is read only through `gmail/store.ts`, never
  selected with the rest of the row, never rendered, logged or put in a flash;
  `gmail/secret-access.test.ts` keeps the list of files that may name it closed. Disconnect revokes
  it at Google and deletes the row (the ledger cascades), and a person's deletion cascades too.
- **The label is the person's, default "Job Leads".** Gmail label names are unique ignoring case, so
  the match ignores it. A label that does not exist is a status on the card, not an error elsewhere.
- **A window and a ledger, not a history cursor.** A check lists the mails under the label received
  after `max(now − 14 days, lastCheck − 2 days)`, drops the ones in `gmail_message`, and reads up to
  20 a run, newest first. The ledger holds a mail id, its date, an outcome and a count — no content —
  and a mail goes in it only after its listings were handed to the pipeline, so a run that dies is
  repeated and the pipeline's own dedupe keeps the postings single. The window moves on only when
  everything in it was read. Gmail's `historyId` was rejected: it expires and needs this fallback anyway.
- **One fenced, tool-free model call per mail extracts its listings.** Senders and layouts change and
  "others" is open-ended; per-site parsers would be brittle, need real samples per sender, and cover
  only the sites named. The mail's subject, sender and words are inside the fence (ADR 0022); the
  reply is parsed with zod, bounded (30 listings a mail), and a field the mail did not state stays
  null. The call's ledger label is `gmail-extract`, on the scoring task's model.
- **The model never writes an address.** Each web link in a mail is replaced by a `[#n]` marker where
  it stood and listed by host and path; the model answers with the marker's number and the code
  resolves it. A listing with no link the mail holds is dropped and counted. This both removes tracking
  URLs from the prompt and makes an invented link impossible.
- **No link in a mail is ever opened (ADR 0005).** The posting's URL is the mail's own link, which the
  person follows themselves; scoring uses only what the mail says about that job. Descriptions are
  therefore thin, and a digest that says only "5 new jobs, see them" yields thin postings. Accepted.
- **Postings are the person's alone.** They go through `processNormalizedJobs` with `ownerId`, as an
  import does (ADR 0067): the base filter, de-duplication (a job already known from another source is
  recognised by its fingerprint), scoring against that person's searches, and their alert. They are not
  `handPicked`: a digest holds many jobs and the filter should read them. A hidden `AtsType.GMAIL`
  `Company` per person (`atsToken = user-<id>`, never active, `fetchOne` returns `[]`) is where they
  are stored, treated as `IMPORT` is wherever a source is listed.
- **The worker reads; the dashboard asks.** "Check now" and a fresh connection set
  `checkRequestedAt`; a beat a minute takes those, and an hourly beat reads every connected person.
  Both take the fetch lock once for everyone, before a run row is written, and do nothing while
  fetching is paused. Scoring stays in the worker. The connect state (PKCE verifier against `state`
  and the person who began it, ten minutes, single use) is held in the dashboard's memory, since an
  install without sign-in has no secret to sign a cookie with.
- **Where it lives.** A card on Settings → Job search (a personal source; the Sources tab is
  administrators'). `src/gmail/` is pure but for `google-io.ts` (the only file that talks to Google)
  and `store.ts` (the only Prisma file); `jobs/gmail-job.ts` takes its I/O as arguments and is tested
  with fakes; `jobs/gmail-live.ts` is the wiring.

## Alternatives considered

- **IMAP with an app password.** No Google project, no token expiry — and a password that opens the
  whole mailbox, cannot be limited to read-only, and needs 2-step verification. The person chose OAuth.
- **Per-sender parsers.** Cheaper per mail, but one parser per site and layout, each needing real
  captures of a person's mail to write and keep right.
- **Follow the mail's link for the full description.** Would make scores better and break ADR 0005.
- **A history cursor** (`historyId`), **a signed cookie for the connect state** (needs a secret an
  install without sign-in does not have), **running the check in the dashboard** (scoring is the
  worker's lane): see the plan's research notes.

## Consequences

- **Google expires a refresh token after seven days while the operator's client is in "Testing".**
  The client must be published ("In production", unverified, up to 100 users with a warning screen) for
  connections to last; `docs/gmail-setup.md` says so and so does the card's status when access ends.
- A mail costs one model call, once. The cost shows in the AI usage figures as "Reading job-alert emails".
- A mail whose listings are all in the pipeline's dedupe cost a call and added nothing: accepted, since
  the alternative is to read a mail before knowing it is new.
- Two people connecting the same Google account hold two connections and two sets of jobs.
