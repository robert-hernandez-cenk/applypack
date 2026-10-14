import type { Profile } from '@prisma/client';
import type { GmailReadIo, GoogleIo } from '../gmail/google-io';
import { parseListings } from '../gmail/listing';
import { toNormalizedJob } from '../gmail/map';
import { parseMessage, readMail } from '../gmail/message';
import { buildGmailExtractPrompt, GMAIL_MAX_TOKENS } from '../gmail/prompt';
import { ledgerCutoff, pickMessages, searchQuery, windowStart } from '../gmail/query';
import type { GoogleSettings } from '../gmail/settings';
import { GMAIL_STATUSES, errorReason, statusOf, type FailureStatus, type GmailStatus } from '../gmail/status';
import type * as store from '../gmail/store';
import { logger } from '../logger';
import type { ClassifierMode } from '../settings';
import type { CronStats } from './cron-run';
import type { ReportProgress } from './run-progress';
import type { FetchResult, ProcessOptions, ProcessStats } from './process-jobs';

/*
 * One person's check of their Gmail label (ADR 0071): refresh the access,
 * find the label, list the mails under it that the ledger has not seen, read
 * up to a run's share, ask one fenced model call per mail for its listings,
 * and hand them to the pipeline as that person's own. The caller holds the
 * fetch lock (the tick takes it once for everyone) and has asked whether
 * fetching is paused; this file asks again, because "Check now" and a restart
 * can arrive at any moment.
 *
 * A mail goes in the ledger only after its listings were handed on, so a run
 * that dies in the middle reads the same mails again and the pipeline's own
 * dedupe keeps them from being stored twice. Nothing here reads a link in a
 * mail, and nothing is logged but counts.
 */

export type GmailJobStore = Pick<
  typeof store,
  'getConnection' | 'readRefreshToken' | 'ensureSourceCompany' | 'processedIds' | 'recordMessage' | 'pruneLedger' | 'recordCheck'
>;

export interface GmailJobDeps {
  io: GmailReadIo & Pick<GoogleIo, 'refreshAccessToken'>;
  /** `null` when the install has lost its Google client. */
  google: GoogleSettings | null;
  store: GmailJobStore;
  /** The model: whether any engine can take the task, and one call. */
  ai: () => Promise<{ hasEngine: boolean; complete(system: string, user: string): Promise<string | null> }>;
  pipeline: {
    state(): Promise<{ enabled: boolean; classifierMode: ClassifierMode }>;
    profiles(userId: number): Promise<Profile[]>;
    /** The funnel and the alert for these items, for this person; returns what the funnel counted. */
    run(items: FetchResult[], profiles: Profile[], opts: ProcessOptions, source: { id: number; name: string }): Promise<ProcessStats>;
  };
  now(): Date;
}

interface Read {
  messageId: string;
  receivedAt: Date;
  outcome: 'listings' | 'none' | 'unreadable';
  count: number;
}

const knownStatus = (status: string): GmailStatus => (GMAIL_STATUSES as readonly string[]).includes(status) ? (status as GmailStatus) : 'error';

export async function runGmailJob(userId: number, deps: GmailJobDeps, report?: ReportProgress): Promise<{ stats: CronStats }> {
  const skipped = (reason: string): { stats: CronStats } => ({ stats: { skipped: 1, reason } });
  const fail = async (status: FailureStatus): Promise<{ stats: CronStats }> => {
    await deps.store.recordCheck(userId, { status });
    return { stats: { aborted: 1, status } };
  };

  const connection = await deps.store.getConnection(userId);
  if (!connection) return skipped('not-connected');
  const pipeline = await deps.pipeline.state();
  if (!pipeline.enabled) return skipped('paused');

  const ai = await deps.ai();
  if (!ai.hasEngine) return fail('no_engine');
  if (!deps.google) {
    logger.warn({ userId }, 'gmail-job: the install has no Google client; nothing read');
    return fail('error');
  }
  const profiles = await deps.pipeline.profiles(userId);
  if (profiles.length === 0) {
    // Nothing to score against: leave the status as it was and clear the request.
    await deps.store.recordCheck(userId, { status: knownStatus(connection.status) });
    return skipped('no-active-profile');
  }

  const now = deps.now();
  let access: string;
  let listed: string[];
  try {
    const token = await deps.store.readRefreshToken(userId);
    if (token === null) return skipped('not-connected');
    access = await deps.io.refreshAccessToken(deps.google, token);
    const labelId = await deps.io.resolveLabelId(access, connection.labelName);
    listed = await deps.io.listMessages(access, labelId, searchQuery(windowStart(now, connection.lastCheckAt)));
  } catch (err) {
    const status = statusOf(err);
    logger.warn({ userId, status, reason: errorReason(err) }, 'gmail-job: could not reach the label');
    return fail(status);
  }

  const { take, left } = pickMessages(listed, await deps.store.processedIds(connection.id, listed));
  const source = await deps.store.ensureSourceCompany(userId);

  const items: FetchResult[] = [];
  const reads: Read[] = [];
  let leftOut = 0;
  let failure: FailureStatus | null = null;
  const reportMails = (): void =>
    report?.({
      stage: 'mails',
      label: 'runs.running.stage.mails',
      unit: 'runs.running.unit.mails',
      done: reads.length,
      total: take.length,
      counters: { listings: reads.reduce((sum, r) => sum + r.count, 0) },
    });
  for (const id of take) {
    reportMails();
    try {
      const mail = readMail(await deps.io.getMessage(access, id));
      const read = (outcome: Read['outcome'], count: number): void => void reads.push({ messageId: id, receivedAt: mail.receivedAt, outcome, count });
      if (mail.text === '') {
        read('none', 0);
        continue;
      }
      const { system, user } = buildGmailExtractPrompt(mail);
      const reply = await ai.complete(system, user);
      if (reply === null) {
        // The engines failed this mail, not the mail: it stays unread, and so does everything after it.
        failure = 'error';
        break;
      }
      const parsed = parseListings(reply, mail.links);
      if (parsed === null) {
        read('unreadable', 0);
        continue;
      }
      leftOut += parsed.skipped;
      items.push(...parsed.listings.map((listing) => ({ job: toNormalizedJob(listing, mail.receivedAt, source.id), companyName: source.name })));
      read(parsed.listings.length > 0 ? 'listings' : 'none', parsed.listings.length);
    } catch (err) {
      failure = statusOf(err);
      logger.warn({ userId, status: failure, reason: errorReason(err) }, 'gmail-job: a mail could not be read');
      break;
    }
  }

  reportMails();
  let inner: ProcessStats | null = null;
  if (items.length > 0) {
    try {
      inner = await deps.pipeline.run(
        items,
        profiles,
        { classifierMode: pipeline.classifierMode, classify: true, respectAlertHours: true, groupAlerts: true, ownerId: userId, report },
        { id: source.id, name: source.name },
      );
    } catch (err) {
      // Nothing is marked read: the next run takes the same mails, and the pipeline stores each posting once.
      logger.error({ err, userId }, 'gmail-job: the postings were not handed on');
      return fail('error');
    }
  }
  for (const row of reads) await deps.store.recordMessage(connection.id, row);
  await deps.store.pruneLedger(connection.id, ledgerCutoff(now));

  const listings = reads.reduce((sum, r) => sum + r.count, 0);
  const counts = { mails: reads.length, listings };
  // The window moves on only when everything in it was read.
  await deps.store.recordCheck(userId, failure ? { status: failure, ...counts } : { status: 'ok', ...(left === 0 && { lastCheckAt: now }), ...counts });
  const stats: CronStats = { ...counts, skippedListings: leftOut, ...(left > 0 && { left }), ...(failure && { status: failure }), ...inner };
  logger.info({ userId, ...counts, left, failure }, 'gmail-job: done');
  return { stats };
}
