import { DEFAULT_USER_ID } from '../users/identity';
import { logger } from '../logger';
import { prisma } from '../db';
import { runStaleApplicationsJob } from '../jobs/stale-applications-job';
import { recordCronRun } from '../jobs/cron-run';
import { inRunLocale } from '../run-locale';

inRunLocale(() => recordCronRun('stale-applications', () => runStaleApplicationsJob(DEFAULT_USER_ID)))
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'stale-once: failed');
    void prisma.$disconnect().finally(() => process.exit(1));
  });
