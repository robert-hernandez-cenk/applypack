import { z } from 'zod';
import { decodeHtmlEntities, stripHtml } from '../http';
import { GoogleError } from './status';

/*
 * A Gmail message read into what the extraction needs (ADR 0071): who sent
 * it, when it arrived, its words, and the addresses in it. Pure.
 *
 * The addresses are taken OUT of the words and numbered: each link becomes a
 * `[#n]` marker where it stood, and the model names a listing's link by that
 * number. It can therefore never produce an address that was not in the mail,
 * and a long tracking URL costs a marker instead of a hundred tokens. Nothing
 * here, or after it, ever requests one of them (ADR 0005).
 */

/** How much of a mail's words the model is shown. */
export const BODY_CHARS = 12_000;
/** How many different addresses a mail may offer; a digest has a dozen at most. */
export const MAX_LINKS = 60;
/**
 * How much of a part is read at all. A digest is tens of kilobytes; a mail can be
 * twenty-five megabytes, and anyone can send one to an address a Gmail filter
 * labels. Patterns run over this much and no more, and the ones below are bounded
 * besides: a pattern that rescans from every `<a` took a minute on a megabyte of them.
 */
export const RAW_CHARS = 200_000;

interface Header {
  name: string;
  value: string;
}

interface Part {
  mimeType: string;
  filename: string;
  headers: Header[];
  body: { data?: string | undefined };
  parts: Part[];
}

const PartSchema: z.ZodType<Part, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    mimeType: z.string().default(''),
    filename: z.string().default(''),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
    body: z.object({ data: z.string().optional() }).default({}),
    parts: z.array(PartSchema).default([]),
  }),
);

const MessageSchema = z.object({
  id: z.string().min(1),
  internalDate: z.string().regex(/^\d+$/),
  payload: PartSchema,
});

export type GmailMessage = z.infer<typeof MessageSchema>;

export function parseMessage(json: unknown): GmailMessage {
  const parsed = MessageSchema.safeParse(json);
  if (!parsed.success) throw new GoogleError('error', "Google's message was not in the expected shape");
  return parsed.data;
}

export interface ReadMail {
  subject: string;
  fromName: string;
  receivedAt: Date;
  text: string;
  /** `links[n - 1]` is what the marker `[#n]` stands for. */
  links: string[];
}

function header(root: Part, name: string): string {
  return root.headers.find((h) => h.name.toLowerCase() === name)?.value.trim() ?? '';
}

/** "Name" <a@b.example>, Name <a@b.example>, <a@b.example> or a@b.example → the name, else the address. */
function senderName(from: string): string {
  const angle = /^(.*?)\s*<([^>]*)>\s*$/.exec(from);
  if (!angle) return from;
  const name = (angle[1] ?? '').replace(/^"|"$/g, '').trim();
  return name !== '' ? name : (angle[2] ?? '').trim();
}

/** The first part of this type that holds text, skipping attachments. */
function findText(part: Part, mimeType: string): string | null {
  if (part.filename === '' && part.mimeType === mimeType && part.body.data) {
    // Four base64 characters make three bytes: cut before decoding, so a huge part is never held as text.
    const text = Buffer.from(part.body.data.slice(0, Math.ceil((RAW_CHARS * 4) / 3)), 'base64url').toString('utf8').slice(0, RAW_CHARS);
    if (text.trim() !== '') return text;
  }
  for (const child of part.parts) {
    const found = findText(child, mimeType);
    if (found !== null) return found;
  }
  return null;
}

/** Numbers each different web address in the order it first appears. */
class Links {
  readonly list: string[] = [];

  /** The marker for this address, or '' when it is not a web address or the mail has offered too many. */
  marker(address: string): string {
    if (!/^https?:\/\//i.test(address)) return '';
    let at = this.list.indexOf(address);
    if (at === -1) {
      if (this.list.length >= MAX_LINKS) return '';
      this.list.push(address);
      at = this.list.length - 1;
    }
    return `[#${at + 1}]`;
  }
}

/** Every part of it bounded: a tag, an address and the words inside a link (a whole job card may sit in one). */
const ANCHOR = /<a\b[^>]{0,200}?\bhref\s*=\s*(?:"([^"]{0,2000})"|'([^']{0,2000})')[^>]{0,200}>([\s\S]{0,3000}?)<\/a>/gi;
const BARE_URL = /https?:\/\/[^\s<>"'\])]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function htmlToText(html: string, links: Links): string {
  const marked = html.replace(ANCHOR, (_all, double: string | undefined, single: string | undefined, inner: string) => {
    const marker = links.marker(decodeHtmlEntities((double ?? single ?? '').trim()));
    return marker === '' ? inner : `${inner} ${marker}`;
  });
  return stripHtml(marked);
}

function plainToText(text: string, links: Links): string {
  return text.replace(BARE_URL, (url) => {
    const bare = url.replace(TRAILING_PUNCTUATION, '');
    return links.marker(bare) + url.slice(bare.length);
  });
}

export function readMail(message: GmailMessage): ReadMail {
  const root = message.payload;
  const links = new Links();
  const plain = findText(root, 'text/plain');
  const html = plain === null ? findText(root, 'text/html') : null;
  const raw = plain !== null ? plainToText(plain, links) : html !== null ? htmlToText(html, links) : '';
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, BODY_CHARS);
  return {
    subject: header(root, 'subject'),
    fromName: senderName(header(root, 'from')),
    receivedAt: new Date(Number(message.internalDate)),
    text,
    links: links.list,
  };
}
