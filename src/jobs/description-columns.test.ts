import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simhash64, toDbBigInt } from '../fingerprint';
import { descriptionColumns } from './description-columns';

test('the first change keeps the text the posting arrived with', () => {
  const cols = descriptionColumns({ description: 'as it came', descriptionOriginal: null }, 'my own words');
  assert.equal(cols.description, 'my own words');
  assert.equal(cols.descriptionOriginal, 'as it came');
  assert.ok(cols.descriptionRefreshedAt instanceof Date);
});

test('a later change keeps the first original, not the text in between', () => {
  const cols = descriptionColumns({ description: 'second', descriptionOriginal: 'first' }, 'third');
  assert.equal(cols.descriptionOriginal, 'first');
  assert.equal(cols.description, 'third');
});

test('the fingerprint follows the new text', () => {
  const cols = descriptionColumns({ description: 'a', descriptionOriginal: null }, 'brand new text for the posting');
  assert.equal(cols.descriptionSimhash, toDbBigInt(simhash64('brand new text for the posting')));
});
