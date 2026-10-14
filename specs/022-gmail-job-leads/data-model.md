# Data Model: Gmail Job Leads

## GmailConnection (`gmail_connection`)

One per person. Deleted with the person (cascade) and on Disconnect.

| Field | Type | Notes |
| --- | --- | --- |
| id | Int PK | |
| userId | Int, unique, FK `users` onDelete Cascade | one account per person |
| accountEmail | String | shown on the card; not an identifier |
| refreshToken | String | **secret**. Read only by `store.ts:readRefreshToken`; never selected by pages/routes, never logged |
| labelName | String, default `"Job Leads"` | 1-225 chars, trimmed (Gmail label limit); validated in `settings.ts` |
| status | String, default `"waiting"` | `waiting` `ok` `access_ended` `label_missing` `unreachable` `quota` `no_engine` `error` (set from `status.ts`) |
| checkRequestedAt | DateTime? | set by "Check now"; cleared by the worker when it takes the request |
| lastCheckAt | DateTime? | start of the last *successful* read; drives the window |
| lastMails | Int? | mails read in the last check |
| lastListings | Int? | postings found in the last check |
| createdAt, updatedAt | DateTime | |

State: `waiting` -> `ok` | any failure kind; any kind -> `ok` on the next good check; `access_ended` leaves the row so the card can offer Reconnect (Connect again replaces the token, keeps label).

## GmailMessage (`gmail_message`)

The processed-mail ledger. Holds no content.

| Field | Type | Notes |
| --- | --- | --- |
| id | Int PK | |
| connectionId | Int FK `gmail_connection` onDelete Cascade | |
| messageId | String | Gmail's message id |
| receivedAt | DateTime | the mail's `internalDate`; used to prune |
| outcome | String | `listings` `none` `unreadable` |
| count | Int | postings taken |
| createdAt | DateTime | |

`@@unique([connectionId, messageId])`, `@@index([connectionId, receivedAt])`. Written only after the mail's postings are stored. Pruned after 60 days.

## AtsType.GMAIL

New enum value. One hidden `Company` per person: `atsType=GMAIL`, `atsToken="user-<userId>"`, `name="Gmail"`, `active=false`. Created by `store.ts` on first read. `fetchOne` returns `[]`; hidden from `/companies` and source toggles like `IMPORT`.

## Mapped posting (no new column)

| NormalizedJob | From |
| --- | --- |
| companyId | the person's GMAIL row |
| externalId | `sha1(title | employerKey | location)` first 24 hex |
| title, location | listing (location may be `""`) |
| url | the mail link the listing points to (resolved from the model's `link` number, http(s) only). Never a Gmail permalink: it would point into the mailbox |
| description | the listing's own lines from the mail (bounded), never the whole mail |
| employer | listing company, or `null` (aggregator rule, ADR 0056) |
| postedAt | the mail's `internalDate` |
| handPicked | **unset** (digests go through the filter) |

Rule (listing.ts): a listing with no resolvable http(s) link is dropped and counted in the check's "skipped" figure, never guessed.

## Relationships

`User 1—0..1 GmailConnection 1—* GmailMessage`; `User 1—1 Company(GMAIL)` by token convention; postings reach `UserJob` only for the owner.

## Isolation rules (tested)

- Every `store.ts` read/write takes `userId`; no query lists connections without a user filter except the worker's `connectedUserIds()`.
- A callback with a `state` made for user A in user B's session is refused.
- `UserJob` rows for mail postings exist only for the owner.
