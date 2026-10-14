import type { GoogleSettings } from './settings';

/*
 * The address the browser is sent to for consent (ADR 0071). Pure, so the one
 * thing worth pinning — what we ask Google for — is tested. The client secret
 * is not in it; it only travels in the server-to-server code exchange.
 */

/** Read-only mail, and the account address to show. Nothing that could send, label or delete. */
export const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly openid email';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export function authorizationUrl(settings: GoogleSettings, secrets: { state: string; challenge: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    // A refresh token on every consent, so a reconnect always yields one.
    access_type: 'offline',
    prompt: 'consent',
    state: secrets.state,
    code_challenge: secrets.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}
