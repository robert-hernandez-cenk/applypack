import * as oidc from 'openid-client';
import type { OidcSettings } from './settings';
import type { IdentityClaims } from './session';

/*
 * The one file that talks to the identity provider (ADR 0064). Everything else
 * sees the small `OidcClient` below, so the routes are tested with a fake and
 * the library's calls are confirmed against its own types here.
 */

const SCOPE = 'openid profile email';

/** What a sign-in needs to remember between leaving for the provider and coming back. */
export interface SignInSecrets {
  state: string;
  nonce: string;
  verifier: string;
}

export interface OidcClient {
  /** A fresh sign-in: its secrets, and the provider address to send the browser to. */
  begin(): Promise<SignInSecrets & { url: string }>;
  /**
   * Trade the provider's answer for who signed in. Throws when the answer is
   * not valid (wrong state, nonce or verifier, a bad ID token, a provider error).
   */
  exchange(callbackUrl: URL, secrets: SignInSecrets): Promise<IdentityClaims>;
}

const isPlainHttp = (issuer: URL): boolean => issuer.protocol === 'http:';

/** Discovers the provider; rejects when it cannot be reached or does not describe itself. */
export async function createOidcClient(settings: OidcSettings): Promise<OidcClient> {
  const config = await oidc.discovery(
    settings.issuer,
    settings.clientId,
    settings.clientSecret,
    undefined,
    // settings.ts allows plain http for localhost only.
    isPlainHttp(settings.issuer) ? { execute: [oidc.allowInsecureRequests] } : undefined,
  );
  return {
    async begin() {
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const verifier = oidc.randomPKCECodeVerifier();
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: settings.redirectUri,
        scope: SCOPE,
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
      });
      return { state, nonce, verifier, url: url.href };
    },
    async exchange(callbackUrl, secrets) {
      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: secrets.verifier,
        expectedState: secrets.state,
        expectedNonce: secrets.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) throw new Error('the provider returned no ID token');
      return claims;
    },
  };
}
