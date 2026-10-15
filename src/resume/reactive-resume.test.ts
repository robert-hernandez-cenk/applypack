import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReactiveResume } from './reactive-resume';

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
  assert.equal(lines[0], '# Alex Rivera');
  assert.ok(markdown.includes('Senior Backend Engineer'));
  assert.ok(markdown.includes('alex@example.com · +1 555 0100 · Austin, TX · https://alex.example.com'));
  assert.ok(markdown.includes('## Summary\nBackend engineer with 9 years building payment systems & APIs.\n\nLed teams'));
});

test('v6: experience carries position, company, place, dates and bullets', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('### Senior Engineer — Northwind Pay (Remote) · Mar 2022 – Present'));
  assert.ok(markdown.includes('- Cut settlement latency by 40%'));
  assert.ok(markdown.includes('- Moved 12 services to Kubernetes'));
});

test('v6: roles sit under their employer with their own dates', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('### Contoso Labs (Dallas, TX) · 2016 – 2022'));
  assert.ok(markdown.includes('#### Tech Lead · 2019 – 2022\nOwned the billing platform.'));
  assert.ok(markdown.includes('#### Engineer · 2016 – 2019'));
});

test('v6: the other visible sections are written out', () => {
  const { markdown } = read('v6');
  assert.ok(markdown.includes('## Education'));
  assert.ok(markdown.includes('### BSc in Computer Science — University of Texas (Austin, TX) · 2008 – 2012'));
  assert.ok(markdown.includes('Languages: TypeScript, Go, SQL'));
  assert.ok(markdown.includes('Infrastructure: Kubernetes, PostgreSQL'));
  assert.ok(markdown.includes('### ledger-kit · 2021'));
  assert.ok(markdown.includes('English — Native'));
  assert.ok(markdown.includes('### CKA — CNCF · Jun 2023'));
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
  assert.ok(markdown.includes('### Platform Engineer — Adatum (Berlin) · 2021 - Present'));
  assert.ok(markdown.includes('- Cut build time from 25 to 8 minutes'));
  assert.ok(markdown.includes('Tooling: Bazel, GitHub Actions, Rust'));
});

test('v4: summary lives in its section, visible flags and date strings are honoured', () => {
  const { markdown, name } = read('v4');
  assert.equal(name, 'Mina Okafor');
  assert.ok(markdown.includes('## Summary\nAnalyst who turns messy data into decisions.'));
  assert.ok(markdown.includes('### Data Analyst — Fabrikam (Lagos) · Jan 2020 - Present'));
  assert.ok(markdown.includes('Analytics: SQL, Looker, Python'));
  assert.ok(markdown.includes('### BSc in Statistics — University of Lagos · 2015 - 2019'));
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
  assert.ok(read('hidden-and-html').markdown.includes('### Engineer — Tailspin · Summer 2019'));
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
  assert.ok(!/^#{3,4} (·|\d)/m.test(got.markdown), 'a heading of dates alone');
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
