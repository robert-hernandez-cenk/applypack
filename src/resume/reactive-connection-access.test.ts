import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/*
 * The API key is read only where it has to be (ADR 0075). A page or a job that
 * names the table or its accessor is one edit from rendering or logging the
 * key, so the list of files that may is closed, and the store never selects a
 * connection whole.
 */

const SRC = join(__dirname, '..');

/** The files that may name the table or the key's accessor, with why. */
const MAY_NAME_THE_KEY: Record<string, string> = {
  'resume/reactive-connection-store.ts': 'the only file that reads or writes the table',
  'web/routes/reactive-resume.ts': 'saves a checked pair, removes it',
  'web/routes/resumes.tsx': 'reads the key to list and to import',
  'scripts/route-smoke.ts': 'a harness: reads the row to prove a save, a removal and a refusal; runs on a throwaway database',
};

function sources(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.includes('.test.'))
    .map((e) => join(e.parentPath, e.name));
}

const rel = (file: string): string => relative(SRC, file).split(sep).join('/');

test('only the closed list of files names the table or the key accessor', () => {
  const offenders = sources()
    .filter((file) => /reactiveResumeConnection|readInstanceKey/.test(readFileSync(file, 'utf8')))
    .map(rel)
    .filter((file) => !Object.hasOwn(MAY_NAME_THE_KEY, file));
  assert.deepEqual(offenders, []);
});

test('the store never reads a connection without saying which columns', () => {
  const store = readFileSync(join(SRC, 'resume', 'reactive-connection-store.ts'), 'utf8');
  const reads = [...store.matchAll(/prisma\.reactiveResumeConnection\.(find\w+)\(([\s\S]*?)\)\s*;?\s*\n/g)];
  assert.ok(reads.length >= 2, 'the store reads connections');
  for (const [call, method, args] of reads) assert.match(args ?? '', /select:/, `${method} has no select: ${call.slice(0, 80)}`);
});

test('the page-facing view has no key field', () => {
  const pure = readFileSync(join(SRC, 'resume', 'reactive-connection.ts'), 'utf8');
  const view = /export interface ConnectionView \{([\s\S]*?)\n\}/.exec(pure)?.[1] ?? '';
  assert.ok(view.length > 0);
  assert.ok(!/key/i.test(view));
});
