# 0070 — Administrators run the install; members work in their own space

**Status:** Accepted (2026-10-14). Slice 6 of 6 of issue #5. Closes the series 0065-0069
and completes [0065](./0065-users-and-identity.md) (roles), [0069](./0069-settings-chats-and-mutes-belong-to-a-person.md)
("forced for slice 6") and [0049](./0049-employer-mode-is-a-mode-not-a-product.md) (employer mode is
administrators' only; its rows stay unscoped).

## Context

Slices 1-5 made searches, job state, resumes and notifications each person's own. What runs the
install for everybody — sources and companies, discovery, the fetch schedule and pause, the AI
engine, keys and spend, the update check, employer mode, the first-run wizard — was still editable by any
signed-in person, and nobody could see or manage the users.

## Decision

- **One route table decides who may call what** (`src/users/admin-policy.ts`, pure). Two lists,
  `ADMIN_ROUTES` and `PERSONAL_ROUTES`, name every route as `METHOD /pattern`; `routeAccess`
  matches a request to the most specific pattern, and a path in neither list is administrators-only
  (fail closed). The route smoke fails the build on a registered route that is in neither list or in
  both (`classesOf`), so a new route cannot ship unclassified.
- **One middleware enforces it** (`web/admin-guard.tsx`), after the display and language middleware and
  before any body is read: a member asking for an administrators' route gets a 403 page in their
  language (JSON for `/state` polls); a member opening `/welcome` is sent home.
- **Pages adapt to the role; writes are refused by the guard.** A member's menu has no Discovery, AI
  usage, Users or Screening; `/settings` hides the Sources, AI and Screening tabs and the install-wide
  sections of the others (pause, source-health alerts, start-at-login, update check) and keeps the
  schedule's alert half editable with the fetch half read-only; `/companies` shows only their muted
  companies (the list lives there, ADR 0056); the Overview and Runs draw no Fetch now or Pause.
- **`/runs` is read-only for members**: the install's runs, the install-wide search funnel
  (`funnel_day` counts the catalog, not anyone's private data) and their own recaps and nudges.
  Starting a run, pausing and every progress page's controls are administrators'.
- **No wizard for members.** `setupCompletedAt` is the install's; a member is never redirected to
  `/welcome` and is treated as set up for language purposes. The wizard configures the AI engine and
  sources, which are not theirs.
- **Employer mode** (screenings, applicants, rubrics) stays one shared set and is administrators'
  only, routes and menu alike. Scoping it by person is out of scope for the epic.
- **The users page** (`/users`, administrators): name, role, joined, last active (the newest of a
  resume save, a settings save, a stage change or an application; "never" otherwise), and what each
  person holds. An administrator promotes a member, demotes another administrator or removes a user,
  the removal behind the existing confirm popover that counts what goes with the person.
  `users/rules.ts` (pure): **nobody demotes or removes themselves** (another administrator does that: a
  misclick cannot lock a person out) and **the last administrator is never demoted or removed**.
  `changeUser` re-judges inside the settings write lock on a fresh read, so two administrators
  acting at once cannot take both.
- **Removal** deletes the `users` row; every owned table cascades (ADR 0066-0069). The per-person
  `cron_run` rows have no foreign key and are deleted in the same transaction. The shared catalog is
  untouched. The removed person's cookie now names no user: a 401, and signing in again makes a new
  member.
- **A tailoring run belongs to who started it.** `TargetRun.userId`; `/target/runs/<id>` and its
  `/state` answer "gone" to anyone else, and an identical request from a second person starts a run of
  their own instead of joining. (Closes the P3 of ADR 0068.)
- **`createProfile` / `updateProfile` check the resume's owner** themselves, so a route that forgets cannot
  link another person's resume to a search. (Closes the P2 of ADR 0066.)
- **Pack queueing is covered per person** by a unit test over `pack/trigger.ts` (settings and day count are
  the person's); the queue write itself is exercised by the two-person route smoke (ADR 0068). A DB-free
  integration test would need a seam in `process-jobs.ts` this slice does not justify.

## Consequences

- An install without sign-in still runs as the implicit default user, an administrator: nothing is refused.
  If that user is ever demoted by another administrator the open dashboard locks them out of administration;
  self-demotion is refused so the page cannot do it by accident.
- Sign-in is the only way to get a second user. Anyone the provider authenticates becomes a **member**;
  restrict the client at the provider (ADR 0064). There is no invitation, approval or email step.
- A member can still use the AI engine through their own comparisons, letters and checks; the engine, its keys
  and the spend are administrators'. The AI usage page is administrators' only because it shows the whole
  install's money.
- Operator notices (budget, changed careers page, failing sources) already go to administrators (ADR 0069).

## Alternatives considered

- **A guard line in every handler:** 70 places to forget; no way to list what is guarded.
- **A sub-app per role:** reorders the mount order that `/jobs/import` and `/companies/folder` depend on.
- **A `lastSeenAt` column written per request:** a write per page view for one column of a table.
- **Letting a lone administrator demote themselves when another exists:** one misclick from a lockout on an
  install without sign-in, where nobody else could undo it.
- **A per-user wizard flag:** would walk members through install-wide steps.
