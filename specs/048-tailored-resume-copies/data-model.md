# Data model: Tailored resume copies

## TailoredResume (`tailored_resume`)

| Column | Type | Notes |
|--------|------|-------|
| id | Int PK | |
| resumeId | Int | FK `resume` ON DELETE CASCADE — the owner is reached through it |
| jobId | Int | FK `job` ON DELETE CASCADE |
| text | Text | the copy's plain text |
| sourceFilename | String | file name for download |
| mimeType | String | |
| original | Bytes | the file; left out of list reads |
| createdAt / updatedAt | DateTime | `updatedAt` is when the copy was last saved |

Unique `(resumeId, jobId)`. Index on `jobId`.

## ResumeMatch (changed)

`tailoredId Int?` — FK `tailored_resume` ON DELETE CASCADE; index on `tailoredId`. NULL means a comparison of the master itself (every existing row).

## Rules

- Every store function takes `userId` first and reads a copy `where: { id, resume: { userId } }`.
- A copy is never read by: the resume list, the scan, `listOtherResumeSkills`, `sameTextAs`/`findResumeWithText`, `matchStatsByResume`, `listLatestKeywordTables`.
- Save = upsert on `(resumeId, jobId)`; promote = `replaceResumeFile` from the copy; delete = row removal (its comparisons cascade).
- No backfill: old versions stay as they are.
