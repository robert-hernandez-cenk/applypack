import { config } from '../config';
import { getAiRuntime } from '../ai-runtime';
import { liveGoogleIo } from '../gmail/google-io';
import { GMAIL_MAX_TOKENS } from '../gmail/prompt';
import { googleSettings } from '../gmail/settings';
import * as store from '../gmail/store';
import { t } from '../i18n/t';
import { logger } from '../logger';
import { listActiveProfiles } from '../profiles';
import { getSettings } from '../settings';
import { deliverHeldAlerts } from './alert-delivery';
import { makeFetchPauseProbe } from './fetch-pause';
import type { GmailJobDeps } from './gmail-job';
import { emptyProcessStats, processNormalizedJobs } from './process-jobs';

/*
 * The real Google, database, model and pipeline behind `runGmailJob` (ADR
 * 0071). Kept apart so the job itself is tested with fakes. The run ends as an
 * import does: the matches it held are sent as one message, the best listed
 * and the rest counted (alert-delivery.ts), to the person whose mail it was.
 */

export function liveGmailDeps(): GmailJobDeps {
  return {
    io: liveGoogleIo,
    google: googleSettings(config),
    store,
    ai: async () => {
      const runtime = await getAiRuntime();
      return {
        hasEngine: runtime.chainFor('scoring').length > 0,
        complete: async (system, user) =>
          (await runtime.complete({ json: true, system, user, maxTokens: GMAIL_MAX_TOKENS, label: 'gmail-extract', role: 'classifier' }))?.text ?? null,
      };
    },
    pipeline: {
      state: async () => {
        const settings = await getSettings();
        return { enabled: settings.fetchingEnabled, classifierMode: settings.classifierMode };
      },
      profiles: listActiveProfiles,
      run: async (items, profiles, opts, source) => {
        const inner = emptyProcessStats();
        // A pause on Settings stops a run that is scoring, as it stops a tick.
        await processNormalizedJobs(items, profiles, inner, { ...opts, isCancelled: makeFetchPauseProbe() });
        if (inner.alertHeld > 0) {
          const sent = await deliverHeldAlerts(new Date(), { companyId: source.id, title: t('gmail.alertTitle') }, opts.ownerId).catch((err: unknown) => {
            logger.error({ err, source: source.name }, 'gmail-job: the matches were not sent; they stay held');
            return { delivered: 0, messages: 0, counted: 0, failed: 0 };
          });
          inner.alerted += sent.delivered;
          inner.alertFailed += sent.failed;
          inner.alertHeld = Math.max(0, inner.alertHeld - sent.delivered - sent.counted - sent.failed);
        }
        return inner;
      },
    },
    now: () => new Date(),
  };
}
