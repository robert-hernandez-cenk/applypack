# Gmail job leads — setting it up

Each person connects their own Gmail, and ApplyPack reads the mails they file under one label (default
**Job Leads**), takes the job listings out of them — Indeed, LinkedIn and any other sender — and scores
them like any other job. It is read-only: ApplyPack never sends, changes or deletes mail, never reads
mail outside that label, and never opens a link in a mail (ADR 0071, ADR 0005).

The person who runs the install does the Google side once; then everyone connects from
**Settings → Job search → Gmail job leads**.

## 1. Create a Google client (once, by whoever runs the install)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one).
2. **APIs & Services → Library**: enable the **Gmail API**.
3. **OAuth consent screen**: user type **External**; add the scope
   `https://www.googleapis.com/auth/gmail.readonly` (and `openid`, `email`).
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Under
   **Authorized redirect URIs** add the dashboard's address plus `/gmail/callback`:
   - `npm start` on your own computer: `http://localhost:4747/gmail/callback` (the port is `WEB_PORT`);
   - behind an address of its own: `<WEB_PUBLIC_URL>/gmail/callback`, e.g. `https://jobs.example.org/gmail/callback`.
5. Put the client's id and secret in `.env`:

   ```
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   ```

   Restart ApplyPack. Both must be set; with either empty the card says Gmail is not set up.

## 2. Publish the client, or connections end after a week

While the OAuth consent screen is in **Testing**, Google ends every refresh token after **7 days**: each
person would have to reconnect weekly. On the consent screen choose **Publish app** (status **In
production**). You do not have to submit it for verification for your own use: an unverified client works
for up to 100 users and shows a "Google hasn't verified this app" warning on the consent screen, which
people click through (**Advanced → Go to … (unsafe)**). Only people you tell to connect will see it.

## 3. Label the mail (each person)

In Gmail, make a label named **Job Leads** (or any name, set on the card) and put the job-alert mails in
it. A filter does it for good: **Settings → Filters and blocked addresses → Create a new filter**, from
the alert sender (for example the address your job site's alerts come from), **Apply the label: Job Leads**,
and tick **Also apply to matching conversations** for the mails already there.

## 4. Connect

**Settings → Job search → Gmail job leads → Connect Gmail**. Approve read-only access. The first check
starts within a minute (or press **Check now**); after that the label is read every hour. ApplyPack looks
at the last two weeks the first time, and never reads the same mail twice.

## What to expect

- Each listing in a mail becomes one posting with what the mail says: title, company, place, and the
  mail's own link. The mail's text is all there is to score on — ApplyPack does not open the link — so a
  digest that only says "5 new jobs" gives thin postings.
- Reading a mail uses the AI engine once (shown as "Reading job-alert emails" in AI usage).
- Nothing is read while fetching is paused.
- **Disconnect** revokes the access at Google and deletes the saved connection. Jobs already found stay.
  You can also remove ApplyPack at <https://myaccount.google.com/permissions>.

## When the card says something is wrong

| The card says | What it means |
| --- | --- |
| Google ended this connection | access was revoked, or the client is still in Testing (7 days). Publish it, then **Reconnect** |
| No label with this name exists | the name in the field does not match a Gmail label; fix it there or in Gmail |
| Google could not be reached / allowance used up | transient; the next check tries again |
| No AI engine is set up | set one up under Settings → AI |

Run a check by hand: `npm run gmail:once` (or `docker compose exec app node dist/scripts/gmail-once.js`).
