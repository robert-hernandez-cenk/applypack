import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LABEL, MAX_LABEL_CHARS, googleSettings, normalizeLabel } from './settings';

const base = { GOOGLE_CLIENT_ID: 'id.apps.example', GOOGLE_CLIENT_SECRET: 'secret', WEB_PORT: 4747 };

test('the default label is Job Leads', () => {
  assert.equal(DEFAULT_LABEL, 'Job Leads');
});

test('normalizeLabel trims and keeps a name as typed', () => {
  assert.deepEqual(normalizeLabel('  Leads / Indeed  '), { ok: true, label: 'Leads / Indeed' });
});

test('normalizeLabel falls back to the default for an empty field', () => {
  assert.deepEqual(normalizeLabel('   '), { ok: true, label: DEFAULT_LABEL });
  assert.deepEqual(normalizeLabel(undefined), { ok: true, label: DEFAULT_LABEL });
});

test('normalizeLabel refuses control characters and over-long names', () => {
  assert.equal(normalizeLabel('a\u0000b').ok, false);
  assert.equal(normalizeLabel('a\nb').ok, false);
  assert.equal(normalizeLabel('x'.repeat(MAX_LABEL_CHARS)).ok, true);
  assert.equal(normalizeLabel('x'.repeat(MAX_LABEL_CHARS + 1)).ok, false);
});

test('googleSettings is null unless both the id and the secret are set', () => {
  assert.equal(googleSettings({ WEB_PORT: 4747 }), null);
  assert.equal(googleSettings({ ...base, GOOGLE_CLIENT_SECRET: undefined }), null);
  assert.equal(googleSettings({ ...base, GOOGLE_CLIENT_ID: '  ' }), null);
});

test('the redirect address is the public address plus /gmail/callback', () => {
  const s = googleSettings({ ...base, WEB_PUBLIC_URL: 'https://jobs.example.org/' });
  assert.equal(s?.redirectUri, 'https://jobs.example.org/gmail/callback');
});

test('without a public address the redirect is the loopback address on the web port', () => {
  assert.equal(googleSettings(base)?.redirectUri, 'http://localhost:4747/gmail/callback');
});
