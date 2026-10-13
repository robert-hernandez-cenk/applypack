# Data model

`user_job`: id, userId -> users (cascade), jobId -> job (cascade), status JobStatus default NEW, fitScore Int?, techMatch String[], redFlags String[], summary Text?, priorityRulesApplied String[], alertedAt, alertHeldAt, appliedAt, recruiterContact, pipelineStage, applicationNotes Text, appliedResumeId -> resume (SetNull), appliedResumeVersion, appliedResumeText Text, createdAt; unique (userId, jobId); indexes (userId,status), (userId,alertHeldAt), (userId,pipelineStage,appliedAt), (jobId), (appliedResumeId).

`job_stage_event`: + userId default 1 -> users (cascade).

`job`: drops fitScore, techMatch, redFlags, summary, status, alertedAt, alertHeldAt, appliedAt, recruiterContact, pipelineStage, applicationNotes, appliedResume*, priorityRulesApplied and the indexes on them.
