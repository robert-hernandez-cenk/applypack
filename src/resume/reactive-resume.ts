import { z } from 'zod';
import { stripHtml } from '../http';

/*
 * A Reactive Resume export (v4, v5 or v6 JSON) → the text a resume is stored
 * as (ADR 0073). Pure. The files carry no version marker, so the generation
 * is read off the shape; every key is optional and an unknown one is ignored.
 * The shapes are written from the published schema and, for v6, checked
 * against one real export (specs/044-…/research R8).
 *
 * The text is written in the dialect a .docx or .pdf extracts to, because
 * that is what every reader of a stored resume — `structureFromText`, the
 * page's "what a parser reads" panel, an ATS that extracts text — already
 * understands: the name, the headline and one contact line as plain lines,
 * `## ` section headings, and per job a company line, a `Position · Dates`
 * line and its bullets. A `#` heading for the name or a `###` one per job read
 * as a stack of sections, and the parser found no name, no contact and one job
 * of six. No line here begins with `#` except a section heading.
 */

export type Generation = 'v4' | 'v5' | 'v6';

export type ReactiveResumeRead =
  | { ok: true; generation: Generation; name: string; markdown: string }
  | { ok: false; code: 'notReactiveResume' | 'empty' };

/** What a field holds: rich text (HTML), one plain string, or a list of words written as `Name: a, b, c`. */
export type SourceKind = 'html' | 'text' | 'keywords';

/**
 * Where a line of the Markdown came from (ADR 0079): the JSON Pointer of the
 * field, the item's own id, and `label` — the English noun a report names it by
 * ("Experience · Acme"). A line made from several fields has none.
 */
export interface LineSource {
  pointer: string;
  id: string;
  field: string;
  kind: SourceKind;
  label: string;
}

/** `lines[i]` is the source of `markdown.split('\n')[i]`. */
export type ReactiveResumeMapped =
  | { ok: true; generation: Generation; name: string; markdown: string; lines: Array<LineSource | null> }
  | { ok: false; code: 'notReactiveResume' | 'empty' };

type Rec = Record<string, unknown>;

const RecSchema = z.record(z.string(), z.unknown());
const isRec = (x: unknown): x is Rec => RecSchema.safeParse(x).success && !Array.isArray(x);
const rec = (x: unknown): Rec => (isRec(x) ? x : {});
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/*
 * A line's source rides at its end as MARK_OPEN + index + MARK_CLOSE while the
 * text is built, and is cut off again in one place at the end. The two control
 * characters are taken out of everything read from the file, so a resume cannot
 * forge a tag.
 */
const MARK_OPEN = '\u0001';
const MARK_CLOSE = '\u0002';
const MARK_CHARS = /[\u0001\u0002]/g;
const MARK_AT_END = /\u0001(\d+)\u0002$/;

const text = (x: unknown): string => (typeof x === 'string' ? x.replace(MARK_CHARS, '').trim() : '');
/** The first of `keys` that holds text. */
const pick = (r: Rec, ...keys: string[]): string => {
  for (const k of keys) {
    const v = text(r[k]);
    if (v) return v;
  }
  return '';
};

const DASH = '–';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PRESENT = 'Present';
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

/** How far past `<a` a tag's end and its `</a>` are looked for: a link spread wider than this is left as its words. */
const LINK_WINDOW_CHARS = 2_000;
const LINK_OPEN = '<a';
const LINK_CLOSE = '</a>';
/** The only targets worth keeping: a web or a mail address. */
const LINK_SCHEME = /^(?:https?:|mailto:)/i;
const HREF = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const TAG = /<[^>]*>/g;
const AMP_ENTITY = /&amp;/g;
const MAILTO = /^mailto:/i;
/** The longest `## ` heading the reader takes for one (`structure-from-text.ts`); a longer one is read as content. */
const MAX_HEADING_CHARS = 80;

const hrefOf = (tag: string): string => {
  const m = HREF.exec(tag);
  const target = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
  return LINK_SCHEME.test(target) && !/[<>]/.test(target) ? target : '';
};

const asText = (s: string): string => s.replace(TAG, '').replace(AMP_ENTITY, '&').trim();

/** `words (address)`, or the address alone when there are no words or they are the address. */
const linkText = (words: string, target: string): string => {
  const said = asText(words);
  const address = asText(target);
  if (said === '' || said === address) return target;
  // "a@b.example (mailto:a@b.example)" says it twice.
  return said === address.replace(MAILTO, '') ? words : `${words} (${target})`;
};

/**
 * `<a href="X">words</a>` → `words (X)` for a web or mail address; any other
 * anchor is left for `stripHtml` to reduce to its words. One pass: the next
 * `>` and `</a>` only ever move forward, so a run of openers that never close
 * costs its length, not its square — `replaceUpTo` in http.ts is the case
 * that taught this (300 kB of `<a ` took nine seconds). The text comes out
 * still markup, for the one `stripHtml` pass that follows (it decodes `&amp;`
 * last; never run it twice).
 */
function withLinkTargets(html: string): string {
  let out = '';
  let copied = 0;
  let from = 0;
  let tagEnd = -1;
  let close = -1;
  for (;;) {
    const open = html.indexOf(LINK_OPEN, from);
    if (open === -1) break;
    from = open + LINK_OPEN.length;
    if (!/\s/.test(html.charAt(from))) continue;
    if (tagEnd < open) tagEnd = html.indexOf('>', open);
    if (tagEnd === -1) break;
    if (close < tagEnd) close = html.indexOf(LINK_CLOSE, tagEnd);
    if (close === -1) break;
    if (close - open > LINK_WINDOW_CHARS) continue;
    const target = hrefOf(html.slice(open, tagEnd));
    if (!target) continue;
    out += html.slice(copied, open) + linkText(html.slice(tagEnd + 1, close), target);
    copied = from = close + LINK_CLOSE.length;
  }
  return out + html.slice(copied);
}

/**
 * Formatted text → plain lines. The bullets stripHtml writes become Markdown
 * list lines — the editor wraps each item's text in a paragraph, so the
 * bullet can sit alone on its line — and a list stays one block. A link keeps
 * its address next to its words.
 */
function plain(html: unknown): string {
  const s = text(html);
  return s ? stripHtml(withLinkTargets(s)).replace(/^•\s*/gm, '- ').replace(/^(- .*)\n\n(?=- )/gm, '$1\n') : '';
}

function datePoint(s: string): string {
  const m = YEAR_MONTH.exec(s);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${month} ${m[1]}` : s;
}

/** v6 keeps `dates`; v4 and v5 only the rendered string. A date the app kept as written (`raw`) stays so. */
function when(item: Rec): string {
  const d = rec(item.dates);
  const start = text(d.start);
  const end = text(d.end);
  const present = d.present === true;
  if (start || end || present) {
    if (present) return start ? `${datePoint(start)} ${DASH} ${PRESENT}` : PRESENT;
    if (start && end) return `${datePoint(start)} ${DASH} ${datePoint(end)}`;
    return datePoint(start || end);
  }
  return text(d.raw) || pick(item, 'period', 'date');
}

const hiddenItem = (x: Rec): boolean => x.hidden === true || x.visible === false;

/** Parts joined by a dot, the separator the reader splits a line on. */
const dotted = (...parts: string[]): string => parts.filter(Boolean).join(' · ');

/** An item's line: `main · rest…`; none at all for an item that names nothing, so its dates never stand alone. */
const entry = (main: string, ...rest: string[]): string => (main ? dotted(main, ...rest) : '');

/** A job: the company line, then the position line with its dates, then its text; just the text when it names neither. */
const job = (company: string, position: string, dates: string, text: string[]): string[] =>
  company || position ? [company, dotted(position, dates), ...text] : text;

/**
 * A job described only in paragraphs gets each one as a bullet: the reader
 * starts the next job after a block of bullets and at no other place, so two
 * jobs without any would run into one. A description that has a list keeps its
 * paragraphs as written.
 */
const bulleted = (text: string[]): string[] => {
  const lines = text.flatMap((t) => t.split('\n')).filter((l) => l.trim());
  return lines.some((l) => l.startsWith('- ')) ? text : lines.map((l) => `- ${l}`);
};

/** `## Title`, made a heading the reader accepts: it refuses two commas (a list) and anything past 80 characters. */
const sectionHeading = (title: string): string => {
  const plain = title.split(',').length > 2 ? title.replace(/,/g, ';') : title;
  return `## ${plain.slice(0, MAX_HEADING_CHARS).trim()}`;
};

/** A link written as text, or as `{ url }` (v5, v6) or `{ href }` (v4). */
const linkOf = (x: unknown): string => (typeof x === 'string' ? text(x) : pick(rec(x), 'url', 'href'));
const websiteOf = (item: Rec): string => linkOf(item.website) || linkOf(item.url);

type Block = string[];

/** Where an item (or one role of it) sits, so the lines made from its fields can say so. */
interface Scope {
  marks: LineSource[];
  pointer: string;
  id: string;
  label: string;
}

/** The tag for a field of `scope`, to be put at the end of each of its lines. */
function mark(scope: Scope, field: string, kind: SourceKind): string {
  scope.marks.push({ pointer: `${scope.pointer}/${field}`, id: scope.id, field, kind, label: scope.label });
  return `${MARK_OPEN}${scope.marks.length - 1}${MARK_CLOSE}`;
}

/** `s` with `tag` at the end of each of its lines that says something. */
const tagged = (s: string, tag: string): string =>
  s
    .split('\n')
    .map((l) => (l.trim() ? l + tag : l))
    .join('\n');

/** One section's items → lines. */
interface SectionKind {
  key: string;
  title: string;
  /** An item is a line or two and its text; never a heading. */
  item: (item: Rec, scope: Scope) => Block;
}

/** Fields that are not mapped: their lines carry no source. */
const body = (...parts: unknown[]): Block => parts.map(plain).filter(Boolean);

/** The rich-text fields of an item, each tagged with where it came from. */
const fieldBody = (scope: Scope, item: Rec, ...fields: string[]): Block =>
  fields.map((f) => {
    const lines = plain(item[f]);
    return lines ? tagged(lines, mark(scope, f, 'html')) : '';
  }).filter(Boolean);

function experience(item: Rec, scope: Scope): Block {
  const company = entry(pick(item, 'company'), pick(item, 'location'));
  const position = pick(item, 'position');
  // The index is the place in the file, hidden roles included: a patch addresses it.
  const roles = list(item.roles).map((r, at) => ({ role: rec(r), at })).filter(({ role }) => !hiddenItem(role));
  const text = bulleted(fieldBody(scope, item, 'description', 'summary'));
  // An employer that holds several positions has none of its own: each position is a job, the company line repeated above it.
  const held = roles.flatMap(({ role, at }, i) => {
    const own: Scope = { ...scope, pointer: `${scope.pointer}/roles/${at}`, id: pick(role, 'id') || scope.id };
    return job(company, pick(role, 'position'), when(role), [...(i === 0 && !position ? text : []), ...bulleted(fieldBody(own, role, 'description', 'summary'))]);
  });
  return position || roles.length === 0 ? [...job(company, position, when(item), text), ...held] : held;
}

/** The school first, because that is where the reader looks for it. */
function education(item: Rec, scope: Scope): Block {
  const degree = pick(item, 'degree', 'studyType');
  const area = pick(item, 'area');
  const what = degree && area ? `${degree} in ${area}` : degree || area;
  const grade = pick(item, 'grade', 'score');
  const main = pick(item, 'school', 'institution') || what;
  return [entry(main, main === what ? '' : what, pick(item, 'location'), when(item), grade ? `Grade ${grade}` : ''), ...fieldBody(scope, item, 'description', 'summary')];
}

function skills(item: Rec, scope: Scope): Block {
  const name = pick(item, 'name');
  const words = list(item.keywords).map(text).filter(Boolean);
  if (words.length > 0) return [(name ? `${name}: ${words.join(', ')}` : words.join(', ')) + mark(scope, 'keywords', 'keywords')];
  const note = pick(item, 'proficiency', 'description');
  return [name && note ? `${name} — ${note}` : name];
}

function project(item: Rec, scope: Scope): Block {
  const words = list(item.keywords).map(text).filter(Boolean);
  const link = websiteOf(item);
  return [
    entry(pick(item, 'name'), when(item)),
    ...fieldBody(scope, item, 'description', 'summary'),
    ...(words.length > 0 ? [`Keywords: ${words.join(', ')}`] : []),
    ...(link ? [link] : []),
  ];
}

/** `English (Native)`: the form the reader splits into a language and its fluency. */
function language(item: Rec): Block {
  const name = pick(item, 'language', 'name');
  const level = pick(item, 'fluency', 'description');
  return [name && level ? `${name} (${level})` : name];
}

/** Certifications, awards and publications: a title, who gave it, when. */
const titled = (by: string[]) => (item: Rec, scope: Scope): Block => {
  const title = pick(item, 'title', 'name');
  const giver = pick(item, ...by);
  return [entry(title && giver ? `${title} — ${giver}` : title || giver, when(item)), ...fieldBody(scope, item, 'description', 'summary')];
};

/** Written like a job — people retitle this section "Volunteer Experience", and the reader then reads it as work. */
function volunteer(item: Rec, scope: Scope): Block {
  return job(entry(pick(item, 'organization', 'company'), pick(item, 'location')), pick(item, 'position'), when(item), bulleted(fieldBody(scope, item, 'description', 'summary')));
}

function interest(item: Rec): Block {
  const name = pick(item, 'name');
  const words = list(item.keywords).map(text).filter(Boolean);
  return [words.length > 0 ? `${name ? `${name}: ` : ''}${words.join(', ')}` : name];
}

/**
 * The visible profiles as header entries: the address alone when there is one,
 * else `Network: username`. A bare network names nobody, so it adds nothing.
 */
function profileEntries(sections: Rec): string[] {
  const sec = rec(sections.profiles);
  if (hiddenItem(sec)) return [];
  return list(sec.items)
    .map(rec)
    .filter((item) => !hiddenItem(item))
    .map((item) => {
      const user = pick(item, 'username');
      const network = pick(item, 'network');
      return websiteOf(item) || (network && user ? `${network}: ${user}` : user);
    });
}

function reference(item: Rec, scope: Scope): Block {
  const name = pick(item, 'name');
  const role = pick(item, 'position');
  return [name && role ? `${name} — ${role}` : name || role, ...fieldBody(scope, item, 'description', 'summary')];
}

/** The order a resume reads in. */
const SECTIONS: SectionKind[] = [
  { key: 'experience', title: 'Experience', item: experience },
  { key: 'education', title: 'Education', item: education },
  { key: 'skills', title: 'Skills', item: skills },
  { key: 'projects', title: 'Projects', item: project },
  { key: 'languages', title: 'Languages', item: language },
  { key: 'certifications', title: 'Certifications', item: titled(['issuer']) },
  { key: 'awards', title: 'Awards', item: titled(['awarder']) },
  { key: 'publications', title: 'Publications', item: titled(['publisher']) },
  { key: 'volunteer', title: 'Volunteer', item: volunteer },
  { key: 'interests', title: 'Interests', item: interest },
  { key: 'references', title: 'References', item: reference },
];

/** v6 and v5 hold `summary` at the top; v4 inside `sections`. `pointer` is the section's, whichever. */
function summaryOf(root: Rec, sections: Rec): { title: string; content: string; pointer: string } | null {
  const top = isRec(root.summary);
  const s = top ? rec(root.summary) : isRec(sections.summary) ? rec(sections.summary) : null;
  if (!s || hiddenItem(s) || s.hidden === true) return null;
  return { title: pick(s, 'title', 'name'), content: plain(s.content), pointer: top ? '/summary' : '/sections/summary' };
}

function generationOf(root: Rec, sections: Rec): Generation {
  if (!isRec(root.summary)) return 'v4';
  const dated = Object.values(sections).some((sec) => list(rec(sec).items).some((it) => isRec(rec(it).dates)));
  return dated ? 'v6' : 'v5';
}

/** A contact field: its link, else its words; v4 keeps `name` and `value` instead, written `name: value`. */
function contactField(f: Rec): string {
  const value = pick(f, 'value');
  return linkOf(f.link) || pick(f, 'text') || (value && pick(f, 'name') ? `${pick(f, 'name')}: ${value}` : value);
}

/**
 * Email, phone, place, website, contact fields, then the profiles; an address
 * the line already holds is not said twice. A contact field is its link when
 * it has one — "LinkedIn" is a label, the address is what a reader can use —
 * and its words when it has not.
 */
function contactLine(basics: Rec, sections: Rec): string {
  const custom = list(basics.customFields).map(rec).map(contactField).filter(Boolean);
  const parts = [pick(basics, 'email'), pick(basics, 'phone'), pick(basics, 'location'), websiteOf(basics), ...custom, ...profileEntries(sections)];
  return [...new Set(parts.filter(Boolean))].join(' · ');
}

function customSection(sec: Rec): { title: string; lines: Block } | null {
  if (hiddenItem(sec)) return null;
  const items = list(sec.items).map(rec).filter((i) => !hiddenItem(i));
  const lines = [
    ...body(sec.recipient, sec.content),
    ...items.flatMap((i) => body(pick(i, 'name', 'title'), pick(i, 'description', 'summary'))),
  ];
  return lines.length > 0 ? { title: pick(sec, 'title', 'name') || pick(sec, 'type') || 'Notes', lines } : null;
}

/** The words that name an item in a report: its employer, school, title… */
const itemName = (item: Rec): string => pick(item, 'company', 'school', 'institution', 'organization', 'name', 'title', 'issuer');

/** `Section · Name`, or the section alone. */
const labelOf = (section: string, item: Rec): string => {
  const who = itemName(item);
  return who ? `${section} · ${who}` : section;
};

/**
 * The resume as Markdown, and for each line the field it came from (ADR 0079).
 * `readReactiveResume` is this function's text, so the two cannot differ.
 */
export function readReactiveResumeMapped(json: unknown): ReactiveResumeMapped {
  if (!isRec(json) || !isRec(json.basics) || !isRec(json.sections)) return { ok: false, code: 'notReactiveResume' };
  const basics = json.basics;
  const sections = json.sections;
  const marks: LineSource[] = [];
  const out: string[] = [];
  const name = pick(basics, 'name');
  const headline = pick(basics, 'headline');
  const contact = contactLine(basics, sections);

  const blocks: string[][] = [];
  const summary = summaryOf(json, sections);
  if (summary && summary.content) {
    const scope: Scope = { marks, pointer: summary.pointer, id: 'summary', label: 'Summary' };
    blocks.push([sectionHeading(summary.title || 'Summary'), tagged(summary.content, mark(scope, 'content', 'html'))]);
  }
  for (const kind of SECTIONS) {
    const sec = rec(sections[kind.key]);
    if (sec.hidden === true || sec.visible === false) continue;
    const heading = pick(sec, 'title', 'name') || kind.title;
    // The index is the place in the file, hidden items included: a patch addresses it.
    const items = list(sec.items).map((it, at) => ({ item: rec(it), at })).filter(({ item }) => !hiddenItem(item));
    const lines = items
      .flatMap(({ item, at }) => kind.item(item, { marks, pointer: `/sections/${kind.key}/items/${at}`, id: pick(item, 'id'), label: labelOf(heading, item) }))
      .filter(Boolean);
    if (lines.length > 0) blocks.push([sectionHeading(heading), ...lines]);
  }
  // v5 and v6 keep them in `customSections`, v4 in `sections.custom`, an object keyed by id.
  for (const c of [...list(json.customSections), ...Object.values(rec(sections.custom))]) {
    const custom = customSection(rec(c));
    if (custom) blocks.push([sectionHeading(custom.title), ...custom.lines]);
  }
  if (blocks.length === 0) return { ok: false, code: 'empty' };

  if (name) out.push(name);
  if (headline) out.push(headline + mark({ marks, pointer: '/basics', id: 'basics', label: 'Headline' }, 'headline', 'text'));
  if (contact) out.push(contact);
  const head = out.join('\n');
  const tagless = [head, ...blocks.map((b) => b.join('\n'))].filter(Boolean).join('\n\n');
  const lines: Array<LineSource | null> = [];
  const markdown = tagless
    .split('\n')
    .map((l) => {
      const at = MARK_AT_END.exec(l);
      lines.push(at ? (marks[Number(at[1])] ?? null) : null);
      return at ? l.slice(0, at.index) : l;
    })
    .join('\n');
  return { ok: true, generation: generationOf(json, sections), name, markdown, lines };
}

export function readReactiveResume(json: unknown): ReactiveResumeRead {
  const got = readReactiveResumeMapped(json);
  return got.ok ? { ok: true, generation: got.generation, name: got.name, markdown: got.markdown } : got;
}
