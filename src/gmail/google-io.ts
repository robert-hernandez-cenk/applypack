import * as oidc from 'openid-client';
import { fetchWithRetry } from '../http';
import { findLabelId, parseLabels, parseMessageList, parseProfile, parseRefreshReply, parseTokenReply } from './google-reply';
import { parseMessage, type GmailMessage } from './message';
import type { GoogleSettings } from './settings';

/*
 * The only file that talks to Google (ADR 0071). Everything else sees the
 * `GoogleIo` below, so the routes and the job are tested with a fake, and
 * what Google may answer is read by `google-reply.ts`. A token is a header
 * or a form field here and nowhere else: never a URL, never a log line.
 * Failures arrive as `HttpError` / `Error`, which `status.ts:statusOf` reads.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Pages of 100 ids a run lists at most: 200 mails inside a two-week window is a lot of alerts. */
const MAX_LIST_PAGES = 2;
const PAGE_SIZE = '100';

export interface Pkce {
  verifier: string;
  challenge: string;
}

export interface GoogleIo {
  pkce(): Promise<Pkce>;
  exchangeCode(settings: GoogleSettings, code: string, verifier: string): Promise<{ accessToken: string; refreshToken: string }>;
  refreshAccessToken(settings: GoogleSettings, refreshToken: string): Promise<string>;
  accountEmail(accessToken: string): Promise<string>;
  revoke(refreshToken: string): Promise<void>;
}

async function postForm(url: string, form: Record<string, string>): Promise<unknown> {
  const resp = await fetchWithRetry(url, {
    init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() },
  });
  return resp.json();
}

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const resp = await fetchWithRetry(url, { init: { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } } });
  return resp.json();
}

/** What a check reads with an access token: the label, the mail ids under it, and a mail. */
export interface GmailReadIo {
  resolveLabelId(accessToken: string, name: string): Promise<string>;
  listMessages(accessToken: string, labelId: string, query: string): Promise<string[]>;
  getMessage(accessToken: string, id: string): Promise<GmailMessage>;
}

export const liveGoogleIo: GoogleIo & GmailReadIo = {
  async pkce() {
    const verifier = oidc.randomPKCECodeVerifier();
    return { verifier, challenge: await oidc.calculatePKCECodeChallenge(verifier) };
  },

  async exchangeCode(settings, code, verifier) {
    return parseTokenReply(
      await postForm(TOKEN_URL, {
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: settings.redirectUri,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
      }),
    );
  },

  async refreshAccessToken(settings, refreshToken) {
    return parseRefreshReply(
      await postForm(TOKEN_URL, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
      }),
    );
  },

  async accountEmail(accessToken) {
    return parseProfile(await getJson(`${GMAIL_API}/profile`, accessToken));
  },

  async resolveLabelId(accessToken, name) {
    return findLabelId(parseLabels(await getJson(`${GMAIL_API}/labels`, accessToken)), name);
  },

  async listMessages(accessToken, labelId, query) {
    const ids: string[] = [];
    let page: string | null = null;
    for (let i = 0; i < MAX_LIST_PAGES; i++) {
      const url = new URL(`${GMAIL_API}/messages`);
      url.search = new URLSearchParams({ labelIds: labelId, q: query, maxResults: PAGE_SIZE, ...(page && { pageToken: page }) }).toString();
      const listed = parseMessageList(await getJson(url.href, accessToken));
      ids.push(...listed.ids);
      if (!listed.next) break;
      page = listed.next;
    }
    return ids;
  },

  async getMessage(accessToken, id) {
    return parseMessage(await getJson(`${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`, accessToken));
  },

  async revoke(refreshToken) {
    await fetchWithRetry(REVOKE_URL, {
      init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken }).toString() },
    });
  },
};
