import { config } from '../config';
import { liveGoogleIo } from '../gmail/google-io';
import { PendingStore } from '../gmail/pending';
import { googleSettings } from '../gmail/settings';
import * as store from '../gmail/store';
import { currentUser } from './current-user';
import { createGmailRoute } from './routes/gmail';

/** The Gmail routes wired to the real Google, the real database and the person making the request (ADR 0071). */
export const gmailRoute = createGmailRoute({
  io: liveGoogleIo,
  settings: () => googleSettings(config),
  pending: new PendingStore(),
  store,
  userId: () => currentUser().id,
});
