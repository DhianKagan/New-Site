import type { RequestHandler } from 'express';
import { logger } from './logger.ts';
import { getRedisClient } from './redis.ts';

export interface RedisLikeForRateLimit {
  eval: (script: string, numkeys: number, ...args: (string | number)[]) => Promise<unknown>;
}

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  prefix?: string;
  redis?: RedisLikeForRateLimit | null;
}): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const prefix = options.prefix ?? `ec:v1:rl:${options.windowMs}:${options.max}`;

  function resolveRedis(): RedisLikeForRateLimit | null {
    if (options.redis !== undefined) return options.redis;
    return getRedisClient();
  }

  function applyInMemory(ip: string, res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) {
    const now = Date.now();
    if (hits.size > 2000) {
      for (const [key, bucket] of hits.entries()) {
        if (bucket.resetAt <= now) hits.delete(key);
      }
    }
    const existing = hits.get(ip);
    if (!existing || existing.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (existing.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: options.message });
      return;
    }
    existing.count += 1;
    next();
  }

  return async (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const redis = resolveRedis();
    if (redis) {
      try {
        const key = `${prefix}:${ip}`;
        const result = (await redis.eval(RATE_LIMIT_LUA, 1, key, options.windowMs)) as [number, number];
        const current = Number(result?.[0] ?? 1);
        const ttlMs = Number(result?.[1] ?? options.windowMs);
        if (current > options.max) {
          const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));
          res.setHeader('Retry-After', String(retryAfterSec));
          res.status(429).json({ error: options.message });
          return;
        }
        next();
        return;
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Redis rate limiter failed, falling back to in-memory');
      }
    }

    applyInMemory(ip, res, next);
  };
}
