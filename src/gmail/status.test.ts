import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../http';
import { t } from '../i18n/t';
import { GMAIL_STATUSES, GoogleError, errorReason, statusKey, statusOf } from './status';

const http = (status: number, body = ''): HttpError => new HttpError(`HTTP ${status} for https://example.test/x`, status, 'https://example.test/x', body);

test('Google ending the access reads as access_ended', () => {
  assert.equal(statusOf(http(401)), 'access_ended');
  assert.equal(statusOf(http(400, '{"error":"invalid_grant","error_description":"Token has been expired or revoked."}')), 'access_ended');
  assert.equal(statusOf(http(403, '{"error":{"errors":[{"reason":"insufficientPermissions"}]}}')), 'access_ended');
});

test('a spent allowance reads as quota', () => {
  assert.equal(statusOf(http(429)), 'quota');
  assert.equal(statusOf(http(403, '{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}')), 'quota');
  assert.equal(statusOf(http(403, '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}')), 'quota');
  assert.equal(statusOf(http(403, '{"error":{"errors":[{"reason":"dailyLimitExceeded"}]}}')), 'quota');
});

test('Google down, slow or unreachable reads as unreachable', () => {
  assert.equal(statusOf(http(500)), 'unreachable');
  assert.equal(statusOf(http(503)), 'unreachable');
  assert.equal(statusOf(new Error('Request to https://x.test/ timed out after 10000ms')), 'unreachable');
  assert.equal(statusOf(new TypeError('fetch failed')), 'unreachable');
});

test('an error that carries its own status keeps it', () => {
  assert.equal(statusOf(new GoogleError('label_missing')), 'label_missing');
  assert.equal(statusOf(new GoogleError('no_engine')), 'no_engine');
});

test('anything else is a plain error, never its text', () => {
  assert.equal(statusOf(new Error('boom')), 'error');
  assert.equal(statusOf('nope'), 'error');
  assert.equal(statusOf(http(404)), 'error');
});

test('every status has a sentence in the catalog, and unknown ones fall back to the error sentence', () => {
  for (const status of GMAIL_STATUSES) assert.notEqual(t(statusKey(status)), statusKey(status), status);
  assert.equal(statusKey('something-new'), statusKey('error'));
});

test('a Gmail API the operator never enabled is a setup error, not Google ending a person’s access', () => {
  const disabled = '{"error":{"code":403,"message":"Gmail API has not been used in project 123 before or it is disabled.","errors":[{"reason":"accessNotConfigured"}],"status":"PERMISSION_DENIED"}}';
  assert.equal(statusOf(http(403, disabled)), 'error');
  assert.equal(statusOf(http(403, '{"error":{"status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}')), 'error');
});

test('the reason Google gave is available for the log, from either error shape, and only that', () => {
  assert.equal(errorReason(http(403, '{"error":{"errors":[{"reason":"accessNotConfigured","message":"private words"}]}}')), 'accessNotConfigured');
  assert.equal(errorReason(http(400, '{"error":"invalid_grant","error_description":"Token has been expired or revoked."}')), 'invalid_grant');
  assert.equal(errorReason(http(503, '<html>')), undefined);
  assert.equal(errorReason(new Error('boom')), undefined);
});
