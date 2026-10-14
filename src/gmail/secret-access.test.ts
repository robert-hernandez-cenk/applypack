import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/*
 * The refresh token is read only where it has to be (ADR 0071). A page or a
 * job that mentions it is one edit from rendering or logging it, so the list
 * of files that may is closed, and the store never selects a connection whole.
 */

const SRC = join(__dirname, '..');

/** The files that may name the token, with why. */
const MAY_NAME_THE_TOKEN: Record<string, string> = {
  'gmail/store.ts': 'the only file that reads or writes the column',
  'gmail/google-io.ts': 'trades it with Google',
  'gmail/google-reply.ts': 'reads Google’s answer that carries it',
  'web/routes/gmail.ts': 'hands the one from the code exchange to the store',
  'jobs/gmail-job.ts': 'reads it through the store accessor to refresh an access token',
};

function sources(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.includes('.test.'))
    .map((e) => join(e.parentPath, e.name));
}

const rel = (file: string): string => relative(SRC, file).split(sep).join('/');

test('only the closed list of files names the refresh token', () => {
  const offenders = sources()
    .filter((file) => /refreshToken|refresh_token/.test(readFileSync(file, 'utf8')))
    .map(rel)
    .filter((file) => !Object.hasOwn(MAY_NAME_THE_TOKEN, file));
  assert.deepEqual(offenders, []);
});

test('the store never reads a connection without saying which columns', () => {
  const store = readFileSync(join(SRC, 'gmail', 'store.ts'), 'utf8');
  const reads = [...store.matchAll(/prisma\.gmailConnection\.(find\w+)\(([\s\S]*?)\)\s*;?\s*(?:\n|$)/g)];
  assert.ok(reads.length >= 3, 'the store reads connections');
  for (const [call, method, args] of reads) assert.match(args ?? '', /select:/, `${method} has no select: ${call.slice(0, 80)}`);
});

test('the page-facing view has no token field', () => {
  const store = readFileSync(join(SRC, 'gmail', 'store.ts'), 'utf8');
  const view = /export interface ConnectionView \{([\s\S]*?)\n\}/.exec(store)?.[1] ?? '';
  assert.ok(view.length > 0);
  assert.ok(!/token/i.test(view));
});
