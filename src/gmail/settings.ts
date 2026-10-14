/*
 * What the Gmail connection needs to know before it touches anything (ADR
 * 0071): the install's Google client and the label a person reads. Pure — the
 * caller passes the environment in.
 */

export const DEFAULT_LABEL = 'Job Leads';
/** Gmail's own limit on a label name. */
export const MAX_LABEL_CHARS = 225;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type LabelCheck = { ok: true; label: string } | { ok: false };

/** The label a person typed: trimmed, the default when empty, refused when Gmail could not hold it. */
export function normalizeLabel(raw: string | undefined | null): LabelCheck {
  const label = (raw ?? '').trim();
  if (label === '') return { ok: true, label: DEFAULT_LABEL };
  if (label.length > MAX_LABEL_CHARS || CONTROL_CHARS.test(label)) return { ok: false };
  return { ok: true, label };
}

export interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  /** Where Google sends the browser back: the dashboard's own address. */
  redirectUri: string;
}

interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  WEB_PUBLIC_URL?: string | undefined;
  WEB_PORT: number;
}

export const CALLBACK_PATH = '/gmail/callback';

/** `null` when the install has not set up a Google client: the feature is then off. */
export function googleSettings(env: GoogleEnv): GoogleSettings | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const origin = env.WEB_PUBLIC_URL?.trim().replace(/\/+$/, '') || `http://localhost:${env.WEB_PORT}`;
  return { clientId, clientSecret, redirectUri: `${origin}${CALLBACK_PATH}` };
}
