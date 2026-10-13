import { defaultSchedule, parseSchedule, ScheduleSchema, type Schedule } from './user-schedule';

/*
 * What is the install's and what is a person's in the settings (ADR 0069).
 * Pure: the lists below are the classification, held to the schema by
 * settings-split.test.ts (a column in neither list fails the build), and the
 * schedule helpers are the one place the stored schedule is cut in two.
 *
 * AppSettings keeps what runs the install: fetching, sources, the AI engine
 * and what it costs, employer mode, the wizard flag. UserSettings (one row per
 * person) keeps what changes what one person sees or is told.
 */

/** The columns `app_settings` keeps. `schedule` stays as the install's fetch half (zone + fetch). */
export const GLOBAL_COLUMNS = [
  'id',
  'classifierMode',
  'hnParserEnabled',
  'disabledSources',
  'discoveryEnabled',
  'fetchingEnabled',
  'aiEngine',
  'aiKeys',
  'sourceKeys',
  'aiUsage',
  'updateCheck',
  'latestVersion',
  'latestCheckedAt',
  'aiBudgetCents',
  'aiBudgetAlerted',
  'openAiBaseUrl',
  'localAiUrl',
  'localContextTokens',
  'employersFilledAt',
  'sourceHealthAlerts',
  'schedule',
  'setupCompletedAt',
  'instanceId',
  'employerMode',
  'screeningRetentionDays',
  'updatedAt',
] as const;

/** The columns `user_settings` holds, besides its `userId` and `updatedAt`. `schedule` is the alert half + the person's zone. */
export const PERSONAL_COLUMNS = [
  'telegramEnabled',
  'applicationTrackingEnabled',
  'staleApplicationsDigestEnabled',
  'reapplyDays',
  'coverAngles',
  'pipelineStages',
  'schedule',
  'pack',
  'locale',
] as const;

/** Columns that left `app_settings` for `user_settings` in migration 20261014090000 — kept so the ADR table and the test say where each went. */
export const MOVED_COLUMNS = PERSONAL_COLUMNS.filter((c) => c !== 'schedule');

/**
 * The person's schedule as the alert code wants it: their zone and their alert
 * half. `fetch` is the install's, copied in so the object is a whole `Schedule`
 * (callers that ask "when may a match be sent" never read it). A person who has
 * saved nothing gets the defaults in the install's zone.
 */
export function personalSchedule(personalRaw: unknown, globalRaw: unknown, fallbackZone: string): Schedule {
  const global = parseSchedule(globalRaw, fallbackZone);
  const own = ScheduleSchema.safeParse(personalRaw ?? undefined);
  if (!own.success) return { ...defaultSchedule(global.timezone), fetch: global.fetch };
  return { ...own.data, fetch: global.fetch };
}

/** What a save of the schedule form stores: the person's half always, the install's only for an administrator. */
export interface ScheduleSave {
  /** The person's `user_settings.schedule`. */
  personal: Schedule;
  /** The install's `app_settings.schedule`; null = leave it as it is. */
  global: Schedule | null;
}

export function planScheduleSave(form: Schedule, isAdmin: boolean): ScheduleSave {
  return { personal: form, global: isAdmin ? form : null };
}

/**
 * The form a person submits, with the install's fetch half put back when they
 * may not change it: a member's fetch fields are shown, not saved.
 */
export function formForRole(form: Schedule, current: Schedule, isAdmin: boolean): Schedule {
  return isAdmin ? form : { ...form, fetch: current.fetch };
}
