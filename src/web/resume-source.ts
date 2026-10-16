import { listResumes } from '../resume/store';
import { resumeOptionLabel } from './resume-label';
import { currentUser } from './current-user';

/* The saved resumes a launcher (/letter) offers in its select. */

export interface ResumeOption {
  id: number;
  isDefault: boolean;
  label: string;
}

export async function listResumeOptions(): Promise<ResumeOption[]> {
  return (await listResumes(currentUser().id)).map((r) => ({ id: r.id, isDefault: r.isDefault, label: resumeOptionLabel(r) }));
}
