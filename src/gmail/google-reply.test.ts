import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleError } from './status';
import { findLabelId, parseLabels, parseMessageList, parseProfile, parseRefreshReply, parseTokenReply } from './google-reply';

const GRANTED = 'https://www.googleapis.com/auth/gmail.readonly openid https://www.googleapis.com/auth/userinfo.email';

test('a code exchange gives the access and refresh tokens', () => {
  const out = parseTokenReply({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: GRANTED, token_type: 'Bearer' });
  assert.deepEqual(out, { accessToken: 'at', refreshToken: 'rt' });
});

test('a connection without a refresh token is refused: it could not outlive the hour', () => {
  assert.throws(() => parseTokenReply({ access_token: 'at', expires_in: 3599, scope: GRANTED, token_type: 'Bearer' }), GoogleError);
});

test('the person unticking the mail permission leaves a connection that reads nothing, so it is refused', () => {
  assert.throws(() => parseTokenReply({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: 'openid https://www.googleapis.com/auth/userinfo.email', token_type: 'Bearer' }), GoogleError);
});

test('a permission broader than read-only is refused', () => {
  assert.throws(() => parseTokenReply({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: `${GRANTED} https://mail.google.com/`, token_type: 'Bearer' }), GoogleError);
});

test('a reply that is not a token reply is refused', () => {
  assert.throws(() => parseTokenReply({ nothing: true }), GoogleError);
  assert.throws(() => parseTokenReply('<html>'), GoogleError);
});

test('a refresh gives a new access token', () => {
  assert.equal(parseRefreshReply({ access_token: 'at2', expires_in: 3599, scope: GRANTED, token_type: 'Bearer' }), 'at2');
  assert.throws(() => parseRefreshReply({ error: 'x' }), GoogleError);
});

test('the account address comes from the profile', () => {
  assert.equal(parseProfile({ emailAddress: 'Person@Example.org', messagesTotal: 4, threadsTotal: 3, historyId: '9' }), 'Person@Example.org');
  assert.throws(() => parseProfile({}), GoogleError);
});

test('the label is found by name, ignoring case, among all of the person’s labels', () => {
  const labels = parseLabels({ labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }, { id: 'Label_12', name: 'Job Leads', type: 'user' }] });
  assert.equal(findLabelId(labels, 'job leads'), 'Label_12');
  assert.equal(findLabelId(labels, 'Job Leads'), 'Label_12');
});

test('a label that does not exist is label_missing, not an error to be retried', () => {
  const labels = parseLabels({ labels: [{ id: 'INBOX', name: 'INBOX' }] });
  assert.throws(() => findLabelId(labels, 'Job Leads'), (err: unknown) => err instanceof GoogleError && err.status === 'label_missing');
});

test('an account with no labels list reads as no labels', () => {
  assert.deepEqual(parseLabels({}), []);
});

test('a message list gives the ids and the page token, and an empty label gives none', () => {
  assert.deepEqual(parseMessageList({ messages: [{ id: 'a', threadId: 't' }, { id: 'b', threadId: 't' }], nextPageToken: 'p2', resultSizeEstimate: 2 }), { ids: ['a', 'b'], next: 'p2' });
  assert.deepEqual(parseMessageList({ resultSizeEstimate: 0 }), { ids: [], next: null });
});
