import type { MessageKey } from '../i18n/catalog';
import type { ConnectionView } from './store';
import { statusKey } from './status';

/*
 * What the Gmail card on Settings shows (ADR 0071): the connection read into
 * a state and a few facts, so the page only lays them out. Pure; the type
 * import from the store is erased, and the token is not in `ConnectionView`.
 */

export type CardState = 'unconfigured' | 'disconnected' | 'connected' | 'ended';

export interface CardView {
  state: CardState;
  /** Whether Connect / Reconnect can be offered: the install has a Google client. */
  canConnect: boolean;
  account: string | null;
  label: string | null;
  statusKey: MessageKey | null;
  /** A check is waiting for the worker. */
  queued: boolean;
  /** The last good read, kept through a failed one; null before the first. */
  lastCheck: { at: Date; mails: number; listings: number } | null;
}

export function cardView(connection: ConnectionView | null, configured: boolean): CardView {
  if (!connection) {
    return { state: configured ? 'disconnected' : 'unconfigured', canConnect: configured, account: null, label: null, statusKey: null, queued: false, lastCheck: null };
  }
  return {
    state: connection.status === 'access_ended' ? 'ended' : 'connected',
    canConnect: configured,
    account: connection.accountEmail,
    label: connection.labelName,
    statusKey: statusKey(connection.status),
    queued: connection.checkRequestedAt !== null,
    lastCheck: connection.lastCheckAt ? { at: connection.lastCheckAt, mails: connection.lastMails ?? 0, listings: connection.lastListings ?? 0 } : null,
  };
}
