import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReactiveResumeMapped } from './reactive-resume';
import { InstanceError, type InstanceFailure, type InstanceResumeData } from './reactive-resume-api';
import { reactiveWriteBack, writeBackName, type WriteBackIo } from './reactive-resume-writeback';

const live = (): { data: Record<string, unknown>; updatedAt: string } =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'reactive-resume', 'v6-live-response.json'), 'utf8'));

function setup() {
  const { data, updatedAt } = live();
  const got = readReactiveResumeMapped(data);
  assert.ok(got.ok);
  const lines = got.markdown.split('\n');
  const at = got.lines.findIndex((s, i) => s?.pointer === '/sections/experience/items/0/description' && lines[i]!.startsWith('- '));
  const changed = [...lines];
  changed[at] = '- Rewritten for the posting';
  return { data, updatedAt, master: got.markdown, copy: changed.join('\n'), at };
}

interface Fake {
  io: WriteBackIo;
  calls: string[];
  patched: Array<{ id: string; operations: unknown[]; expectedUpdatedAt?: string }>;
}

function fake(over: Partial<WriteBackIo> = {}, data: unknown = setup().data, extra: Partial<InstanceResumeData> = {}): Fake {
  const calls: string[] = [];
  const patched: Fake['patched'] = [];
  const row = (): InstanceResumeData => ({ name: 'Main', data: structuredClone(data), updatedAt: '2026-10-16T00:00:00.000Z', locked: false, ...extra });
  const io: WriteBackIo = {
    getResume: async (id) => {
      calls.push(`get:${id}`);
      return row();
    },
    duplicate: async (id, name) => {
      calls.push(`duplicate:${id}:${name}`);
      return 'clone-1';
    },
    patch: async (id, patch) => {
      calls.push(`patch:${id}`);
      patched.push({ id, ...patch });
      return { updatedAt: '2026-10-17T00:00:00.000Z' };
    },
    ...over,
  };
  return { io, calls, patched };
}

const input = (s: ReturnType<typeof setup>) => ({ remoteId: 'src-1', generation: 'v6', storedText: s.master, copyText: s.copy, name: 'Main - Acme - Staff Engineer' });
const fails = (code: InstanceFailure) => async (): Promise<never> => {
  throw new InstanceError(code);
};

describe('reactiveWriteBack', () => {
  it('reads the source, copies it under the new name, reads the copy and patches the copy', async () => {
    const s = setup();
    const f = fake();
    const got = await reactiveWriteBack(f.io, input(s));
    assert.deepEqual(f.calls, ['get:src-1', 'duplicate:src-1:Main - Acme - Staff Engineer', 'get:clone-1', 'patch:clone-1']);
    assert.equal(got.ok, true);
    if (!got.ok) return;
    assert.equal(got.remoteId, 'clone-1');
    assert.equal(got.applied, 1);
    assert.deepEqual(got.notApplied, []);
    assert.equal(f.patched[0]!.expectedUpdatedAt, '2026-10-16T00:00:00.000Z');
    assert.equal((f.patched[0]!.operations[0] as { path: string }).path, '/sections/experience/items/0/description');
  });

  it('a copy with no edits is an exact clone: copied, not patched', async () => {
    const s = setup();
    const f = fake();
    const got = await reactiveWriteBack(f.io, { ...input(s), copyText: s.master });
    assert.equal(got.ok, true);
    assert.deepEqual(f.calls, ['get:src-1', 'duplicate:src-1:Main - Acme - Staff Engineer', 'get:clone-1']);
  });

  it('a source that no longer reads like the stored text creates nothing', async () => {
    const s = setup();
    const f = fake();
    const got = await reactiveWriteBack(f.io, { ...input(s), storedText: `${s.master}\nchanged since` });
    assert.deepEqual(got, { ok: false, code: 'stale' });
    assert.deepEqual(f.calls, ['get:src-1']);
  });

  it('a resume of an older generation is declined before any call', async () => {
    const s = setup();
    const f = fake();
    assert.deepEqual(await reactiveWriteBack(f.io, { ...input(s), generation: 'v5' }), { ok: false, code: 'generation' });
    assert.deepEqual(f.calls, []);
  });

  it('a source the instance does not have is notFound, any other instance failure keeps its code, nothing is created', async () => {
    const s = setup();
    for (const [code, want] of [['notApi', 'notFound'], ['unauthorized', 'unauthorized'], ['unreachable', 'unreachable'], ['timeout', 'timeout'], ['tooLarge', 'tooLarge'], ['redirect', 'redirect']] as const) {
      const f = fake({ getResume: fails(code) });
      assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: want });
      assert.deepEqual(f.calls, []);
    }
  });

  it('edits that none can be placed create nothing and say why', async () => {
    const s = setup();
    const f = fake();
    const got = await reactiveWriteBack(f.io, { ...input(s), copyText: `A new first line\n${s.master}` });
    assert.equal(got.ok, false);
    if (got.ok) return;
    assert.equal(got.code, 'nothingApplied');
    assert.equal(got.notApplied?.[0]?.reason, 'noField');
    assert.deepEqual(f.calls, ['get:src-1']);
  });

  it('a copy made but not patched is named, so it is not lost', async () => {
    const s = setup();
    for (const code of ['conflict', 'locked', 'badPatch', 'unauthorized', 'timeout', 'unreachable'] as const) {
      const f = fake({ patch: fails(code) });
      assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code, createdRemoteId: 'clone-1' });
    }
  });

  it('a copy that cannot be read back is named too', async () => {
    const s = setup();
    let reads = 0;
    const f = fake({
      getResume: async () => {
        reads += 1;
        if (reads === 2) throw new InstanceError('unreachable');
        return { name: 'Main', data: structuredClone(s.data), updatedAt: 'x', locked: false };
      },
    });
    assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: 'unreachable', createdRemoteId: 'clone-1' });
  });

  it('a copy that came out locked is not patched', async () => {
    const s = setup();
    let reads = 0;
    const f = fake({
      getResume: async () => {
        reads += 1;
        return { name: 'Main', data: structuredClone(s.data), updatedAt: 'x', locked: reads === 2 };
      },
    });
    assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: 'locked', createdRemoteId: 'clone-1' });
    assert.equal(f.patched.length, 0);
  });

  it('a copy request that timed out is flagged as possibly made', async () => {
    const s = setup();
    const f = fake({ duplicate: fails('timeout') });
    assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: 'timeout', maybeCreated: true });
  });

  it('nothing is called twice, however a call ends', async () => {
    const s = setup();
    let patches = 0;
    const f = fake({
      patch: async () => {
        patches += 1;
        throw new InstanceError('timeout');
      },
    });
    await reactiveWriteBack(f.io, input(s));
    assert.equal(f.calls.filter((c) => c.startsWith('duplicate')).length, 1);
    assert.equal(patches, 1);
  });

  it('a copy that no longer reads like the source (changed in between) is stale and named', async () => {
    const s = setup();
    let reads = 0;
    const f = fake({
      getResume: async () => {
        reads += 1;
        const d = structuredClone(s.data) as { basics: { headline: string } };
        if (reads === 2) d.basics.headline = 'Edited by someone else meanwhile';
        return { name: 'Main', data: d, updatedAt: 'x', locked: false };
      },
    });
    assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: 'stale', createdRemoteId: 'clone-1' });
  });
});

describe('writeBackName', () => {
  it('joins the resume, the company and the role', () => {
    assert.equal(writeBackName('Main', 'Acme', 'Staff Engineer'), 'Main - Acme - Staff Engineer');
  });
  it('leaves out what is missing', () => {
    assert.equal(writeBackName('Main', '', 'Staff Engineer'), 'Main - Staff Engineer');
    assert.equal(writeBackName('Main', null, ''), 'Main');
  });
  it('stays under the length limit', () => {
    assert.ok(writeBackName('M'.repeat(150), 'C'.repeat(150), 'R'.repeat(150)).length <= 200);
  });
});

describe('reactiveWriteBack — outcomes the first pass got wrong', () => {
  it('a copy request that ended without an answer may have made a copy: the result says so', async () => {
    const s = setup();
    for (const code of ['timeout', 'unreachable'] as const) {
      const f = fake({ duplicate: fails(code) });
      assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code, maybeCreated: true });
    }
    const f = fake({ duplicate: fails('unauthorized') });
    assert.deepEqual(await reactiveWriteBack(f.io, input(s)), { ok: false, code: 'unauthorized' });
  });

  it('a copy on which no edit can be placed is named, not reported as sent', async () => {
    const s = setup();
    let reads = 0;
    const f = fake({
      getResume: async () => {
        reads += 1;
        const d = structuredClone(s.data) as { sections: { experience: { items: Array<{ description: string }> } } };
        // The copy has the first job's text in a shape the planner will not edit.
        if (reads === 2) d.sections.experience.items[0]!.description = '<table><tr><td>x</td></tr></table>';
        return { name: 'Main', data: d, updatedAt: 'x', locked: false };
      },
    });
    const got = await reactiveWriteBack(f.io, input(s));
    assert.equal(got.ok, false);
    if (got.ok) return;
    assert.ok(got.code === 'stale' || got.code === 'nothingApplied');
    assert.equal(got.createdRemoteId, 'clone-1');
  });
});
