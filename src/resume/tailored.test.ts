import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorHistory, patchSource, tailoredFileName, workingMatch } from './tailored';

test('patchSource: the copy is the base when the editor started from its text', () => {
  assert.equal(patchSource({ baseText: 'Line one\nLine two', copyText: 'Line one\nLine two' }), 'copy');
  assert.equal(patchSource({ baseText: '  Line one\n', copyText: 'Line one' }), 'copy');
});

test('patchSource: the master is the base without a copy or when the text differs', () => {
  assert.equal(patchSource({ baseText: 'Line one', copyText: null }), 'master');
  assert.equal(patchSource({ baseText: 'Line one', copyText: 'Line two' }), 'master');
  assert.equal(patchSource({ baseText: '', copyText: '' }), 'master');
});

test('tailoredFileName: both names, slugged, no version', () => {
  assert.equal(tailoredFileName('Senior Backend PHP', 'Staff Engineer @ Acme', 'docx'), 'senior-backend-php-staff-engineer-acme.docx');
});

test('tailoredFileName: falls back to "resume" and keeps the extension', () => {
  assert.equal(tailoredFileName('', '', 'md'), 'resume.md');
  assert.equal(tailoredFileName('日本語', '日本語', 'docx'), 'resume.docx');
});

const base = { id: 3, tailoredId: null, draft: false };
const draft = { id: 4, tailoredId: null, draft: true };
const onCopy = { id: 2, tailoredId: 7, draft: false };
const olderCopy = { id: 1, tailoredId: 7, draft: false };
const matches = [draft, base, onCopy, olderCopy];

test("workingMatch: without a copy the comparison asked for, else the newest", () => {
  assert.equal(workingMatch(matches, 3, null)?.id, 3);
  assert.equal(workingMatch(matches, 99, null)?.id, 4);
  assert.equal(workingMatch([], 1, null), undefined);
});

test("workingMatch: with a copy, a comparison of the resume itself opens the copy's newest instead", () => {
  assert.equal(workingMatch(matches, 3, { id: 7 })?.id, 2);
  assert.equal(workingMatch([base], 3, { id: 7 })?.id, 3, 'the copy has no comparison yet');
});

test("workingMatch: a draft and the copy's own comparisons stay as asked", () => {
  assert.equal(workingMatch(matches, 4, { id: 7 })?.id, 4);
  assert.equal(workingMatch(matches, 1, { id: 7 })?.id, 1);
});

test("editorHistory: with a copy the resume's own runs drop out of the editor's list", () => {
  assert.deepEqual(editorHistory(matches, { id: 7 }).map((m) => m.id), [4, 2, 1]);
  assert.deepEqual(editorHistory(matches, null).map((m) => m.id), [4, 3, 2, 1]);
});
