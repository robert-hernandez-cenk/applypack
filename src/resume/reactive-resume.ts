import { z } from 'zod';
import { stripHtml } from '../http';

/*
 * A Reactive Resume export (v4, v5 or v6 JSON) → the Markdown a resume is
 * stored as (ADR 0073). Pure. The files carry no version marker, so the
 * generation is read off the shape; every key is optional and an unknown one
 * is ignored — the shapes are written from the published schema and have not
 * been checked against a live instance (specs/039-…/contracts).
 */

export type Generation = 'v4' | 'v5' | 'v6';

export type ReactiveResumeRead =
  | { ok: true; generation: Generation; name: string; markdown: string }
  | { ok: false; code: 'notReactiveResume' | 'empty' };

type Rec = Record<string, unknown>;

const RecSchema = z.record(z.string(), z.unknown());
const isRec = (x: unknown): x is Rec => RecSchema.safeParse(x).success && !Array.isArray(x);
const rec = (x: unknown): Rec => (isRec(x) ? x : {});
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const text = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
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

const hrefOf = (tag: string): string => {
  const m = HREF.exec(tag);
  const target = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
  return LINK_SCHEME.test(target) && !/[<>]/.test(target) ? target : '';
};

const asText = (s: string): string => s.replace(TAG, '').replace(AMP_ENTITY, '&').trim();

/** `words (address)`, or the address alone when there are no words or they are the address. */
const linkText = (words: string, target: string): string => {
  const said = asText(words);
  return said === '' || said === asText(target) ? target : `${words} (${target})`;
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

/** A heading line: the place in brackets and the dates after a dot; no line at all for an item that names nothing. */
function heading(level: number, main: string, place: string, dates: string): string {
  if (!main) return '';
  const where = place ? `${main} (${place})` : main;
  return `${'#'.repeat(level)} ${[where, dates].filter(Boolean).join(' · ')}`;
}

/** A link written as text, or as `{ url }` (v5, v6) or `{ href }` (v4). */
const linkOf = (x: unknown): string => (typeof x === 'string' ? text(x) : pick(rec(x), 'url', 'href'));
const websiteOf = (item: Rec): string => linkOf(item.website) || linkOf(item.url);

type Block = string[];

/** One section's items → Markdown lines. */
interface SectionKind {
  key: string;
  title: string;
  /** An item is a heading with a body, or plain lines. */
  item: (item: Rec) => Block;
}

const body = (...parts: unknown[]): Block => parts.map(plain).filter(Boolean);

function experience(item: Rec): Block {
  const company = pick(item, 'company');
  const position = pick(item, 'position');
  const roles = list(item.roles).map(rec).filter((r) => !hiddenItem(r));
  // An employer that holds several roles has none of its own: the heading is the company.
  const main = position && company ? `${position} — ${company}` : position || company;
  return [
    heading(3, main, pick(item, 'location'), when(item)),
    ...body(item.description, item.summary),
    ...roles.flatMap((r) => [heading(4, pick(r, 'position'), '', when(r)), ...body(r.description, r.summary)]),
  ];
}

function education(item: Rec): Block {
  const degree = pick(item, 'degree', 'studyType');
  const area = pick(item, 'area');
  const school = pick(item, 'school', 'institution');
  const what = degree && area ? `${degree} in ${area}` : degree || area;
  const main = what && school ? `${what} — ${school}` : what || school;
  const grade = pick(item, 'grade', 'score');
  return [heading(3, main, pick(item, 'location'), when(item)), ...(grade ? [`Grade: ${grade}`] : []), ...body(item.description, item.summary)];
}

function skills(item: Rec): Block {
  const name = pick(item, 'name');
  const words = list(item.keywords).map(text).filter(Boolean);
  if (words.length > 0) return [name ? `${name}: ${words.join(', ')}` : words.join(', ')];
  const note = pick(item, 'proficiency', 'description');
  return [name && note ? `${name} — ${note}` : name];
}

function project(item: Rec): Block {
  const words = list(item.keywords).map(text).filter(Boolean);
  const link = websiteOf(item);
  return [
    heading(3, pick(item, 'name'), '', when(item)),
    ...body(item.description, item.summary),
    ...(words.length > 0 ? [`Keywords: ${words.join(', ')}`] : []),
    ...(link ? [link] : []),
  ];
}

function language(item: Rec): Block {
  const name = pick(item, 'language', 'name');
  const level = pick(item, 'fluency', 'description');
  return [name && level ? `${name} — ${level}` : name];
}

/** Certifications, awards and publications: a title, who gave it, when. */
const titled = (by: string[]) => (item: Rec): Block => {
  const title = pick(item, 'title', 'name');
  const giver = pick(item, ...by);
  return [heading(3, title && giver ? `${title} — ${giver}` : title || giver, '', when(item)), ...body(item.description, item.summary)];
};

function volunteer(item: Rec): Block {
  return [
    heading(3, pick(item, 'organization', 'company'), pick(item, 'location'), when(item)),
    ...(pick(item, 'position') ? [pick(item, 'position')] : []),
    ...body(item.description, item.summary),
  ];
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

function reference(item: Rec): Block {
  const name = pick(item, 'name');
  const role = pick(item, 'position');
  return [heading(3, name && role ? `${name} — ${role}` : name || role, '', ''), ...body(item.description, item.summary)];
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

/** v6 and v5 hold `summary` at the top; v4 inside `sections`. */
function summaryOf(root: Rec, sections: Rec): { title: string; content: string } | null {
  const s = isRec(root.summary) ? root.summary : isRec(sections.summary) ? sections.summary : null;
  if (!s || hiddenItem(s) || s.hidden === true) return null;
  return { title: pick(s, 'title', 'name'), content: plain(s.content) };
}

function generationOf(root: Rec, sections: Rec): Generation {
  if (!isRec(root.summary)) return 'v4';
  const dated = Object.values(sections).some((sec) => list(rec(sec).items).some((it) => isRec(rec(it).dates)));
  return dated ? 'v6' : 'v5';
}

/** Email, phone, place, website, custom fields, then the profiles; an address the line already holds is not said twice. */
function contactLine(basics: Rec, sections: Rec): string {
  const custom = list(basics.customFields).map((f) => pick(rec(f), 'text')).filter(Boolean);
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

export function readReactiveResume(json: unknown): ReactiveResumeRead {
  if (!isRec(json) || !isRec(json.basics) || !isRec(json.sections)) return { ok: false, code: 'notReactiveResume' };
  const basics = json.basics;
  const sections = json.sections;
  const out: string[] = [];
  const name = pick(basics, 'name');
  const headline = pick(basics, 'headline');
  const contact = contactLine(basics, sections);

  const blocks: string[][] = [];
  const summary = summaryOf(json, sections);
  if (summary && summary.content) blocks.push([`## ${summary.title || 'Summary'}`, summary.content]);
  for (const kind of SECTIONS) {
    const sec = rec(sections[kind.key]);
    if (sec.hidden === true || sec.visible === false) continue;
    const items = list(sec.items).map(rec).filter((i) => !hiddenItem(i));
    const lines = items.flatMap((i) => kind.item(i)).filter(Boolean);
    if (lines.length > 0) blocks.push([`## ${pick(sec, 'title', 'name') || kind.title}`, ...lines]);
  }
  // v5 and v6 keep them in `customSections`, v4 in `sections.custom`, an object keyed by id.
  for (const c of [...list(json.customSections), ...Object.values(rec(sections.custom))]) {
    const custom = customSection(rec(c));
    if (custom) blocks.push([`## ${custom.title}`, ...custom.lines]);
  }
  if (blocks.length === 0) return { ok: false, code: 'empty' };

  if (name) out.push(`# ${name}`);
  if (headline) out.push(headline);
  if (contact) out.push(contact);
  const head = out.join('\n');
  const markdown = [head, ...blocks.map((b) => b.join('\n'))].filter(Boolean).join('\n\n');
  return { ok: true, generation: generationOf(json, sections), name, markdown };
}
