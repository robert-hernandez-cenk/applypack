import { SOURCE_LOCALE, withLocale, type Locale } from './i18n/locale';
import { DEFAULT_USER_ID } from './users/identity';
import { logger } from './logger';
import { getDisplaySettings } from './settings';

/*
 * The language a worker run writes its messages in (ADR 0061, stage 4): the
 * one chosen for the interface, so an alert, the recap and a reminder read
 * like the dashboard. Read at the start of every cron run and every
 * once-script, never kept between them (gotcha 9): a change on Settings
 * reaches the next tick. None chosen, or a database that cannot answer, is
 * English. The language is a person's own (ADR 0069): a run that is not for
 * anyone in particular writes the default user's, and a message for a person
 * is worded in theirs.
 */

async function runLocale(userId: number): Promise<Locale> {
  try {
    return (await getDisplaySettings(userId)).locale ?? SOURCE_LOCALE;
  } catch (err) {
    logger.warn({ err }, 'locale: the language could not be read; this run writes English');
    return SOURCE_LOCALE;
  }
}

/** `run` in a person's interface language (the default user's unless told), read now. */
export async function inRunLocale<T>(run: () => Promise<T>, userId: number = DEFAULT_USER_ID): Promise<T> {
  return withLocale(await runLocale(userId), run);
}
