import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './infrastructure/logging/logger.js';
import { closeDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    // Run database migrations during startup
    await runMigrations();

    const app = buildApp();
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀 Finance Command Center Backend API running at ${address}`);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      await app.close();
      await closeDb();
      logger.info('Server and database connections closed cleanly.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.fatal({ err }, 'Failed to start API server');
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
