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
  assert.ok(markdown.includes('GitHub: arivera'));
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
  assert.ok(markdown.includes('Line one & bold <3 a link\n\nLine two\n\n- First\n- Second'));
  assert.ok(!/<\/?[a-z]/i.test(markdown));
  assert.ok(!markdown.includes('&amp;'));
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
