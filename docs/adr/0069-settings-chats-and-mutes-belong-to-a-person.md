# 0069 — What a person is told, where, and what they muted is their own; what runs the install is the install's

**Status:** Accepted (2026-10-14). Slice 5 of 6 of issue #5. Builds on
[0065](./0065-users-and-identity.md) to [0068](./0068-a-resume-and-what-hangs-off-it-is-its-owners.md);
amends [0041](./0041-notification-channels.md) (a destination is a person's),
[0056](./0056-mute-an-employer-and-a-reapply-window.md) (the mute list and the window are a person's),
[0063](./0063-the-worker-prepares-an-application-pack.md) (the pack settings are a person's) and
[0061](./0061-the-interface-speaks-several-languages.md) (the language is a person's).

## Context

With per-person searches, job rows and resumes (0066 to 0068), the settings were still one
singleton row, the destinations one install-wide list and the mute list one set: a person's
Alerts switch, chats, mutes, language and zone applied to everybody, and a chat that no search
named got one alert per person.

## Decision

- **`AppSettings` keeps what runs the install; `UserSettings` (one row per user, `userId` primary
  key, cascade) holds what is a person's.** The split is `src/settings-split.ts` (pure): its two
  lists are held to the schema by a test, so a new column must be put on one side to build.
  A person's row is created with its defaults the first time anything reads it; row 1 is copied
  from the old singleton by the migration.

| Setting | Side | Why |
|---|---|---|
| Alerts on/off (`telegramEnabled`) | person | holds what is found for them |
| Alert timing, digest hours, and the person's time zone (`schedule`, alert half) | person | their window, their zone |
| Application tracking, stale-nudge toggle | person | their board, their nudge |
| Re-apply window (`reapplyDays`) | person | counts their own applications |
| Cover angles, board columns (`pipelineStages`) | person | their letters, their board |
| Application-pack settings (`pack`) | person | their resume, their limit |
| Interface language (`locale`) | person | what they read |
| Fetch schedule and its zone (`schedule`, fetch half), `fetchingEnabled` | install | one search for everybody |
| `disabledSources`, `hnParserEnabled`, `discoveryEnabled`, `sourceKeys`, `classifierMode` | install | the catalog is shared |
| `aiEngine`, `aiKeys`, `openAiBaseUrl`, `localAiUrl`, `localContextTokens`, `aiBudgetCents`, `aiBudgetAlerted`, `aiUsage` | install | per-user AI keys are out of scope |
| `updateCheck`, `latestVersion`, `latestCheckedAt`, `instanceId` | install | about this install |
| `employerMode`, `screeningRetentionDays` | install | employer mode is not scoped |
| `sourceHealthAlerts` | install | a policy for operator notices |
| `setupCompletedAt` | install | the wizard sets up engines and sources; a member is not walked through it |
| `employersFilledAt` | install | a one-time fill of shared rows |

- **The schedule is cut in two.** `app_settings.schedule` is `{timezone, fetch}`; `user_settings.schedule`
  is `{timezone, alerts}`. Both keep the one `Schedule` shape, each side reads its half
  (`settings-split.ts:personalSchedule`), so every caller still holds a whole `Schedule`. The page
  is drawn in the person's zone. The Schedule form saves the person's half for everybody; the fetch
  half and the install's zone are written only by an administrator (`formForRole`) — forced by the
  split, otherwise a member would reschedule the install. A member sees the fetch fields read-only.
- **Destinations and mutes are owned.** `NotificationTarget.userId` (a destination is unique per
  person, so the same chat may be two people's), `CompanyMute (userId, key)`. Every list, toggle,
  delete, test and pick takes the `userId`; another person's id is "not found". A search can
  name only its owner's destination; a search naming none broadcasts to *its owner's* active
  destinations.
- **Delivery is per person.** `alertChannel`, `sendAlert`, `sendDigest`, `sendPackNotice` take the
  person; held alerts are grouped per person and chat (`held-alerts.ts`) and each person's
  schedule, switch and chats decide when theirs leave; the recap and the stale nudge run per
  person at *their* digest hours (`jobs/for-each-user.ts`), each with a run row carrying
  `cron_run.userId`, and "since the last recap" is read from the person's own last run (rows
  from before users count for the default user). The packs-ready message, `listUnnotifiedPacks`
  and `cancelQueuedAutoPacks` are per owner. Messages are worded in the recipient's language.
- **Operator notices go to administrators:** the AI budget warning, the changed-careers-page
  notice, and the failing-source line of the recap, each through the administrator's own chats,
  switch and hours. A member's chat never hears them.
- **Mutes at the tick.** Each recipient has their own rules (`loadEmployerRulesFor`). A posting is
  turned away before any AI only when *every* person it could reach turns it away
  (`employer.ts:employerGates`); otherwise those who do get no row and no alert and the rest are
  served as before. A pass over the whole catalog (re-classify) sets a posting aside only when
  every holder muted it (`heldOnlyByMuters`). `/jobs`, the Overview and the job lists hide the
  person's own mutes; the re-apply window counts only the person's own applications.
- **The pack runner** reads the pack owner's switch, floor, limits, cover angles and mutes; the
  tick reads each person's pack settings and day count.
- **Bootstrap and tools.** The `.env` bootstrap of destinations goes to the default user; the
  once-scripts for the recap and the nudge run for every person.
- **Run history** (`/runs`, the Overview's last-run tiles) shows the install's runs and the
  person's own recaps and nudges.

## Forced for slice 6 (#12)

Everything install-wide above is still editable by any signed-in user (sources, AI engine and
keys, fetching pause, employer mode, update check, wizard), as it was; only the fetch half of the
schedule is gated, because the split made the form ambiguous. #12 puts the role UI and the gating
on the rest. Operator notices already follow the `ADMIN` role.

## Consequences

- A new person starts with alerts on, instant mode, packs off, English, the install's zone and no
  destinations: nothing reaches them until they add a chat.
- A broadcast chat a person owns gets one alert per posting from *that person's* verdicts; two
  people sharing a chat each add it (unique per person) and each hear their own matches.
- The route smoke runs the two-person checks with Telegram replaced by a recording stand-in.

## Alternatives considered

- **Per-user columns on `users`:** wide table, and the classification test has nothing to hold on to.
- **A key/value table:** loses types, defaults and the schema-held classification.
- **Dropping a posting at the tick when anyone muted it:** hides it from people who did not.
- **A shared digest mark with one run row for all people:** a person's window would be cut by
  somebody else's digest hour.
- **Per-user wizard flag:** would send members through install-wide steps (AI engine, sources).
