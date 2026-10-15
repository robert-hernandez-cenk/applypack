# Data model: Reactive Resume import

No Prisma change, no migration. Three in-code shapes.

## ReactiveResumeRead (pure result of `readReactiveResume(json)`)

| Field | Type | Notes |
| --- | --- | --- |
| `ok` | `true` | |
| `generation` | `'v4' \| 'v5' \| 'v6'` | detected; shown nowhere to the person, logged at info |
| `name` | `string` | `basics.name`, else the resume's own name, else "Reactive Resume" |
| `markdown` | `string` | the visible content, reading order |

Refusal: `{ ok: false, code: 'notReactiveResume' \| 'empty' }`. A too-short text is refused by the caller with the existing `tooShort` notice (`MIN_TEXT_CHARS` 200), not here.

Rules: `hidden: true` (v5/v6) or `visible: false` (v4) on a section or an item drops it; picture, metadata, design, template are never read; unknown keys are ignored (zod `.passthrough()` off, shape tolerant).

## InstanceAddress (pure, `parseInstanceUrl`)

| Field | Type | Notes |
| --- | --- | --- |
| `base` | `URL` | http(s), no userinfo, no query/fragment, path prefix kept, no trailing slash |

Refusal codes: `scheme`, `credentials`, `empty`, `invalid`.

## PullEntry (in memory, `web/pull-stash.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | the only part that reaches a page |
| `userId` | number | an entry is read only by its owner |
| `base` | string | instance base, as parsed |
| `key` | string | the API key; never leaves the process |
| `createdAt` | number | TTL 10 min; max 8 entries, oldest evicted |

Transitions: created by a successful list → consumed (deleted) by the import → or expired/evicted.

## Resume (existing) — fields an import sets

`name` (the resume's name), `sourceFilename` (`<name>.md`), `mimeType` (`text/markdown`), `original` (Markdown bytes), `text` (same Markdown), then the usual `createResume` defaults and the queued scan.
