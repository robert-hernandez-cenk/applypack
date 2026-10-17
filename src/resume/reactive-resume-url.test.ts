import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, builderUrl, parseInstanceUrl, reachable } from './reactive-resume-url';

function base(raw: string): URL {
  const got = parseInstanceUrl(raw);
  assert.ok(got.ok, `${raw} should be accepted`);
  return got.base;
}

test('an address is accepted with or without a scheme, a slash, a query or a fragment', () => {
  assert.equal(base('https://rxresu.me').href, 'https://rxresu.me/');
  assert.equal(base('rxresu.me').href, 'https://rxresu.me/');
  assert.equal(base('  http://localhost:3000/  ').href, 'http://localhost:3000/');
  assert.equal(base('https://host.example/resume/?a=1#x').href, 'https://host.example/resume');
});

test('with no scheme typed, a name on the person\'s own network is http and a public one https', () => {
  assert.equal(base('localhost:3000').href, 'http://localhost:3000/');
  assert.equal(base('192.168.1.5:3000').href, 'http://192.168.1.5:3000/');
  assert.equal(base('rr.internal').href, 'http://rr.internal/');
  assert.equal(base('intranet:3000').href, 'http://intranet:3000/');
  assert.equal(base('resume.example.com').href, 'https://resume.example.com/');
  assert.equal(base('https://192.168.1.5:3000').href, 'https://192.168.1.5:3000/', 'a scheme that was typed is kept');
});

test('the API path is not part of the address the person enters', () => {
  assert.equal(base('https://host.example/api/openapi').href, 'https://host.example/');
  assert.equal(base('https://host.example/rr/api/openapi/').href, 'https://host.example/rr');
});

test('what is not an http(s) address without credentials is refused, each for its own reason', () => {
  const code = (raw: string) => {
    const got = parseInstanceUrl(raw);
    return got.ok ? 'ok' : got.code;
  };
  assert.equal(code(''), 'empty');
  assert.equal(code('   '), 'empty');
  assert.equal(code('ftp://host.example'), 'scheme');
  assert.equal(code('file:///etc/passwd'), 'scheme');
  assert.equal(code('https://user:pw@host.example'), 'credentials');
  assert.equal(code('https://user@host.example'), 'credentials');
  assert.equal(code('javascript:alert(1)'), 'invalid');
  assert.equal(code('https://'), 'invalid');
  assert.equal(code('not a url'), 'invalid');
});

test('apiUrl puts the API under the instance and keeps a path prefix', () => {
  assert.equal(apiUrl(base('https://rxresu.me'), '/resumes'), 'https://rxresu.me/api/openapi/resumes');
  assert.equal(apiUrl(base('https://host.example/rr/'), '/resumes/abc'), 'https://host.example/rr/api/openapi/resumes/abc');
});

const never = async (): Promise<string[]> => assert.fail('no lookup was expected');

test('a member is refused every private, loopback and link-local address before any lookup', async () => {
  const refused = [
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://[::1]:3000',
    'http://10.0.0.5',
    'http://192.168.1.2',
    'http://172.16.0.1',
    'http://169.254.169.254',
    'http://[::ffff:169.254.169.254]',
    'http://intranet',
    'http://rr.internal',
    'http://rr.local',
    'http://0.0.0.0',
  ];
  for (const raw of refused) {
    assert.deepEqual(await reachable(base(raw), { privileged: false }, never), { ok: false, code: 'privateAddress' }, raw);
  }
});

test('a member may reach a public name whose every address is public', async () => {
  assert.deepEqual(await reachable(base('https://rxresu.me'), { privileged: false }, async () => ['104.21.1.1', '2606:4700::1']), { ok: true });
});

test('a member is refused a public-looking name that resolves inside the network', async () => {
  assert.deepEqual(await reachable(base('https://rr.example.com'), { privileged: false }, async () => ['93.184.216.34', '10.0.0.9']), {
    ok: false,
    code: 'privateAddress',
  });
  assert.deepEqual(await reachable(base('https://127.0.0.1.nip.io'), { privileged: false }, async () => ['127.0.0.1']), {
    ok: false,
    code: 'privateAddress',
  });
});

test('a name that does not resolve is its own answer', async () => {
  assert.deepEqual(await reachable(base('https://nope.example.com'), { privileged: false }, async () => []), { ok: false, code: 'noHost' });
  assert.deepEqual(
    await reachable(base('https://nope.example.com'), { privileged: false }, async () => {
      throw new Error('ENOTFOUND');
    }),
    { ok: false, code: 'noHost' },
  );
});

test('an administrator or the local install may reach private addresses, with no lookup', async () => {
  for (const raw of ['http://localhost:3000', 'http://10.0.0.5', 'http://intranet', 'https://rr.example.com']) {
    assert.deepEqual(await reachable(base(raw), { privileged: true }, never), { ok: true }, raw);
  }
});

test('builderUrl is where the resume opens in the instance, under a path prefix too', () => {
  assert.equal(builderUrl(base('https://rxresu.me'), 'abc-123'), 'https://rxresu.me/builder/abc-123');
  assert.equal(builderUrl(base('https://host.example/rr/'), 'a/b'), 'https://host.example/rr/builder/a%2Fb');
});
