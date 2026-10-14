import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_CHARS, MAX_LISTINGS_PER_MAIL, parseListings } from './listing';

const LINKS = ['https://l.example/1', 'https://l.example/2', 'https://l.example/3'];
const reply = (listings: unknown[]) => JSON.stringify({ listings });
const one = (over: Record<string, unknown> = {}) => ({ title: 'Platform Engineer', company: 'Globex', location: 'Remote', salary_min: null, salary_max: null, workplace: null, link: 2, ...over });

test('a listing is read with its link resolved from the marker number', () => {
  const out = parseListings(reply([one({ salary_min: 110000, salary_max: 130000, workplace: 'remote' })]), LINKS);
  assert.deepEqual(out, {
    listings: [{ title: 'Platform Engineer', company: 'Globex', location: 'Remote', salaryMin: 110000, salaryMax: 130000, workplace: 'remote', url: 'https://l.example/2' }],
    skipped: 0,
  });
});

test('the reply may come wrapped in prose or a code fence', () => {
  const out = parseListings('Here you go:\n```json\n' + reply([one()]) + '\n```', LINKS);
  assert.equal(out?.listings.length, 1);
});

test('a mail with no jobs is an empty list, not a failure', () => {
  assert.deepEqual(parseListings(reply([]), LINKS), { listings: [], skipped: 0 });
});

test('a reply that is not the expected shape is null, so the mail is marked unreadable', () => {
  assert.equal(parseListings('no json here', LINKS), null);
  assert.equal(parseListings('{"listings": "none"}', LINKS), null);
  assert.equal(parseListings('{"jobs": []}', LINKS), null);
});

test('what the mail did not say stays null, and a missing company is never the word null', () => {
  const out = parseListings(reply([one({ company: null, location: '  ', workplace: 'moon' })]), LINKS);
  assert.equal(out?.listings[0]?.company, null);
  assert.equal(out?.listings[0]?.location, null);
  assert.equal(out?.listings[0]?.workplace, null);
});

test('a listing with no title, or with no link the mail holds, is dropped and counted', () => {
  const out = parseListings(reply([one({ title: '   ' }), one({ link: null }), one({ link: 0 }), one({ link: 4 }), one({ link: 1.5 }), one({ link: 3 })]), LINKS);
  assert.equal(out?.listings.length, 1);
  assert.equal(out?.listings[0]?.url, 'https://l.example/3');
  assert.equal(out?.skipped, 5);
});

test('the same job twice in one mail is one job, whatever its case', () => {
  const out = parseListings(reply([one(), one({ title: 'platform engineer', company: 'GLOBEX', link: 1 })]), LINKS);
  assert.equal(out?.listings.length, 1);
  assert.equal(out?.listings[0]?.url, 'https://l.example/2');
  assert.equal(out?.skipped, 0);
});

test('the same title at two companies is two jobs', () => {
  const out = parseListings(reply([one(), one({ company: 'Initech' })]), LINKS);
  assert.equal(out?.listings.length, 2);
});

test('a mail can offer only so many jobs; the rest are counted, not silently lost', () => {
  const many = Array.from({ length: MAX_LISTINGS_PER_MAIL + 4 }, (_, i) => one({ title: `Role ${i}`, link: 1 }));
  const out = parseListings(reply(many), LINKS);
  assert.equal(out?.listings.length, MAX_LISTINGS_PER_MAIL);
  assert.equal(out?.skipped, 4);
});

test('long fields are cut', () => {
  const out = parseListings(reply([one({ title: 'T'.repeat(500), company: 'C'.repeat(500) })]), LINKS);
  assert.equal(out?.listings[0]?.title.length, FIELD_CHARS);
  assert.equal(out?.listings[0]?.company?.length, FIELD_CHARS);
});

test('salaries the model could not have read are dropped, and a reversed range is put right', () => {
  const bad = parseListings(reply([one({ salary_min: -5, salary_max: 99_000_000 })]), LINKS);
  assert.deepEqual([bad?.listings[0]?.salaryMin, bad?.listings[0]?.salaryMax], [null, null]);
  const swapped = parseListings(reply([one({ salary_min: 130000, salary_max: 110000 })]), LINKS);
  assert.deepEqual([swapped?.listings[0]?.salaryMin, swapped?.listings[0]?.salaryMax], [110000, 130000]);
});
