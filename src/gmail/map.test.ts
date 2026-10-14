import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Listing } from './listing';
import { toNormalizedJob } from './map';

const RECEIVED = new Date('2026-10-14T08:00:00Z');
const listing = (over: Partial<Listing> = {}): Listing => ({
  title: 'Senior Backend Engineer',
  company: 'Acme Robotics',
  location: 'Austin, TX (Hybrid)',
  salaryMin: 110000,
  salaryMax: 130000,
  workplace: 'hybrid',
  url: 'https://www.jobs.example/comm/view/1111111111',
  ...over,
});

test('a listing becomes a posting under the person’s own Gmail source', () => {
  const job = toNormalizedJob(listing(), RECEIVED, 42);
  assert.equal(job.companyId, 42);
  assert.equal(job.title, 'Senior Backend Engineer');
  assert.equal(job.url, 'https://www.jobs.example/comm/view/1111111111');
  assert.equal(job.location, 'Austin, TX (Hybrid)');
  assert.deepEqual(job.postedAt, RECEIVED);
  assert.equal(job.employer, 'Acme Robotics');
  assert.deepEqual(job.locationHints, { workplace: 'HYBRID' });
});

test('the employer is the company the mail named, or nobody — never the source’s own name', () => {
  assert.equal(toNormalizedJob(listing({ company: null }), RECEIVED, 42).employer, null);
});

test('it is not hand-picked and not dated by the clock: the filter and the date are the mail’s', () => {
  const job = toNormalizedJob(listing(), RECEIVED, 42);
  assert.equal(job.handPicked, undefined);
  assert.equal(job.undated, undefined);
});

test('the description is what the mail said about this one job, not the mail', () => {
  const job = toNormalizedJob(listing(), RECEIVED, 42);
  assert.equal(job.description, 'Senior Backend Engineer\nAcme Robotics\nAustin, TX (Hybrid)\nSalary: 110000–130000 a year\nWorkplace: hybrid');
});

test('lines the mail did not give are left out', () => {
  const job = toNormalizedJob(listing({ company: null, location: null, salaryMin: null, salaryMax: null, workplace: null }), RECEIVED, 42);
  assert.equal(job.description, 'Senior Backend Engineer');
  assert.equal(job.location, '');
  assert.equal(job.locationHints, undefined);
});

test('one salary figure is said once', () => {
  assert.match(toNormalizedJob(listing({ salaryMin: 90000, salaryMax: null }), RECEIVED, 42).description, /Salary: 90000 a year/);
});

test('the same job in two digests has the same id, however it is spelled', () => {
  const a = toNormalizedJob(listing(), RECEIVED, 42).externalId;
  const b = toNormalizedJob(listing({ title: 'senior  backend engineer!', company: 'ACME Robotics, Inc.', url: 'https://other.example/x' }), new Date('2026-10-20T08:00:00Z'), 42).externalId;
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{24}$/);
});

test('a different company or place is a different job', () => {
  const a = toNormalizedJob(listing(), RECEIVED, 42).externalId;
  assert.notEqual(a, toNormalizedJob(listing({ company: 'Globex' }), RECEIVED, 42).externalId);
  assert.notEqual(a, toNormalizedJob(listing({ location: 'Denver, CO' }), RECEIVED, 42).externalId);
});
