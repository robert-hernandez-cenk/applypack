# Contract: dashboard routes

All routes act as `currentUser()`. POSTs pass `originGuard()`. Responses are redirects back to `/settings?tab=profile#gmail` with a flash message; none render the token.

| Route | Method | Behaviour |
| --- | --- | --- |
| `/gmail/connect` | GET | 404-style flash if Google is not configured. Else creates state + PKCE verifier (kept in `pending.ts` for 10 min, bound to the user), redirects to Google's consent URL (scope `gmail.readonly openid email`, `access_type=offline`, `prompt=consent`, `code_challenge_method=S256`). |
| `/gmail/callback` | GET | Reads `state`, `code`, `error`. Refuses (flash, nothing stored) when: `error` present, state unknown/expired/used, state's user != current user. Exchanges the code with the stored verifier, reads the account address, upserts the connection (token replaced, label kept or default), resets `lastCheckAt`, status `waiting`, and queues a first check (`checkRequestedAt = now`). |
| `/gmail/label` | POST `label` | Validates (trim, 1-225 chars, no control chars). Saves; resets `lastCheckAt` so the new label is read from the first-run window; status `waiting`. |
| `/gmail/check` | POST | Sets `checkRequestedAt = now` if connected and none pending. Flash "queued; the worker picks it up within a minute". |
| `/gmail/disconnect` | POST | Revokes the token at Google (best effort, logged on failure), deletes the connection (ledger cascades), flash. Postings already found stay. |

Card states (`gmail-card.tsx`): not configured / not connected / connected (account, label form, status line, last check + counts, Check now, Disconnect) / access ended (Reconnect). The status line is the `status.ts` key worded through `t()`.

Not routes: the worker never serves HTTP; "Check now" only writes a request.
