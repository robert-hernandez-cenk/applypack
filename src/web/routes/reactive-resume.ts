import { Hono } from 'hono';
import { t } from '../../i18n/t';
import { cleanKey } from '../../resume/reactive-connection';
import type * as store from '../../resume/reactive-connection-store';
import { InstanceError, type listInstanceResumes } from '../../resume/reactive-resume-api';
import { parseInstanceUrl, type reachable } from '../../resume/reactive-resume-url';
import { flashRedirect } from '../flash';
import { onceGuard } from '../once-guard';
import { INSTANCE_FAILURE, KEY_FAILURE, REACH_FAILURE, URL_FAILURE } from '../reactive-failures';

/*
 * The Reactive Resume card's routes (ADR 0075). Both act as the person making
 * the request and send them back to the card. A pair is saved only after the
 * instance has listed their resumes with it, under the same address rules as a
 * pull (ADR 0073); the key is never in a flash, a log line or a redirect.
 */

export const REACTIVE_CARD_PATH = '/settings?tab=profile#reactive-resume';

export interface ReactiveRouteDeps {
  store: Pick<typeof store, 'saveConnection' | 'deleteConnection'>;
  list: typeof listInstanceResumes;
  reach: typeof reachable;
  userId: () => number;
  /** Only an administrator may aim the server at its own network; on a local install the one person is one. */
  mayReachInward: () => boolean;
}

const formText = (v: unknown): string => (typeof v === 'string' ? v : '');

export function createReactiveResumeRoute(deps: ReactiveRouteDeps): Hono {
  const routes = new Hono();
  const back = (kind: 'ok' | 'warn' | 'err', text: string): Response => flashRedirect(REACTIVE_CARD_PATH, kind, text);
  const once = onceGuard(() => `settings:reactive:${deps.userId()}`, () => REACTIVE_CARD_PATH);

  routes.post('/settings/reactive-resume', once, async (c) => {
    const form = await c.req.parseBody();
    const address = parseInstanceUrl(formText(form.url));
    if (!address.ok) return back('err', t(URL_FAILURE[address.code]));
    const key = cleanKey(form.key);
    if (!key.ok) return back('err', t(KEY_FAILURE[key.code]));
    const reach = await deps.reach(address.base, { privileged: deps.mayReachInward() });
    if (!reach.ok) return back('err', t(REACH_FAILURE[reach.code]));
    try {
      // The cheapest request that proves the address, the key and the API together; an empty list is still a working pair.
      await deps.list(address.base, key.key);
    } catch (err) {
      if (err instanceof InstanceError) return back('err', t(INSTANCE_FAILURE[err.code]));
      throw err;
    }
    await deps.store.saveConnection(deps.userId(), address.base.href, key.key);
    return back('ok', t('reactive.flash.saved', { host: address.base.host }));
  });

  routes.post('/settings/reactive-resume/remove', async () => {
    await deps.store.deleteConnection(deps.userId());
    return back('ok', t('reactive.flash.removed'));
  });

  return routes;
}
