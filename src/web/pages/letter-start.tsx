/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Button, Card, Checkbox, Flash, Hint, Input, PageHeader, SectionTitle, Select, Textarea } from '../ui';
import type { FlashMessage } from '../flash';
import type { ResumeOption } from '../resume-source';
import type { JobPickOption } from '../job-pick';
import { JobPicker } from './job-picker';
import { toneLabel } from './cover-letter-card';
import { COVER_TONES, type CoverAngles } from '../../resume/prompts';
import { t } from '../../i18n/t';
import { tRich } from '../rich';

/*
 * The /letter launcher (F8.3): a searchable picker over the jobs already
 * stored and a select over the saved resumes. A posting is added at /jobs/new
 * and a resume on the Resumes page first (#55). The default path is the fast
 * one: no classification, no match, no research — one model call and the
 * letter.
 */

export interface LetterStartProps {
  jobs: JobPickOption[];
  resumes: ResumeOption[];
  angles: CoverAngles;
  flash?: FlashMessage | null;
}

export const LetterStartPage: FC<LetterStartProps> = ({
  jobs,
  resumes,
  angles,
  flash,
}) => {
  const hasResumes = resumes.length > 0;
  const hasJobs = jobs.length > 0;
  const defaultResumeId = (resumes.find((r) => r.isDefault) ?? resumes[0])?.id;
  return (
    <Layout title={t('nav.letter')} active="letter">
      <PageHeader title={t('nav.letter')} meta={t('letter.start.howLong')}>
        {t('letter.aShortLetterGroundedIn')}
      </PageHeader>
      <Flash flash={flash} />

      <form id="letter-form" method="post" action="/letter" enctype="multipart/form-data" class="w-full">
        <input type="hidden" name="saveAngles" value="1" />
        <div class="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle>{t('letter.jobPosting')}</SectionTitle>
            {hasJobs ? (
              <JobPicker jobs={jobs} required>{t('letter.start.pickerTail')}</JobPicker>
            ) : (
              <Hint>
                {tRich('letter.start.noJobs', {}, {
                  add: (words) => (
                    <a href="/jobs/new" class="font-medium text-accent-strong hover:text-accent-deep">
                      {words}
                    </a>
                  ),
                })}
              </Hint>
            )}
          </Card>

          <Card>
            <SectionTitle>{t('letter.resume')}</SectionTitle>
            {hasResumes ? (
              <Select name="resumeId" aria-label={t('letter.resume')}>
                {resumes.map((r) => (
                  <option value={r.id} selected={r.id === defaultResumeId} translate="no">
                    {r.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Hint>
                {tRich('letter.start.noResumes', {}, {
                  upload: (words) => (
                    <a href="/resumes" class="font-medium text-accent-strong hover:text-accent-deep">
                      {words}
                    </a>
                  ),
                })}
              </Hint>
            )}
          </Card>
        </div>

        <Card class="mt-4">
          <SectionTitle>{t('letter.theLetter')}</SectionTitle>
          <div class="space-y-3">
            <div class="flex flex-wrap items-end gap-4">
              <label class="block">
                <span class="block text-label text-ink">{t('letter.tone')}</span>
                <Select name="tone" class="mt-1.5 !w-auto">
                  {COVER_TONES.map((tone) => (
                    <option value={tone} selected={tone === 'warm'}>
                      {toneLabel(tone)}
                    </option>
                  ))}
                </Select>
              </label>
              <Button size="lg" variant="violet">
                {t('letter.writeTheLetter')}
              </Button>
            </div>

            <div class="grid gap-2.5 sm:grid-cols-3">
              <label class="block">
                <span class="block text-meta text-ink-muted">{t('letter.whyThisCompany')}</span>
                <Input name="whyCompany" maxlength="300" class="mt-1 !text-meta" value={angles.whyCompany ?? ''} />
              </label>
              <label class="block">
                <span class="block text-meta text-ink-muted">{t('letter.whatProblemYoudSolve')}</span>
                <Input name="problem" maxlength="300" class="mt-1 !text-meta" value={angles.problem ?? ''} />
              </label>
              <label class="block">
                <span class="block text-meta text-ink-muted">{t('letter.yourApproach')}</span>
                <Input name="approach" maxlength="300" class="mt-1 !text-meta" value={angles.approach ?? ''} />
              </label>
            </div>
            <label class="block">
              <span class="block text-meta text-ink-muted">{t('letter.anythingEveryLetterShouldMention')}</span>
              <Textarea name="notes" rows={2} maxlength="500" class="mt-1 !text-meta" placeholder={t('letter.start.notesPlaceholder')}>
                {angles.notes ?? ''}
              </Textarea>
            </label>
            <Hint>
              {t('letter.savedForYourNextLetters')}
            </Hint>

            <details class="rounded-md border border-line px-3 py-2">
              <summary class="cursor-pointer text-note font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
                {t('letter.analyzeFirstSlowerSharper')}
              </summary>
              <div class="mt-2.5 space-y-2">
                <Checkbox name="runMatch" value="1">
                  {t('letter.scoreThisResumeAgainstThe')}
                </Checkbox>
                <Checkbox name="runVerify" value="1">
                  {t('letter.researchTheCompanyFirst2')}
                </Checkbox>
                <Hint>
                  {t('letter.bothAreStoredOnThe')}
                </Hint>
              </div>
            </details>
          </div>
        </Card>
      </form>
      <script type="module" dangerouslySetInnerHTML={{ __html: BOOT_JS }} />
    </Layout>
  );
};

const BOOT_JS = `
import { init } from '/static/launcher.mjs';
init();
`;
