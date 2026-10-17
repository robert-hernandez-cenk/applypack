// ADR 0080. One answer to "has this person applied to this posting?". A stage
// used to settle it (any stage meant applied); Consider and Applying are
// stages of a posting that has NOT been sent, and Expired alone says only that
// the posting went away, so every reader asks here instead of testing
// `pipelineStage !== null`.

import type { Prisma } from '@prisma/client';

/** The stage "Consider" puts a posting in. */
export const CONSIDER_KEY = 'consider';

/** The stages before Applied: held, but nothing has gone out. */
export const PRE_APPLY_KEYS = [CONSIDER_KEY, 'applying'] as const;

/** Stages that, alone, do not say the application was sent: the two before Applied, and a posting that expired. */
const UNSENT_KEYS = [...PRE_APPLY_KEYS, 'expired'];

export interface AppliedState {
  stage: string | null;
  appliedAt: Date | null;
  status: string;
}

export function isPreApply(stage: string): boolean {
  return (PRE_APPLY_KEYS as readonly string[]).includes(stage);
}

/**
 * Applied, by any of the three things that can say so: the inbox status, an
 * apply date (kept when a card moves back, because the person did apply), or
 * a stage past Applying. A posting that closed before it was sent sits in
 * Expired with none of the three; one that closed after it was sent has the date.
 */
export function hasApplied(state: AppliedState): boolean {
  if (state.status === 'APPLIED' || state.appliedAt !== null) return true;
  return state.stage !== null && !UNSENT_KEYS.includes(state.stage);
}

/** Whether "Mark applied" puts the posting on the Applied stage: from no stage, or from the two before it. A later stage stays where it is. */
export function seedsApplied(stage: string | null): boolean {
  return stage === null || isPreApply(stage);
}

/** `hasApplied` as a filter on a person's row, for the queries that select applications. */
export const appliedWhere = {
  OR: [
    { status: 'APPLIED' },
    { appliedAt: { not: null } },
    { AND: [{ pipelineStage: { not: null } }, { pipelineStage: { notIn: UNSENT_KEYS } }] },
  ],
} satisfies Prisma.UserJobWhereInput;
