import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionStep } from './identity';

test('a person already known is not created again', () => {
  assert.equal(provisionStep({ known: true, defaultUnclaimed: true }), 'known');
  assert.equal(provisionStep({ known: true, defaultUnclaimed: false }), 'known');
});

test('the first person to sign in takes over the default user', () => {
  assert.equal(provisionStep({ known: false, defaultUnclaimed: true }), 'claim-default');
});

test('everyone after that is a new user', () => {
  assert.equal(provisionStep({ known: false, defaultUnclaimed: false }), 'create');
});
