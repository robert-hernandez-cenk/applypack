import { extname } from 'node:path';
import { docxToText, ResumeTextError } from './docx-text';
import { pdfToText } from './pdf-text';
import { t } from '../i18n/t';
import { readReactiveResume } from './reactive-resume';
import { MAX_INFLATED_PART_BYTES, ZipError, ZipLimitError } from './zip';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'] as const;
const MIN_TEXT_CHARS = 200;

/**
 * A Reactive Resume export, already parsed → the resume's name (the file's
 * own, possibly empty) and the Markdown stored as its text and file (ADR 0073).
 * Throws ResumeTextError like every other reader.
 */
export function reactiveResumeText(json: unknown): { name: string; text: string } {
  const read = readReactiveResume(json);
  if (!read.ok) throw new ResumeTextError(read.code === 'empty' ? 'reactiveEmpty' : 'notReactiveResume');
  if (read.markdown.length < MIN_TEXT_CHARS) throw new ResumeTextError('tooShort', { n: read.markdown.length });
  return { name: read.name, text: read.markdown };
}

const MAX_FILE_STEM_CHARS = 100;
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** A resume that arrived as data, stored as the Markdown it was written out to: its file name, type, bytes and text. */
export function markdownResume(name: string, text: string) {
  const stem = name.replace(UNSAFE_NAME_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_FILE_STEM_CHARS) || t('upload.defaultName');
  return { sourceFilename: `${stem}.md`, mimeType: 'text/markdown', original: Buffer.from(text, 'utf8'), text };
}

/** The bytes of a `.json` upload → `reactiveResumeText`. */
export function reactiveResumeFromBytes(bytes: Buffer): { name: string; text: string } {
  let json: unknown;
  try {
    json = JSON.parse(bytes.toString('utf8').replace(/^﻿/, ''));
  } catch {
    throw new ResumeTextError('badJson');
  }
  return reactiveResumeText(json);
}

/** Uploaded file → the plain text stored on Resume.text. Throws ResumeTextError with a user-facing message. */
export async function extractResumeText(filename: string, bytes: Buffer): Promise<string> {
  const ext = extname(filename).toLowerCase();
  let text: string;
  if (ext === '.pdf') {
    // pdfToText enforces its own minimum with a scanned-image hint.
    return pdfToText(bytes);
  } else if (ext === '.docx') {
    try {
      text = docxToText(bytes);
    } catch (err) {
      if (err instanceof ZipLimitError) {
        throw new ResumeTextError('docxTooLarge', { mb: MAX_INFLATED_PART_BYTES / 1024 / 1024 });
      }
      if (err instanceof ZipError) throw new ResumeTextError('notZip');
      throw err;
    }
  } else if (ext === '.md' || ext === '.txt') {
    text = bytes.toString('utf8').replace(/\r\n/g, '\n').trim();
  } else {
    throw new ResumeTextError('unsupported', { ext: ext || 'none', accepted: ACCEPTED_EXTENSIONS.join(', ') });
  }
  if (text.length < MIN_TEXT_CHARS) {
    throw new ResumeTextError('tooShort', { n: text.length });
  }
  return text;
}
