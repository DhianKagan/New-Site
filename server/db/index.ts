import {
  reconcileSeedCatalogOnStartup,
  seedCatalogIfEmpty,
  seedProjectsIfEmpty,
} from './catalog.ts';
import { isDatabaseConfigured, runMigrations } from './client.ts';
import { seedDealsIfEmpty } from './deals.ts';
import { ensureMasterAdminAccount, seedStaffIfEmpty } from './staff.ts';
import { backfillContactsAndSeedCrm } from './tasks.ts';

let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations();
      await seedCatalogIfEmpty();
      await reconcileSeedCatalogOnStartup();
      await seedDealsIfEmpty();
      await backfillContactsAndSeedCrm();
      await seedStaffIfEmpty();
      await ensureMasterAdminAccount();
      await seedProjectsIfEmpty();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export * from './client.ts';
export * from './utils.ts';
export * from './settings.ts';
export * from './catalog.ts';
export * from './contacts.ts';
export * from './deals.ts';
export * from './tasks.ts';
export * from './staff.ts';
export * from './customers.ts';
export * from './reviews.ts';
