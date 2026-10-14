import { Hono } from 'hono';
import { t } from '../../i18n/t';
import { authorizationUrl } from '../../gmail/google-url';
import type { GoogleIo } from '../../gmail/google-io';
import type { PendingStore } from '../../gmail/pending';
import { normalizeLabel, type GoogleSettings } from '../../gmail/settings';
import { statusOf } from '../../gmail/status';
import type * as store from '../../gmail/store';
import { logger } from '../../logger';
import { flashRedirect } from '../flash';

/*
 * The Gmail card's routes (ADR 0071). Every one acts as the person making the
 * request and sends them back to the card. Google and the database come in
 * through `GmailRouteDeps`, so the connect flow is tested without either; the
 * live wiring is `web/gmail-live.ts`. A token is never in a flash, a log line
 * or a redirect: the only thing that carries one is the call to the store.
 */

const GMAIL_CARD_PATH = '/settings?tab=profile#gmail';

export type GmailRouteStore = Pick<typeof store, 'saveConnection' | 'setLabel' | 'requestCheck' | 'deleteConnection' | 'readRefreshToken'>;

export interface GmailRouteDeps {
  io: GoogleIo;
  /** `null` when the install has no Google client. */
  settings: () => GoogleSettings | null;
  pending: PendingStore;
  store: GmailRouteStore;
  userId: () => number;
}

export function createGmailRoute(deps: GmailRouteDeps): Hono {
  const routes = new Hono();
  const back = (kind: 'ok' | 'warn' | 'err', text: string): Response => flashRedirect(GMAIL_CARD_PATH, kind, text);

  routes.get('/gmail/connect', async (c) => {
    const google = deps.settings();
    if (!google) return back('err', t('gmail.flash.notSetUp'));
    const { verifier, challenge } = await deps.io.pkce();
    const state = deps.pending.begin(deps.userId(), verifier);
    return c.redirect(authorizationUrl(google, { state, challenge }));
  });

  routes.get('/gmail/callback', async (c) => {
    const google = deps.settings();
    if (!google) return back('err', t('gmail.flash.notSetUp'));
    const userId = deps.userId();
    const state = c.req.query('state') ?? '';
    // Taken first, so a state is spent whatever Google answered.
    const verifier = deps.pending.take(state, userId);
    const code = c.req.query('code');
    if (c.req.query('error')) return back('err', t('gmail.flash.denied'));
    if (!verifier || !code) return back('err', t('gmail.flash.failed'));
    try {
      const tokens = await deps.io.exchangeCode(google, code, verifier);
      const accountEmail = await deps.io.accountEmail(tokens.accessToken);
      await deps.store.saveConnection(userId, { accountEmail, refreshToken: tokens.refreshToken });
    } catch (err) {
      logger.warn({ userId, status: statusOf(err) }, 'gmail: connecting failed');
      return back('err', t('gmail.flash.failed'));
    }
    logger.info({ userId }, 'gmail: connected');
    return back('ok', t('gmail.flash.connected'));
  });

  routes.post('/gmail/label', async (c) => {
    const form = await c.req.parseBody();
    const checked = normalizeLabel(typeof form.label === 'string' ? form.label : undefined);
    if (!checked.ok) return back('err', t('gmail.flash.labelInvalid'));
    return (await deps.store.setLabel(deps.userId(), checked.label))
      ? back('ok', t('gmail.flash.labelSaved'))
      : back('err', t('gmail.flash.notConnected'));
  });

  routes.post('/gmail/check', async () => {
    switch (await deps.store.requestCheck(deps.userId())) {
      case 'none':
        return back('err', t('gmail.flash.notConnected'));
      default:
        return back('ok', t('gmail.flash.queued'));
    }
  });

  routes.post('/gmail/disconnect', async () => {
    const userId = deps.userId();
    const token = await deps.store.readRefreshToken(userId);
    if (token === null) return back('warn', t('gmail.flash.notConnected'));
    // Best effort: the row goes either way, and a token Google still holds is one the person can revoke at their account.
    await deps.io.revoke(token).catch((err: unknown) => logger.warn({ userId, status: statusOf(err) }, 'gmail: revoke failed; deleting the connection anyway'));
    await deps.store.deleteConnection(userId);
    logger.info({ userId }, 'gmail: disconnected');
    return back('ok', t('gmail.flash.disconnected'));
  });

  return routes;
}
