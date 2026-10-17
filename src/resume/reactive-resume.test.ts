import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReactiveResume, readReactiveResumeMapped } from './reactive-resume';
import { structureFromText } from './structure-from-text';
import { parsedView } from '../web/parsed-view';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'reactive-resume', `${name}.json`), 'utf8'));

function read(name: string) {
  const got = readReactiveResume(fixture(name));
  assert.ok(got.ok, `${name} should be read`);
  return got;
}

test('each generation is told from the shape of the file', () => {
  assert.equal(read('v6').generation, 'v6');
  assert.equal(read('v5').generation, 'v5');
  assert.equal(read('v4').generation, 'v4');
});

test('v6: header, summary and contact line come first', () => {
  const { name, markdown } = read('v6');
  assert.equal(name, 'Alex Rivera');
  const lines = markdown.split('\n');
  assert.equal(lines[0], 'Alex Rivera');
  assert.equal(lines[1], 'Senior Backend Engineer');
  assert.ok(markdown.includes('alex@example.com · +1 555 0100 · Austin, TX · https://alex.example.com'));
  assert.ok(markdown.includes('## Summary\nBackend engineer with 9 years building payment systems & APIs.\n\nLed teams'));
});

test('v6: experience carries position, company, place, dates and bullets', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('Northwind Pay · Remote\nSenior Engineer · Mar 2022 – Present\n- Cut settlement latency by 40%'));
  assert.ok(markdown.includes('- Moved 12 services to Kubernetes'));
});

test('v6: roles sit under their employer with their own dates', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('Contoso Labs · Dallas, TX\nTech Lead · 2019 – 2022\n- Owned the billing platform.'));
  assert.ok(markdown.includes('Contoso Labs · Dallas, TX\nEngineer · 2016 – 2019'));
  // The employer's own dates are not a role: each position carries its own.
  assert.ok(!markdown.includes('2016 – 2022'));
});

test('v6: the other visible sections are written out', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('## Education'));
  assert.ok(markdown.includes('University of Texas · BSc in Computer Science · Austin, TX · 2008 – 2012'));
  assert.ok(markdown.includes('Languages: TypeScript, Go, SQL'));
  assert.ok(markdown.includes('Infrastructure: Kubernetes, PostgreSQL'));
  assert.ok(markdown.includes('ledger-kit · 2021\nOpen-source double-entry library.'));
  assert.ok(markdown.includes('English (Native)\nSpanish (Professional)'));
  assert.ok(markdown.includes('CKA — CNCF · Jun 2023'));
  assert.ok(markdown.includes('https://github.com/arivera'));
});

/** The contact line: the third line, under the name and the headline. */
const contactOf = (markdown: string): string => markdown.split('\n')[2] ?? '';

test('profile addresses are written into the header, after the website, in the export order', () => {
  assert.equal(
    contactOf(read('v6').markdown),
    'alex@example.com · +1 555 0100 · Austin, TX · https://alex.example.com · https://github.com/arivera · https://www.linkedin.com/in/alex-rivera',
  );
  assert.equal(
    contactOf(read('v5').markdown),
    'jonas@example.com · +49 30 5550100 · Berlin, Germany · https://jonas.example.com · https://gitlab.com/jweber · Mastodon: @jonas',
  );
  assert.equal(
    contactOf(read('v4').markdown),
    'mina@example.com · Lagos, Nigeria · https://mina.example.com · https://www.linkedin.com/in/mina-o',
  );
});

test('no generation writes a trailing Profiles section', () => {
  for (const name of ['v4', 'v5', 'v6']) assert.ok(!read(name).markdown.includes('## Profiles'), name);
});

test('a profile with an address is the address alone, with or without a username', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: { profiles: { items: [{ network: 'GitHub', username: 'ann', website: { url: 'https://github.com/ann' } }, { website: { url: 'https://ann.example/x' } }] } },
  });
  assert.ok(got.ok);
  assert.equal(contactOf(got.markdown), 'ann@example.com · https://github.com/ann · https://ann.example/x');
});

test('a profile with a username and no address is Network: username; a bare network adds nothing', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: { profiles: { items: [{ network: 'Mastodon', username: '@ann' }, { username: 'ann-bare' }, { network: 'Orphan' }, {}] } },
  });
  assert.ok(got.ok);
  assert.equal(contactOf(got.markdown), 'ann@example.com · Mastodon: @ann · ann-bare');
});

test('a hidden profile, a hidden profiles section and a not-visible one write nothing', () => {
  const item = { network: 'Ghostnet', username: 'ghost', website: { url: 'https://ghost.example/h' } };
  const base = { basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com' }, summary: { content: '<p>Summary text of some length</p>' } };
  for (const sections of [
    { profiles: { items: [{ ...item, hidden: true }] } },
    { profiles: { items: [{ ...item, visible: false }] } },
    { profiles: { hidden: true, items: [item] } },
    { profiles: { visible: false, items: [item] } },
  ]) {
    const got = readReactiveResume({ ...base, sections });
    assert.ok(got.ok);
    assert.equal(contactOf(got.markdown), 'ann@example.com');
    assert.ok(!got.markdown.includes('ghost'));
  }
  assert.ok(!read('v6').markdown.includes('ghost'));
  assert.ok(!read('v4').markdown.includes('ghostmina'));
});

test('an address the website already gave is shown once', () => {
  const line = contactOf(read('v6').markdown);
  assert.equal(line.split('https://alex.example.com').length - 1, 1);
});

test('a resume with no profiles keeps the header it always had', () => {
  const data = fixture('v5') as { sections: Record<string, unknown> };
  delete data.sections.profiles;
  const got = readReactiveResume(data);
  assert.ok(got.ok);
  assert.equal(contactOf(got.markdown), 'jonas@example.com · +49 30 5550100 · Berlin, Germany · https://jonas.example.com');
});

test('an export holding only a profile is empty, as one holding only an email already is', () => {
  const only = { basics: { name: 'Ann' }, sections: { profiles: { items: [{ network: 'GitHub', website: { url: 'https://github.com/ann' } }] } } };
  assert.deepEqual(readReactiveResume(only), { ok: false, code: 'empty' });
  assert.deepEqual(readReactiveResume({ basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com' }, sections: {} }), { ok: false, code: 'empty' });
});

test('hidden sections and hidden items never appear', () => {
  for (const name of ['v6', 'hidden-and-html']) {
    const { markdown } = read(name);
    for (const ghost of ['Hidden Corp', 'Secret Role', 'Should never appear', 'Hidden Section Award', 'Wingtip', 'Hidden skill', 'Nope']) {
      assert.ok(!markdown.includes(ghost), `${name} leaks ${ghost}`);
    }
  }
});

test('picture, template and design settings are not read', () => {
  const { markdown } = read('v6');
  for (const noise of ['azurill', 'me.png', 'proficiency', 'Expert']) assert.ok(!markdown.includes(noise), noise);
});

test('v5: period strings are kept as written', () => {
  const { markdown } = read('v5');
  assert.ok(markdown.includes('Adatum · Berlin\nPlatform Engineer · 2021 - Present'));
  assert.ok(markdown.includes('- Cut build time from 25 to 8 minutes'));
  assert.ok(markdown.includes('Tooling: Bazel, GitHub Actions, Rust'));
});

test('v4: summary lives in its section, visible flags and date strings are honoured', () => {
  const { markdown, name } = read('v4');
  assert.equal(name, 'Mina Okafor');
  assert.ok(markdown.includes('## Summary\nAnalyst who turns messy data into decisions.'));
  assert.ok(markdown.includes('Fabrikam · Lagos\nData Analyst · Jan 2020 - Present'));
  assert.ok(markdown.includes('Analytics: SQL, Looker, Python'));
  assert.ok(markdown.includes('University of Lagos · BSc in Statistics · 2015 - 2019'));
  assert.ok(markdown.includes('https://mina.example.com'));
});

test('v4: an item marked not visible is dropped', () => {
  const data = fixture('v4') as { sections: { experience: { items: unknown[] } } };
  data.sections.experience.items.push({ id: 'x', visible: false, company: 'Ghost Co', position: 'Phantom' });
  const got = readReactiveResume(data);
  assert.ok(got.ok);
  assert.ok(!got.markdown.includes('Ghost Co'));
});

test('formatted text keeps paragraphs and lists and loses its markup and entities', () => {
  const { markdown } = read('hidden-and-html');
  assert.ok(markdown.includes('Line one & bold <3 a link (https://example.com)\n\nLine two\n\n- First\n- Second'));
  assert.ok(!/<\/?[a-z]/i.test(markdown));
  assert.ok(!markdown.includes('&amp;'));
});

/** A summary of formatted text, read back as the text it was written out to. */
function summaryText(html: string): string {
  const got = readReactiveResume({ basics: { name: 'Ann' }, summary: { content: html }, sections: {} });
  assert.ok(got.ok);
  return got.markdown.split('## Summary\n')[1] ?? '';
}

test('a link keeps its address next to its words', () => {
  assert.equal(summaryText('<p>Read <a href="https://x.example/p">the post</a> now</p>'), 'Read the post (https://x.example/p) now');
  assert.equal(summaryText('<p><a href="mailto:a@b.example">write</a></p>'), 'write (mailto:a@b.example)');
  assert.equal(summaryText('<p><a href="HTTPS://X.example/Q">go</a></p>'), 'go (HTTPS://X.example/Q)');
});

test('a link whose words are empty or are the address says the address once', () => {
  assert.equal(summaryText('<p><a href="https://x.example/p">https://x.example/p</a></p>'), 'https://x.example/p');
  assert.equal(summaryText('<p>See <a href="https://x.example/p"></a></p>'), 'See https://x.example/p');
  assert.equal(summaryText('<p><a href="https://x.example/?a=1&amp;b=2">https://x.example/?a=1&amp;b=2</a></p>'), 'https://x.example/?a=1&b=2');
});

test('a target that is not a web or mail address is dropped and the words stay', () => {
  for (const href of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html;base64,AAAA', '/relative/path', '//evil.example/x', '#top', '']) {
    assert.equal(summaryText(`<p>Go <a href="${href}">there</a></p>`), 'Go there', JSON.stringify(href));
  }
  assert.equal(summaryText('<p><a>no target</a> and <a name="x">an anchor</a></p>'), 'no target and an anchor');
});

test('single-quoted and unquoted targets are read; tags inside the words are not kept', () => {
  assert.equal(summaryText("<p><a href='https://x.example/s'>single</a></p>"), 'single (https://x.example/s)');
  assert.equal(summaryText('<p><a href=https://x.example/u>bare</a></p>'), 'bare (https://x.example/u)');
  assert.equal(summaryText('<p><a target="_blank" href="https://x.example/t" rel="noopener"><strong>bold</strong> link</a></p>'), 'bold link (https://x.example/t)');
});

test('entities in a target are decoded once, never twice', () => {
  assert.equal(summaryText('<p><a href="https://x.example/?a=1&amp;b=2">q</a></p>'), 'q (https://x.example/?a=1&b=2)');
  assert.equal(summaryText('<p><a href="https://x.example/?a=&amp;lt;">q</a></p>'), 'q (https://x.example/?a=&lt;)');
});

test('a link spread wider than the look-ahead window is left as its words', () => {
  const words = 'w'.repeat(2_100);
  assert.equal(summaryText(`<p><a href="https://x.example/w">${words}</a></p>`), words);
});

test('a link inside a list item or a custom section keeps its address', () => {
  assert.equal(summaryText('<ul><li><p>See <a href="https://x.example/d">docs</a></p></li></ul>'), '- See docs (https://x.example/d)');
  const got = readReactiveResume({
    basics: { name: 'Ann' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: {},
    customSections: [{ title: 'Extras', content: '<p><a href="https://x.example/c">site</a></p>' }],
  });
  assert.ok(got.ok);
  assert.ok(got.markdown.includes('## Extras\nsite (https://x.example/c)'));
});

test('markup that never closes is read in linear time and leaves the real text alone', () => {
  const real = '<p>Real text here</p>';
  for (const junk of [
    '<a '.repeat(100_000),
    '<a href="'.repeat(100_000),
    '<a href="https://x.example/p">'.repeat(20_000) + '</a>',
  ]) {
    const started = performance.now();
    const got = readReactiveResume({ basics: { name: 'Ann' }, summary: { content: real + junk }, sections: {} });
    const ms = performance.now() - started;
    assert.ok(got.ok);
    assert.ok(got.markdown.includes('Real text here'));
    assert.ok(ms < 1_000, `${junk.slice(0, 12)} took ${Math.round(ms)} ms`);
  }
});

test('a date Reactive Resume kept only as written stays as written', () => {
  assert.ok(read('hidden-and-html').markdown.includes('Tailspin\nEngineer · Summer 2019'));
});

test('a custom section is kept as plain text', () => {
  const { markdown } = read('hidden-and-html');
  assert.ok(markdown.includes('## Cover letter\nDear team\nI would like to apply.'));
});

test('a JSON Resume file is not a Reactive Resume export', () => {
  assert.deepEqual(readReactiveResume(fixture('not-rr')), { ok: false, code: 'notReactiveResume' });
});

test('junk never throws', () => {
  for (const junk of [null, undefined, 3, 'text', [], [1], {}, { basics: 1, sections: 2 }]) {
    assert.deepEqual(readReactiveResume(junk), { ok: false, code: 'notReactiveResume' });
  }
});

test('an export with nothing visible is empty', () => {
  const got = readReactiveResume({ basics: { name: '' }, summary: { content: '' }, sections: {} });
  assert.deepEqual(got, { ok: false, code: 'empty' });
});

test('a missing name falls back to an empty one for the caller to fill', () => {
  const got = readReactiveResume({ basics: {}, summary: { content: '<p>Hello there</p>' }, sections: {} });
  assert.ok(got.ok);
  assert.equal(got.name, '');
  assert.ok(got.markdown.startsWith('## Summary'));
});

test('an item that names nothing leaves no bare heading behind', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: {
      experience: { items: [{ company: '', position: '', dates: { start: '2020', end: null, present: true }, description: '<p>Did a thing</p>' }] },
      projects: { items: [{ name: '', description: '' }] },
    },
  });
  assert.ok(got.ok);
  assert.ok(!/^#+\s*$/m.test(got.markdown), 'a bare heading');
  assert.ok(!/^(·\s*)?\d{4}/m.test(got.markdown), 'a line of dates alone');
  assert.ok(got.markdown.includes('Did a thing'));
  assert.ok(!got.markdown.includes('## Projects'), 'a section with nothing in it');
});

test('an empty field does not hide the one it falls back to', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann', website: { url: '', label: '' }, url: { href: 'https://ann.example.com' } },
    summary: { content: '<p>Summary</p>' },
    sections: {},
    customSections: [{ title: 'Extras', items: [{ name: '', title: 'Chess club', description: '', summary: '<p>Captain</p>' }] }],
  });
  assert.ok(got.ok);
  assert.ok(got.markdown.includes('https://ann.example.com'));
  assert.ok(got.markdown.includes('## Extras\nChess club\nCaptain'));
});

test('v4 custom sections are read from sections.custom', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann' },
    sections: {
      summary: { content: '<p>Summary</p>', visible: true },
      custom: { abc: { name: 'Achievements', visible: true, items: [{ name: 'Won the hackathon', summary: '<p>First place</p>', visible: true }, { name: 'Hidden', visible: false }] } },
    },
  });
  assert.ok(got.ok);
  assert.ok(got.markdown.includes('## Achievements\nWon the hackathon\nFirst place'));
  assert.ok(!got.markdown.includes('Hidden'));
});

test('a contact field is its link when it has one, its words when it has not', () => {
  const line = contactOf(read('v6-live-shape').markdown);
  assert.equal(
    line,
    'dana@example.com · (555) 010-4477 · Springfield, NC · https://www.linkedin.com/in/dana-whitfield · https://github.com/dana-whitfield · Authorized to work in the US',
  );
  assert.ok(!/LinkedIn|Github/.test(line), 'the words a link was labelled with');
  assert.ok(!line.includes('Portfolio'), 'a website label with no address says nothing');
});

test('no line begins with # except a ## section heading', () => {
  for (const name of ['v4', 'v5', 'v6', 'v6-live-shape', 'hidden-and-html']) {
    for (const line of read(name).markdown.split('\n')) {
      assert.ok(!/^\s*#/.test(line) || /^## \S/.test(line), `${name}: ${line}`);
    }
  }
});

test('a job is a company line, then a position line with its dates, then its text', () => {
  const { markdown } = read('v6-live-shape');
  assert.ok(
    markdown.includes(
      'Brightwave Labs\nStaff Platform Engineer – Applied Automation · Dec 2025 – Sep 2026\nProduct Engineering\n\n- Owned the discovery component',
    ),
  );
  assert.ok(markdown.includes('Quillmark, Inc\nSoftware Engineer · Feb 2015 – May 2015\n- Built web applications'));
  assert.ok(markdown.includes('## Professional Experience\nBrightwave Labs\n'));
});

test('a position with no company and no dates, or dates and no position, is still read', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann', headline: 'Engineer' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: {
      experience: {
        items: [
          { company: 'Acme', position: '', dates: { start: '2020', end: '2022', present: false }, description: '<ul><li>Built a thing</li></ul>' },
          { company: '', position: 'Consultant', description: '<ul><li>Advised teams</li></ul>' },
        ],
      },
    },
  });
  assert.ok(got.ok);
  assert.ok(got.markdown.includes('Acme\n2020 – 2022\n- Built a thing'));
  assert.ok(got.markdown.includes('Consultant\n- Advised teams'));
});

test('education, certificates and the rest are plain lines; a language carries its fluency in brackets', () => {
  const { markdown } = read('v6-live-shape');
  assert.ok(markdown.includes('## Education\nRidgemont State University · B.S. in Computer Science · Raleigh, NC · 2006\n'));
  assert.ok(markdown.includes('Ridgemont State University · B.S. in Electrical Engineering · Raleigh, NC · 2007'));
  assert.ok(read('v6').markdown.includes('English (Native)'));
});

test('the plain reader finds the name, every contact, the jobs, the degrees and the skills groups', () => {
  const text = read('v6-live-shape').markdown;
  const r = structureFromText(text);
  assert.equal(r.basics.name, 'Dana Whitfield');
  assert.equal(r.basics.label, 'Platform Engineering Leader');
  assert.equal(r.basics.email, 'dana@example.com');
  assert.equal(r.basics.phone, '(555) 010-4477');
  assert.equal(r.basics.location, 'Springfield, NC');
  assert.equal(r.basics.url, 'https://www.linkedin.com/in/dana-whitfield');
  assert.deepEqual(r.basics.profiles, ['https://github.com/dana-whitfield']);
  assert.deepEqual(r.basics.lines, ['Authorized to work in the US']);
  assert.ok(r.basics.summary?.startsWith('Platform engineering leader with 20 years'));
  // Six employers; the two that write their positions as bold paragraphs read as two roles each, as in a .docx.
  assert.deepEqual(
    r.work.filter((w) => w.name).map((w) => w.name),
    ['Brightwave Labs', 'Harborline', 'Northgate', 'Quillmark, Inc', 'Tessera Systems, LLC', 'Ridgeline Inc. (RLI)'],
  );
  assert.equal(r.work.length, 8);
  const first = r.work[0]!;
  assert.deepEqual(
    [first.position, first.startDate, first.endDate, first.summary, first.highlights.length],
    ['Staff Platform Engineer – Applied Automation', 'Dec 2025', 'Sep 2026', 'Product Engineering', 3],
  );
  assert.equal(r.education.length, 3);
  assert.deepEqual([...new Set(r.education.map((e) => e.institution))], ['Ridgemont State University']);
  assert.equal(r.skills.length, 10);
  assert.deepEqual(r.skills[0], { name: 'Applied AI & Agentic Engineering', keywords: ['Claude Code', 'Cursor', 'On-device AI'] });
  // Nothing of the resume became a section heading of its own.
  assert.deepEqual(r.extras, []);
});

test('the page panel that says what a parser reads finds every contact', () => {
  for (const name of ['v4', 'v5', 'v6', 'v6-live-shape']) {
    const view = parsedView(read(name).markdown);
    assert.ok(view.name, `${name}: name`);
    assert.ok(view.headline, `${name}: headline`);
    // A section in the file's own words ("Certifications") is the reader's business; a name or a job line is not a section.
    assert.ok(!view.sections.some((s) => s === view.name || s.includes(' · ')), `${name}: a role or a name read as a section: ${view.sections.join(' | ')}`);
    const found = view.contacts.filter((c) => c.value).map((c) => c.kind);
    assert.ok(found.includes('email') && found.includes('link') && found.includes('location'), `${name}: ${found.join()}`);
  }
  const live = parsedView(read('v6-live-shape').markdown);
  assert.deepEqual(live.contacts.map((c) => c.kind + ':' + (c.value ? 'yes' : 'no')), ['email:yes', 'phone:yes', 'link:yes', 'location:yes']);
  assert.equal(live.ownHeadings, 0);
  assert.deepEqual(live.sections, ['Summary', 'Skills (10 groups)', 'Experience (8 roles)', 'Education']);
});

/** A one-section export, read back with the plain reader. */
function sectionOf(key: string, title: string, items: unknown[]) {
  const got = readReactiveResume({
    basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com' },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: { [key]: { title, items } },
  });
  assert.ok(got.ok);
  return { markdown: got.markdown, read: structureFromText(got.markdown) };
}

test('a section title the reader would not take for a heading is made one, never left as content', () => {
  const { markdown, read: r } = sectionOf('publications', 'Publications, Talks, and Patents', [{ title: 'A paper', publisher: 'Journal' }]);
  assert.ok(markdown.includes('## Publications; Talks; and Patents\n'));
  assert.deepEqual(r.extras.map((e) => e.heading), ['Publications; Talks; and Patents']);
  const long = sectionOf('publications', 'P'.repeat(90), [{ title: 'A paper', publisher: 'Journal' }]).markdown;
  assert.ok(long.split('\n').every((l) => !l.startsWith('## ') || l.length <= 83), 'a heading past the reader\'s limit');
  assert.equal(sectionOf('publications', 'Publications and Talks', [{ title: 'A paper' }]).markdown.includes('## Publications and Talks\n'), true);
});

test('a job described in plain paragraphs is bulleted, so the next job starts where it should', () => {
  const { markdown, read: r } = sectionOf('experience', 'Experience', [
    { company: 'Acme', position: 'Engineer', dates: { start: '2020-01', end: '2021-01', present: false }, description: '<p>Built things.</p>' },
    { company: 'Globex', position: 'Lead', dates: { start: '2021-02', end: '2022-02', present: false }, description: '<p>Led things.</p>' },
  ]);
  assert.ok(markdown.includes('Acme\nEngineer · Jan 2020 – Jan 2021\n- Built things.\nGlobex\nLead · Feb 2021 – Feb 2022\n- Led things.'));
  assert.deepEqual(r.work.map((w) => [w.name, w.position, w.highlights]), [['Acme', 'Engineer', ['Built things.']], ['Globex', 'Lead', ['Led things.']]]);
});

test('a description that already has a list keeps its paragraphs as written', () => {
  const { markdown } = sectionOf('experience', 'Experience', [
    { company: 'Acme', position: 'Engineer', description: '<p>Platform team</p><ul><li><p>Built things.</p></li></ul>' },
  ]);
  assert.ok(markdown.includes('Acme\nEngineer\nPlatform team\n\n- Built things.'));
});

test('volunteering is written like a job, so it reads the same under either section name', () => {
  const { markdown, read: r } = sectionOf('volunteer', 'Volunteer Experience', [
    { organization: 'Red Cross', location: 'Rome', position: 'Helper', dates: { start: '2019', end: '2020', present: false }, description: '<p>Helped.</p>' },
  ]);
  assert.ok(markdown.includes('Red Cross · Rome\nHelper · 2019 – 2020\n- Helped.'));
  assert.deepEqual(r.work.map((w) => [w.name, w.location, w.position, w.startDate, w.endDate]), [['Red Cross', 'Rome', 'Helper', '2019', '2020']]);
});

test('a v4 contact field keeps its value, with its name when it has one', () => {
  const got = readReactiveResume({
    basics: { name: 'Ann', headline: 'Engineer', email: 'ann@example.com', customFields: [{ name: 'Visa', value: 'H1B' }, { value: 'Remote only' }, { name: 'Empty', value: '' }] },
    summary: { content: '<p>Summary text of some length</p>' },
    sections: {},
  });
  assert.ok(got.ok);
  assert.equal(contactOf(got.markdown), 'ann@example.com · Visa: H1B · Remote only');
});

test('a mail link whose words are the address says the address once, without the scheme', () => {
  assert.equal(summaryText('<p><a href="mailto:a@b.example">a@b.example</a></p>'), 'a@b.example');
});

test('a position in capitals with year-only dates is read as a job by the plain reader', () => {
  const { read: r } = sectionOf('experience', 'Experience', [
    { company: 'Acme', position: 'CTO', dates: { start: '2020', end: '2021', present: false }, description: '<ul><li>Built.</li></ul>' },
    { company: 'Globex', position: 'VP', dates: { start: '2018', end: '2019', present: false }, description: '<ul><li>Ran.</li></ul>' },
  ]);
  assert.deepEqual(r.extras, []);
  assert.deepEqual(r.work.map((w) => [w.name, w.position, w.startDate, w.endDate]), [['Acme', 'CTO', '2020', '2021'], ['Globex', 'VP', '2018', '2019']]);
});

test('an education line with a date range in the middle of it reads as school, degree and dates', () => {
  const { read: r } = sectionOf('education', 'Education', [
    { school: 'MIT', degree: 'BSc', area: 'CS', location: 'Boston, MA', dates: { start: '2010', end: '2014', present: false } },
  ]);
  assert.deepEqual(r.education.map((e) => [e.institution, e.area, e.startDate, e.endDate]), [['MIT', 'BSc in CS · Boston, MA', '2010', '2014']]);
});

/* ---------- provenance: which field each line came from (#50, ADR 0079) ---------- */

const liveData = (): unknown => (fixture('v6-live-response') as { data: unknown }).data;

function mapped(json: unknown) {
  const got = readReactiveResumeMapped(json);
  assert.ok(got.ok, 'should be read');
  return got;
}

const ALL_SHAPES: Array<[string, () => unknown]> = [
  ['v4', () => fixture('v4')],
  ['v5', () => fixture('v5')],
  ['v6', () => fixture('v6')],
  ['v6-live-shape', () => fixture('v6-live-shape')],
  ['hidden-and-html', () => fixture('hidden-and-html')],
  ['v6-live-response', liveData],
];

for (const [name, load] of ALL_SHAPES) {
  test(`mapped read of ${name}: same markdown as the plain read, one source slot per line`, () => {
    const json = load();
    const plainRead = readReactiveResume(json);
    assert.ok(plainRead.ok);
    const got = mapped(json);
    assert.equal(got.markdown, plainRead.markdown);
    assert.equal(got.generation, plainRead.generation);
    assert.equal(got.lines.length, got.markdown.split('\n').length);
    assert.ok(!got.markdown.includes('\u0001') && !got.markdown.includes('\u0002'));
  });
}

test('mapped read: a notReactiveResume file answers the same as the plain read', () => {
  assert.deepEqual(readReactiveResumeMapped(fixture('not-rr')), readReactiveResume(fixture('not-rr')));
});

test('mapped read: the headline, the summary, a job bullet and a skills line name their fields', () => {
  const got = mapped(liveData());
  const rows = got.markdown.split('\n').map((text, i) => ({ text, src: got.lines[i] }));

  const headline = rows[1];
  assert.deepEqual(headline?.src && { pointer: headline.src.pointer, kind: headline.src.kind }, { pointer: '/basics/headline', kind: 'text' });

  const summary = rows.find((r) => r.src?.pointer === '/summary/content');
  assert.ok(summary && summary.src?.kind === 'html' && summary.src.label === 'Summary');

  const job = rows.find((r) => r.src?.pointer === '/sections/experience/items/0/description');
  assert.ok(job, 'the first job text is sourced');
  assert.equal(job.src?.id, 'e1');
  assert.equal(job.src?.kind, 'html');
  assert.match(job.src?.label ?? '', /^Professional Experience · Example Org 1$/);

  const skill = rows.find((r) => r.src?.pointer === '/sections/skills/items/0/keywords');
  assert.ok(skill && skill.src?.kind === 'keywords');
  assert.match(skill.text, /^Skill group \d+: Term\d+1, Term\d+2/);
});

test('mapped read: lines assembled from several fields, headings and blank lines have no source', () => {
  const got = mapped(liveData());
  const rows = got.markdown.split('\n').map((text, i) => ({ text, src: got.lines[i] }));
  assert.equal(rows[0]?.src, null, 'the name line');
  assert.equal(rows[2]?.src, null, 'the contact line');
  for (const r of rows) {
    if (r.text === '' || r.text.startsWith('## ')) assert.equal(r.src, null, `"${r.text}"`);
  }
  // A company line and a `Position · Dates` line are made of several fields.
  const dated = rows.find((r) => / · Dec 2025 – Sep 2026$/.test(r.text));
  assert.ok(dated);
  assert.equal(dated.src, null);
});

test('mapped read: a hidden item does not shift the pointer of the one after it', () => {
  const json = {
    basics: { name: 'Pat Doe', headline: 'Engineer' },
    summary: { hidden: true, content: '' },
    sections: {
      experience: {
        items: [
          { id: 'a', hidden: true, company: 'Gone Ltd', position: 'Ghost', description: '<p>never shown</p>' },
          { id: 'b', hidden: false, company: 'Shown Ltd', position: 'Dev', dates: { start: '2020-01', present: true }, description: '<ul><li><p>Built the thing</p></li></ul>' },
        ],
      },
    },
  };
  const got = mapped(json);
  const rows = got.markdown.split('\n').map((text, i) => ({ text, src: got.lines[i] }));
  const bullet = rows.find((r) => r.text.startsWith('- Built the thing'));
  assert.equal(bullet?.src?.pointer, '/sections/experience/items/1/description');
  assert.equal(bullet?.src?.id, 'b');
});

test('mapped read: roles keep their own pointers under the employer', () => {
  const json = {
    basics: { name: 'Pat Doe' },
    summary: {},
    sections: {
      experience: {
        items: [
          {
            id: 'x', company: 'Multi Co',
            roles: [
              { id: 'r1', position: 'Junior', dates: { start: '2018-01', end: '2019-01' }, description: '<ul><li><p>First role work</p></li></ul>' },
              { id: 'r2', position: 'Senior', dates: { start: '2019-02', present: true }, description: '<ul><li><p>Second role work</p></li></ul>' },
            ],
          },
        ],
      },
    },
  };
  const got = mapped(json);
  const rows = got.markdown.split('\n').map((text, i) => ({ text, src: got.lines[i] }));
  assert.equal(rows.find((r) => r.text.includes('First role work'))?.src?.pointer, '/sections/experience/items/0/roles/0/description');
  assert.equal(rows.find((r) => r.text.includes('Second role work'))?.src?.pointer, '/sections/experience/items/0/roles/1/description');
});

test('mapped read: marker characters in the resume cannot forge a source or leak into the text', () => {
  const json = {
    basics: { name: 'Pat Doe', headline: 'Eng\u00010\u0002ineer' },
    summary: { content: '<p>Line with \u00010\u0002 marks</p>' },
    sections: { experience: { items: [{ id: 'a', company: 'Co', position: 'Dev', description: '<ul><li><p>Did \u0001999\u0002 things</p></li></ul>' }] } },
  };
  const got = mapped(json);
  assert.ok(!got.markdown.includes('\u0001') && !got.markdown.includes('\u0002'));
  assert.equal(got.lines.length, got.markdown.split('\n').length);
  assert.ok(got.lines.every((l) => l === null || l.pointer.startsWith('/')));
});
