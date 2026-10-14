import { logger } from '../logger';
import { prisma } from '../db';
import { gmailTick } from '../jobs/gmail-tick';

// Asked for now: every connected person's label is read, each as its own run (ADR 0071).
// Asks for the fetch lock once and gives up if a fetch holds it, as the other once-scripts do.
gmailTick('all', { waitMs: 0 })
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, 'gmail-once: failed');
    void prisma.$disconnect().finally(() => process.exit(1));
  });
