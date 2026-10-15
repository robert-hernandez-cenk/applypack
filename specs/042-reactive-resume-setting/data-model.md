# Data Model: Reactive Resume connection as a saved setting

## ReactiveResumeConnection (new table `reactive_resume_connection`)

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | Int, primary key | one connection per person; FK to `users`, `onDelete: Cascade` |
| `baseUrl` | String | the instance as `parseInstanceUrl` wrote it (`URL.href`); never holds credentials (refused at parse) |
| `apiKey` | String | the secret; 1 to `MAX_KEY_CHARS` (500) characters after trim; selected only by `readInstanceKey` |
| `createdAt` | DateTime, default now | |
| `updatedAt` | DateTime, `@updatedAt` | |

**Transitions**: absent → saved (check passed) → saved (replaced, check passed) → absent (removed or user deleted). A failed check changes nothing.

**Validation**: address through `parseInstanceUrl`; key trimmed, non-empty, at most 500 characters (over-long refused whole); reach and list check before any write.

## ConnectionView (pure, what a page may know)

`{ base: string; host: string }` — no key field (held by the access test).

## Pull entry (in memory, `web/pull-stash.ts`)

| Field | Notes |
| --- | --- |
| `userId` | owner; `takePull` refuses another person |
| `ids` | the Reactive Resume ids the list showed; import may only ask for one of them |
| `target` | `{ kind: 'new' }` or `{ kind: 'version', resumeId }` |

Ten-minute lifetime, taken once, few per person (as #39). **No base, no key.**

## Existing rows

`Resume` is changed only through the existing `createResume` / `replaceResumeFile`; no new column on it (spec non-goal: remembering the source).
