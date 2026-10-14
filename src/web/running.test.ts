import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

type Mod = {
  nextState: (ok: boolean, body: string) => 'swap' | 'remove' | 'keep';
  refresh: (host: { innerHTML: string }, url: string, fetchImpl: typeof fetch) => Promise<'swap' | 'remove' | 'keep'>;
  init: (
    host: { innerHTML: string },
    opts: {
      url?: string;
      everyMs?: number;
      fetchImpl: typeof fetch;
      schedule: (fn: () => void, ms: number) => void;
      isHidden?: () => boolean;
      onGone?: () => void;
    },
  ) => Promise<void>;
};
// Static ES module served from public/; node loads it as the browser does.
// @ts-expect-error — plain JS with no declaration file; the shape is typed above.
const loaded = import('./public/running.mjs') as Promise<Mod>;

const reply = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('nextState', () => {
  it('swaps in a body', async () => assert.equal((await loaded).nextState(true, '<section>x</section>'), 'swap'));
  it('removes the card on an empty body', async () => {
    assert.equal((await loaded).nextState(true, ''), 'remove');
    assert.equal((await loaded).nextState(true, '  \n'), 'remove');
  });
  it('keeps the card on a failed answer', async () => assert.equal((await loaded).nextState(false, '<section>x</section>'), 'keep'));
});

describe('refresh', () => {
  it('replaces the host content on 200', async () => {
    const host = { innerHTML: 'old' };
    assert.equal(await (await loaded).refresh(host, '/runs/running', reply(200, '<section>new</section>')), 'swap');
    assert.equal(host.innerHTML, '<section>new</section>');
  });
  it('empties the host when nothing runs', async () => {
    const host = { innerHTML: 'old' };
    assert.equal(await (await loaded).refresh(host, '/runs/running', reply(200, '')), 'remove');
    assert.equal(host.innerHTML, '');
  });
  it('keeps the card on a non-200 answer', async () => {
    const host = { innerHTML: 'old' };
    assert.equal(await (await loaded).refresh(host, '/runs/running', reply(500, 'boom')), 'keep');
    assert.equal(host.innerHTML, 'old');
  });
  it('keeps the card when the answer is a redirect (a sign-in page), whatever it holds', async () => {
    const host = { innerHTML: 'old' };
    const redirected = (async () => Object.assign(new Response('<html>sign in</html>', { status: 200 }), { redirected: true })) as unknown as typeof fetch;
    assert.equal(await (await loaded).refresh(host, '/runs/running', redirected), 'keep');
    assert.equal(host.innerHTML, 'old');
  });
  it('asks for the fragment without claiming to want a page', async () => {
    let init: RequestInit | undefined;
    const spy = (async (_url: string, i?: RequestInit) => {
      init = i;
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;
    await (await loaded).refresh({ innerHTML: '' }, '/runs/running', spy);
    assert.equal(JSON.stringify(init?.headers ?? {}).includes('text/html'), false);
  });
  it('keeps the card when the request throws', async () => {
    const host = { innerHTML: 'old' };
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    assert.equal(await (await loaded).refresh(host, '/runs/running', failing), 'keep');
    assert.equal(host.innerHTML, 'old');
  });
});

describe('init', () => {
  async function run(answers: typeof fetch, opts: { hidden?: () => boolean; onGone?: () => void; url?: string } = {}) {
    const host = { innerHTML: 'old' };
    const timers: Array<{ fn: () => void; ms: number }> = [];
    let calls = 0;
    const counted = (async (...args: Parameters<typeof fetch>) => {
      calls++;
      return answers(...args);
    }) as typeof fetch;
    const started = (await loaded).init(host, { ...(opts.url ? { url: opts.url } : {}), everyMs: 5000, fetchImpl: counted, schedule: (fn, ms) => void timers.push({ fn, ms }), isHidden: opts.hidden ?? (() => false), onGone: opts.onGone ?? (() => undefined) });
    return { host, timers, calls: () => calls, started };
  }

  it('waits one period before the first request and schedules the next after each', async () => {
    const r = await run(reply(200, '<section>n</section>'));
    await r.started;
    assert.equal(r.calls(), 0);
    assert.equal(r.timers.length, 1);
    assert.equal(r.timers[0]!.ms, 5000);
    r.timers[0]!.fn();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(r.calls(), 1);
    assert.equal(r.host.innerHTML, '<section>n</section>');
    assert.equal(r.timers.length, 2);
  });

  it('stops polling once the card is gone and says so, so the page can show the ended run', async () => {
    let gone = 0;
    const r = await run(reply(200, ''), { onGone: () => void gone++ });
    await r.started;
    r.timers[0]!.fn();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(r.host.innerHTML, '');
    assert.equal(r.timers.length, 1);
    assert.equal(gone, 1);
  });

  it('asks for the url it was given: the card of one run on /runs/:id (#36)', async () => {
    const asked: string[] = [];
    const spy = (async (url: string) => {
      asked.push(url);
      return new Response('<section>n</section>', { status: 200 });
    }) as unknown as typeof fetch;
    const r = await run(spy, { url: '/runs/7/card' });
    await r.started;
    r.timers[0]!.fn();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(asked, ['/runs/7/card']);
  });

  it('does not ask while the page is hidden, and tries again later', async () => {
    const r = await run(reply(200, '<section>n</section>'), { hidden: () => true });
    await r.started;
    r.timers[0]!.fn();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(r.calls(), 0);
    assert.equal(r.timers.length, 2);
  });
});
