import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canEdit, isUnchanged, planEdit, type JobEditCurrent, type JobEditForm } from './job-edit';
import { MAX_POSTING_CHARS, MIN_DESCRIPTION_CHARS } from './posting-limits';

const LONG = 'x'.repeat(MIN_DESCRIPTION_CHARS);
const current: JobEditCurrent = { title: 'Backend engineer', shownCompany: 'Acme', location: 'Remote', description: 'short mail' };
const same: JobEditForm = { title: 'Backend engineer', company: 'Acme', location: 'Remote', description: 'short mail' };
const plan = (over: Partial<JobEditForm>, cur: JobEditCurrent = current) => planEdit(cur, { ...same, ...over });

test('a posting is editable only by the one person who holds it', () => {
  assert.equal(canEdit([7], 7, 'GMAIL'), true);
  assert.equal(canEdit([], 7, 'GMAIL'), false);
  assert.equal(canEdit([8], 7, 'GMAIL'), false);
  assert.equal(canEdit([7, 8], 7, 'GMAIL'), false);
});

test('only what the person brought themselves is editable, however few hold it', () => {
  for (const own of ['MANUAL', 'GMAIL', 'IMPORT', 'FOLDER']) assert.equal(canEdit([7], 7, own), true, own);
  for (const theirs of ['GREENHOUSE', 'REMOTEOK', 'FRANCETRAVAIL', 'HN_HIRING', 'FEED']) assert.equal(canEdit([7], 7, theirs), false, theirs);
});

test('a form that says what is stored changes nothing, and a short stored description is not an error', () => {
  const r = plan({});
  assert.deepEqual(r, { ok: true, changes: {} });
  assert.equal(r.ok && isUnchanged(r.changes), true);
});

test('only the fields that differ are planned, compared after trimming and line-end folding', () => {
  assert.deepEqual(plan({ title: '  Backend engineer ', location: 'Berlin' }), { ok: true, changes: { location: 'Berlin' } });
  assert.deepEqual(plan({ description: 'short mail\r\n' }), { ok: true, changes: {} });
  assert.deepEqual(plan({ description: `${LONG}\r\nmore` }), { ok: true, changes: { description: `${LONG}\nmore` } });
});

test('the company is compared with the name the page shows; blank means nobody is named', () => {
  assert.deepEqual(plan({ company: 'Globex' }), { ok: true, changes: { employer: 'Globex' } });
  assert.deepEqual(plan({ company: '  ' }), { ok: true, changes: { employer: null } });
  assert.deepEqual(plan({ company: '' }, { ...current, shownCompany: null }), { ok: true, changes: {} });
});

test('an empty location is allowed', () => {
  assert.deepEqual(plan({ location: '' }), { ok: true, changes: { location: '' } });
});

test('each refusal names its reason', () => {
  assert.deepEqual(plan({ title: ' ' }), { ok: false, error: 'titleEmpty' });
  assert.deepEqual(plan({ title: 't'.repeat(301) }), { ok: false, error: 'titleTooLong' });
  assert.deepEqual(plan({ company: 'c'.repeat(201) }), { ok: false, error: 'companyTooLong' });
  assert.deepEqual(plan({ location: 'l'.repeat(301) }), { ok: false, error: 'locationTooLong' });
  assert.deepEqual(plan({ description: 'a little more' }), { ok: false, error: 'descriptionTooShort' });
  assert.deepEqual(plan({ description: 'y'.repeat(MAX_POSTING_CHARS + 1) }), { ok: false, error: 'descriptionTooLong' });
});

test('a description may be cleared down only to the minimum, never to nothing', () => {
  assert.deepEqual(plan({ description: '' }), { ok: false, error: 'descriptionTooShort' });
});
