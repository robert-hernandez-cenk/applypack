import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  duplicateInstanceResume,
  getInstanceResume,
  InstanceError,
  listInstanceResumes,
  patchInstanceResume,
  type InstanceFailure,
} from './reactive-resume-api';

const KEY = 'rr_live_SECRET_0123456789';

let server: Server;
let base: URL;
let handler: (req: IncomingMessage, res: ServerResponse) => void = () => undefined;
const seen: IncomingMessage[] = [];

before(async () => {
  server = createServer((req, res) => {
    seen.push(req);
    handler(req, res);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const json = (res: ServerResponse, body: unknown, status = 200): void => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function failure(run: () => Promise<unknown>): Promise<InstanceFailure> {
  try {
    await run();
  } catch (err) {
    assert.ok(err instanceof InstanceError, `threw ${(err as Error).constructor.name}: ${(err as Error).message}`);
    assert.ok(!err.message.includes(KEY), 'the key is in the error message');
    assert.ok(!String(err.stack).includes(KEY), 'the key is in the stack');
    return err.code;
  }
  return assert.fail('did not fail');
}

describe('listInstanceResumes', () => {
  it('sends the key and nothing else of its own, to the list path', async () => {
    seen.length = 0;
    handler = (_req, res) => json(res, [{ id: 'a1', name: 'Main', slug: 'main' }]);
    await listInstanceResumes(base, KEY);
    const req = seen[0]!;
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/api/openapi/resumes');
    assert.equal(req.headers['x-api-key'], KEY);
    assert.equal(req.headers.accept, 'application/json');
    assert.equal(req.headers.cookie, undefined);
    assert.equal(req.headers.authorization, undefined);
  });

  it('reads an array, or an array held under items / resumes / data', async () => {
    const rows = [{ id: 'a1', name: 'Main' }, { id: 2, name: 'Second', slug: 's' }, { name: 'no id' }];
    for (const wrap of [(r: unknown) => r, (r: unknown) => ({ items: r }), (r: unknown) => ({ resumes: r }), (r: unknown) => ({ data: r })]) {
      handler = (_req, res) => json(res, wrap(rows));
      assert.deepEqual(await listInstanceResumes(base, KEY), [
        { id: 'a1', name: 'Main' },
        { id: '2', name: 'Second' },
      ]);
    }
  });

  it('keeps a path prefix the instance sits behind', async () => {
    seen.length = 0;
    handler = (_req, res) => json(res, []);
    await listInstanceResumes(new URL(`${base.origin}/rr`), KEY);
    assert.equal(seen[0]!.url, '/rr/api/openapi/resumes');
  });

  it('a person with no resumes is an empty list, not a failure', async () => {
    handler = (_req, res) => json(res, []);
    assert.deepEqual(await listInstanceResumes(base, KEY), []);
  });

  it('each way it can go wrong has its own code, and none names the key', async () => {
    handler = (_req, res) => json(res, { message: 'no' }, 401);
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'unauthorized');
    handler = (_req, res) => json(res, { message: 'no' }, 403);
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'unauthorized');
    handler = (_req, res) => json(res, { message: 'gone' }, 404);
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'notApi');
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html>sign in</html>');
    };
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'notApi');
    handler = (_req, res) => json(res, { hello: 'world' });
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'notApi');
    handler = (_req, res) => json(res, { error: 'boom' }, 500);
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'unreachable');
    handler = (_req, res) => {
      res.writeHead(302, { location: 'https://elsewhere.example/api/openapi/resumes' });
      res.end();
    };
    assert.equal(await failure(() => listInstanceResumes(base, KEY)), 'redirect');
  });

  it('a redirect is never followed, so the key never leaves for the other host', async () => {
    seen.length = 0;
    handler = (_req, res) => {
      res.writeHead(307, { location: `${base.origin}/elsewhere` });
      res.end();
    };
    await failure(() => listInstanceResumes(base, KEY));
    assert.equal(seen.length, 1);
  });

  it('a body over the cap is refused', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ id: 'a', name: 'x'.repeat(5000) }]));
    };
    assert.equal(await failure(() => listInstanceResumes(base, KEY, { maxBytes: 1000 })), 'tooLarge');
  });

  it('an instance that never answers times out', async () => {
    handler = () => undefined;
    assert.equal(await failure(() => listInstanceResumes(base, KEY, { timeoutMs: 60 })), 'timeout');
  });

  it('a port nobody listens on is unreachable', async () => {
    const dead = new URL('http://127.0.0.1:1');
    assert.equal(await failure(() => listInstanceResumes(dead, KEY, { timeoutMs: 2000 })), 'unreachable');
  });
});

describe('getInstanceResume', () => {
  it('fetches one resume by id and returns its name and data', async () => {
    seen.length = 0;
    handler = (_req, res) => json(res, { id: 'a/1', name: 'Main', slug: 'main', data: { basics: {}, sections: {} } });
    const got = await getInstanceResume(base, KEY, 'a/1');
    assert.equal(seen[0]!.url, '/api/openapi/resumes/a%2F1');
    assert.equal(seen[0]!.headers['x-api-key'], KEY);
    assert.equal(got.name, 'Main');
    assert.deepEqual(got.data, { basics: {}, sections: {} });
  });

  it('accepts the resume data sent bare', async () => {
    handler = (_req, res) => json(res, { basics: { name: 'A' }, sections: {} });
    assert.deepEqual((await getInstanceResume(base, KEY, 'x')).data, { basics: { name: 'A' }, sections: {} });
  });

  it('fails like the list does', async () => {
    handler = (_req, res) => json(res, {}, 401);
    assert.equal(await failure(() => getInstanceResume(base, KEY, 'x')), 'unauthorized');
    handler = (_req, res) => json(res, { nothing: true });
    assert.equal(await failure(() => getInstanceResume(base, KEY, 'x')), 'notApi');
    handler = (_req, res) => json(res, {}, 404);
    assert.equal(await failure(() => getInstanceResume(base, KEY, 'x')), 'notApi');
  });
});

describe('getInstanceResume: what a write needs to know', () => {
  it('returns when the resume was last changed and whether it is locked', async () => {
    handler = (_req, res) =>
      json(res, { id: 'a', name: 'Main', isLocked: true, updatedAt: '2026-10-15T21:33:38.248Z', data: { basics: {}, sections: {} } });
    const got = await getInstanceResume(base, KEY, 'a');
    assert.equal(got.locked, true);
    assert.equal(got.updatedAt, '2026-10-15T21:33:38.248Z');
  });

  it('a resume that does not say is unlocked and has no stamp', async () => {
    handler = (_req, res) => json(res, { name: 'Main', data: { basics: {}, sections: {} } });
    const got = await getInstanceResume(base, KEY, 'a');
    assert.equal(got.locked, false);
    assert.equal(got.updatedAt, null);
  });
});

/** Run `body` against a handler that records what it was sent. */
function recording(reply: (res: ServerResponse) => void): { bodies: string[] } {
  const bodies: string[] = [];
  handler = (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      bodies.push(Buffer.concat(chunks).toString('utf8'));
      reply(res);
    });
  };
  return { bodies };
}

describe('duplicateInstanceResume', () => {
  it('posts the new name to the duplicate path and returns the new id', async () => {
    seen.length = 0;
    const { bodies } = recording((res) => json(res, 'new-id-1'));
    const id = await duplicateInstanceResume(base, KEY, 'a/1', 'Main - Acme - Staff Engineer');
    assert.equal(id, 'new-id-1');
    const req = seen[0]!;
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/api/openapi/resumes/a%2F1/duplicate');
    assert.equal(req.headers['x-api-key'], KEY);
    assert.match(String(req.headers['content-type']), /application\/json/);
    assert.deepEqual(JSON.parse(bodies[0]!), { name: 'Main - Acme - Staff Engineer' });
  });

  it('an answer that is not an id is not this API', async () => {
    handler = (_req, res) => json(res, { nothing: true });
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n')), 'notApi');
    handler = (_req, res) => json(res, '');
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n')), 'notApi');
  });

  it('a missing resume or a missing route is notApi, a refused key is unauthorized', async () => {
    handler = (_req, res) => json(res, {}, 404);
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n')), 'notApi');
    handler = (_req, res) => json(res, {}, 401);
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n')), 'unauthorized');
  });

  it('is never repeated: a timeout is one request', async () => {
    seen.length = 0;
    handler = () => undefined;
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n', { timeoutMs: 60 })), 'timeout');
    assert.equal(seen.length, 1);
  });

  it('a redirect is not followed and the key stays here', async () => {
    seen.length = 0;
    handler = (_req, res) => {
      res.writeHead(307, { location: `${base.origin}/elsewhere` });
      res.end();
    };
    assert.equal(await failure(() => duplicateInstanceResume(base, KEY, 'a', 'n')), 'redirect');
    assert.equal(seen.length, 1);
  });
});

describe('patchInstanceResume', () => {
  const ops = [{ op: 'replace' as const, path: '/basics/headline', value: 'Staff Engineer' }];

  it('patches the resume with the operations and the stamp it expects', async () => {
    seen.length = 0;
    const { bodies } = recording((res) => json(res, { id: 'c', updatedAt: '2026-10-17T00:00:00.000Z', data: {} }));
    const got = await patchInstanceResume(base, KEY, 'c', { expectedUpdatedAt: '2026-10-16T00:00:00.000Z', operations: ops });
    assert.equal(got.updatedAt, '2026-10-17T00:00:00.000Z');
    const req = seen[0]!;
    assert.equal(req.method, 'PATCH');
    assert.equal(req.url, '/api/openapi/resumes/c');
    assert.equal(req.headers['x-api-key'], KEY);
    assert.deepEqual(JSON.parse(bodies[0]!), { expectedUpdatedAt: '2026-10-16T00:00:00.000Z', operations: ops });
  });

  it('a locked resume is locked, whatever else 403 can mean', async () => {
    handler = (_req, res) => json(res, { defined: true, code: 'RESUME_LOCKED', status: 403, message: 'Unlock the resume first.' }, 403);
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops })), 'locked');
    handler = (_req, res) => json(res, { message: 'nope' }, 403);
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops })), 'unauthorized');
  });

  it('a resume that changed since it was read is a conflict', async () => {
    handler = (_req, res) => json(res, { defined: true, code: 'RESUME_VERSION_CONFLICT', status: 409, message: 'changed' }, 409);
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops })), 'conflict');
  });

  it('operations the instance refuses are badPatch', async () => {
    handler = (_req, res) => json(res, { defined: true, code: 'INVALID_PATCH_OPERATIONS', status: 400, message: 'bad' }, 400);
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops })), 'badPatch');
  });

  it('is never repeated: a timeout is one request and names nothing secret', async () => {
    seen.length = 0;
    handler = () => undefined;
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops }, { timeoutMs: 60 })), 'timeout');
    assert.equal(seen.length, 1);
  });

  it('a body over the cap is refused', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ updatedAt: 'x', pad: 'x'.repeat(5000) }));
    };
    assert.equal(await failure(() => patchInstanceResume(base, KEY, 'c', { operations: ops }, { maxBytes: 1000 })), 'tooLarge');
  });
});
