import * as oidc from 'openid-client';
import { fetchWithRetry } from '../http';
import { parseProfile, parseRefreshReply, parseTokenReply } from './google-reply';
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

export const liveGoogleIo: GoogleIo = {
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

  async revoke(refreshToken) {
    await fetchWithRetry(REVOKE_URL, {
      init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken }).toString() },
    });
  },
};
