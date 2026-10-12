import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOidcSettings } from './settings';

const SECRET = 'x'.repeat(32);
const FULL = {
  OIDC_ISSUER: 'https://idp.example.test',
  OIDC_CLIENT_ID: 'applypack',
  OIDC_CLIENT_SECRET: 'shh',
  OIDC_SESSION_SECRET: SECRET,
  WEB_PUBLIC_URL: 'https://jobs.example.test',
};

function errorOf(env: Record<string, string | undefined>): string {
  const result = readOidcSettings(env);
  assert.equal(result.kind, 'error');
  return result.kind === 'error' ? result.message : '';
}

test('nothing set means sign-in is off', () => {
  assert.deepEqual(readOidcSettings({}), { kind: 'off' });
});

test('a full block turns it on and derives the redirect URI', () => {
  const result = readOidcSettings({ ...FULL, WEB_PUBLIC_URL: 'https://jobs.example.test/' });
  assert.equal(result.kind, 'on');
  if (result.kind !== 'on') return;
  assert.equal(result.settings.redirectUri, 'https://jobs.example.test/auth/callback');
  assert.equal(result.settings.secureCookies, true);
  assert.equal(result.settings.sessionSeconds, 8 * 3600);
});

test('an http public address gives cookies without Secure', () => {
  const result = readOidcSettings({ ...FULL, WEB_PUBLIC_URL: 'http://localhost:4747' });
  assert.equal(result.kind === 'on' && result.settings.secureCookies, false);
});

test('OIDC_SESSION_HOURS sets the lifetime', () => {
  const result = readOidcSettings({ ...FULL, OIDC_SESSION_HOURS: '24' });
  assert.equal(result.kind === 'on' && result.settings.sessionSeconds, 24 * 3600);
});

for (const missing of ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_SESSION_SECRET', 'WEB_PUBLIC_URL'] as const) {
  test(`${missing} missing names it`, () => {
    assert.match(errorOf({ ...FULL, [missing]: undefined }), new RegExp(missing));
  });
}

test('a short session secret is refused', () => {
  assert.match(errorOf({ ...FULL, OIDC_SESSION_SECRET: 'x'.repeat(31) }), /OIDC_SESSION_SECRET/);
});

test('the public address must be an http(s) origin without a path', () => {
  for (const bad of ['jobs.example.test', 'ftp://jobs.example.test', 'https://jobs.example.test/app', 'https://']) {
    assert.match(errorOf({ ...FULL, WEB_PUBLIC_URL: bad }), /WEB_PUBLIC_URL/, bad);
  }
});

test('the issuer must be https unless it is a loopback host', () => {
  assert.match(errorOf({ ...FULL, OIDC_ISSUER: 'http://idp.example.test' }), /OIDC_ISSUER/);
  assert.match(errorOf({ ...FULL, OIDC_ISSUER: 'not a url' }), /OIDC_ISSUER/);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(readOidcSettings({ ...FULL, OIDC_ISSUER: `http://${host}:8080/realm` }).kind, 'on', host);
  }
});

test('OIDC_SESSION_HOURS must be a whole number from 1 to 168', () => {
  for (const bad of ['0', '169', '1.5', 'abc', '-3']) {
    assert.match(errorOf({ ...FULL, OIDC_SESSION_HOURS: bad }), /OIDC_SESSION_HOURS/, bad);
  }
  assert.equal(readOidcSettings({ ...FULL, OIDC_SESSION_HOURS: '168' }).kind, 'on');
});

test('other OIDC settings without an issuer are an error, not silence', () => {
  assert.match(errorOf({ OIDC_CLIENT_ID: 'applypack' }), /OIDC_ISSUER/);
  assert.match(errorOf({ WEB_PUBLIC_URL: 'https://jobs.example.test' }), /OIDC_ISSUER/);
});

test('the error never repeats a secret', () => {
  const message = errorOf({ ...FULL, OIDC_SESSION_SECRET: 'tooshort', OIDC_CLIENT_SECRET: 'super-secret-value' });
  assert.ok(!message.includes('tooshort'));
  assert.ok(!message.includes('super-secret-value'));
});
