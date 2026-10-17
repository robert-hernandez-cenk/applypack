# Data Model: Reactive Resume write-back

## Stored

### Resume (existing table `resume`) — two columns added

| Column | Type | Rule |
| --- | --- | --- |
| `remoteId` | `String?` | The resume's id on the person's Reactive Resume instance. Set when a resume is created from, or given a new version from, a Reactive Resume import; `NULL` for every other source. Not backfilled. |
| `remoteGeneration` | `String?` | `v4`, `v5` or `v6` as read at import. `NULL` with `remoteId`. |

Both are set or cleared together. A new version uploaded from a **file** clears them (the text no longer comes from
the source); a new version pulled from RR sets them to the pulled resume. No index (never queried by them).

Migration `20261017000000_resume_remote_origin`: `ALTER TABLE "resume" ADD COLUMN "remoteId" TEXT, ADD COLUMN
"remoteGeneration" TEXT;`. `prisma migrate diff` must be empty against the schema.

`TailoredResume` is unchanged.

## Derived (never stored)

### MappedRead (reader output)

```
{ ok: true, generation, name, markdown, lines: LineSource[] }   // lines.length === markdown.split('\n').length
LineSource = null | { pointer: string; id: string; field: 'description'|'summary'|'content'|'headline'|'keywords'|…;
                      kind: 'html' | 'text' | 'keywords'; label: string }
```

`label` is the English noun used in the report ("Experience · Dell"); the page words it (`placeName`-style: stored
English, worded on the way out).

### WriteBackPlan (pure result)

```
{ operations: PatchOp[]; edits: EditReport[] }
PatchOp = { op: 'replace'|'add'|'remove'; path: string; value?: unknown }
EditReport = { status: 'applied' | 'notApplied'; kind: 'changed'|'added'|'removed'; label: string; line: string;
               reason?: 'noField'|'misaligned'|'assembled'|'newSection'|'labelChanged' }
```

### SendResult (route → page)

```
{ ok: true; remoteId: string; name: string; applied: number; notApplied: EditReport[] }
| { ok: false; code: 'noOrigin'|'noConnection'|'stale'|'generation'|'notFound'|'locked'|'conflict'|'badPatch'
                |'unauthorized'|'unreachable'|'timeout'|'tooLarge'|'notApi'|'redirect'|'privateAddress';
    createdRemoteId?: string }       // set when a clone exists despite the failure
```

## Relationships and ownership

`TailoredResume → Resume → User`: the route resolves the copy through `userId` (existing `getTailoredWithFile`
pattern); a foreign id reads as "gone". The connection is read with the person's own `userId`.

## State transitions

None stored. A send has no persisted state; its outcome is a flash on the redirect target.
