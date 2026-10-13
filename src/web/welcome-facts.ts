import type { Profile } from '@prisma/client';
import { prisma } from '../db';
import { probeAiProviders, type AiProviderStatus } from '../ai-runtime';
import { aiEngineOrder, parseAiEngineConfig, type AiProviderId } from '../ai-engine';
import { config } from '../config';
import { getSettings, type AppSettingsView } from '../settings';
import { getActiveProfile } from '../profiles';
import { currentUser } from './current-user';
import { isBlankProfile } from '../profile-guards';
import type { SourceSuggestion } from '../starter-packs/suggest';
import { currentSuggestions, waitingSuggestions } from './source-suggestions';
import type { WelcomeFacts } from './welcome-steps';
import { t } from '../i18n/t';

/*
 * Gathers what the wizard derives its steps from (welcome-steps.ts) — shared
 * by /welcome and the Overview's "Finish setup" chip. The engine probe is
 * cached for a minute inside probeAiProviders, so the 30 s Overview refresh
 * does not spawn CLI processes every time.
 */

export interface WelcomeContext {
  facts: WelcomeFacts;
  settings: AppSettingsView;
  statuses: Record<AiProviderId, AiProviderStatus>;
  profile: Profile | null;
  /** What the sources step lists (#148). */
  suggestions: SourceSuggestion[];
}

export async function loadWelcomeContext(): Promise<WelcomeContext> {
  const [settings, probed, profile, jobCount, scoredCount, suggestions] = await Promise.all([
    getSettings(),
    probeAiProviders(),
    getActiveProfile(currentUser().id),
    // The person's own postings: a teammate's scored jobs say nothing about this person's setup (ADR 0067).
    prisma.userJob.count({ where: { userId: currentUser().id } }),
    prisma.userJob.count({ where: { userId: currentUser().id, fitScore: { not: null } } }),
    currentSuggestions(),
  ]);
  // Ollama answering on its default address is an offer — the "A model on
  // this computer" card — until the local engine is in the list: counted as
  // connected, setup would call step 1 done while nothing would call it.
  const order = aiEngineOrder(parseAiEngineConfig(settings.aiEngine), config.AI_PROVIDER);
  const statuses =
    probed.local_api.ok && !order.includes('local_api')
      ? { ...probed, local_api: { ok: false, detail: t('welcome.ai.notInList', { detail: probed.local_api.detail }) } }
      : probed;
  return {
    settings,
    statuses,
    profile,
    suggestions,
    facts: {
      aiReady: Object.values(statuses).some((s) => s.ok),
      jobCount,
      profileReady: profile !== null && !isBlankProfile(profile),
      scoredCount,
      sourcesWaiting: waitingSuggestions(suggestions).length,
      setupCompletedAt: settings.setupCompletedAt,
    },
  };
}
