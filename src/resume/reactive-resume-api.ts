import { z } from 'zod';
import { apiUrl } from './reactive-resume-url';

/*
 * The ONLY file that calls a person's Reactive Resume instance (ADR 0073):
 * the list of their resumes and one resume's data, and (ADR 0079) a copy of a
 * resume and a patch of that copy, with their API key in `x-api-key`. One
 * request each, no retry — a write that timed out may have happened, and the
 * instance says not to repeat it — no redirect followed (the key would go
 * with it), a time limit and a size limit on the body. Whether the server may
 * call that address at all is `reactive-resume-url.ts:reachable`, asked by the
 * caller first. The key is only ever a header: no message, log line or error
 * produced here contains it.
 */

export type InstanceFailure =
  | 'unauthorized'
  | 'notApi'
  | 'redirect'
  | 'tooLarge'
  | 'timeout'
  | 'unreachable'
  /** The resume is locked in Reactive Resume. */
  | 'locked'
  /** It changed after it was read. */
  | 'conflict'
  /** The instance refused what was sent as invalid. */
  | 'badPatch';

export class InstanceError extends Error {
  constructor(readonly code: InstanceFailure) {
    super(`Reactive Resume instance: ${code}`);
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** The upload ceiling: a resume's data is far smaller. */
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const LIST_WRAPPERS = ['items', 'resumes', 'data'];
const REDIRECT_MIN = 300;
const REDIRECT_MAX = 399;

export interface InstanceLimits {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface InstanceResume {
  id: string;
  name: string;
}

const RowSchema = z.object({
  id: z.union([z.string().min(1), z.number()]),
  name: z.string().optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
});

const GetSchema = z
  .object({
    name: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    isLocked: z.boolean().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

/** What the instance answers to a copy: the new resume's id. */
const IdSchema = z.string().min(1);

/** What it answers to a patch: the resume, of which only the stamp matters here. */
const PatchedSchema = z.object({ updatedAt: z.string().optional() });

/** One RFC 6902 operation, of the three this app ever sends. */
export type PatchOperation =
  | { op: 'replace' | 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export async function listInstanceResumes(base: URL, key: string, limits: InstanceLimits = {}): Promise<InstanceResume[]> {
  const body = await requestJson('GET', apiUrl(base, '/resumes'), key, limits);
  const rows = Array.isArray(body)
    ? body
    : LIST_WRAPPERS.map((k) => (body as Record<string, unknown> | null)?.[k]).find((v) => Array.isArray(v));
  if (!Array.isArray(rows)) throw new InstanceError('notApi');
  const out: InstanceResume[] = [];
  for (const row of rows) {
    const parsed = RowSchema.safeParse(row);
    if (parsed.success) out.push({ id: String(parsed.data.id), name: parsed.data.name ?? parsed.data.title ?? parsed.data.slug ?? String(parsed.data.id) });
  }
  return out;
}

export interface InstanceResumeData {
  name: string;
  data: unknown;
  /** When it was last changed, as the instance wrote it; null when it does not say. */
  updatedAt: string | null;
  locked: boolean;
}

export async function getInstanceResume(base: URL, key: string, id: string, limits: InstanceLimits = {}): Promise<InstanceResumeData> {
  const body = await requestJson('GET', resumeUrl(base, id), key, limits);
  const parsed = GetSchema.safeParse(body);
  if (!parsed.success) throw new InstanceError('notApi');
  // A resume sent bare (its data at the top) reads the same.
  const data = parsed.data.data ?? ('basics' in parsed.data ? parsed.data : null);
  if (!data) throw new InstanceError('notApi');
  return { name: parsed.data.name ?? '', data, updatedAt: parsed.data.updatedAt ?? null, locked: parsed.data.isLocked === true };
}

/** A copy of a resume under a new name (ADR 0079); returns the copy's id. The original is not touched. */
export async function duplicateInstanceResume(base: URL, key: string, id: string, name: string, limits: InstanceLimits = {}): Promise<string> {
  const parsed = IdSchema.safeParse(await requestJson('POST', `${resumeUrl(base, id)}/duplicate`, key, limits, { name }));
  if (!parsed.success) throw new InstanceError('notApi');
  return parsed.data;
}

/**
 * Operations applied to a resume. `expectedUpdatedAt` makes the instance
 * refuse the change (`conflict`) when someone edited the resume after it was
 * read; returns the stamp it now has.
 */
export async function patchInstanceResume(
  base: URL,
  key: string,
  id: string,
  patch: { operations: PatchOperation[]; expectedUpdatedAt?: string },
  limits: InstanceLimits = {},
): Promise<{ updatedAt: string | null }> {
  const parsed = PatchedSchema.safeParse(await requestJson('PATCH', resumeUrl(base, id), key, limits, patch));
  if (!parsed.success) throw new InstanceError('notApi');
  return { updatedAt: parsed.data.updatedAt ?? null };
}

const resumeUrl = (base: URL, id: string): string => apiUrl(base, `/resumes/${encodeURIComponent(id)}`);

/** An error body worth reading for its `code`; a mutation's refusals say why there. */
const ERROR_BODY_MAX_BYTES = 16 * 1024;
const LOCKED_CODE = 'RESUME_LOCKED';

async function requestJson(method: 'GET' | 'POST' | 'PATCH', url: string, key: string, limits: InstanceLimits, body?: unknown): Promise<unknown> {
  const maxBytes = limits.maxBytes ?? DEFAULT_MAX_BYTES;
  const mutating = method !== 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers: { 'x-api-key': key, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch {
      throw new InstanceError(controller.signal.aborted ? 'timeout' : 'unreachable');
    }
    const code = mutating && !resp.ok ? await errorCode(resp, controller.signal) : null;
    const refusal = refusalOf(resp.status, mutating, code);
    if (refusal) {
      await resp.body?.cancel().catch(() => undefined);
      throw new InstanceError(refusal);
    }
    const text = await readCapped(resp, maxBytes, controller.signal);
    try {
      return JSON.parse(text);
    } catch {
      throw new InstanceError('notApi');
    }
  } finally {
    clearTimeout(timer);
  }
}

/** The `code` a refusing answer names, or null: a body that is large, not JSON or without one says nothing. */
async function errorCode(resp: Response, signal: AbortSignal): Promise<string | null> {
  try {
    const parsed: unknown = JSON.parse(await readCapped(resp, ERROR_BODY_MAX_BYTES, signal));
    const code = (parsed as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

/** What an answer that is not a 2xx says about the instance; null for one worth reading. */
function refusalOf(status: number, mutating: boolean, code: string | null): InstanceFailure | null {
  if (status >= REDIRECT_MIN && status <= REDIRECT_MAX) return 'redirect';
  if (status === 403 && code === LOCKED_CODE) return 'locked';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404 || status === 405 || status === 410) return 'notApi';
  if (mutating && status === 409) return 'conflict';
  if (mutating && status === 400) return 'badPatch';
  return status >= 200 && status < REDIRECT_MIN ? null : 'unreachable';
}

/** The body as text, stopped as soon as it passes `maxBytes`. */
async function readCapped(resp: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  const declared = Number(resp.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await resp.body?.cancel().catch(() => undefined);
    throw new InstanceError('tooLarge');
  }
  const reader = resp.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new InstanceError('tooLarge');
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof InstanceError) throw err;
    throw new InstanceError(signal.aborted ? 'timeout' : 'unreachable');
  }
  return Buffer.concat(chunks).toString('utf8');
}
