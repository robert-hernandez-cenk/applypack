import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractResumeText, ACCEPTED_EXTENSIONS, markdownResume, reactiveResumeFromBytes, reactiveResumeText } from './resume-text';
import { ResumeTextError } from './docx-text';
import { buildZip } from './zip-write';

/**
 * What the reader does with a file that is not what it claims to be.
 * Every path here has to end in a ResumeTextError the upload form can show —
 * anything else reaches the user as a 500 on a file they chose themselves.
 */
const PROSE = 'Senior engineer with ten years of Laravel and React work. '.repeat(6);

async function refusal(name: string, bytes: Buffer): Promise<string> {
  try {
    await extractResumeText(name, bytes);
    assert.fail(`${name} was read instead of refused`);
  } catch (err) {
    assert.ok(err instanceof ResumeTextError, `${name} threw ${(err as Error).constructor.name}`);
    return err.message;
  }
}

describe('extractResumeText — the files a user actually picks', () => {
  it('reads plain text and markdown', async () => {
    assert.match(await extractResumeText('cv.txt', Buffer.from(PROSE)), /Laravel/);
    assert.match(await extractResumeText('cv.md', Buffer.from(`# CV\n\n${PROSE}`)), /Laravel/);
  });

  it('normalises Windows line endings', async () => {
    const text = await extractResumeText('cv.txt', Buffer.from(PROSE.replace(/ /g, '\r\n')));
    assert.doesNotMatch(text, /\r/);
  });

  it('refuses an empty file', async () => {
    for (const ext of ACCEPTED_EXTENSIONS) {
      assert.ok((await refusal(`cv${ext}`, Buffer.alloc(0))).length > 0);
    }
  });

  it('refuses a file with too little text to be a resume', async () => {
    assert.match(await refusal('cv.txt', Buffer.from('Nazar Boyko')), /characters/);
  });

  it('refuses a .docx that is not a zip', async () => {
    assert.match(await refusal('cv.docx', Buffer.from(PROSE)), /not a valid \.docx/);
  });

  it('refuses a .docx that is a zip without a document', async () => {
    // A real .docx fixture renamed is fine; a zip of something else is not.
    const notWord = readFileSync('src/resume/fixtures/flow-simple.docx');
    const truncated = notWord.subarray(0, Math.floor(notWord.length / 2));
    assert.ok((await refusal('cv.docx', truncated)).length > 0);
  });

  it('refuses a .docx whose document is larger inside than the reader survives, and reads one of honest size', async () => {
    // Reading costs about 50 MB of memory a megabyte of XML: the ceiling is 8 MB, and a real resume is under 2 (#400).
    const docx = (mb: number): Buffer => {
      const paragraph = `<w:p><w:r><w:t>${PROSE}</w:t></w:r></w:p>`;
      const body = paragraph.repeat(Math.ceil((mb * 1024 * 1024) / paragraph.length));
      return buildZip([{ name: 'word/document.xml', data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`) }]);
    };
    assert.match(await refusal('cv.docx', docx(9)), /larger inside than this tool reads \(8 MB in one part\)/);
    assert.ok((await extractResumeText('cv.docx', docx(1))).startsWith(PROSE.slice(0, 40)));
  });

  it('refuses a .pdf that is really a zip, and says so as a PDF problem', async () => {
    const zip = readFileSync('src/resume/fixtures/flow-simple.docx');
    assert.ok((await refusal('cv.pdf', zip)).length > 0);
  });

  it('names the extensions it does take', async () => {
    const message = await refusal('cv.pages', Buffer.from(PROSE));
    for (const ext of ACCEPTED_EXTENSIONS) assert.ok(message.includes(ext), `${ext} not named`);
  });

  it('refuses a file with no extension at all', async () => {
    assert.match(await refusal('resume', Buffer.from(PROSE)), /Unsupported file type/);
  });
});

describe('reactiveResumeFromBytes — a Reactive Resume export picked as a file', () => {
  const fixture = (name: string): Buffer => readFileSync(join(__dirname, 'fixtures', 'reactive-resume', `${name}.json`));
  const failure = (bytes: Buffer): string => {
    try {
      reactiveResumeFromBytes(bytes);
    } catch (err) {
      assert.ok(err instanceof ResumeTextError);
      return err.failure;
    }
    return assert.fail('was read instead of refused');
  };

  it('reads all three generations', () => {
    for (const name of ['v4', 'v5', 'v6']) assert.ok(reactiveResumeFromBytes(fixture(name)).text.length > 200, name);
  });

  it('keeps the profile addresses in the header, where the file upload and the pull both read them', () => {
    assert.match(reactiveResumeFromBytes(fixture('v6')).text, /Austin, TX · https:\/\/alex\.example\.com · https:\/\/github\.com\/arivera · /);
  });

  it('survives a byte-order mark', () => {
    assert.match(reactiveResumeFromBytes(Buffer.concat([Buffer.from('﻿'), fixture('v6')])).text, /Alex Rivera/);
  });

  it('refuses what is not JSON, not an export, empty, or too short, each with its own reason', () => {
    assert.equal(failure(Buffer.from('{ nope')), 'badJson');
    assert.equal(failure(fixture('not-rr')), 'notReactiveResume');
    assert.equal(failure(Buffer.from('{"basics":{},"sections":{}}')), 'reactiveEmpty');
    assert.equal(failure(Buffer.from('{"basics":{"name":"A"},"summary":{"content":"<p>Hi there</p>"},"sections":{}}')), 'tooShort');
  });
});

describe('markdownResume', () => {
  it('stores the text as a .md file under a name a file system accepts', () => {
    const r = markdownResume('A/B: "C"?', 'body');
    assert.deepEqual([r.sourceFilename, r.mimeType, r.original.toString('utf8'), r.text], ['A B C.md', 'text/markdown', 'body', 'body']);
  });

  it('falls back to a default name', () => {
    assert.equal(markdownResume('  ', 'x').sourceFilename, 'Resume.md');
  });
});

describe('reactiveResumeText — a pull remembers the format it read (ADR 0079)', () => {
  const data = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', 'reactive-resume', `${name}.json`), 'utf8'));

  it('says which generation the text came from', () => {
    assert.equal(reactiveResumeText(data('v6')).generation, 'v6');
    assert.equal(reactiveResumeText(data('v5')).generation, 'v5');
    assert.equal(reactiveResumeText(data('v4')).generation, 'v4');
  });
});
