import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchSource, staleBaseMatch, tailoredFileName } from './tailored';

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

test('staleBaseMatch: only a base comparison older than the copy', () => {
  const copy = { updatedAt: new Date('2026-10-17T13:39:21Z') };
  const before = new Date('2026-10-17T13:20:33Z');
  const after = new Date('2026-10-17T13:50:00Z');
  assert.equal(staleBaseMatch({ tailoredId: null, draft: false, createdAt: before }, copy), true);
  assert.equal(staleBaseMatch({ tailoredId: null, draft: false, createdAt: after }, copy), false, 'made after the save');
  assert.equal(staleBaseMatch({ tailoredId: null, draft: true, createdAt: before }, copy), false, 'a draft is the person\'s own text');
  assert.equal(staleBaseMatch({ tailoredId: 1, draft: false, createdAt: before }, copy), false, 'the copy\'s own comparison');
  assert.equal(staleBaseMatch({ tailoredId: null, draft: false, createdAt: before }, null), false, 'no copy');
});
