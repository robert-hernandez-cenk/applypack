import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliedWhere, hasApplied, isPreApply, PRE_APPLY_KEYS, seedsApplied } from './applied-state';

const none = { stage: null, appliedAt: null, status: 'NEW' };

test('the pre-apply stages are Consider and Applying', () => {
  assert.deepEqual([...PRE_APPLY_KEYS], ['consider', 'applying']);
});

test('a posting with no stage, no date and no Applied status has not been applied to', () => {
  assert.equal(hasApplied(none), false);
});

test('Consider and Applying do not count as applied', () => {
  assert.equal(hasApplied({ ...none, stage: 'consider' }), false);
  assert.equal(hasApplied({ ...none, stage: 'applying' }), false);
});

test('Applied, a work column, Rejected and Ghosted count as applied', () => {
  for (const stage of ['applied', 'screen', 'my-own-column', 'rejected', 'ghosted']) {
    assert.equal(hasApplied({ ...none, stage }), true, stage);
  }
});

test('Expired alone is not an application: a posting can close before it was ever sent', () => {
  assert.equal(hasApplied({ ...none, stage: 'expired' }), false);
  // Once something else says it went out, it did.
  assert.equal(hasApplied({ ...none, stage: 'expired', appliedAt: new Date('2026-10-01') }), true);
  assert.equal(hasApplied({ ...none, stage: 'expired', status: 'APPLIED' }), true);
});

test('isPreApply names the two stages before Applied', () => {
  assert.equal(isPreApply('consider'), true);
  assert.equal(isPreApply('applying'), true);
  assert.equal(isPreApply('applied'), false);
  assert.equal(isPreApply('expired'), false);
});

test('the Applied status counts even without a stage', () => {
  assert.equal(hasApplied({ ...none, status: 'APPLIED' }), true);
});

test('an apply date counts even on a pre-apply stage: the person said they applied', () => {
  assert.equal(hasApplied({ stage: 'consider', appliedAt: new Date('2026-10-01'), status: 'NEW' }), true);
});

test('Mark applied seeds the Applied stage from no stage and from the pre-apply stages only', () => {
  assert.equal(seedsApplied(null), true);
  assert.equal(seedsApplied('consider'), true);
  assert.equal(seedsApplied('applying'), true);
  for (const stage of ['applied', 'screen', 'rejected', 'ghosted', 'expired']) {
    assert.equal(seedsApplied(stage), false, stage);
  }
});

test('appliedWhere is the same rule as a Prisma filter', () => {
  assert.deepEqual(appliedWhere, {
    OR: [
      { status: 'APPLIED' },
      { appliedAt: { not: null } },
      { AND: [{ pipelineStage: { not: null } }, { pipelineStage: { notIn: ['consider', 'applying', 'expired'] } }] },
    ],
  });
});
