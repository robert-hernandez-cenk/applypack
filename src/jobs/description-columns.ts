import type { Job } from '@prisma/client';
import { simhash64, toDbBigInt } from '../fingerprint';

/*
 * The columns a changed description writes (#162 stage 3, ADR 0043; #46): the
 * new text, the text the posting arrived with (the first one is kept through
 * any number of changes), when it changed — which is what makes a stored
 * comparison's keywords stale — and the fingerprint that follows the text
 * (ADR 0018). Shared by the company-page swap and by a person's own edit.
 * Pure; `text` is already normalised.
 */
export function descriptionColumns(
  job: Pick<Job, 'description' | 'descriptionOriginal'>,
  text: string,
): Pick<Job, 'description' | 'descriptionOriginal' | 'descriptionRefreshedAt' | 'descriptionSimhash'> {
  return {
    description: text,
    descriptionOriginal: job.descriptionOriginal ?? job.description,
    descriptionRefreshedAt: new Date(),
    descriptionSimhash: toDbBigInt(simhash64(text)),
  };
}
