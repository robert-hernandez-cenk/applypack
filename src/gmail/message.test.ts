import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleError } from './status';
import { alternativeMail, attachmentMail, b64url, emptyMail, htmlMail, htmlOnlyMail, singlePartMail } from './fixtures/mails';
import { BODY_CHARS, MAX_LINKS, parseMessage, readMail } from './message';

const read = (m: unknown) => readMail(parseMessage(m));

test('a digest with both versions is read from the plain one, its links numbered where they stand', () => {
  const mail = read(alternativeMail());
  assert.match(mail.text, /Senior Backend Engineer\nAcme Robotics · Austin, TX \(Hybrid\)\nView job: \[#1\]/);
  assert.match(mail.text, /Platform Engineer\nGlobex Corporation · Remote\nView job: \[#2\]/);
  assert.deepEqual(mail.links, [
    'https://www.jobs.example/comm/view/1111111111?trk=eml-1&ref=a',
    'https://www.jobs.example/comm/view/2222222222?trk=eml-2&ref=a',
    'https://www.jobs.example/comm/search?trk=eml-all',
    'https://www.jobs.example/e/unsubscribe?x=1',
  ]);
});

test('the sender, the subject and the day the mail arrived come from the headers and the mail’s own stamp', () => {
  const mail = read(alternativeMail());
  assert.equal(mail.subject, '5 new jobs for Backend Engineer in Austin');
  assert.equal(mail.fromName, 'Example Job Alerts');
  assert.equal(mail.receivedAt.toISOString(), '2025-10-14T08:00:00.000Z');
});

test('a sender with no display name is the address', () => {
  const mail = read(alternativeMail({ from: 'alerts@jobs.example' }));
  assert.equal(mail.fromName, 'alerts@jobs.example');
});

test('an HTML-only digest keeps each link beside the words it wrapped', () => {
  const mail = read(htmlOnlyMail());
  assert.match(mail.text, /Laravel Developer \[#1\]/);
  assert.match(mail.text, /PHP Engineer \[#2\]/);
  assert.match(mail.text, /Initech - Remote/);
  assert.match(mail.text, /\$110,000 - \$130,000 a year/);
  assert.ok(!/<[a-z]/i.test(mail.text), 'no markup left');
  assert.deepEqual(mail.links, ['https://cts.indeed.example/rc/clk?jk=aaa111&from=email', 'https://cts.indeed.example/rc/clk?jk=bbb222&from=email']);
});

test('the same address twice is one link', () => {
  const mail = read(htmlOnlyMail());
  assert.match(mail.text, /Apply now \[#1\]/);
});

test('mailto and script links are not links', () => {
  const html = `<a href="mailto:a@b.example">mail</a> <a href="javascript:void(0)">js</a> <a href="https://ok.example/x">ok</a>`;
  const mail = read(htmlMail(html));
  assert.deepEqual(mail.links, ['https://ok.example/x']);
  assert.match(mail.text, /mail js ok \[#1\]/);
});

test('an attachment is ignored and the text inside the nested alternative is used', () => {
  const mail = read(attachmentMail());
  assert.match(mail.text, /Senior Backend Engineer/);
  assert.ok(!mail.text.includes('job-description.pdf'));
});

test('a single-part mail has its body on the payload', () => {
  const mail = read(singlePartMail('Staff Accountant at Hooli\nhttps://www.jobs.example/v/3'));
  assert.equal(mail.text, 'Staff Accountant at Hooli\n[#1]');
  assert.deepEqual(mail.links, ['https://www.jobs.example/v/3']);
});

test('base64url’s - and _ decode', () => {
  const text = 'Pay: >>>???';
  assert.ok(b64url(text).includes('-') && b64url(text).includes('_'));
  assert.equal(read(singlePartMail(text)).text, text);
});

test('a mail with nothing readable gives empty text and no links', () => {
  const mail = read(emptyMail());
  assert.equal(mail.text, '');
  assert.deepEqual(mail.links, []);
});

test('the text is cut at the budget, and links past the cap get no marker', () => {
  const long = singlePartMail('x'.repeat(BODY_CHARS + 500));
  assert.equal(read(long).text.length, BODY_CHARS);
  const many = Array.from({ length: MAX_LINKS + 5 }, (_, i) => `https://l.example/${i}`).join('\n');
  const mail = read(singlePartMail(many));
  assert.equal(mail.links.length, MAX_LINKS);
  assert.ok(!mail.text.includes('https://'), 'no raw address is left in the text');
  assert.ok(mail.text.includes(`[#${MAX_LINKS}]`) && !mail.text.includes(`[#${MAX_LINKS + 1}]`));
});

test('a reply that is not a message is refused', () => {
  assert.throws(() => parseMessage({ nothing: true }), GoogleError);
  assert.throws(() => parseMessage('<html>'), GoogleError);
});
