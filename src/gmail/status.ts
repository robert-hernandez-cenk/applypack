import { HttpError } from '../http';
import type { MessageKey } from '../i18n/catalog';

/*
 * What a Gmail connection can be in (ADR 0071), and how a failure is read
 * into one of those words. The card shows the status's sentence; the raw
 * error stays in the log, never on a page and never in the database.
 */

export const GMAIL_STATUSES = ['waiting', 'ok', 'access_ended', 'label_missing', 'unreachable', 'quota', 'no_engine', 'error'] as const;
export type GmailStatus = (typeof GMAIL_STATUSES)[number];

export type FailureStatus = Exclude<GmailStatus, 'waiting' | 'ok'>;

/** A failure whose status is already known where it happens. */
export class GoogleError extends Error {
  constructor(public readonly status: FailureStatus, message: string = status) {
    super(message);
    this.name = 'GoogleError';
  }
}

const QUOTA_REASONS = /rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded|quotaExceeded/;
const REVOKED = /invalid_grant|unauthorized_client|invalid_token/;
/** The operator never enabled the Gmail API for the project: a setup mistake, not anyone's access ending. */
const NOT_ENABLED = /accessNotConfigured|SERVICE_DISABLED/;

function httpStatus(err: HttpError): FailureStatus {
  const body = err.body ?? '';
  if (err.status === 403 && NOT_ENABLED.test(body)) return 'error';
  if (err.status === 401 || REVOKED.test(body)) return 'access_ended';
  if (err.status === 429 || (err.status === 403 && QUOTA_REASONS.test(body))) return 'quota';
  if (err.status === 403) return 'access_ended';
  if (err.status >= 500) return 'unreachable';
  return 'error';
}

/** The status a thrown value stands for. A timeout arrives as a plain Error with a message, not an AbortError (gotcha 13). */
export function statusOf(err: unknown): FailureStatus {
  if (err instanceof GoogleError) return err.status;
  if (err instanceof HttpError) return httpStatus(err);
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return 'unreachable';
  if (err instanceof Error && /timed out after/.test(err.message)) return 'unreachable';
  return 'error';
}

const KEYS: Record<GmailStatus, MessageKey> = {
  waiting: 'gmail.status.waiting',
  ok: 'gmail.status.ok',
  access_ended: 'gmail.status.accessEnded',
  label_missing: 'gmail.status.labelMissing',
  unreachable: 'gmail.status.unreachable',
  quota: 'gmail.status.quota',
  no_engine: 'gmail.status.noEngine',
  error: 'gmail.status.error',
};

/** The catalog key for a stored status; a word this version does not know reads as a plain error. */
export function statusKey(status: string): MessageKey {
  return Object.hasOwn(KEYS, status) ? KEYS[status as GmailStatus] : KEYS.error;
}

/**
 * The reason code Google put on a failure (`accessNotConfigured`, `invalid_grant`), for the log
 * beside the status. Only that word: Google's message text is not read out, and a body that is
 * not JSON gives nothing.
 */
export function errorReason(err: unknown): string | undefined {
  if (!(err instanceof HttpError) || !err.body) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(err.body);
  } catch {
    return undefined;
  }
  const error = (json as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  const listed = (error as { errors?: { reason?: unknown }[]; details?: { reason?: unknown }[] } | null | undefined);
  const reason = [...(listed?.errors ?? []), ...(listed?.details ?? [])].map((e) => e.reason).find((r) => typeof r === 'string');
  return typeof reason === 'string' ? reason : undefined;
}
