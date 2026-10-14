import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { liveStatusPath, parseRunId, showsLiveStatus } from './run-link';

describe('liveStatusPath', () => {
  it('addresses a run by its id', () => {
    assert.equal(liveStatusPath(7), '/runs/7');
  });
});

describe('parseRunId', () => {
  it('reads a positive whole number', () => {
    assert.equal(parseRunId('7'), 7);
    assert.equal(parseRunId('0012'), 12);
    assert.equal(parseRunId('2147483647'), 2147483647);
  });

  it('refuses anything else', () => {
    for (const bad of ['', 'abc', '-1', '1.5', '7x', '0', ' 7', '2147483648', '99999999999999999999']) {
      assert.equal(parseRunId(bad), null, bad);
    }
  });
});

describe('showsLiveStatus', () => {
  it('is true only for a run in flight', () => {
    assert.equal(showsLiveStatus('RUNNING'), true);
    assert.equal(showsLiveStatus('OK'), false);
    assert.equal(showsLiveStatus('FAILED'), false);
  });
});
