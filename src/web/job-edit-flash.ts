/*
 * What the job page says after a saved edit (#46): the edit is kept either
 * way, so the flash says that first and then what the re-score came to —
 * in the words Re-classify already uses for a press that formed no verdict.
 * Pure — tested in job-edit-flash.test.ts.
 */

import type { Rescored } from '../jobs/classify-existing';
import { t } from '../i18n/t';
import type { FlashKind } from './flash';
import { rescoreFlash } from './rescore-flash';

export function jobEditFlash(outcome: Rescored): { kind: FlashKind; text: string } {
  // An edit never moves a status (keepStatus), so what a verdict-less outcome reports is "as it was".
  const why = rescoreFlash(outcome, 'status' in outcome ? outcome.status : 'NEW');
  if (!why) return { kind: 'ok', text: t('jobEdit.flash.scored') };
  return { kind: 'warn', text: t('jobEdit.flash.notScored', { why: why.text }) };
}
