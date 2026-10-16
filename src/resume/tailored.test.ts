import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchSource, tailoredFileName } from './tailored';

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
