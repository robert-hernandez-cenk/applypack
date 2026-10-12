import { serve } from '@hono/node-server';
import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { app, connectSignIn } from './app';
import { announceReady, onLauncherStop } from '../local/child';
import { stopCliChildren } from '../ai-provider';

async function listen(): Promise<ReturnType<typeof serve>> {
  try {
    await connectSignIn();
  } catch (err) {
    // A lock that cannot open is no lock: stop here instead of serving without it (ADR 0064).
    logger.error({ err }, 'web: the identity provider could not be reached — refusing to start');
    process.exit(1);
  }
  return serve(
    {
      fetch: app.fetch,
      port: config.WEB_PORT,
      hostname: config.WEB_HOST,
    },
    (info) => {
      logger.info(
        { host: info.address, port: info.port },
        'web: listening',
      );
      announceReady();
    },
  );
}

const listening = listen();

async function shutdown(signal: string): Promise<void> {
  // A comparison's CLI call in flight would otherwise run on, orphaned, to its timeout (H43).
  logger.info({ signal, cliChildren: stopCliChildren() }, 'web: shutting down');
  const server = await listening;
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
onLauncherStop((reason) => void shutdown(reason));
