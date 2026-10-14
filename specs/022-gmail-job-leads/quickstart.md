# Quickstart: validating Gmail Job Leads

## Prerequisites

- Node 24, `npm ci`, a throwaway database (`npm run db` or Docker; never the live data folder).
- For the live check only: a Google Cloud project with the Gmail API enabled and a *Web application* OAuth client whose redirect URI is `http://localhost:<WEB_PORT>/gmail/callback`; its id and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (see `docs/gmail-setup.md`). A Gmail account with a label `Job Leads` holding at least one job-alert mail.

## Automated (no Google needed)

```bash
npm run lint:types && npm test          # pure modules, fence registry, env-example, i18n catalog parity
npm run exports:audit
npm run build && npm run smoke:routes   # throwaway DB only: card renders "not configured", cross-origin POST refused
```

Expected: all green; the smoke prints the Gmail card check in the Settings -> Job search page.

## Manual (live, one person)

1. `npm start`, open Settings -> Job search. The Gmail card shows Connect.
2. Connect, approve read-only access. The card shows your address, label "Job Leads", status "waiting".
3. Within a minute the worker runs the first check (or press Check now). Expect: counts on the card; postings from the labelled mails in Jobs, scored for you.
4. Press Check now again: 0 new postings, no new AI spend (ledger).
5. Rename the label field to a name that does not exist: next check shows "label not found".
6. Revoke the app at myaccount.google.com/permissions: next check shows "access ended" and Reconnect.
7. Disconnect: card returns to Connect; the app disappears from Google's list.

## Manual (two people, sign-in on)

Connect user A and user B to different accounts. Confirm B's Jobs, Overview, alerts and Settings never show A's postings, address, or label.

Unverified in CI by design: steps 2-7 need a real Google account.
