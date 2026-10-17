import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionsText,
  buildCondensePrompt,
  buildRemovalsPrompt,
  condensePanel,
  cutsStillApplicable,
  cutsWanted,
  parseCutsResponse,
  parseWordsResponse,
  readCondense,
  readCondenseStage,
  shorterOnly,
  withCondenseStage,
  wordsToActions,
} from './condense';
import { CHARS_PER_PAGE, CUTS_DEFAULT, CUTS_MAX, lengthPlan } from './length';
import { fenceOpen } from '../prompt-fence';

const JOB = { title: 'Backend Engineer', companyName: 'Acme', location: 'Remote', description: 'Node.js and Postgres.' };
const KEYWORDS = [
  { term: 'Node.js', requirement: 'must' as const, primary: true, status: 'present' as const },
  { term: 'Docker', requirement: 'preferred' as const, primary: false, status: 'add' as const },
];

test('stage marker: absent reads none, the two steps round-trip, other keys survive', () => {
  assert.equal(readCondenseStage(undefined), 'none');
  assert.equal(readCondenseStage({}), 'none');
  assert.equal(readCondenseStage({ condense: 'nonsense' }), 'none');
  const a = withCondenseStage({ mode: 'full', pages: 2 }, 'removals');
  assert.deepEqual(a, { mode: 'full', pages: 2, condense: 'removals' });
  assert.equal(readCondenseStage(a), 'removals');
  assert.equal(readCondenseStage(withCondenseStage(a, 'rewrites')), 'rewrites');
  assert.deepEqual(withCondenseStage('garbage', 'removals'), { condense: 'removals' });
});

test('stored wording: {} and garbage read as nothing', () => {
  const none = { rewrites: [], from: '', actionsOn: '' };
  assert.deepEqual(readCondense({}), none);
  assert.deepEqual(readCondense('x'), none);
  assert.deepEqual(readCondense(null), none);
  assert.equal(readCondense({ actionsOn: 'condensed' }).actionsOn, 'condensed');
});

test('the text actions quote: the refresh text once there is one, else the first comparison text', () => {
  assert.equal(actionsText({ resumeText: 'orig', condense: {} }), 'orig');
  assert.equal(actionsText({ resumeText: 'orig', condense: { actionsOn: 'short' } }), 'short');
});

test('cuts wanted: the default with no target or when met, growing with the overshoot otherwise', () => {
  assert.equal(cutsWanted(lengthPlan('x'.repeat(CHARS_PER_PAGE * 4), 'keep')), CUTS_DEFAULT);
  assert.equal(cutsWanted(lengthPlan('x'.repeat(CHARS_PER_PAGE), 2)), CUTS_DEFAULT);
  const over = lengthPlan('x'.repeat(CHARS_PER_PAGE * 3), 1);
  assert.ok(cutsWanted(over) > CUTS_DEFAULT && cutsWanted(over) <= CUTS_MAX);
});

test('panel: open when over the target or when a step has results, collapsed otherwise', () => {
  const over = lengthPlan('x'.repeat(CHARS_PER_PAGE * 2), 1);
  const met = lengthPlan('x'.repeat(CHARS_PER_PAGE), 2);
  const keep = lengthPlan('x'.repeat(CHARS_PER_PAGE * 5), 'keep');
  assert.equal(condensePanel(over, 'none').open, true);
  assert.equal(condensePanel(met, 'none').open, false);
  assert.equal(condensePanel(keep, 'none').open, false);
  assert.equal(condensePanel(met, 'removals').open, true);
});

test('cuts reply: up to as many removals as the budget may ask for parses; more does not', () => {
  const cut = (i: number) => ({ section: 'experience', where: `role ${i}`, what: 'older bullet', why: 'not relevant', quote: `bullet ${i}` });
  const ok = parseCutsResponse(JSON.stringify({ removals: Array.from({ length: CUTS_MAX }, (_, i) => cut(i)) }));
  assert.equal(ok.ok, true);
  const tooMany = parseCutsResponse(JSON.stringify({ removals: Array.from({ length: CUTS_MAX + 1 }, (_, i) => cut(i)) }));
  assert.equal(tooMany.ok, false);
  assert.equal(parseCutsResponse('{}').ok, true);
});

test('cuts prompt: removals rules protect the contact line and wanted keywords', () => {
  const { system } = buildRemovalsPrompt('resume', JOB, { keywords: KEYWORDS, length: lengthPlan('resume', 'keep') });
  assert.match(system, /never remove the contact line/);
  assert.match(system, /email, phone/);
  assert.match(system, /KEEP WANTED KEYWORDS/);
  assert.match(system, /"present" or "add" for THIS posting/);
  assert.match(system, /which items to drop and which to keep/);
  assert.match(system, /"removals"/);
});

test('cuts prompt: outside text is fenced and the keyword verdicts come with it', () => {
  const { user } = buildRemovalsPrompt('MY RESUME TEXT', JOB, { keywords: KEYWORDS, length: lengthPlan('x', 'keep') });
  assert.ok(user.includes(fenceOpen('RESUME')));
  assert.ok(user.includes(fenceOpen('JOB POSTING')));
  assert.ok(user.includes(fenceOpen('KEYWORD VERDICTS')));
  assert.match(user, /Node\.js \| must \| primary \| present/);
  assert.match(user, /Docker \| preferred \| add/);
});

test('cuts prompt: a target not yet met is stated with the number of cuts allowed; none states the default', () => {
  const over = lengthPlan('x'.repeat(CHARS_PER_PAGE * 3), 1);
  const asked = buildRemovalsPrompt('resume', JOB, { keywords: KEYWORDS, length: over }).user;
  assert.match(asked, /LENGTH TARGET/);
  assert.match(asked, new RegExp(`up to ${cutsWanted(over)} removals`));
  const none = buildRemovalsPrompt('resume', JOB, { keywords: KEYWORDS, length: lengthPlan('resume', 'keep') }).user;
  assert.doesNotMatch(none, /LENGTH TARGET/);
  assert.match(none, new RegExp(`up to ${CUTS_DEFAULT} removals`));
});

test('wording prompt: asks for shorter text only, fences the text, keeps keywords and numbers', () => {
  const { system, user } = buildCondensePrompt('THE TEXT NOW', JOB, { keywords: KEYWORDS, length: lengthPlan('THE TEXT NOW', 'keep') });
  assert.match(system, /STRICTLY SHORTER/);
  assert.match(system, /number|figure/i);
  assert.match(system, /"rewrites"/);
  assert.ok(user.includes(fenceOpen('RESUME')));
  assert.ok(user.includes(fenceOpen('KEYWORD VERDICTS')));
});

test('wording reply parses and maps to change actions', () => {
  const parsed = parseWordsResponse(
    JSON.stringify({ rewrites: [{ section: 'experience', where: 'Acme, bullet 2', what: 'Shorten', why: 'Same fact, fewer words', quote: 'Was responsible for the development of APIs', replacement: 'Built APIs' }] }),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const [action] = wordsToActions(parsed.data.rewrites);
  assert.equal(action?.priority, 'medium');
  assert.equal(action?.insert_after, null);
  assert.equal(action?.quote, 'Was responsible for the development of APIs');
  assert.equal(action?.replacement, 'Built APIs');
  assert.equal(parseWordsResponse(JSON.stringify({ rewrites: [{ section: 'experience', where: 'x', what: 'y', why: 'z', quote: '', replacement: 'a' }] })).ok, false);
});

test('shorter only: a replacement as long as or longer than its quote is dropped, the rest stay', () => {
  const mk = (quote: string, replacement: string) => ({
    section: 'experience' as const, where: 'w', what: 'x', why: 'y', priority: 'medium' as const, quote, replacement, insert_after: null,
  });
  const out = shorterOnly([mk('aaaa bbbb cccc', 'aaaa bbbb'), mk('same', 'same'), mk('short', 'a much longer replacement')]);
  assert.equal(out.actions.length, 1);
  assert.equal(out.actions[0]?.replacement, 'aaaa bbbb');
  assert.equal(out.dropped, 2);
});

test('cutsStillApplicable: keeps the cuts whose quote is still in the text, drops accepted and unquoted ones', () => {
  const cut = (quote: string | null) => ({ section: 'skills' as const, where: 'Skills', what: 'drop', why: 'unused', quote });
  const text = 'Skills: PHP, Laravel\nExperience: built things';
  const kept = cutsStillApplicable([cut('Laravel'), cut('Cobol'), cut(null), cut('  ')], text);
  assert.deepEqual(kept.map((r) => r.quote), ['Laravel'], 'Cobol was accepted (gone from the text)');
});
