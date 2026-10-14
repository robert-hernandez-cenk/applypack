import { cleanServerUrl, isLocalHost } from './ai-usage';
import { t } from './i18n/t';
import { lookupAddresses, type Resolver } from './jobs/posting-url';

/*
 * The Ollama address typed for the local engine (ADR 0057): its root, on this
 * machine or the user's own network — the engine is called local because it
 * is. A pasted `/v1` or `/api` is dropped: the native API lives at the root.
 *
 * "Local" is read off the name first (`isLocalHost`). A name that does not
 * say so — `ollama.lan`, a split-horizon `ai.example.com` — is looked up and
 * accepted only when EVERY address it answers with is local, so one public
 * record refuses it. Judged when the address is saved; a record that changes
 * afterwards is not watched (the DNS-rebinding residual jobs/posting-url.ts
 * names). Kept apart from ai-usage.ts, which is pure.
 */

/** The system resolver can wait a long time on a broken network, and a form post waits with it. */
export const LOOKUP_TIMEOUT_MS = 5_000;

export async function checkLocalAiUrl(
  input: string,
  resolve: Resolver = lookupAddresses,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const cleaned = cleanServerUrl(input);
  if (!cleaned.ok) return cleaned;
  const host = new URL(cleaned.url).hostname;
  if (!isLocalHost(host)) {
    const addresses = await resolveWithin(resolve, host.replace(/^\[|\]$/g, ''));
    if (addresses.length === 0) return { ok: false, reason: t('engine.url.noHost') };
    if (!addresses.every(isLocalHost)) return { ok: false, reason: t('engine.url.notLocal') };
  }
  return { ok: true, url: cleaned.url.replace(/\/(v1|api)$/, '') };
}

/** What the name resolves to; a failure or a lookup that outlasts the limit is an empty answer. */
async function resolveWithin(resolve: Resolver, host: string): Promise<string[]> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<string[]>((done) => {
    timer = setTimeout(() => done([]), LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([resolve(host).catch(() => []), limit]);
  } finally {
    clearTimeout(timer);
  }
}
