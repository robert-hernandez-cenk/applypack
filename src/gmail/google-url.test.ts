import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GMAIL_SCOPES, authorizationUrl } from './google-url';

const settings = { clientId: 'id.apps.example', clientSecret: 'secret', redirectUri: 'https://jobs.example.org/gmail/callback' };

test('the consent screen asks for read-only mail and the account address, nothing more', () => {
  assert.equal(GMAIL_SCOPES, 'https://www.googleapis.com/auth/gmail.readonly openid email');
  const url = new URL(authorizationUrl(settings, { state: 's1', challenge: 'c1' }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('scope'), GMAIL_SCOPES);
});

test('it asks for a refresh token every time, with PKCE and the state', () => {
  const url = new URL(authorizationUrl(settings, { state: 's1', challenge: 'c1' }));
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('code_challenge'), 'c1');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 's1');
  assert.equal(url.searchParams.get('client_id'), 'id.apps.example');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://jobs.example.org/gmail/callback');
});

test('the client secret never rides on the browser address', () => {
  assert.ok(!authorizationUrl(settings, { state: 's1', challenge: 'c1' }).includes('secret'));
});
