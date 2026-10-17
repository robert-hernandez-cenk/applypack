# Data model

No schema or migration change. `UserJob.pipelineStage` stays a nullable string (`prisma/schema.prisma`).

## Stage keys

| Key | Kind | Position | Notes |
|---|---|---|---|
| `consider` | fixed, new | board col 1 | pre-apply |
| `applying` | fixed, new | board col 2 | pre-apply |
| `applied` | fixed | board col 3 | apply date set here (board move or Mark applied) |
| *(work keys)* | the person's | after Applied | untouched |
| `rejected` | fixed end | No Offer | default drop target |
| `ghosted` | fixed end | No Offer | |
| `expired` | fixed end, new | No Offer | set by hand |
| `unfiled` | derived | own panel | jobs holding a key no column covers |
| `no-offer` | reserved, never stored | presentation column | |

Reserved (a work column cannot take them): `applied rejected ghosted unfiled consider applying expired no-offer`.

## hasApplied

```
hasApplied({ stage, appliedAt, status }) =
    status === 'APPLIED'
 || appliedAt !== null
 || (stage !== null && stage not in ['consider','applying'])
```

`appliedWhere` is the same rule as a Prisma `UserJobWhereInput` (for the pack and the company/source counts).

## Transitions

Any stage -> any stage. A ledger row (`JobStageEvent`) on every real change, `source = 'ui'`. `appliedAt` is set only when reaching `applied` (board move: if empty; Mark applied: if empty; the job form: as typed) and is never cleared by a move.
