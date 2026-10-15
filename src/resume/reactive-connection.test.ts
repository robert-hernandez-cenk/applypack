import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanKey, MAX_KEY_CHARS, viewOf } from './reactive-connection';

test('a key is trimmed, including the line break a paste brings', () => {
  assert.deepEqual(cleanKey('  rr_abc123 \n'), { ok: true, key: 'rr_abc123' });
});

test('nothing, blanks and non-text are an empty key', () => {
  for (const raw of ['', '   \n', undefined, null, 5, {}]) {
    assert.deepEqual(cleanKey(raw), { ok: false, code: 'empty' });
  }
});

test('a key over the ceiling is refused whole, never cut', () => {
  assert.deepEqual(cleanKey('k'.repeat(MAX_KEY_CHARS)), { ok: true, key: 'k'.repeat(MAX_KEY_CHARS) });
  assert.deepEqual(cleanKey('k'.repeat(MAX_KEY_CHARS + 1)), { ok: false, code: 'tooLong' });
});

test('the view names the instance and the host, and has no key', () => {
  const view = viewOf('https://rxresu.me/');
  assert.deepEqual(view, { base: 'https://rxresu.me/', host: 'rxresu.me' });
  assert.deepEqual(Object.keys(view).sort(), ['base', 'host']);
});

test('the host of a self-hosted instance keeps its port', () => {
  assert.equal(viewOf('http://192.168.1.5:3000/resume').host, '192.168.1.5:3000');
});
