import { z } from 'zod';
import { apiUrl } from './reactive-resume-url';

/*
 * The ONLY file that calls a person's Reactive Resume instance (ADR 0073):
 * the list of their resumes and one resume's data, with their API key in
 * `x-api-key`. One request each, no retry, no redirect followed (the key
 * would go with it), a time limit and a size limit on the body. Whether the
 * server may call that address at all is `reactive-resume-url.ts:reachable`,
 * asked by the caller first. The key is only ever a header: no message, log
 * line or error produced here contains it.
 */

export type InstanceFailure = 'unauthorized' | 'notApi' | 'redirect' | 'tooLarge' | 'timeout' | 'unreachable';

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

const GetSchema = z.object({ name: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() }).passthrough();

export async function listInstanceResumes(base: URL, key: string, limits: InstanceLimits = {}): Promise<InstanceResume[]> {
  const body = await getJson(apiUrl(base, '/resumes'), key, limits);
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

export async function getInstanceResume(base: URL, key: string, id: string, limits: InstanceLimits = {}): Promise<{ name: string; data: unknown }> {
  const body = await getJson(apiUrl(base, `/resumes/${encodeURIComponent(id)}`), key, limits);
  const parsed = GetSchema.safeParse(body);
  if (!parsed.success) throw new InstanceError('notApi');
  // A resume sent bare (its data at the top) reads the same.
  const data = parsed.data.data ?? ('basics' in parsed.data ? parsed.data : null);
  if (!data) throw new InstanceError('notApi');
  return { name: parsed.data.name ?? '', data };
}

async function getJson(url: string, key: string, limits: InstanceLimits): Promise<unknown> {
  const maxBytes = limits.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let resp: Response;
    try {
      resp = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    } catch {
      throw new InstanceError(controller.signal.aborted ? 'timeout' : 'unreachable');
    }
    if (resp.status >= REDIRECT_MIN && resp.status <= REDIRECT_MAX) {
      await resp.body?.cancel().catch(() => undefined);
      throw new InstanceError('redirect');
    }
    if (resp.status === 401 || resp.status === 403) {
      await resp.body?.cancel().catch(() => undefined);
      throw new InstanceError('unauthorized');
    }
    if (resp.status === 404 || resp.status === 405 || resp.status === 410) {
      await resp.body?.cancel().catch(() => undefined);
      throw new InstanceError('notApi');
    }
    if (!resp.ok) {
      await resp.body?.cancel().catch(() => undefined);
      throw new InstanceError('unreachable');
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
