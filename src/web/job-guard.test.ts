import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobIdOfPath } from './job-guard';

test('only /jobs/<id> paths name a posting', () => {
  assert.equal(jobIdOfPath('/jobs/12'), 12);
  assert.equal(jobIdOfPath('/jobs/12/status'), 12);
  assert.equal(jobIdOfPath('/jobs/12/target'), 12);
  assert.equal(jobIdOfPath('/jobs'), null);
  assert.equal(jobIdOfPath('/jobs/new'), null);
  assert.equal(jobIdOfPath('/jobs/import'), null);
  assert.equal(jobIdOfPath('/jobs/12abc'), null);
  assert.equal(jobIdOfPath('/other/jobs/12'), null);
});
