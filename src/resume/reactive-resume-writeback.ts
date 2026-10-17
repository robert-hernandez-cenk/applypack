import { planWriteBack, type EditReport } from './reactive-resume-apply';
import { InstanceError, type InstanceFailure, type InstanceResumeData, type PatchOperation } from './reactive-resume-api';

/*
 * A tailored copy sent to Reactive Resume as a NEW resume (ADR 0079). The
 * steps, in the order that keeps a failure harmless:
 *   1. read the source, and refuse if it no longer reads like the text the
 *      resume was imported as — nothing is created;
 *   2. plan the edits on it, and refuse if none can be placed — nothing is
 *      created;
 *   3. ask the instance for a copy under the new name — from here a failure
 *      leaves a copy behind, which is named in the result;
 *   4. read the copy, plan on IT (the operations address its own fields) and
 *      patch it, expecting the stamp it was read at.
 * Every call is made once: a write that timed out may have happened, and the
 * instance says not to repeat it. The original is only ever read. Its I/O is
 * handed in, so this is tested with fakes and the route passes the real client.
 */

export interface WriteBackIo {
  getResume: (id: string) => Promise<InstanceResumeData>;
  duplicate: (id: string, name: string) => Promise<string>;
  patch: (id: string, patch: { operations: PatchOperation[]; expectedUpdatedAt?: string }) => Promise<{ updatedAt: string | null }>;
}

export interface WriteBackInput {
  /** The resume's id on the instance. */
  remoteId: string;
  generation: string;
  /** The text the resume was imported as. */
  storedText: string;
  /** The tailored copy's text. */
  copyText: string;
  /** The new resume's name. */
  name: string;
}

export type SendFailure =
  | 'generation'
  | 'stale'
  | 'notFound'
  | 'nothingApplied'
  | InstanceFailure;

export type SendResult =
  | { ok: true; remoteId: string; name: string; applied: number; notApplied: EditReport[] }
  | {
      ok: false;
      code: SendFailure;
      /** The copy that exists on the instance despite the failure. */
      createdRemoteId?: string;
      /** The request for a copy ended without an answer: the instance may have made one we cannot name. */
      maybeCreated?: boolean;
      /** For `nothingApplied`: every edit, with why. */
      notApplied?: EditReport[];
    };

/** Only the generation whose write path was checked against a live instance is written. */
const WRITABLE_GENERATION = 'v6';
const NAME_SEPARATOR = ' - ';
/** The instance's own limit is not published; this keeps a name readable in its list. */
const MAX_NAME_CHARS = 200;

/** `<Resume> - <Company> - <Role>`, what is missing left out, cut to a length a list can show. */
export function writeBackName(resume: string, company: string | null, role: string | null): string {
  return [resume, company, role]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(NAME_SEPARATOR)
    .slice(0, MAX_NAME_CHARS);
}

const failureOf = (err: unknown): InstanceFailure => {
  if (err instanceof InstanceError) return err.code;
  throw err;
};

export async function reactiveWriteBack(io: WriteBackIo, input: WriteBackInput): Promise<SendResult> {
  if (input.generation !== WRITABLE_GENERATION) return { ok: false, code: 'generation' };

  let source: InstanceResumeData;
  try {
    source = await io.getResume(input.remoteId);
  } catch (err) {
    const code = failureOf(err);
    return { ok: false, code: code === 'notApi' ? 'notFound' : code };
  }
  const plan = await planWriteBack({ data: source.data, masterText: input.storedText, copyText: input.copyText });
  if (!plan.ok) return { ok: false, code: 'stale' };
  if (plan.edits.length > 0 && plan.operations.length === 0) return { ok: false, code: 'nothingApplied', notApplied: plan.edits };

  let createdRemoteId: string;
  try {
    createdRemoteId = await io.duplicate(input.remoteId, input.name);
  } catch (err) {
    const code = failureOf(err);
    return code === 'timeout' || code === 'unreachable' ? { ok: false, code, maybeCreated: true } : { ok: false, code };
  }

  // From here a copy exists: every way out names it.
  const left = (code: SendFailure, notApplied?: EditReport[]): SendResult => ({ ok: false, code, createdRemoteId, ...(notApplied ? { notApplied } : {}) });
  let copy: InstanceResumeData;
  try {
    copy = await io.getResume(createdRemoteId);
  } catch (err) {
    return left(failureOf(err));
  }
  if (copy.locked) return left('locked');
  const onCopy = await planWriteBack({ data: copy.data, masterText: input.storedText, copyText: input.copyText });
  if (!onCopy.ok) return left('stale');

  // The source had places for the edits and the copy has none: nothing to send into the copy that was just made.
  if (onCopy.edits.length > 0 && onCopy.operations.length === 0) return left('nothingApplied', onCopy.edits);

  if (onCopy.operations.length > 0) {
    try {
      await io.patch(createdRemoteId, { operations: onCopy.operations, ...(copy.updatedAt ? { expectedUpdatedAt: copy.updatedAt } : {}) });
    } catch (err) {
      return left(failureOf(err));
    }
  }
  return {
    ok: true,
    remoteId: createdRemoteId,
    name: input.name,
    applied: onCopy.edits.filter((e) => e.status === 'applied').length,
    notApplied: onCopy.edits.filter((e) => e.status === 'notApplied'),
  };
}
