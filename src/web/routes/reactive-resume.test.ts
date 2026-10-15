import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlashCookie } from '../flash';
import { InstanceError } from '../../resume/reactive-resume-api';
import { createReactiveResumeRoute, REACTIVE_CARD_PATH } from './reactive-resume';

const KEY = 'rr_super_secret_key';

function harness(opts: { list?: () => Promise<unknown>; privileged?: boolean; reach?: { ok: true } | { ok: false; code: 'privateAddress' | 'noHost' } } = {}) {
  const saved = new Map<number, { base: string; key: string }>();
  const reachCalls: { host: string; privileged: boolean }[] = [];
  let listCalls = 0;
  const app = createReactiveResumeRoute({
    store: {
      async saveConnection(userId, base, key) {
        saved.set(userId, { base, key });
      },
      async deleteConnection(userId) {
        saved.delete(userId);
      },
    },
    list: (async () => {
      listCalls += 1;
      return (opts.list ?? (async () => []))();
    }) as never,
    reach: (async (base: URL, who: { privileged: boolean }) => {
      reachCalls.push({ host: base.host, privileged: who.privileged });
      return opts.reach ?? { ok: true };
    }) as never,
    userId: () => 1,
    mayReachInward: () => opts.privileged ?? false,
  });
  return { app, saved, reachCalls, listCalls: () => listCalls };
}

const post = (app: ReturnType<typeof harness>['app'], path: string, body: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const flashOf = (res: Response) => parseFlashCookie(res.headers.get('set-cookie')?.split(';')[0]);

/** Nothing a response sends back may carry the key. */
const assertNoKey = (res: Response) => {
  assert.ok(!(res.headers.get('location') ?? '').includes(KEY));
  assert.ok(!(res.headers.get('set-cookie') ?? '').includes(KEY));
  assert.ok(!decodeURIComponent(res.headers.get('set-cookie') ?? '').includes(KEY));
};

test('a pair that lists is saved, and the person lands on the card', async () => {
  const h = harness();
  const res = await post(h.app, '/settings/reactive-resume', { url: 'rxresu.me', key: `  ${KEY}\n` });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), REACTIVE_CARD_PATH);
  assert.deepEqual(h.saved.get(1), { base: 'https://rxresu.me/', key: KEY });
  assert.equal(flashOf(res)?.kind, 'ok');
  assert.match(flashOf(res)?.text ?? '', /rxresu\.me/);
  assertNoKey(res);
});

test('a refused key saves nothing and keeps the old pair', async () => {
  const h = harness({ list: async () => { throw new InstanceError('unauthorized'); } });
  h.saved.set(1, { base: 'https://old.example/', key: 'old' });
  const res = await post(h.app, '/settings/reactive-resume', { url: 'rxresu.me', key: KEY });
  assert.equal(flashOf(res)?.kind, 'err');
  assert.deepEqual(h.saved.get(1), { base: 'https://old.example/', key: 'old' });
  assertNoKey(res);
});

test('an address or key that cannot work is refused before any request', async () => {
  const h = harness();
  for (const body of [{ url: '', key: KEY }, { url: 'ftp://x.example', key: KEY }, { url: 'https://u:p@x.example', key: KEY }, { url: 'rxresu.me', key: '  ' }, { url: 'rxresu.me', key: 'k'.repeat(501) }]) {
    const res = await post(h.app, '/settings/reactive-resume', body);
    assert.equal(flashOf(res)?.kind, 'err', JSON.stringify(body).slice(0, 40));
  }
  assert.equal(h.listCalls(), 0);
  assert.equal(h.reachCalls.length, 0);
  assert.equal(h.saved.size, 0);
});

test('an address inside the network is refused before the instance is asked, for a member', async () => {
  const h = harness({ reach: { ok: false, code: 'privateAddress' } });
  const res = await post(h.app, '/settings/reactive-resume', { url: 'http://192.168.1.5:3000', key: KEY });
  assert.equal(flashOf(res)?.kind, 'err');
  assert.deepEqual(h.reachCalls, [{ host: '192.168.1.5:3000', privileged: false }]);
  assert.equal(h.listCalls(), 0);
  assert.equal(h.saved.size, 0);
});

test('an administrator is let reach inward', async () => {
  const h = harness({ privileged: true });
  await post(h.app, '/settings/reactive-resume', { url: 'http://192.168.1.5:3000', key: KEY });
  assert.deepEqual(h.reachCalls, [{ host: '192.168.1.5:3000', privileged: true }]);
  assert.equal(h.saved.get(1)?.base, 'http://192.168.1.5:3000/');
});

test('an instance with no resumes yet is still a working pair', async () => {
  const h = harness({ list: async () => [] });
  await post(h.app, '/settings/reactive-resume', { url: 'rxresu.me', key: KEY });
  assert.ok(h.saved.has(1));
});

test('removing deletes the pair, and again is harmless', async () => {
  const h = harness();
  h.saved.set(1, { base: 'https://rxresu.me/', key: KEY });
  const res = await post(h.app, '/settings/reactive-resume/remove');
  assert.equal(res.headers.get('location'), REACTIVE_CARD_PATH);
  assert.equal(h.saved.size, 0);
  assert.equal(flashOf(await post(h.app, '/settings/reactive-resume/remove'))?.kind, 'ok');
});
