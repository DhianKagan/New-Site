import 'dotenv/config';
import { logger } from '../logger.ts';
import { closeDatabasePool, isDatabaseConfigured, runMigrations } from './client.ts';

async function main() {
  if (!isDatabaseConfigured()) {
    logger.error('DATABASE_URL is required to run migrations');
    process.exit(1);
  }
  await runMigrations();
  logger.info('PostgreSQL migrations applied successfully');
  await closeDatabasePool();
}

main().catch(async (err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'PostgreSQL migration failed');
  await closeDatabasePool().catch(() => undefined);
  process.exit(1);
});
