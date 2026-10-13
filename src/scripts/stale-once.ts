import { logger } from '../logger';
import { prisma } from '../db';
import { runStaleApplicationsJob } from '../jobs/stale-applications-job';
import { runForEveryUser } from '../jobs/for-each-user';

// Asked for now, so every person gets their nudge; each is its own run (ADR 0069).
runForEveryUser('stale-applications', runStaleApplicationsJob)
  .then(async (failed) => {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    logger.error({ err }, 'stale-once: failed');
    void prisma.$disconnect().finally(() => process.exit(1));
  });
