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

/**
 * Formatted text → plain lines. The bullets stripHtml writes become Markdown
 * list lines — the editor wraps each item's text in a paragraph, so the
 * bullet can sit alone on its line — and a list stays one block.
 */
function plain(html: unknown): string {
  const s = text(html);
  return s ? stripHtml(s).replace(/^•\s*/gm, '- ').replace(/^(- .*)\n\n(?=- )/gm, '$1\n') : '';
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

function profile(item: Rec): Block {
  const network = pick(item, 'network');
  const user = pick(item, 'username');
  const link = websiteOf(item);
  const who = [user, link && !user ? link : ''].filter(Boolean).join(' ');
  return [network && who ? `${network}: ${who}` : network || who];
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
  { key: 'profiles', title: 'Profiles', item: profile },
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

function contactLine(basics: Rec): string {
  const custom = list(basics.customFields).map((f) => pick(rec(f), 'text')).filter(Boolean);
  return [pick(basics, 'email'), pick(basics, 'phone'), pick(basics, 'location'), websiteOf(basics), ...custom].filter(Boolean).join(' · ');
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
  const contact = contactLine(basics);

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
