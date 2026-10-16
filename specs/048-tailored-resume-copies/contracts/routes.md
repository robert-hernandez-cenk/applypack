# Route contract: Tailored resume copies

| Route | Before | After |
|-------|--------|-------|
| `POST /resumes/:id/draft` | form: `text`, `baseText`, optional `jobId`; saves the next version of the resume, then scans or compares | form: `text`, `baseText`, **required** `jobId`; upserts the (resume, posting) copy, then compares the copy; the resume is untouched; a missing or foreign `jobId` gets an error flash |
| `GET /tailored/:id/download` | — | the copy's file as an attachment; not found when the copy's resume is not the caller's |
| `POST /tailored/:id/delete` | — | deletes the copy and its comparisons; redirects back with a flash |
| `POST /tailored/:id/promote` | — | the copy's text and file become the resume's next version, scan cleared; redirects to `/resumes/<resumeId>` with a flash |
| `GET /resumes/:id` | page | adds the "Tailored copies" card |
| `GET /jobs/:id/target` | editor, "Save as vN" | editor, "Save tailored copy"; shows this posting's copy with a download link |

Access policy (`src/users/admin-policy.ts`): the three new routes join `PERSONAL_ROUTES`.
