import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createLoginBruteForceGuard, type RedisLikeForGuard } from '../server/auth.ts';
import { createRateLimiter, type RedisLikeForRateLimit } from '../server/rateLimit.ts';

function createFakeRedis(): RedisLikeForGuard & RedisLikeForRateLimit {
  const store = new Map<string, { value: string; expiresAt: number }>();

  const prune = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry ?? null;
  };

  return {
    async pttl(key: string): Promise<number> {
      const entry = prune(key);
      if (!entry) return -2;
      if (entry.expiresAt <= 0) return -1;
      return Math.max(1, entry.expiresAt - Date.now());
    },

    async del(...keys: string[]): Promise<number> {
      let deleted = 0;
      for (const k of keys) {
        if (store.delete(k)) deleted += 1;
      }
      return deleted;
    },

    async eval(script: string, _numkeys: number, ...args: (string | number)[]): Promise<unknown> {
      if (script.includes('lockKey')) {
        const [countKey, lockKey, rawWindowMs, rawLockMs, rawMax] = args;
        const windowMs = Number(rawWindowMs);
        const lockMs = Number(rawLockMs);
        const maxAttempts = Number(rawMax);
        const lockEntry = prune(String(lockKey));
        if (lockEntry) {
          return [1, Math.max(1, lockEntry.expiresAt - Date.now()), 0];
        }
        const curEntry = prune(String(countKey));
        const nextCount = (curEntry ? Number(curEntry.value) : 0) + 1;
        const expiresAt = curEntry ? curEntry.expiresAt : Date.now() + windowMs;
        store.set(String(countKey), { value: String(nextCount), expiresAt });
        if (nextCount >= maxAttempts) {
          store.set(String(lockKey), { value: '1', expiresAt: Date.now() + lockMs });
          store.delete(String(countKey));
          return [1, lockMs, 0];
        }
        return [0, 0, maxAttempts - nextCount];
      }

      const [key, rawWindowMs] = args;
      const windowMs = Number(rawWindowMs);
      const existing = prune(String(key));
      const current = (existing ? Number(existing.value) : 0) + 1;
      const expiresAt = existing ? existing.expiresAt : Date.now() + windowMs;
      store.set(String(key), { value: String(current), expiresAt });
      return [current, Math.max(1, expiresAt - Date.now())];
    },
  };
}

async function runMiddleware(mw: ReturnType<typeof createRateLimiter>, ip: string) {
  const req = { ip, socket: { remoteAddress: ip } } as unknown as Request;
  let statusCode = 200;
  let body: unknown = null;
  const headers: Record<string, string> = {};
  let passed = false;

  const res = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;

  await mw(req, res, (() => {
    passed = true;
  }) as NextFunction);

  return { statusCode, body, headers, passed };
}

test('createRateLimiter enforces limits in-memory when Redis is unavailable', async () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    message: 'Too many requests',
    redis: null,
  });

  const r1 = await runMiddleware(limiter, '10.0.0.1');
  const r2 = await runMiddleware(limiter, '10.0.0.1');
  const r3 = await runMiddleware(limiter, '10.0.0.1');

  assert.equal(r1.passed, true);
  assert.equal(r2.passed, true);
  assert.equal(r3.passed, false);
  assert.equal(r3.statusCode, 429);
  assert.ok(Number(r3.headers['retry-after']) >= 1);
});

test('createRateLimiter shares counters across two replica instances backed by Redis', async () => {
  const sharedRedis = createFakeRedis();
  const replicaA = createRateLimiter({
    prefix: 'ec:test:rl',
    windowMs: 60_000,
    max: 3,
    message: 'Limit reached',
    redis: sharedRedis,
  });
  const replicaB = createRateLimiter({
    prefix: 'ec:test:rl',
    windowMs: 60_000,
    max: 3,
    message: 'Limit reached',
    redis: sharedRedis,
  });

  assert.equal((await runMiddleware(replicaA, '192.168.1.10')).passed, true);
  assert.equal((await runMiddleware(replicaB, '192.168.1.10')).passed, true);
  assert.equal((await runMiddleware(replicaA, '192.168.1.10')).passed, true);
  const fourth = await runMiddleware(replicaB, '192.168.1.10');
  assert.equal(fourth.passed, false);
  assert.equal(fourth.statusCode, 429);
});

test('createLoginBruteForceGuard shares lockouts across replicas in Redis and clears on success', async () => {
  const sharedRedis = createFakeRedis();
  const guardA = createLoginBruteForceGuard({
    windowMs: 60_000,
    lockDurationMs: 60_000,
    maxAttemptsPerPair: 2,
    maxAttemptsPerIdentifier: 5,
    maxAttemptsPerIp: 10,
    keyPrefix: 'ec:test:bf',
    redis: sharedRedis,
  });
  const guardB = createLoginBruteForceGuard({
    windowMs: 60_000,
    lockDurationMs: 60_000,
    maxAttemptsPerPair: 2,
    maxAttemptsPerIdentifier: 5,
    maxAttemptsPerIp: 10,
    keyPrefix: 'ec:test:bf',
    redis: sharedRedis,
  });

  assert.deepEqual(await guardA.check('1.2.3.4', 'admin@example.com'), { allowed: true });

  const fail1 = await guardA.recordFailure('1.2.3.4', 'admin@example.com');
  assert.equal(fail1.locked, false);
  assert.equal(fail1.remainingAttempts, 1);

  const fail2 = await guardB.recordFailure('1.2.3.4', 'admin@example.com');
  assert.equal(fail2.locked, true);

  const blockedOnA = await guardA.check('1.2.3.4', 'admin@example.com');
  assert.equal(blockedOnA.allowed, false);

  await guardB.recordSuccess('1.2.3.4', 'admin@example.com');
  assert.deepEqual(await guardA.check('1.2.3.4', 'admin@example.com'), { allowed: true });
});

test('createLoginBruteForceGuard works in-memory when Redis is unset', async () => {
  const guard = createLoginBruteForceGuard({
    windowMs: 60_000,
    lockDurationMs: 60_000,
    maxAttemptsPerPair: 2,
    redis: null,
  });

  await guard.recordFailure('5.6.7.8', 'user@example.com');
  const second = await guard.recordFailure('5.6.7.8', 'user@example.com');
  assert.equal(second.locked, true);
  const check = await guard.check('5.6.7.8', 'user@example.com');
  assert.equal(check.allowed, false);
  await guard.recordSuccess('5.6.7.8', 'user@example.com');
  assert.deepEqual(await guard.check('5.6.7.8', 'user@example.com'), { allowed: true });
});
