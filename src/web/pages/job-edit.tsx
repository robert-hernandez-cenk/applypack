/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Button, Card, Field, Hint, Input, PageHeader, Textarea } from '../ui';
import { MAX_COMPANY_CHARS, MAX_LOCATION_CHARS, MAX_TITLE_CHARS, type JobEditError, type JobEditForm } from '../../jobs/job-edit';
import { MAX_POSTING_CHARS, MIN_DESCRIPTION_CHARS } from '../../jobs/posting-limits';
import { jobHref, type JobTab } from '../job-tabs';
import { t } from '../../i18n/t';

/*
 * The edit page (#46): the four fields a person can add context to, with
 * what they typed kept when a save is refused. A posting someone else also
 * holds gets the explanation and no form.
 */

export interface JobEditPageProps {
  job: { id: number; title: string };
  values: JobEditForm;
  error?: JobEditError;
  tab: JobTab;
}

const errorText = (error: JobEditError): string =>
  t(`jobEdit.error.${error}`, {
    min: MIN_DESCRIPTION_CHARS,
    max: error === 'titleTooLong' ? MAX_TITLE_CHARS : error === 'companyTooLong' ? MAX_COMPANY_CHARS : error === 'locationTooLong' ? MAX_LOCATION_CHARS : MAX_POSTING_CHARS,
  });

const Header: FC<{ job: { id: number; title: string }; tab: JobTab }> = ({ job, tab }) => (
  <PageHeader title={t('jobEdit.heading')} meta={<span translate="no">{job.title}</span>} back={{ href: jobHref(job.id, tab), label: t('job.backToTheJob') }} />
);

export const JobEditPage: FC<JobEditPageProps> = ({ job, values, error, tab }) => (
  <Layout title={t('jobEdit.title')} active="jobs">
    <Header job={job} tab={tab} />
    <Card>
      <Hint class="mb-4">{t('jobEdit.intro')}</Hint>
      {error && (
        <p role="alert" class="mb-4 text-sm text-danger">
          {errorText(error)}
        </p>
      )}
      <form method="post" action={`/jobs/${job.id}/edit`} class="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="tab" value={tab} />
        <Field label={t('jobEdit.field.title')}>
          <Input type="text" name="title" required maxlength={MAX_TITLE_CHARS} value={values.title} translate="no" />
        </Field>
        <Field label={t('jobEdit.field.company')} hint={t('jobEdit.hint.company')}>
          <Input type="text" name="company" maxlength={MAX_COMPANY_CHARS} value={values.company} translate="no" />
        </Field>
        <Field label={t('jobEdit.field.location')} class="sm:col-span-2">
          <Input type="text" name="location" maxlength={MAX_LOCATION_CHARS} value={values.location} translate="no" />
        </Field>
        <Field label={t('jobEdit.field.description')} hint={t('jobEdit.hint.description')} class="sm:col-span-2">
          <Textarea name="description" rows={18} translate="no">
            {values.description}
          </Textarea>
        </Field>
        <div class="flex items-center gap-3 sm:col-span-2">
          <Button size="lg">{t('jobEdit.save')}</Button>
          <Button href={jobHref(job.id, tab)} variant="secondary" size="lg">
            {t('jobEdit.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  </Layout>
);

/** The posting is held by other people too: it is theirs to read as it was. */
export const JobEditSharedPage: FC<{ job: { id: number; title: string }; tab: JobTab }> = ({ job, tab }) => (
  <Layout title={t('jobEdit.title')} active="jobs">
    <Header job={job} tab={tab} />
    <Card>
      <p class="text-sm leading-6 text-ink">{t('jobEdit.shared')}</p>
    </Card>
  </Layout>
);
