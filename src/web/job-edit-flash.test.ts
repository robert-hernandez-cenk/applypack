import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobEditFlash } from './job-edit-flash';

test('a saved edit that was scored says both', () => {
  assert.deepEqual(jobEditFlash({ kind: 'scored', status: 'SAVED' }), { kind: 'ok', text: 'Saved. The posting was scored again on the new text.' });
});

test('a saved edit that formed no verdict says it is saved and why nothing was scored', () => {
  const none = jobEditFlash({ kind: 'no-search' });
  assert.equal(none.kind, 'warn');
  assert.match(none.text, /^Saved\. This posting was not scored again: no running search has a stack or role types/);
  const failed = jobEditFlash({ kind: 'failed', reason: 'the sign-in was refused' });
  assert.match(failed.text, /^Saved\. This posting was not scored again: the sign-in was refused/);
  const turnedAway = jobEditFlash({ kind: 'prefiltered', status: 'SAVED' });
  assert.match(turnedAway.text, /^Saved\. Two-stage scoring turned this posting away at its quick first pass/);
});
