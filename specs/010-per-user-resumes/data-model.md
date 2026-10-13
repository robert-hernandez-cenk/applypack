# Data model

`resume`: + `userId` Int NOT NULL default 1 -> users (cascade), index (userId).

`candidate_fact`: + `userId` Int NOT NULL default 1 -> users (cascade); unique (userId, term) replaces unique (term).

`application_pack`: + `userId` Int NOT NULL default 1 -> users (cascade); unique (userId, jobId) replaces unique (jobId); index (userId, status).

Owned through `resume` (no column): `resume_match`, `resume_review`, `cover_letter`.
Shared: `posting_brief`, `job_verification`, `ai_call` (bare resumeId).
`users`: + relations `resumes`, `candidateFacts`, `applicationPacks`.
