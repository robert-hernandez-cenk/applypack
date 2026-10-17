import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readSend, SEND_TTL_MS, stashSend, type Sent } from './send-stash';

const sent = (userId: number): Sent => ({
  userId,
  jobTitle: 'Staff Engineer',
  back: { href: '/resumes/1#tailored', label: 'Main' },
  outcome: { ok: true, sent: { name: 'Main - Acme', openHref: 'https://rr.example/builder/x' }, applied: 1, notApplied: [] },
});

describe('the send stash — the page a send redirects to', () => {
  it('gives the result back to the person it is for, as often as they look', () => {
    const id = stashSend(sent(1), 1_000);
    assert.equal(readSend(id, 1, 2_000)?.jobTitle, 'Staff Engineer');
    assert.equal(readSend(id, 1, 3_000)?.jobTitle, 'Staff Engineer');
  });

  it('is nobody else\'s', () => {
    const id = stashSend(sent(1), 1_000);
    assert.equal(readSend(id, 2, 2_000), null);
  });

  it('forgets after its time, and knows no id it was not given', () => {
    const id = stashSend(sent(1), 1_000);
    assert.equal(readSend(id, 1, 1_000 + SEND_TTL_MS + 1), null);
    assert.equal(readSend('not-an-id', 1, 2_000), null);
  });

  it('keeps a few per person: the newest stay', () => {
    const ids = Array.from({ length: 8 }, (_, i) => stashSend(sent(7), 10_000 + i));
    assert.equal(readSend(ids[0]!, 7, 10_100), null);
    assert.ok(readSend(ids[7]!, 7, 10_100));
  });
});
