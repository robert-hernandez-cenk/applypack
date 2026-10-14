import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { t } from './i18n/t';
import { checkLocalAiUrl, LOOKUP_TIMEOUT_MS } from './local-ai-url';

/** A resolver that answers from a table and remembers every name it was asked. */
function fake(answers: Record<string, string[] | Error>) {
  const asked: string[] = [];
  const resolve = async (host: string): Promise<string[]> => {
    asked.push(host);
    const answer = answers[host];
    if (answer instanceof Error) throw answer;
    return answer ?? [];
  };
  return { asked, resolve };
}

const NOT_LOCAL = t('engine.url.notLocal');
const NO_HOST = t('engine.url.noHost');

test('a name that resolves only to local addresses is accepted, over plain http too', async () => {
  const { resolve, asked } = fake({ 'ollama.lan': ['192.168.1.20'], 'ollama.home': ['10.0.0.5', 'fd12::1'] });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.lan:11434', resolve), { ok: true, url: 'http://ollama.lan:11434' });
  assert.deepEqual(await checkLocalAiUrl('https://ollama.home', resolve), { ok: true, url: 'https://ollama.home' });
  assert.deepEqual(asked, ['ollama.lan', 'ollama.home']);
});

test('one public address among the answers is enough to refuse the name', async () => {
  const { resolve } = fake({ 'ollama.lan': ['192.168.1.20', '93.184.216.34'], 'ollama.example.com': ['93.184.216.34'] });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.lan:11434', resolve), { ok: false, reason: NOT_LOCAL });
  assert.deepEqual(await checkLocalAiUrl('https://ollama.example.com', resolve), { ok: false, reason: NOT_LOCAL });
});

test('a name that resolves into the carrier-grade NAT range is local; just outside it is not', async () => {
  const { resolve } = fake({ 'ollama.mesh': ['100.100.1.5'], 'ollama.edge': ['100.128.0.1'] });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.mesh:11434', resolve), { ok: true, url: 'http://ollama.mesh:11434' });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.edge:11434', resolve), { ok: false, reason: NOT_LOCAL });
});

test('an IPv4-mapped IPv6 answer is not local, whatever it maps', async () => {
  const { resolve } = fake({ 'ollama.lan': ['::ffff:10.0.0.5'] });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.lan', resolve), { ok: false, reason: NOT_LOCAL });
});

test('a name that does not resolve, answers nothing or never answers is "not found"', async () => {
  const { resolve } = fake({ 'empty.lan': [], 'gone.lan': new Error('ENOTFOUND') });
  assert.deepEqual(await checkLocalAiUrl('http://empty.lan', resolve), { ok: false, reason: NO_HOST });
  assert.deepEqual(await checkLocalAiUrl('http://gone.lan', resolve), { ok: false, reason: NO_HOST });

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const hang = checkLocalAiUrl('http://hang.lan', () => new Promise<string[]>(() => undefined));
    mock.timers.tick(LOOKUP_TIMEOUT_MS);
    assert.deepEqual(await hang, { ok: false, reason: NO_HOST });
  } finally {
    mock.timers.reset();
  }
});

test('an address that is local by its text is never looked up', async () => {
  const { resolve, asked } = fake({});
  for (const url of ['http://127.0.0.1:11434', 'http://localhost:11434', 'http://host.docker.internal:11434', 'http://ollama.local:11434', 'http://192.168.1.20:11434']) {
    assert.equal((await checkLocalAiUrl(url, resolve)).ok, true, url);
  }
  assert.deepEqual(asked, []);
});

test("the local engine's address is Ollama's root: a pasted /v1 or /api is dropped", async () => {
  const { resolve } = fake({ 'ollama.lan': ['192.168.1.20'] });
  assert.deepEqual(await checkLocalAiUrl('http://127.0.0.1:11434/v1/', resolve), { ok: true, url: 'http://127.0.0.1:11434' });
  assert.deepEqual(await checkLocalAiUrl('http://host.docker.internal:11434/api', resolve), { ok: true, url: 'http://host.docker.internal:11434' });
  assert.deepEqual(await checkLocalAiUrl('http://ollama.lan:11434/v1', resolve), { ok: true, url: 'http://ollama.lan:11434' });
});

test('a malformed address, a wrong scheme and credentials are refused before any lookup', async () => {
  const { resolve, asked } = fake({ 'ollama.lan': ['192.168.1.20'] });
  for (const bad of ['', 'localhost:11434', 'ftp://ollama.lan', 'http://user:pw@ollama.lan']) {
    assert.equal((await checkLocalAiUrl(bad, resolve)).ok, false, bad);
  }
  assert.deepEqual(asked, []);
});
