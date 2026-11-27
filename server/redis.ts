import { Redis } from 'ioredis';
import { logger } from './logger.ts';

let redisClient: Redis | null = null;
let warnedMissingRedis = false;
let lastRedisErrorLogMs = 0;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

function logRedisWarning(message: string): void {
  const now = Date.now();
  if (now - lastRedisErrorLogMs < 15_000) return;
  lastRedisErrorLogMs = now;
  logger.warn(message);
}

export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      logger.warn('REDIS_URL is not configured; using in-memory fallback for rate-limiting, brute-force guard, and caches');
    }
    return null;
  }

  if (!redisClient) {
    const url = process.env.REDIS_URL!.trim();
    const isTls = url.startsWith('rediss://');
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      connectTimeout: 5_000,
      commandTimeout: 3_000,
      retryStrategy: (times) => Math.min(times * 200, 3_000),
      ...(isTls && process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false'
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    });

    redisClient.on('error', (err) => {
      logRedisWarning(`[redis] Client error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  return redisClient;
}

export async function checkRedisHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!isRedisConfigured()) {
    return { configured: false, ok: true };
  }
  const client = getRedisClient();
  if (!client) {
    return { configured: true, ok: false, error: 'Redis client unavailable' };
  }
  const started = Date.now();
  try {
    const pong = await client.ping();
    if (pong !== 'PONG') {
      return { configured: true, ok: false, error: `Unexpected PING response: ${pong}` };
    }
    return { configured: true, ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : 'Redis health check failed',
    };
  }
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logRedisWarning(`[redis] Failed to read cache key ${key}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const safeTtl = Math.max(1, Math.round(ttlSec));
    await client.set(key, JSON.stringify(value), 'EX', safeTtl);
  } catch (err) {
    logRedisWarning(`[redis] Failed to write cache key ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function redisDel(...keys: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch (err) {
    logRedisWarning(`[redis] Failed to delete cache keys: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function closeRedis(): Promise<void> {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  try {
    await Promise.race([
      client.quit(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          client.disconnect();
          resolve();
        }, 2_000);
      }),
    ]);
  } catch {
    client.disconnect();
  }
}
