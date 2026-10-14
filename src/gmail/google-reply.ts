import { z } from 'zod';
import { GoogleError } from './status';

/*
 * What Google's answers are allowed to look like (ADR 0071): every reply is
 * parsed here before anything reads it, and a reply that does not fit is an
 * error, never a guess. Pure — `google-io.ts` fetches, this reads.
 */

/** The scopes a connection may hold; mail beyond read-only is refused, and read-only itself is required. */
const READ_ONLY = 'https://www.googleapis.com/auth/gmail.readonly';
const ALLOWED_SCOPES = new Set([READ_ONLY, 'openid', 'email', 'https://www.googleapis.com/auth/userinfo.email']);

const TokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().default(''),
});

function parseOr<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, json: unknown, what: string): T {
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new GoogleError('error', `Google's ${what} was not in the expected shape`);
  return parsed.data;
}

function checkScopes(scope: string): void {
  const granted = scope.split(/\s+/).filter(Boolean);
  // Google lets a person untick a permission on the consent screen: a connection without the mail one reads nothing.
  if (!granted.includes(READ_ONLY)) throw new GoogleError('error', 'read access to mail was not granted');
  if (granted.some((s) => !ALLOWED_SCOPES.has(s))) throw new GoogleError('error', 'a broader permission than read-only was granted');
}

/** The answer to the code exchange: both tokens, and only for a read-only grant. */
export function parseTokenReply(json: unknown): { accessToken: string; refreshToken: string } {
  const token = parseOr(TokenSchema, json, 'token reply');
  if (!token.refresh_token) throw new GoogleError('error', 'Google gave no refresh token');
  checkScopes(token.scope);
  return { accessToken: token.access_token, refreshToken: token.refresh_token };
}

/** The answer to a refresh: a new access token. */
export function parseRefreshReply(json: unknown): string {
  return parseOr(TokenSchema, json, 'refresh reply').access_token;
}

const ProfileSchema = z.object({ emailAddress: z.string().min(1) });

export function parseProfile(json: unknown): string {
  return parseOr(ProfileSchema, json, 'profile').emailAddress;
}

const LabelsSchema = z.object({ labels: z.array(z.object({ id: z.string(), name: z.string() })).default([]) });
export interface GmailLabel {
  id: string;
  name: string;
}

export function parseLabels(json: unknown): GmailLabel[] {
  return parseOr(LabelsSchema, json, 'label list').labels;
}

/** Gmail keeps label names unique ignoring case, so the match ignores it too. */
export function findLabelId(labels: readonly GmailLabel[], name: string): string {
  const wanted = name.trim().toLowerCase();
  const hit = labels.find((l) => l.name.toLowerCase() === wanted);
  if (!hit) throw new GoogleError('label_missing');
  return hit.id;
}

const MessageListSchema = z.object({
  messages: z.array(z.object({ id: z.string() })).default([]),
  nextPageToken: z.string().optional(),
});

export function parseMessageList(json: unknown): { ids: string[]; next: string | null } {
  const list = parseOr(MessageListSchema, json, 'message list');
  return { ids: list.messages.map((m) => m.id), next: list.nextPageToken ?? null };
}
