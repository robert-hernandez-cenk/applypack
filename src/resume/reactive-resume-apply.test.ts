import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReactiveResume, readReactiveResumeMapped, type LineSource } from './reactive-resume';
import { applyOperations, planWriteBack, type WriteBackPlan } from './reactive-resume-apply';

/*
 * The edits of a tailored copy → patch operations on a Reactive Resume
 * resume (ADR 0079), run over the redacted answer of a real 6.0.3 instance.
 * The property every case checks: when every edit was applied, reading the
 * patched resume back gives exactly the copy's text.
 */

const live = (): { data: Record<string, unknown> } =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'reactive-resume', 'v6-live-response.json'), 'utf8'));

interface Row {
  i: number;
  text: string;
  src: LineSource | null;
}

function rows(data: unknown): { master: string; rows: Row[] } {
  const got = readReactiveResumeMapped(data);
  assert.ok(got.ok);
  return { master: got.markdown, rows: got.markdown.split('\n').map((text, i) => ({ i, text, src: got.lines[i] ?? null })) };
}

/** `master` with the lines at the given places replaced (`null` deletes, an array replaces by several). */
function edited(master: string, changes: Record<number, string | string[] | null>): string {
  return master
    .split('\n')
    .flatMap((l, i) => (i in changes ? (changes[i] === null ? [] : [changes[i]!].flat()) : [l]))
    .join('\n');
}

const fieldRows = (rs: Row[], pointer: string): Row[] => rs.filter((r) => r.src?.pointer === pointer);
const bullets = (rs: Row[], pointer: string): Row[] => fieldRows(rs, pointer).filter((r) => r.text.startsWith('- '));

async function plan(data: unknown, master: string, copy: string): Promise<Extract<WriteBackPlan, { ok: true }>> {
  const got = await planWriteBack({ data, masterText: master, copyText: copy });
  assert.ok(got.ok, 'planned');
  return got;
}

function patchedMarkdown(data: unknown, p: Extract<WriteBackPlan, { ok: true }>): string {
  const read = readReactiveResume(applyOperations(data, p.operations));
  assert.ok(read.ok);
  return read.markdown;
}

describe('planWriteBack — what a copy changes', () => {
  it('no edits: nothing to send, and the data comes back equal', async () => {
    const { data } = live();
    const { master } = rows(data);
    const p = await plan(data, master, master);
    assert.deepEqual(p.operations, []);
    assert.deepEqual(p.edits, []);
    assert.deepEqual(applyOperations(data, p.operations), data);
  });

  it('planning reads the data and changes none of it', async () => {
    const { data } = live();
    const before = structuredClone(data);
    const { master, rows: rs } = rows(data);
    const at = bullets(rs, '/sections/experience/items/0/description')[0]!;
    await plan(data, master, edited(master, { [at.i]: '- Rewrote this bullet for the posting' }));
    assert.deepEqual(data, before);
  });

  it('one reworded bullet is one replace of its field; every other block stays as it was', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const target = bullets(rs, '/sections/experience/items/0/description')[1]!;
    const copy = edited(master, { [target.i]: '- Led the Discovery rewrite & cut onboarding time' });
    const p = await plan(data, master, copy);

    assert.equal(p.operations.length, 1);
    const op = p.operations[0]!;
    assert.equal(op.op, 'replace');
    assert.equal(op.path, '/sections/experience/items/0/description');
    const before = (data.sections as any).experience.items[0].description as string;
    const after = (op as { value: string }).value;
    const lis = before.match(/<li>[\s\S]*?<\/li>/g)!;
    for (const li of lis.filter((_, i) => i !== 1)) assert.ok(after.includes(li), 'an untouched bullet is kept verbatim');
    assert.ok(after.includes('Led the Discovery rewrite &amp; cut onboarding time'));
    assert.deepEqual(p.edits.map((e) => [e.status, e.kind]), [['applied', 'changed']]);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a bullet that is bare text in its list item is reworded too', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const target = bullets(rs, '/sections/experience/items/3/description')[0]!;
    const copy = edited(master, { [target.i]: '- Shipped the ETL service' });
    const p = await plan(data, master, copy);
    assert.equal(p.operations.length, 1);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('two edits in one field are one operation', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const [a, b] = bullets(rs, '/sections/experience/items/1/description');
    const copy = edited(master, { [a!.i]: '- First reworded', [b!.i]: '- Second reworded' });
    const p = await plan(data, master, copy);
    assert.equal(p.operations.length, 1);
    assert.equal(p.edits.filter((e) => e.status === 'applied').length, 2);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a bullet added after another becomes a list item after it', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const after = bullets(rs, '/sections/experience/items/0/description')[0]!;
    const copy = edited(master, { [after.i]: [after.text, '- Added a bullet about the posting'] });
    const p = await plan(data, master, copy);
    assert.deepEqual(p.edits.map((e) => [e.status, e.kind]), [['applied', 'added']]);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a bullet taken out is a list item taken out', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const gone = bullets(rs, '/sections/experience/items/1/description')[0]!;
    const copy = edited(master, { [gone.i]: null });
    const p = await plan(data, master, copy);
    assert.deepEqual(p.edits.map((e) => [e.status, e.kind]), [['applied', 'removed']]);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a reworded summary is a replace of the summary', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const at = fieldRows(rs, '/summary/content')[0]!;
    const copy = edited(master, { [at.i]: 'A summary written for this posting.' });
    const p = await plan(data, master, copy);
    assert.equal(p.operations.length, 1);
    assert.equal(p.operations[0]!.path, '/summary/content');
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a reworded headline is a replace of the headline', async () => {
    const { data } = live();
    const { master } = rows(data);
    const copy = edited(master, { 1: 'Staff Platform Engineer' });
    const p = await plan(data, master, copy);
    assert.deepEqual(p.operations, [{ op: 'replace', path: '/basics/headline', value: 'Staff Platform Engineer' }]);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a reworded skills line replaces the keyword list and keeps the group name', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const at = rs.find((r) => r.src?.pointer === '/sections/skills/items/0/keywords')!;
    const copy = edited(master, { [at.i]: `${at.text.split(': ')[0]}: Alpha, Beta, Gamma` });
    const p = await plan(data, master, copy);
    assert.deepEqual(p.operations, [{ op: 'replace', path: '/sections/skills/items/0/keywords', value: ['Alpha', 'Beta', 'Gamma'] }]);
    assert.equal(patchedMarkdown(data, p), copy);
  });

  it('words that are markup are written as words, not as markup', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const at = bullets(rs, '/sections/experience/items/0/description')[0]!;
    const copy = edited(master, { [at.i]: '- Grew R&D 3x & kept <script>alert(1)</script> out' });
    const p = await plan(data, master, copy);
    for (const op of p.operations) assert.ok(!/<script/i.test(String((op as { value?: unknown }).value)), 'no tag came from the words');
    // Applied, it reads back as the copy; refused, it says so — never a different resume.
    if (p.edits.every((e) => e.status === 'applied')) assert.equal(patchedMarkdown(data, p), copy);
  });

  it('a source that no longer reads like the stored text is stale', async () => {
    const { data } = live();
    const { master } = rows(data);
    const got = await planWriteBack({ data, masterText: `${master}\nsomething added since`, copyText: master });
    assert.deepEqual(got, { ok: false, reason: 'stale' });
  });
});

describe('planWriteBack — what it will not guess', () => {
  const reasonOf = (p: Extract<WriteBackPlan, { ok: true }>, i = 0) => p.edits[i]?.reason;

  it('a line made of several fields is not applied', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const contact = rs.find((r) => r.i === 2)!;
    const p = await plan(data, master, edited(master, { [contact.i]: `${contact.text} · Remote` }));
    assert.deepEqual(p.operations, []);
    assert.equal(p.edits[0]?.status, 'notApplied');
    assert.equal(reasonOf(p), 'assembled');
  });

  it('a changed company line or position-and-dates line is not applied', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const dated = rs.find((r) => / · Dec 2025 – Sep 2026$/.test(r.text))!;
    const p = await plan(data, master, edited(master, { [dated.i]: 'Principal Engineer · Dec 2025 – Sep 2026' }));
    assert.deepEqual(p.operations, []);
    assert.equal(reasonOf(p), 'assembled');
  });

  it('a new section is not applied', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const last = rs[rs.length - 1]!;
    const p = await plan(data, master, `${master}\n\n## Patents\n- Patent one`);
    assert.deepEqual(p.operations, []);
    assert.ok(p.edits.length >= 1 && p.edits.every((e) => e.status === 'notApplied'));
    assert.ok(p.edits.some((e) => e.reason === 'newSection'));
    assert.ok(last);
  });

  it('a heading reworded is not applied', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const heading = rs.find((r) => r.text.startsWith('## '))!;
    const p = await plan(data, master, edited(master, { [heading.i]: '## Something Else' }));
    assert.deepEqual(p.operations, []);
    assert.equal(reasonOf(p), 'newSection');
  });

  it('a skills line whose group name changed is not applied', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const at = rs.find((r) => r.src?.pointer === '/sections/skills/items/0/keywords')!;
    const p = await plan(data, master, edited(master, { [at.i]: 'Renamed group: Alpha, Beta' }));
    assert.deepEqual(p.operations, []);
    assert.equal(reasonOf(p), 'labelChanged');
  });

  it('a line added where no field is known is not applied', async () => {
    const { data } = live();
    const { master } = rows(data);
    const p = await plan(data, master, `A new first line\n${master}`);
    assert.deepEqual(p.operations, []);
    assert.equal(p.edits[0]?.kind, 'added');
    assert.equal(reasonOf(p), 'noField');
  });

  it('a field whose blocks do not line up with its lines is left alone, edit by edit', async () => {
    const { data } = live();
    // A nested list: one bullet holds another list, which the reader flattens into more lines than blocks.
    (data.sections as any).experience.items[1].description =
      '<p>Team</p><ul><li><p>Outer</p><ul><li><p>Inner one</p></li><li><p>Inner two</p></li></ul></li></ul>';
    const { master, rows: rs } = rows(data);
    const at = fieldRows(rs, '/sections/experience/items/1/description').find((r) => r.text.includes('Inner one'))!;
    const p = await plan(data, master, edited(master, { [at.i]: '- Inner reworded' }));
    assert.deepEqual(p.operations, []);
    assert.equal(p.edits[0]?.status, 'notApplied');
    assert.equal(reasonOf(p), 'misaligned');
  });

  it('every changed line is reported once, applied or not, and none is dropped', async () => {
    const { data } = live();
    const { master, rows: rs } = rows(data);
    const bullet = bullets(rs, '/sections/experience/items/0/description')[0]!;
    const copy = edited(master, { 1: 'New headline', 2: `${rs[2]!.text} · Remote`, [bullet.i]: '- Reworded' });
    const p = await plan(data, master, copy);
    assert.equal(p.edits.length, 3);
    assert.deepEqual(p.edits.map((e) => e.status).sort(), ['applied', 'applied', 'notApplied']);
    for (const e of p.edits) assert.ok(e.line.length > 0);
  });
});
