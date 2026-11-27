import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { logger } from '../logger.ts';
import * as schema from '../schema.ts';

const { Pool } = pg;

export type AppDatabase = NodePgDatabase<typeof schema>;

let poolInstance: pg.Pool | null = null;
let dbInstance: AppDatabase | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function buildPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  const max = Math.max(2, Math.min(50, Number(process.env.PG_POOL_MAX) || 10));
  const useSsl =
    process.env.DATABASE_SSL?.trim().toLowerCase() === 'true' ||
    /sslmode=(require|verify-full|verify-ca)/i.test(connectionString);

  return {
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' } } : {}),
  };
}

export function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool(buildPoolConfig());
    poolInstance.on('error', (err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Unexpected idle Postgres client error');
    });
  }
  return poolInstance;
}

export function getDb(): AppDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: 'DATABASE_URL is not configured' };
  }
  const started = Date.now();
  try {
    await getPool().query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Postgres query failed' };
  }
}

export async function runMigrations(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('Cannot run migrations: DATABASE_URL is not configured');
  }
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(getDb(), { migrationsFolder });
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    const pool = poolInstance;
    poolInstance = null;
    dbInstance = null;
    await pool.end();
  }
}
