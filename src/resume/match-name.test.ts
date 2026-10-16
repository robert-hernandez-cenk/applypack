import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousFor } from './match-name';

const at = (min: number) => new Date(Date.UTC(2026, 8, 13, 12, min));
const row = (id: number, min: number, resumeId = 1) => ({ id, resumeId, createdAt: at(min) });

test('previousFor pairs a resume with its own earlier comparison', () => {
  const latest = row(3, 30);
  const first = row(1, 10);
  const rows = [latest, row(2, 20), first];
  assert.equal(previousFor(latest, rows)?.id, 2);
  assert.equal(previousFor(first, rows), null);
});

test('previousFor never pairs two different resumes', () => {
  const other = row(2, 20, 2);
  const latest = row(3, 30);
  assert.equal(previousFor(latest, [latest, other]), null);
});
