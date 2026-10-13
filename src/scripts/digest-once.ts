import { logger } from '../logger';
import { prisma } from '../db';
import { runDigestJob } from '../jobs/digest-job';
import { runForEveryUser } from '../jobs/for-each-user';

// Asked for now, so every person gets their recap; each is its own run (ADR 0069).
runForEveryUser('digest', runDigestJob)
  .then(async (failed) => {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    logger.error({ err }, 'digest-once: failed');
    void prisma.$disconnect().finally(() => process.exit(1));
  });
