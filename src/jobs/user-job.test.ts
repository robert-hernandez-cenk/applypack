import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobStatus } from '@prisma/client';
import { givesRowToOthers, outcomeData } from './user-job';
import type { MergedVerdict } from './verdict-merge';

const merged = (): MergedVerdict => ({
  kept: true,
  scoreLine: 'A 80',
  winner: {
    profileId: 1,
    userId: 1,
    profileName: 'A',
    classification: {
      fit_score: 80,
      location_match: true,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      tech_match: ['node'],
      red_flags: [],
      summary: 'ok',
    } as MergedVerdict['winner']['classification'],
    dismissReason: null,
    priorityRulesApplied: ['rule'],
    notificationTargetId: null,
  },
});

test('a row carries the winner of the person and their status', () => {
  const data = outcomeData({ userId: 1, merged: merged(), status: JobStatus.NEW }, { url: 'https://x.test/apply', pasted: false });
  assert.equal(data.fitScore, 80);
  assert.deepEqual(data.techMatch, ['node']);
  assert.deepEqual(data.priorityRulesApplied, ['rule']);
  assert.equal(data.status, JobStatus.NEW);
});

test('only a shared posting scored with a free status reaches new people', () => {
  assert.equal(givesRowToOthers(false, false), true);
  assert.equal(givesRowToOthers(true, false), false);
  assert.equal(givesRowToOthers(false, true), false);
  assert.equal(givesRowToOthers(true, true), false);
});
