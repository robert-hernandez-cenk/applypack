# Research: Per-user notifications and settings

## R1 Which AppSettings columns are personal
Decision: personal = telegramEnabled, applicationTrackingEnabled, staleApplicationsDigestEnabled, reapplyDays, coverAngles, pipelineStages, pack, locale, and the alert half and zone of `schedule`. Global = classifierMode, hnParserEnabled, disabledSources, discoveryEnabled, fetchingEnabled, aiEngine, aiKeys, sourceKeys, aiUsage (retired), updateCheck, latestVersion, latestCheckedAt, aiBudgetCents, aiBudgetAlerted, openAiBaseUrl, localAiUrl, localContextTokens, employersFilledAt, sourceHealthAlerts, setupCompletedAt, instanceId, employerMode, screeningRetentionDays, and the fetch half of `schedule`. Rationale: a column is personal when it changes what one person sees or is told; global when it changes what the install does or spends. Per-user AI keys are out of scope, so budget and base urls stay global. `sourceHealthAlerts` is a policy for operator notices. `setupCompletedAt` guards the install-wide wizard (AI engine, sources).
Alternatives: per-user setup wizard flag (a new member would be sent through install-wide steps); per-user source health flag (flag is about sources, not the person).

## R2 Schedule split
Decision: keep `AppSettings.schedule` as the global `{timezone, fetch}`; new `UserSettings.schedule` holds `{timezone, alerts}`. Same Zod shape in both so parsing is unchanged and each side reads only its half. Rationale: smallest change; the fetch gate keeps `getSchedule()`.
Alternative: new tables for each half (more migration for no gain).

## R3 Employer gate with several people
Decision: the tick drops a posting before classification only when every candidate recipient turns it away (candidates = owners of running searches, or the import's owner); otherwise people who turn it away are removed from the rows. Rationale: dropping on one person's mute would hide the posting from everyone.

## R4 Digest per person
Decision: the hourly beat loops people, runs those whose digest hour it is, one `cron_run` row per person (`CronRun.userId`); the window starts at that person's last OK run (legacy null rows count for user 1). Rationale: the user's digest hours are personal; one install-wide mark would cut windows short.

## R5 Operator notices
Decision: administrators' active targets, only for administrators whose alert switch is on. Rationale: someone must hear about budget and a changed careers page; admins own the install. Page-change notice follows the same hold rules per administrator.

## R6 Display middleware order
Decision: `withCurrentUser` is registered before the display middleware so the zone and language come from the person. The 401 for a vanished session is worded in the default language.

## R7 Schedule form for members
Decision: only an administrator's save stores the fetch half and the install zone; a member's save stores the alert half and their zone. Forced by the split; the role UI and gating of other global settings are slice 6.
