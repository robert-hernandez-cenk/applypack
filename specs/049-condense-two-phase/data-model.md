# Data model

## `resume_match` (changed)

| Column | Change | Notes |
| --- | --- | --- |
| `condense` | NEW `Json @default("{}")` | `{ rewrites: MatchAction[], from: string }` once Tighten wording has run; `{}` before |
| `removals` | semantics | the cuts Phase A stored (gated); `[]` on a row never condensed |
| `breakdown.condense` | NEW marker | absent, `'removals'` (Phase A ran) or `'rewrites'` (Phase B ran) |

Migration `20261016150000_match_condense`: `ALTER TABLE "resume_match" ADD COLUMN "condense" JSONB NOT NULL DEFAULT '{}';`

## States

```
none --Find cuts--> removals --Tighten wording (posted text)--> rewrites
  ^                    |  ^                                        |
  |                    +--+ Find cuts again (replaces cuts)        |
  +---------- Find cuts again resets rewrites ---------------------+
```

Refresh suggestions does not change the state; it replaces `actions`, `strengths`, `cautions` only.

## Entities

- **Cut** = `MatchRemoval` (section, where, what, why, quote|null).
- **Wording proposal** = `MatchAction` with a `quote`, a `replacement` strictly shorter than the quote, `priority: 'medium'`.
