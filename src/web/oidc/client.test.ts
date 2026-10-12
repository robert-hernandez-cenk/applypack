import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOidcClient } from './client';
import { readOidcSettings, type OidcSettings } from './settings';

/*
 * The real library against a provider that lives in this process: discovery,
 * PKCE, the code exchange and the ID-token checks are the library's, so this is
 * where they are shown to hold (ADR 0064). The provider signs with a key it
 * publishes; each test says what its next token looks like.
 */

const CLIENT_ID = 'applypack';
const CLIENT_SECRET = 'shh';
const KID = 'test-key';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (data: Buffer | string): string => Buffer.from(data).toString('base64url');

interface Seen {
  challenge: string | null;
  tokenRequest: URLSearchParams | null;
  authorization: string | undefined;
}
const seen: Seen = { challenge: null, tokenRequest: null, authorization: undefined };
/** Overrides for the claims of the next ID token. */
let claims: Record<string, unknown> = {};
let server: Server;
let origin = '';

function idToken(extra: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
  const payload = b64(JSON.stringify({ iss: origin, aud: CLIENT_ID, sub: 'user-1', name: 'Ada', iat: now, exp: now + 300, ...extra }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function body(req: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of req) text += String(chunk);
  return text;
}

before(async () => {
  server = createServer(async (req, res) => {
    const json = (value: unknown): void => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(value));
    };
    if (req.url === '/.well-known/openid-configuration') {
      return json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        jwks_uri: `${origin}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (req.url === '/jwks') return json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] });
    if (req.url === '/token' && req.method === 'POST') {
      seen.tokenRequest = new URLSearchParams(await body(req));
      seen.authorization = req.headers.authorization;
      return json({ access_token: 'access', token_type: 'Bearer', expires_in: 300, id_token: idToken(claims) });
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

function settings(): OidcSettings {
  const reading = readOidcSettings({
    OIDC_ISSUER: origin,
    OIDC_CLIENT_ID: CLIENT_ID,
    OIDC_CLIENT_SECRET: CLIENT_SECRET,
    OIDC_SESSION_SECRET: 'k'.repeat(32),
    WEB_PUBLIC_URL: 'https://jobs.example.test',
  });
  assert.equal(reading.kind, 'on');
  if (reading.kind !== 'on') throw new Error('settings');
  return reading.settings;
}

/** Sign in as the browser would: begin, then come back with a code and the state. */
async function comeBack(stateOverride?: string): Promise<{ client: Awaited<ReturnType<typeof createOidcClient>>; secrets: { state: string; nonce: string; verifier: string }; callback: URL }> {
  const client = await createOidcClient(settings());
  const begun = await client.begin();
  seen.challenge = new URL(begun.url).searchParams.get('code_challenge');
  const callback = new URL('https://jobs.example.test/auth/callback');
  callback.searchParams.set('code', 'the-code');
  callback.searchParams.set('state', stateOverride ?? begun.state);
  return { client, secrets: { state: begun.state, nonce: begun.nonce, verifier: begun.verifier }, callback };
}

test('begin() builds a PKCE authorization request for the discovered endpoint', async () => {
  const client = await createOidcClient(settings());
  const begun = await client.begin();
  const url = new URL(begun.url);
  assert.equal(url.origin + url.pathname, `${origin}/authorize`);
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://jobs.example.test/auth/callback');
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('state'), begun.state);
  assert.equal(url.searchParams.get('nonce'), begun.nonce);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(begun.verifier).digest('base64url'));
});

test('every sign-in has secrets of its own', async () => {
  const client = await createOidcClient(settings());
  const [a, b] = [await client.begin(), await client.begin()];
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.verifier, b.verifier);
});

test('exchange() trades the code for the person, proving the PKCE verifier and the client secret', async () => {
  const { client, secrets, callback } = await comeBack();
  claims = { nonce: secrets.nonce };
  const who = await client.exchange(callback, secrets);
  assert.equal(who.sub, 'user-1');
  assert.equal(who.name, 'Ada');
  const sent = seen.tokenRequest;
  assert.ok(sent);
  assert.equal(sent.get('grant_type'), 'authorization_code');
  assert.equal(sent.get('code'), 'the-code');
  assert.equal(sent.get('redirect_uri'), 'https://jobs.example.test/auth/callback');
  assert.equal(sent.get('code_verifier'), secrets.verifier);
  assert.equal(createHash('sha256').update(sent.get('code_verifier') ?? '').digest('base64url'), seen.challenge);
  // The secret travels in the body or in a Basic header, whichever the library picks; one of them carries it.
  const basic = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
  assert.ok(sent.get('client_secret') === CLIENT_SECRET || seen.authorization === basic, 'the client authenticates with its secret');
});

test('exchange() refuses an answer carrying another sign-in\'s state', async () => {
  const { client, secrets, callback } = await comeBack('someone-elses-state');
  claims = { nonce: secrets.nonce };
  await assert.rejects(client.exchange(callback, secrets));
});

test('exchange() refuses an ID token minted for another nonce', async () => {
  const { client, secrets, callback } = await comeBack();
  claims = { nonce: 'replayed-from-another-sign-in' };
  await assert.rejects(client.exchange(callback, secrets));
});

test('exchange() refuses an ID token minted for another client', async () => {
  const { client, secrets, callback } = await comeBack();
  claims = { nonce: secrets.nonce, aud: 'some-other-app' };
  await assert.rejects(client.exchange(callback, secrets));
});

test('exchange() refuses an ID token from another issuer', async () => {
  const { client, secrets, callback } = await comeBack();
  claims = { nonce: secrets.nonce, iss: 'https://evil.example.test' };
  await assert.rejects(client.exchange(callback, secrets));
});

test('exchange() refuses an ID token that has expired', async () => {
  const { client, secrets, callback } = await comeBack();
  const past = Math.floor(Date.now() / 1000) - 3600;
  claims = { nonce: secrets.nonce, iat: past - 300, exp: past };
  await assert.rejects(client.exchange(callback, secrets));
});

test('exchange() refuses a provider error in the callback', async () => {
  const { client, secrets } = await comeBack();
  const callback = new URL('https://jobs.example.test/auth/callback?error=access_denied&state=' + secrets.state);
  await assert.rejects(client.exchange(callback, secrets));
});

test('a provider that cannot be reached makes the client fail to connect', async () => {
  const reading = readOidcSettings({
    OIDC_ISSUER: 'http://127.0.0.1:1',
    OIDC_CLIENT_ID: CLIENT_ID,
    OIDC_CLIENT_SECRET: CLIENT_SECRET,
    OIDC_SESSION_SECRET: 'k'.repeat(32),
    WEB_PUBLIC_URL: 'https://jobs.example.test',
  });
  if (reading.kind !== 'on') return assert.fail('settings');
  await assert.rejects(createOidcClient(reading.settings));
});
