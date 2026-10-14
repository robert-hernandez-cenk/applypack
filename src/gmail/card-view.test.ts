import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardView } from './card-view';
import type { ConnectionView } from './store';

const connection = (over: Partial<ConnectionView> = {}): ConnectionView => ({
  id: 1,
  accountEmail: 'person@example.org',
  labelName: 'Job Leads',
  status: 'ok',
  checkRequestedAt: null,
  lastCheckAt: new Date('2026-10-14T08:00:00Z'),
  lastMails: 3,
  lastListings: 11,
  ...over,
});

test('an install without a Google client offers no way to connect', () => {
  const view = cardView(null, false);
  assert.equal(view.state, 'unconfigured');
  assert.equal(view.canConnect, false);
});

test('a person not yet connected is offered Connect', () => {
  const view = cardView(null, true);
  assert.equal(view.state, 'disconnected');
  assert.equal(view.canConnect, true);
});

test('a connected person sees the account, the label, the status sentence and the last check', () => {
  const view = cardView(connection(), true);
  assert.equal(view.state, 'connected');
  assert.equal(view.account, 'person@example.org');
  assert.equal(view.label, 'Job Leads');
  assert.equal(view.statusKey, 'gmail.status.ok');
  assert.deepEqual(view.lastCheck, { at: new Date('2026-10-14T08:00:00Z'), mails: 3, listings: 11 });
  assert.equal(view.queued, false);
});

test('a connection Google ended is offered Reconnect and keeps its label', () => {
  const view = cardView(connection({ status: 'access_ended' }), true);
  assert.equal(view.state, 'ended');
  assert.equal(view.label, 'Job Leads');
  assert.equal(view.statusKey, 'gmail.status.accessEnded');
});

test('a check not yet made says so instead of showing counts', () => {
  const view = cardView(connection({ status: 'waiting', lastCheckAt: null, lastMails: null, lastListings: null }), true);
  assert.equal(view.lastCheck, null);
  assert.equal(view.statusKey, 'gmail.status.waiting');
});

test('a request waiting for the worker shows as queued', () => {
  assert.equal(cardView(connection({ checkRequestedAt: new Date() }), true).queued, true);
});

test('a failed check keeps the counts of the last good one', () => {
  const view = cardView(connection({ status: 'unreachable' }), true);
  assert.equal(view.lastCheck?.listings, 11);
  assert.equal(view.statusKey, 'gmail.status.unreachable');
});

test('a connection kept after the install lost its client can still be disconnected but not reconnected', () => {
  const view = cardView(connection({ status: 'access_ended' }), false);
  assert.equal(view.state, 'ended');
  assert.equal(view.canConnect, false);
});
