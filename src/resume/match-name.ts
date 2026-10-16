/*
 * Which earlier comparison a delta is measured against: the most recent
 * earlier one of the same resume.
 */

interface ComparedRow {
  resumeId: number;
  createdAt: Date;
}

/** The most recent earlier comparison of the same resume — for the "vs last time" delta. */
export function previousFor<T extends ComparedRow>(selected: T, matches: T[]): T | null {
  return matches.find((m) => m.resumeId === selected.resumeId && m.createdAt < selected.createdAt) ?? null;
}
