# Research: Gmail Job Leads

No `NEEDS CLARIFICATION` remained after brainstorming; this records the decisions and what was checked in the code.

## D1 — Authorization: Google OAuth, `gmail.readonly`, code + PKCE + state
- **Decision**: the user's choice (asked during brainstorming). Web-application client supplied by the operator; `access_type=offline`, `prompt=consent` so a refresh token is always returned; scope `https://www.googleapis.com/auth/gmail.readonly` plus `openid email` to learn the account address from the ID token/userinfo.
- **Rationale**: revocable, read-only, no password stored.
- **Caveat recorded**: while the operator's client is in "Testing", Google expires refresh tokens after 7 days. `docs/gmail-setup.md` and the card tell the operator to publish it ("In production", unverified, ≤100 users).
- **Alternatives**: IMAP + app password (rejected by the user: full-mailbox password, cannot be read-only).

## D2 — PKCE/state helpers: reuse `openid-client`
- ADR 0064 already depends on it (`randomState`, `randomPKCECodeVerifier`, `calculatePKCECodeChallenge`). Only these three helpers are used; discovery is not (Google's endpoints are fixed constants), so `google-io.ts` builds the authorization URL and posts the code exchange itself with `fetchWithRetry`.
- **Alternative**: full `openid-client` discovery for Google. Rejected: pulls ID-token validation we do not need (we only need the account email, read from the `userinfo`/`gmail users.getProfile` response, not trusted for authN).

## D3 — Where connect state lives between redirect and callback: in-memory
- OIDC uses a signed cookie, which needs `OIDC_SESSION_SECRET`; an install without sign-in has none. `src/web/import-stash.ts` already keeps short-lived per-request data in web-process memory.
- **Decision**: `pending.ts` maps `state -> {userId, verifier, createdAt}` with a 10-minute TTL, single use. The callback requires the `state` AND that the current user equals the stored `userId` (defeats a state replayed in another person's session).
- **Alternative**: signed cookie with a new secret. Rejected: new config for no gain; the dashboard is one process.

## D4 — Reading strategy: window + ledger, not a history cursor
- `messages.list?labelIds=<id>&q=after:<epoch>&maxResults=…` returns ids newest first. A cursor on `historyId` expires and needs a fallback anyway.
- **Decision**: window start = `max(now − FIRST_RUN_DAYS(14), lastCheckAt − OVERLAP_DAYS(2))`; ids not in `gmail_message` are candidates; take up to `MAX_MAILS_PER_RUN` (20) newest first; each processed id is written to the ledger *after* its jobs are stored (CLAUDE.md "never mark read before stored"). A backlog drains over successive runs because unprocessed mails stay inside the window; an outage longer than 14 days loses only mails older than that.
- Ledger rows older than `LEDGER_KEEP_DAYS` (60) are pruned by the same job.
- Label name → id via `labels.list` each run (names are user-editable, ids are stable but unknown to us); a miss is status `label_missing`.

## D5 — Extraction: one fenced AI call per mail
- Model: `role: 'classifier'` (cheap model), `json: true`, no web tools (ADR 0009). Prompt modelled on `jobs/posting-extract.ts`: "never invent; null when the mail does not say".
- Input is the mail's subject, sender display name and the *text* of the body (`stripHtml`), capped at `BODY_CHARS`; links are passed as an indexed list so the model returns a link *index*, and the code resolves it to the real URL (the model cannot fabricate a URL, and a URL not in the mail is impossible).
- Reply: `{ listings: [{ title, company|null, location|null, salary_min|null, salary_max|null, workplace|null, link_index|null }] }`, tolerant zod parse, per-mail cap `MAX_LISTINGS_PER_MAIL` (30), listings without a title dropped, in-mail duplicates dropped.
- **Alternatives**: per-sender parsers (brittle, need samples per site); one call per listing (cost). A mail the model cannot parse is marked processed with outcome `unreadable` so it is not re-paid for.

## D6 — Tracking links and ADR 0005
- Indeed/LinkedIn mails carry tracking redirect URLs. We store the mail's link as the posting's `url` (the person clicks it themselves) and never request it. `blocked-hosts.ts` is consulted for display consistency only; nothing here fetches.
- Consequence: descriptions are thin (what the mail says). Accepted in the spec's assumptions.

## D7 — Identity of a posting
- `externalId = sha1(normalizedTitle | employerKey | normalizedLocation)` truncated, so the same job repeated in consecutive digests collapses on `(companyId, externalId)`; `fingerprint.ts` + cross-listing handle the same job arriving from another source.
- `postedAt` = the mail's `internalDate`; `undated: true` is **not** set (the date is real: when the lead arrived), but it is the mail's date, not the posting's, so `pack/trigger` behaviour is the same as for any dated row. Noted in ADR.

## D8 — Hidden source row
- `Company{ atsType: GMAIL, atsToken: "user-<id>", name: "Gmail", active: false }`, created lazily by `store.ts` (upsert on the existing `atsType_atsToken` unique). `fetchOne` returns `[]`; added next to `IMPORT` in `source-health.ts`, `source-groups.ts` (not fetched, hidden), `source-names.ts`.
- Jobs are owned via `ownerId` in `processNormalizedJobs`; `UserJob` is created only for that person (ADR 0067).

## D9 — Scheduling
- Worker: after the hourly fetch tick, `gmailTick` runs `runForUsers('gmail', userIds with a connection, runGmailJob)`; each is its own `cron_run` row with `userId`. It takes `tryFetchLock()` per person (shares the classifier with the tick; skipped with `reason: 'overlap'` if held) and returns early if `fetchingEnabled` is false.
- "Check now" is a web action that cannot run the job (the worker owns AI work), so it queues: sets `GmailConnection.checkRequestedAt`; the worker's minute heartbeat (as the pack queue does) takes it. The card shows "queued".
- **Alternative**: run in the web process. Rejected: CLAUDE.md keeps scoring in the worker's lane and the launcher's lock semantics are simpler.

## D10 — Where the card goes
- Settings → **Job search** (the `profile` tab). The `sources` tab is admin-only, and this is a personal source. Members and admins both see it.

## D11 — Sensitive-data handling
- Token read only via `store.ts:readRefreshToken(userId)`; `GmailConnection` never selected whole by a page (explicit `select` of non-secret columns, enforced by a test that greps the page/route modules for `refreshToken`).
- Logs carry userId and counts, never mail subjects/bodies or token; error messages from Google are mapped to status codes, raw bodies not stored.
- Disconnect: revoke (`oauth2.googleapis.com/revoke`), then delete the row regardless of the revoke result (a failed revoke is logged; the row is gone either way). The Gmail ledger cascades.

## D12 — Fixtures
- Real Gmail captures need a live account and would contain personal mail. Fixtures are hand-written to the documented API shapes (`payload.parts[]`, `body.data` base64url, `headers[]`, `internalDate` string) and the mail texts are synthetic layouts modelled on public sample alert formats, containing example companies only. The one live check is manual (quickstart, unverified in CI).
