import type { MessageKey } from '../i18n/catalog';
import type { InstanceFailure } from '../resume/reactive-resume-api';
import type { EditReason, EditReport } from '../resume/reactive-resume-apply';
import type { SendFailure } from '../resume/reactive-resume-writeback';
import type { InstanceUrlFailure, Reach } from '../resume/reactive-resume-url';
import type { KeyFailure } from '../resume/reactive-connection';

/*
 * What a person is told when the address, the key or the instance is the
 * problem (ADR 0073, 0075). Shared by the Settings card, which checks a pair
 * before saving it, and the pulls on `/resumes`, which use the saved one.
 */

export const URL_FAILURE = {
  empty: 'resumes.reactive.fail.empty',
  invalid: 'resumes.reactive.fail.invalid',
  scheme: 'resumes.reactive.fail.scheme',
  credentials: 'resumes.reactive.fail.credentials',
} as const satisfies Record<InstanceUrlFailure, MessageKey>;

export const KEY_FAILURE = {
  empty: 'resumes.reactive.fail.noKey',
  tooLong: 'reactive.fail.keyTooLong',
} as const satisfies Record<KeyFailure, MessageKey>;

export const REACH_FAILURE = {
  privateAddress: 'resumes.reactive.fail.privateAddress',
  noHost: 'resumes.reactive.fail.noHost',
} as const satisfies Record<Exclude<Reach, { ok: true }>['code'], MessageKey>;

export const INSTANCE_FAILURE = {
  unauthorized: 'resumes.reactive.fail.unauthorized',
  notApi: 'resumes.reactive.fail.notApi',
  redirect: 'resumes.reactive.fail.redirect',
  tooLarge: 'resumes.reactive.fail.tooLarge',
  timeout: 'resumes.reactive.fail.timeout',
  unreachable: 'resumes.reactive.fail.unreachable',
  locked: 'reactive.send.fail.locked',
  conflict: 'reactive.send.fail.conflict',
  badPatch: 'reactive.send.fail.badPatch',
} as const satisfies Record<InstanceFailure, MessageKey>;

/** A saved key the instance refuses is fixed in Settings, not by typing it again. */
export const SAVED_INSTANCE_FAILURE: Record<InstanceFailure, MessageKey> = {
  ...INSTANCE_FAILURE,
  unauthorized: 'reactive.fail.unauthorizedSaved',
};

/** Why a send did not happen (ADR 0079): the instance's own words, and the ones only a send has. The saved key is the one in use. */
export const SEND_FAILURE: Record<SendFailure, MessageKey> = {
  ...SAVED_INSTANCE_FAILURE,
  generation: 'reactive.send.fail.generation',
  stale: 'reactive.send.fail.stale',
  notFound: 'reactive.send.fail.notFound',
  nothingApplied: 'reactive.send.fail.nothingApplied',
};

/** Why one edit was not written into the copy on the instance. */
export const EDIT_REASON = {
  noField: 'reactive.send.reason.noField',
  assembled: 'reactive.send.reason.assembled',
  misaligned: 'reactive.send.reason.misaligned',
  newSection: 'reactive.send.reason.newSection',
  labelChanged: 'reactive.send.reason.labelChanged',
} as const satisfies Record<EditReason, MessageKey>;

export const EDIT_KIND = {
  changed: 'reactive.send.kind.changed',
  added: 'reactive.send.kind.added',
  removed: 'reactive.send.kind.removed',
} as const satisfies Record<EditReport['kind'], MessageKey>;
