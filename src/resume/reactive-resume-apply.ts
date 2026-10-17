import { loadLineDiff, type DiffOp } from './line-diff';
import { readReactiveResumeMapped, richTextLines, type LineSource } from './reactive-resume';
import type { PatchOperation } from './reactive-resume-api';

/*
 * The edits of a tailored copy → the operations that make them in a Reactive
 * Resume resume (ADR 0079). Pure: the data is read, never written; the caller
 * sends the operations to a copy of the resume.
 *
 * An edit is what the line diff of the master's text against the copy's text
 * says (the same one the .docx patcher uses), and it is placed by the source
 * the reader gave each line (`readReactiveResumeMapped`). Only words inside a
 * field are changed: a reworded, added or removed bullet or paragraph of a
 * rich-text field, a headline, a keyword list. Everything else — a line made of
 * several fields, a heading, a line with no known place — is reported as not
 * applied with the reason, never guessed.
 *
 * A rich-text field is changed block by block (a paragraph, a list item): a
 * block nobody touched keeps its markup byte for byte, a reworded one becomes
 * its new words. Before an operation is emitted the new field is read back with
 * the reader's own rules and must give exactly the lines the edits describe;
 * if it does not, the field is left alone.
 */

export type EditReason = 'noField' | 'assembled' | 'misaligned' | 'newSection' | 'labelChanged';

export interface EditReport {
  status: 'applied' | 'notApplied';
  kind: 'changed' | 'added' | 'removed';
  /** English noun for the field ("Experience · Acme"); empty for a line made of several fields. */
  label: string;
  /** The new line for a change or an addition, the old one for a removal. */
  line: string;
  /** Why it was not applied. */
  reason?: EditReason;
}

export type WriteBackPlan =
  | { ok: true; operations: PatchOperation[]; edits: EditReport[] }
  /** The data does not read like the master's text any more. */
  | { ok: false; reason: 'stale' };

/**
 * The shared line diff calls a pair a change only when the wording survived;
 * a bullet rewritten from scratch comes out as a delete and an insert. They sit
 * in the same place either way, so the leftovers of a run are paired in order
 * and reported as the one reworded line a person means.
 */
function zipRewrites(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  for (let k = 0; k < ops.length; ) {
    if (ops[k]!.op !== 'delete') {
      out.push(ops[k++]!);
      continue;
    }
    let d = k;
    while (d < ops.length && ops[d]!.op === 'delete') d += 1;
    let ins = d;
    while (ins < ops.length && ops[ins]!.op === 'insert') ins += 1;
    const deletes = ops.slice(k, d) as Array<Extract<DiffOp, { op: 'delete' }>>;
    const inserts = ops.slice(d, ins) as Array<Extract<DiffOp, { op: 'insert' }>>;
    const paired = Math.min(deletes.length, inserts.length);
    for (let n = 0; n < paired; n += 1) out.push({ op: 'change', a: deletes[n]!.a, b: inserts[n]!.b });
    out.push(...deletes.slice(paired), ...inserts.slice(paired));
    k = ins;
  }
  return out;
}

/** One edit on its way to a field. */
interface Edit {
  report: EditReport;
  src: LineSource | null;
  /** The master line it changes or removes; for an addition, the line it sits beside. */
  index: number;
  side: 'after' | 'before';
  /** The new words. */
  text: string;
}

const SECTION_MARK = '## ';
const BULLET = /^(?:- |• )/;
const normal = (line: string): string => line.replace(BULLET, '').trim();

export async function planWriteBack(input: { data: unknown; masterText: string; copyText: string }): Promise<WriteBackPlan> {
  const mapped = readReactiveResumeMapped(input.data);
  if (!mapped.ok || mapped.markdown !== input.masterText) return { ok: false, reason: 'stale' };
  const { diffLines } = await loadLineDiff();
  const ops = zipRewrites(diffLines(input.masterText, input.copyText));
  const masterLines = input.masterText.split('\n');

  // The master line after each op, for an addition that has nothing before it to sit beside.
  const nextMaster: Array<number | null> = new Array(ops.length).fill(null);
  let upcoming: number | null = null;
  for (let k = ops.length - 1; k >= 0; k -= 1) {
    nextMaster[k] = upcoming;
    const op = ops[k]!;
    if (op.op !== 'insert') upcoming = op.a.i;
  }

  const edits: Edit[] = [];
  const refuse = (e: Edit, reason: EditReason): void => {
    e.report.status = 'notApplied';
    e.report.reason = reason;
  };
  const make = (kind: EditReport['kind'], line: string, src: LineSource | null, index: number, side: Edit['side'], text: string): Edit => {
    const edit: Edit = { report: { status: 'applied', kind, label: src?.label ?? '', line, }, src, index, side, text };
    edits.push(edit);
    return edit;
  };

  let previous: number | null = null;
  ops.forEach((op, k) => {
    if (op.op === 'keep') {
      previous = op.a.i;
      return;
    }
    if (op.op === 'change') {
      previous = op.a.i;
      if (!op.a.text.trim() && !op.b.text.trim()) return;
      // The saved document draws its headings in capitals: the renderer's doing, not an edit.
      if (op.a.text.startsWith(SECTION_MARK) && op.a.text.toLowerCase() === op.b.text.toLowerCase()) return;
      const src = mapped.lines[op.a.i] ?? null;
      const e = make('changed', op.b.text.trim(), src, op.a.i, 'after', op.b.text);
      if (op.a.text.startsWith(SECTION_MARK) || op.b.text.startsWith(SECTION_MARK)) refuse(e, 'newSection');
      else if (!src) refuse(e, 'assembled');
      return;
    }
    if (op.op === 'delete') {
      previous = op.a.i;
      if (!op.a.text.trim()) return;
      const src = mapped.lines[op.a.i] ?? null;
      const e = make('removed', op.a.text.trim(), src, op.a.i, 'after', '');
      if (op.a.text.startsWith(SECTION_MARK)) refuse(e, 'newSection');
      else if (!src) refuse(e, 'assembled');
      return;
    }
    if (!op.b.text.trim()) return;
    // An addition belongs to the field of the line before it, else of the line after it.
    const before = previous !== null ? (mapped.lines[previous] ?? null) : null;
    const ahead = nextMaster[k] ?? null;
    const after = ahead !== null ? (mapped.lines[ahead] ?? null) : null;
    const onBefore = before !== null;
    const src = before ?? after;
    const e = make('added', op.b.text.trim(), src, onBefore ? previous! : (ahead ?? 0), onBefore ? 'after' : 'before', op.b.text);
    if (op.b.text.startsWith(SECTION_MARK)) refuse(e, 'newSection');
    else if (!src || src.kind !== 'html') refuse(e, 'noField');
  });

  const operations: PatchOperation[] = [];
  const groups = new Map<string, Edit[]>();
  for (const e of edits) {
    if (e.report.status !== 'applied' || !e.src) continue;
    const list = groups.get(e.src.pointer) ?? [];
    list.push(e);
    groups.set(e.src.pointer, list);
  }
  for (const [pointer, group] of groups) {
    const kind = group[0]!.src!.kind;
    const op = kind === 'html' ? htmlField(input.data, mapped.lines, masterLines, pointer, group, refuse) : plainField(input.data, pointer, kind, group, refuse);
    if (op) operations.push(op);
  }
  return { ok: true, operations, edits: edits.map((e) => e.report) };
}

/** A headline or a keyword list: one line, one value. */
function plainField(
  data: unknown,
  pointer: string,
  kind: 'text' | 'keywords' | 'html',
  group: Edit[],
  refuse: (e: Edit, reason: EditReason) => void,
): PatchOperation | null {
  const [first] = group;
  if (!first) return null;
  for (const e of group) if (e.report.kind !== 'changed') refuse(e, 'noField');
  const change = group.find((e) => e.report.kind === 'changed' && e.report.status === 'applied');
  if (!change) return null;
  for (const extra of group) if (extra !== change && extra.report.status === 'applied') refuse(extra, 'misaligned');
  const words = change.text.trim();
  if (kind === 'text') {
    if (!words) {
      refuse(change, 'misaligned');
      return null;
    }
    return { op: 'replace', path: pointer, value: words };
  }
  const name = String(pointerGet(data, pointer.replace(/\/keywords$/, '/name')) ?? '').trim();
  const prefix = name ? `${name}: ` : '';
  if (!words.startsWith(prefix)) {
    refuse(change, 'labelChanged');
    return null;
  }
  const list = words
    .slice(prefix.length)
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
  if (list.length === 0) {
    refuse(change, 'misaligned');
    return null;
  }
  return { op: 'replace', path: pointer, value: list };
}

/* ---------- rich text, block by block ---------- */

interface Block {
  /** A list item, or any other top-level element. */
  kind: 'li' | 'el';
  outerStart: number;
  outerEnd: number;
  /** Its tags, and what they hold. A field of bare text is one block with no tags. */
  open: string;
  inner: string;
  close: string;
  /** The lines it reads as. */
  lines: string[];
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g;
const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr']);
const LISTS = new Set(['ul', 'ol']);
const TEXTUAL = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'blockquote']);

const linesOf = (read: string): string[] => read.split('\n').filter((l) => l.trim());

/**
 * The top-level blocks of a field's HTML, or null when it is not a flat run of
 * paragraphs and list items (a nested list, a table, loose text): those are not
 * edited.
 */
function splitBlocks(html: string): Block[] | null {
  // Text with no markup at all (a summary typed into a plain box) is one block.
  if (!html.includes('<') && html.trim()) {
    return [{ kind: 'el', outerStart: 0, outerEnd: html.length, open: '', inner: html, close: '', lines: linesOf(richTextLines(html)) }];
  }
  const blocks: Block[] = [];
  const stack: Array<{ name: string; start: number; openEnd: number }> = [];
  let lastEnd = 0;
  TAG.lastIndex = 0;
  for (let m = TAG.exec(html); m; m = TAG.exec(html)) {
    const name = m[2]!.toLowerCase();
    if (stack.length === 0 && html.slice(lastEnd, m.index).trim() !== '') return null;
    lastEnd = m.index + m[0].length;
    if (VOID.has(name) || m[0].endsWith('/>')) {
      if (stack.length === 0) return null;
      continue;
    }
    if (m[1] === '') {
      if (stack.length === 0 && !TEXTUAL.has(name) && !LISTS.has(name)) return null;
      if (stack.length === 1 && LISTS.has(stack[0]!.name) && name !== 'li') return null;
      if (stack.length >= 1 && LISTS.has(name) && LISTS.has(stack[0]!.name)) return null;
      stack.push({ name, start: m.index, openEnd: lastEnd });
      continue;
    }
    const top = stack.pop();
    if (!top || top.name !== name) return null;
    const outer = html.slice(top.start, lastEnd);
    const parts = { outerStart: top.start, outerEnd: lastEnd, open: html.slice(top.start, top.openEnd), inner: html.slice(top.openEnd, m.index), close: m[0] };
    if (stack.length === 0 && !LISTS.has(name)) {
      blocks.push({ kind: 'el', ...parts, lines: linesOf(richTextLines(outer)) });
    } else if (stack.length === 1 && LISTS.has(stack[0]!.name) && name === 'li') {
      blocks.push({ kind: 'li', ...parts, lines: linesOf(richTextLines(`<ul>${outer}</ul>`)) });
    }
  }
  if (stack.length > 0 || html.slice(lastEnd).trim() !== '') return null;
  return blocks;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WRAPPED_PARAGRAPH = /^(\s*<p(?:\s[^>]*)?>)([\s\S]*?)(<\/p>\s*)$/i;

/** A block like `like`, holding `words`: its own opening and closing tags, and its paragraph wrapper if it has one. */
function blockLike(like: Block, words: string): string {
  const wrapped = like.kind === 'li' ? WRAPPED_PARAGRAPH.exec(like.inner) : null;
  return like.open + (wrapped ? `${wrapped[1]}${escapeHtml(words)}${wrapped[3]}` : escapeHtml(words)) + like.close;
}

function htmlField(
  data: unknown,
  sources: Array<LineSource | null>,
  masterLines: string[],
  pointer: string,
  group: Edit[],
  refuse: (e: Edit, reason: EditReason) => void,
): PatchOperation | null {
  const giveUp = (): null => {
    for (const e of group) if (e.report.status === 'applied') refuse(e, 'misaligned');
    return null;
  };
  const html = pointerGet(data, pointer);
  if (typeof html !== 'string') return giveUp();
  const blocks = splitBlocks(html);
  if (!blocks) return giveUp();

  // The master lines of this field, each with the block it is read from.
  const fieldLines: number[] = [];
  sources.forEach((s, i) => {
    if (s?.pointer === pointer && masterLines[i]!.trim()) fieldLines.push(i);
  });
  // What the blocks read as, line by line, against what the master says the field reads as.
  const read = blocks.flatMap((b, bi) => b.lines.map((line) => ({ bi, line })));
  const owner = read.map((r) => r.bi);
  if (read.length !== fieldLines.length || fieldLines.some((m, k) => normal(masterLines[m]!) !== normal(read[k]!.line))) {
    return giveUp();
  }
  const blockOf = (master: number): number => owner[fieldLines.indexOf(master)] ?? -1;

  const replace = new Map<number, string>();
  const remove = new Set<number>();
  const before = new Map<number, string[]>();
  const after = new Map<number, string[]>();
  const push = (m: Map<number, string[]>, at: number, words: string): void => {
    m.set(at, [...(m.get(at) ?? []), words]);
  };
  for (const e of group) {
    const bi = blockOf(e.index);
    const words = normal(e.text);
    if (bi < 0) {
      refuse(e, 'misaligned');
      continue;
    }
    if (e.report.kind === 'added') {
      if (!words) refuse(e, 'misaligned');
      else push(e.side === 'after' ? after : before, bi, words);
      continue;
    }
    // One line of a block that reads as several cannot be changed on its own.
    if (blocks[bi]!.lines.length !== 1 || (e.report.kind === 'changed' && !words)) refuse(e, 'misaligned');
    else if (e.report.kind === 'changed') replace.set(bi, words);
    else remove.add(bi);
  }
  if (!group.some((e) => e.report.status === 'applied')) return null;

  let out = '';
  let cursor = 0;
  const expected: string[] = [];
  blocks.forEach((b, bi) => {
    out += html.slice(cursor, b.outerStart);
    for (const w of before.get(bi) ?? []) {
      out += blockLike(b, w);
      expected.push(w);
    }
    if (replace.has(bi)) {
      out += blockLike(b, replace.get(bi)!);
      expected.push(replace.get(bi)!);
    } else if (!remove.has(bi)) {
      out += html.slice(b.outerStart, b.outerEnd);
      expected.push(...b.lines.map(normal));
    }
    for (const w of after.get(bi) ?? []) {
      out += blockLike(b, w);
      expected.push(w);
    }
    cursor = b.outerEnd;
  });
  out = (out + html.slice(cursor)).replace(/<(ul|ol)(?:\s[^>]*)?>\s*<\/\1>/gi, '');

  // Read back with the reader's own rules: it must say exactly what the edits describe.
  const written = splitBlocks(out);
  if (!written || written.flatMap((b) => b.lines.map(normal)).join('\n') !== expected.join('\n')) return giveUp();
  return { op: 'replace', path: pointer, value: out };
}

/* ---------- JSON Pointer, for the three places data is read or replaced ---------- */

const tokens = (pointer: string): string[] => pointer.split('/').slice(1).map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));

function pointerGet(data: unknown, pointer: string): unknown {
  let at: unknown = data;
  for (const token of tokens(pointer)) {
    if (at === null || typeof at !== 'object') return undefined;
    at = (at as Record<string, unknown>)[token];
  }
  return at;
}

/** The data with each `replace` made, on a copy. Only `replace` of a place that exists is ever planned. */
export function applyOperations(data: unknown, operations: PatchOperation[]): unknown {
  const out = structuredClone(data);
  for (const op of operations) {
    if (op.op !== 'replace') throw new Error(`unsupported operation: ${op.op}`);
    const path = tokens(op.path);
    const last = path.pop();
    const parent = pointerGet(out, `/${path.map((t) => t.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`);
    if (last === undefined || parent === null || typeof parent !== 'object') throw new Error(`no such place: ${op.path}`);
    (parent as Record<string, unknown>)[last] = op.value;
  }
  return out;
}
