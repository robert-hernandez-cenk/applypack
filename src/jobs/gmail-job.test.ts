import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '@prisma/client';
import { HttpError } from '../http';
import { alternativeMail, emptyMail, injectionMail, receiptMail } from '../gmail/fixtures/mails';
import { GoogleError, type GmailStatus } from '../gmail/status';
import { parseMessage } from '../gmail/message';
import { fenceClose, fenceOpen } from '../prompt-fence';
import { runGmailJob, type GmailJobDeps } from './gmail-job';

const NOW = new Date('2026-10-14T12:00:00Z');
const GOOGLE = { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://x.example/gmail/callback' };
const PROFILE = { id: 1, userId: 1, name: 'Backend' } as unknown as Profile;

interface Person {
  id: number;
  connection: { id: number; accountEmail: string; labelName: string; status: string; checkRequestedAt: Date | null; lastCheckAt: Date | null; lastMails: number | null; lastListings: number | null } | null;
  token: string;
  ledger: Map<string, { outcome: string; count: number }>;
  recorded: { status: GmailStatus; lastCheckAt?: Date; mails?: number; listings?: number }[];
  companyId: number;
}

const person = (id: number, over: Partial<Person['connection'] & object> = {}): Person => ({
  id,
  connection: { id, accountEmail: `p${id}@example.org`, labelName: 'Job Leads', status: 'waiting', checkRequestedAt: new Date(), lastCheckAt: null, lastMails: null, lastListings: null, ...over },
  token: `rt-${id}`,
  ledger: new Map(),
  recorded: [],
  companyId: 100 + id,
});

interface Harness {
  deps: GmailJobDeps;
  events: string[];
  runs: { items: { job: { title: string; companyId: number; externalId: string }; companyName: string }[]; ownerId: number | undefined; classify: boolean | undefined }[];
  prompts: string[];
  fetched: string[];
  people: Map<number, Person>;
}

interface Options {
  people?: Person[];
  mails?: Record<string, unknown>;
  listed?: string[];
  reply?: (call: number, user: string) => string | null;
  enabled?: boolean;
  hasEngine?: boolean;
  profiles?: Profile[];
  refresh?: (token: string) => Promise<string>;
  resolve?: () => Promise<string>;
  getMessage?: (id: string) => Promise<unknown>;
  google?: typeof GOOGLE | null;
}

const OK_REPLY = (n: number) => JSON.stringify({ listings: [{ title: `Role ${n}`, company: `Company ${n}`, location: 'Remote', salary_min: null, salary_max: null, workplace: 'remote', link: 1 }] });

function harness(o: Options = {}): Harness {
  const people = new Map((o.people ?? [person(1)]).map((p) => [p.id, p] as const));
  const events: string[] = [];
  const runs: Harness['runs'] = [];
  const prompts: string[] = [];
  const fetched: string[] = [];
  let calls = 0;
  const byUser = (id: number): Person => people.get(id) ?? person(id, {});
  const mails = o.mails ?? { m1: alternativeMail({ id: 'm1', internalDate: '1760428800000' }), m2: alternativeMail({ id: 'm2', internalDate: '1760342400000' }) };
  const deps: GmailJobDeps = {
    io: {
      refreshAccessToken: async (_s, token) => (o.refresh ? o.refresh(token) : `at-${token}`),
      resolveLabelId: async () => (o.resolve ? o.resolve() : 'Label_12'),
      listMessages: async () => o.listed ?? Object.keys(mails),
      getMessage: async (_t, id) => {
        fetched.push(id);
        return parseMessage(o.getMessage ? await o.getMessage(id) : mails[id]);
      },
    },
    google: o.google === undefined ? GOOGLE : o.google,
    store: {
      getConnection: async (id) => byUser(id).connection,
      readRefreshToken: async (id) => byUser(id).token,
      ensureSourceCompany: async (id) => ({ id: byUser(id).companyId, name: 'Gmail' }),
      processedIds: async (cid, ids) => new Set(ids.filter((i) => [...people.values()].find((p) => p.connection?.id === cid)?.ledger.has(i))),
      recordMessage: async (cid, row) => {
        events.push(`record:${row.messageId}`);
        [...people.values()].find((p) => p.connection?.id === cid)?.ledger.set(row.messageId, { outcome: row.outcome, count: row.count });
      },
      pruneLedger: async () => undefined,
      recordCheck: async (id, result) => {
        byUser(id).recorded.push(result);
      },
    },
    ai: async () => ({
      hasEngine: o.hasEngine ?? true,
      complete: async (_system, user) => {
        calls++;
        prompts.push(user);
        return o.reply ? o.reply(calls, user) : OK_REPLY(calls);
      },
    }),
    pipeline: {
      state: async () => ({ enabled: o.enabled ?? true, classifierMode: 'single' }),
      profiles: async () => o.profiles ?? [PROFILE],
      run: async (items, _profiles, opts) => {
        events.push('run');
        runs.push({ items: items as never, ownerId: opts.ownerId, classify: opts.classify });
        return {} as never;
      },
    },
    now: () => NOW,
  };
  return { deps, events, runs, prompts, fetched, people };
}

const last = (p: Person) => p.recorded[p.recorded.length - 1];

test('new mails become the person’s jobs, and a mail is marked read only after its jobs were handed on', async () => {
  const h = harness();
  const { stats } = await runGmailJob(1, h.deps);
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0]?.ownerId, 1);
  assert.equal(h.runs[0]?.classify, true);
  assert.deepEqual(h.runs[0]?.items.map((i) => i.job.title), ['Role 1', 'Role 2']);
  assert.ok(h.runs[0]?.items.every((i) => i.job.companyId === 101 && i.companyName === 'Gmail'));
  assert.ok(h.events.indexOf('run') < h.events.indexOf('record:m1') && h.events.indexOf('run') < h.events.indexOf('record:m2'));
  assert.deepEqual(last(h.people.get(1)!), { status: 'ok', lastCheckAt: NOW, mails: 2, listings: 2 });
  assert.equal(stats.mails, 2);
});

test('the same mails on the next check are not read or paid for again', async () => {
  const h = harness();
  await runGmailJob(1, h.deps);
  const readBefore = h.fetched.length;
  const promptsBefore = h.prompts.length;
  await runGmailJob(1, h.deps);
  assert.equal(h.fetched.length, readBefore);
  assert.equal(h.prompts.length, promptsBefore);
  assert.equal(h.runs.length, 1);
  assert.deepEqual(last(h.people.get(1)!), { status: 'ok', lastCheckAt: NOW, mails: 0, listings: 0 });
});

test('a mail with no job in it is read once, costs no error and sends nothing on', async () => {
  const h = harness({ mails: { m1: receiptMail({ id: 'm1' }) }, reply: () => '{"listings": []}' });
  await runGmailJob(1, h.deps);
  assert.equal(h.runs.length, 0);
  assert.deepEqual(h.people.get(1)!.ledger.get('m1'), { outcome: 'none', count: 0 });
});

test('a mail with nothing readable is marked read without asking the model', async () => {
  const h = harness({ mails: { m1: emptyMail({ id: 'm1' }) } });
  await runGmailJob(1, h.deps);
  assert.equal(h.prompts.length, 0);
  assert.equal(h.people.get(1)!.ledger.get('m1')?.outcome, 'none');
});

test('a reply that cannot be read marks the mail unreadable and is not asked again', async () => {
  const h = harness({ mails: { m1: alternativeMail({ id: 'm1' }) }, reply: () => 'I could not do that' });
  await runGmailJob(1, h.deps);
  assert.equal(h.prompts.length, 1);
  assert.equal(h.people.get(1)!.ledger.get('m1')?.outcome, 'unreadable');
});

test('text in a mail that tries to steer the model stays inside the fence and moves nothing but its listing', async () => {
  const h = harness({ mails: { m1: injectionMail({ id: 'm1' }) } });
  await runGmailJob(1, h.deps);
  const prompt = h.prompts[0]!;
  assert.equal(prompt.split(fenceOpen('EMAIL')).length, 2);
  assert.equal(prompt.split(fenceClose('EMAIL')).length, 2);
  assert.ok(prompt.indexOf('IGNORE ALL PREVIOUS INSTRUCTIONS') > prompt.indexOf(fenceOpen('EMAIL')));
  assert.ok(prompt.indexOf('IGNORE ALL PREVIOUS INSTRUCTIONS') < prompt.indexOf(fenceClose('EMAIL')));
  assert.deepEqual(h.runs[0]?.items.map((i) => i.job.title), ['Role 1']);
});

test('a label that does not exist is said so, and no mail is listed', async () => {
  const h = harness({ resolve: async () => { throw new GoogleError('label_missing'); } });
  await runGmailJob(1, h.deps);
  assert.equal(h.fetched.length, 0);
  assert.deepEqual(last(h.people.get(1)!), { status: 'label_missing' });
});

test('Google ending the access is a status on the card, not a failure of the run', async () => {
  const h = harness({ refresh: async () => { throw new HttpError('HTTP 400', 400, 'https://oauth2.googleapis.com/token', '{"error":"invalid_grant"}'); } });
  const { stats } = await runGmailJob(1, h.deps);
  assert.deepEqual(last(h.people.get(1)!), { status: 'access_ended' });
  assert.equal(stats.status, 'access_ended');
});

test('Google down is unreachable, and what was read before it stays read', async () => {
  const h = harness({ getMessage: async (id) => { if (id === 'm2') throw new HttpError('HTTP 503', 503, 'https://gmail.googleapis.com/x', ''); return alternativeMail({ id }); } });
  await runGmailJob(1, h.deps);
  assert.deepEqual([...h.people.get(1)!.ledger.keys()], ['m1']);
  assert.equal(last(h.people.get(1)!)?.status, 'unreachable');
  assert.equal(last(h.people.get(1)!)?.lastCheckAt, undefined);
  assert.equal(h.runs.length, 1);
});

test('no AI engine is said so before anything is read', async () => {
  const h = harness({ hasEngine: false });
  await runGmailJob(1, h.deps);
  assert.equal(h.fetched.length, 0);
  assert.deepEqual(last(h.people.get(1)!), { status: 'no_engine' });
});

test('a model that stops answering ends the run after the mails it did read', async () => {
  const h = harness({ reply: (call) => (call === 1 ? OK_REPLY(1) : null) });
  await runGmailJob(1, h.deps);
  assert.deepEqual([...h.people.get(1)!.ledger.keys()], ['m1']);
  assert.equal(last(h.people.get(1)!)?.status, 'error');
  assert.equal(last(h.people.get(1)!)?.lastCheckAt, undefined);
});

test('a backlog is read a run at a time, and the window does not move past what is still unread', async () => {
  const listed = Array.from({ length: 25 }, (_, i) => `b${i}`);
  const mails = Object.fromEntries(listed.map((id) => [id, alternativeMail({ id })]));
  const h = harness({ listed, mails });
  const { stats } = await runGmailJob(1, h.deps);
  assert.equal(h.fetched.length, 20);
  assert.equal(stats.left, 5);
  assert.equal(last(h.people.get(1)!)?.lastCheckAt, undefined);
  await runGmailJob(1, h.deps);
  assert.equal(h.fetched.length, 25);
  assert.equal(last(h.people.get(1)!)?.lastCheckAt, NOW);
});

test('while fetching is paused no mail is read and nothing is recorded', async () => {
  const h = harness({ enabled: false });
  const { stats } = await runGmailJob(1, h.deps);
  assert.equal(stats.reason, 'paused');
  assert.equal(h.fetched.length, 0);
  assert.deepEqual(h.people.get(1)!.recorded, []);
});

test('a person with no search to score against reads nothing', async () => {
  const h = harness({ profiles: [] });
  const { stats } = await runGmailJob(1, h.deps);
  assert.equal(stats.reason, 'no-active-profile');
  assert.equal(h.fetched.length, 0);
});

test('a person who is not connected is skipped', async () => {
  const h = harness({ people: [{ ...person(1), connection: null }] });
  const { stats } = await runGmailJob(1, h.deps);
  assert.equal(stats.reason, 'not-connected');
  assert.equal(h.fetched.length, 0);
});

test('an install that lost its Google client cannot refresh, and says so', async () => {
  const h = harness({ google: null });
  await runGmailJob(1, h.deps);
  assert.equal(last(h.people.get(1)!)?.status, 'error');
  assert.equal(h.fetched.length, 0);
});

test('two people: one’s failure does not touch the other, and each person’s jobs are handed on as their own', async () => {
  const h = harness({
    people: [person(1), person(2)],
    refresh: async (token) => {
      if (token === 'rt-1') throw new HttpError('HTTP 401', 401, 'u', '');
      return `at-${token}`;
    },
  });
  await runGmailJob(1, h.deps);
  await runGmailJob(2, h.deps);
  assert.equal(last(h.people.get(1)!)?.status, 'access_ended');
  assert.equal(last(h.people.get(2)!)?.status, 'ok');
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0]?.ownerId, 2);
  assert.ok(h.runs[0]?.items.every((i) => i.job.companyId === 102));
  assert.equal(h.people.get(1)!.ledger.size, 0);
  assert.equal(h.people.get(2)!.ledger.size, 2);
});
