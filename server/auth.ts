import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import type { ClientSessionUser, CrmSessionUser, StaffRole } from '../src/types.ts';
import { logger } from './logger.ts';
import { getRedisClient } from './redis.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');
const VALID_ROLES = new Set<StaffRole>(['admin', 'manager', 'engineer', 'installer']);

const requestUserMap = new WeakMap<Request, CrmSessionUser>();
const requestClientMap = new WeakMap<Request, ClientSessionUser>();

function getSigningSecret(): string {
  return process.env.SESSION_SECRET?.trim() || EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/** Async so a login attempt does not block the event loop during key derivation. */
export async function verifyScryptPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = await scryptAsync(password, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function verifyEnvPassword(password: string, expectedPassword: string): boolean {
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(expectedPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

interface BruteBucket {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

export interface RedisLikeForGuard {
  eval: (script: string, numkeys: number, ...args: (string | number)[]) => Promise<unknown>;
  pttl: (key: string) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
}

export interface LoginBruteForceGuard {
  check: (ip: string, identifier?: string) => Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }>;
  recordFailure: (
    ip: string,
    identifier?: string,
  ) => Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }>;
  recordSuccess: (ip: string, identifier?: string) => Promise<void>;
}

const BRUTE_FORCE_RECORD_LUA = `
local countKey = KEYS[1]
local lockKey = KEYS[2]
local windowMs = tonumber(ARGV[1])
local lockMs = tonumber(ARGV[2])
local maxAttempts = tonumber(ARGV[3])

local lockTtl = redis.call('PTTL', lockKey)
if lockTtl and lockTtl > 0 then
  return { 1, lockTtl, 0 }
end

local count = redis.call('INCR', countKey)
if count == 1 then
  redis.call('PEXPIRE', countKey, windowMs)
end

if count >= maxAttempts then
  redis.call('SET', lockKey, '1', 'PX', lockMs)
  redis.call('DEL', countKey)
  return { 1, lockMs, 0 }
end

return { 0, 0, maxAttempts - count }
`;

export function createLoginBruteForceGuard(options?: {
  windowMs?: number;
  lockDurationMs?: number;
  maxAttemptsPerPair?: number;
  maxAttemptsPerIdentifier?: number;
  maxAttemptsPerIp?: number;
  keyPrefix?: string;
  redis?: RedisLikeForGuard | null;
}): LoginBruteForceGuard {
  const windowMs = options?.windowMs ?? 15 * 60_000;
  const lockDurationMs = options?.lockDurationMs ?? 15 * 60_000;
  const maxAttemptsPerPair = options?.maxAttemptsPerPair ?? 5;
  const maxAttemptsPerIdentifier = options?.maxAttemptsPerIdentifier ?? 8;
  const maxAttemptsPerIp = options?.maxAttemptsPerIp ?? 12;
  const keyPrefix = options?.keyPrefix ?? 'ec:v1:bf';

  const pairBuckets = new Map<string, BruteBucket>();
  const idBuckets = new Map<string, BruteBucket>();
  const ipBuckets = new Map<string, BruteBucket>();

  function resolveRedis(): RedisLikeForGuard | null {
    if (options?.redis !== undefined) return options.redis;
    return getRedisClient();
  }

  function pruneMap(map: Map<string, BruteBucket>, now: number) {
    if (map.size < 2000) return;
    for (const [k, b] of map.entries()) {
      if (b.lockedUntil <= now && now - b.windowStart > windowMs) {
        map.delete(k);
      }
    }
  }

  function keysFor(ip: string, identifier?: string) {
    const cleanIp = ip.trim() || 'unknown';
    const cleanId = (identifier ?? '').trim().toLowerCase();
    return {
      ipKey: `ip:${cleanIp}`,
      idKey: cleanId ? `id:${cleanId}` : null,
      pairKey: cleanId ? `pair:${cleanIp}|${cleanId}` : null,
    };
  }

  function remainingLockSec(bucket: BruteBucket | undefined, now: number): number {
    if (!bucket || bucket.lockedUntil <= now) return 0;
    return Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000));
  }

  function bumpBucket(
    map: Map<string, BruteBucket>,
    key: string,
    maxAttempts: number,
    now: number,
  ): { locked: boolean; retryAfterSec: number; remaining: number } {
    pruneMap(map, now);
    let bucket = map.get(key);
    if (!bucket || (bucket.lockedUntil <= now && now - bucket.windowStart > windowMs)) {
      bucket = { failures: 0, windowStart: now, lockedUntil: 0 };
    }
    if (bucket.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSec: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)),
        remaining: 0,
      };
    }
    bucket.failures += 1;
    if (bucket.failures >= maxAttempts) {
      bucket.lockedUntil = now + lockDurationMs;
      map.set(key, bucket);
      return {
        locked: true,
        retryAfterSec: Math.max(1, Math.ceil(lockDurationMs / 1000)),
        remaining: 0,
      };
    }
    map.set(key, bucket);
    return {
      locked: false,
      retryAfterSec: 0,
      remaining: Math.max(0, maxAttempts - bucket.failures),
    };
  }

  async function redisBumpBucket(
    redis: RedisLikeForGuard,
    bucketKey: string,
    maxAttempts: number,
  ): Promise<{ locked: boolean; retryAfterSec: number; remaining: number }> {
    const countKey = `${keyPrefix}:cnt:${bucketKey}`;
    const lockKey = `${keyPrefix}:lock:${bucketKey}`;
    const res = (await redis.eval(
      BRUTE_FORCE_RECORD_LUA,
      2,
      countKey,
      lockKey,
      windowMs,
      lockDurationMs,
      maxAttempts,
    )) as [number, number, number];
    const locked = Number(res?.[0] ?? 0) === 1;
    const ttlMs = Number(res?.[1] ?? 0);
    const remaining = Math.max(0, Number(res?.[2] ?? 0));
    return {
      locked,
      retryAfterSec: locked ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0,
      remaining,
    };
  }

  return {
    async check(ip: string, identifier?: string) {
      const { ipKey, idKey, pairKey } = keysFor(ip, identifier);
      const redis = resolveRedis();
      if (redis) {
        try {
          const lockKeys = [
            `${keyPrefix}:lock:${ipKey}`,
            ...(idKey ? [`${keyPrefix}:lock:${idKey}`] : []),
            ...(pairKey ? [`${keyPrefix}:lock:${pairKey}`] : []),
          ];
          const ttls = await Promise.all(lockKeys.map((k) => redis.pttl(k)));
          const maxTtlMs = Math.max(0, ...ttls.map((v) => Number(v) || 0));
          if (maxTtlMs > 0) {
            return { allowed: false as const, retryAfterSec: Math.max(1, Math.ceil(maxTtlMs / 1000)) };
          }
          return { allowed: true as const };
        } catch (err) {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Redis brute-force check failed, falling back to in-memory');
        }
      }

      const now = Date.now();
      const retryAfterSec = Math.max(
        remainingLockSec(ipBuckets.get(ipKey), now),
        idKey ? remainingLockSec(idBuckets.get(idKey), now) : 0,
        pairKey ? remainingLockSec(pairBuckets.get(pairKey), now) : 0,
      );
      if (retryAfterSec > 0) {
        return { allowed: false as const, retryAfterSec };
      }
      return { allowed: true as const };
    },

    async recordFailure(ip: string, identifier?: string) {
      const { ipKey, idKey, pairKey } = keysFor(ip, identifier);
      const redis = resolveRedis();
      if (redis) {
        try {
          const [ipRes, idRes, pairRes] = await Promise.all([
            redisBumpBucket(redis, ipKey, maxAttemptsPerIp),
            idKey
              ? redisBumpBucket(redis, idKey, maxAttemptsPerIdentifier)
              : Promise.resolve({ locked: false, retryAfterSec: 0, remaining: maxAttemptsPerPair }),
            pairKey
              ? redisBumpBucket(redis, pairKey, maxAttemptsPerPair)
              : Promise.resolve({ locked: false, retryAfterSec: 0, remaining: maxAttemptsPerPair }),
          ]);
          const locked = ipRes.locked || idRes.locked || pairRes.locked;
          const retryAfterSec = Math.max(ipRes.retryAfterSec, idRes.retryAfterSec, pairRes.retryAfterSec);
          const remainingAttempts = Math.min(ipRes.remaining, idRes.remaining, pairRes.remaining);
          return { locked, retryAfterSec, remainingAttempts };
        } catch (err) {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Redis brute-force recordFailure failed, falling back to in-memory');
        }
      }

      const now = Date.now();
      const ipRes = bumpBucket(ipBuckets, ipKey, maxAttemptsPerIp, now);
      const idRes = idKey
        ? bumpBucket(idBuckets, idKey, maxAttemptsPerIdentifier, now)
        : { locked: false, retryAfterSec: 0, remaining: maxAttemptsPerPair };
      const pairRes = pairKey
        ? bumpBucket(pairBuckets, pairKey, maxAttemptsPerPair, now)
        : { locked: false, retryAfterSec: 0, remaining: maxAttemptsPerPair };
      const locked = ipRes.locked || idRes.locked || pairRes.locked;
      const retryAfterSec = Math.max(ipRes.retryAfterSec, idRes.retryAfterSec, pairRes.retryAfterSec);
      const remainingAttempts = Math.min(ipRes.remaining, idRes.remaining, pairRes.remaining);
      return { locked, retryAfterSec, remainingAttempts };
    },

    async recordSuccess(ip: string, identifier?: string) {
      const { idKey, pairKey } = keysFor(ip, identifier);
      const redis = resolveRedis();
      if (redis) {
        try {
          const delKeys: string[] = [];
          if (pairKey) {
            delKeys.push(`${keyPrefix}:cnt:${pairKey}`, `${keyPrefix}:lock:${pairKey}`);
          }
          if (idKey) {
            delKeys.push(`${keyPrefix}:cnt:${idKey}`, `${keyPrefix}:lock:${idKey}`);
          }
          if (delKeys.length > 0) {
            await redis.del(...delKeys);
          }
          return;
        } catch (err) {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Redis brute-force recordSuccess failed, falling back to in-memory');
        }
      }

      if (pairKey) pairBuckets.delete(pairKey);
      if (idKey) idBuckets.delete(idKey);
    },
  };
}

function signEncodedPayload(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyRawTokenPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as Record<string, unknown>;
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user?: Partial<CrmSessionUser>): string {
  const role: StaffRole = user?.role && VALID_ROLES.has(user.role) ? user.role : 'admin';
  return signEncodedPayload({
    kind: 'staff',
    userId: typeof user?.userId === 'number' ? user.userId : null,
    name: user?.name?.trim() || 'Адміністратор',
    login: user?.login?.trim() || 'admin',
    email: user?.email?.trim() || '',
    role,
    assigneeLabel: user?.assigneeLabel?.trim() || user?.name?.trim() || 'Адміністратор',
    exp: Date.now() + 24 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  });
}

export function verifySessionToken(token: string): CrmSessionUser | null {
  const payload = verifyRawTokenPayload(token);
  if (!payload) return null;
  if (payload.kind === 'client') return null;

  const role = payload.role as StaffRole;
  if (!VALID_ROLES.has(role)) {
    return null;
  }
  return {
    userId: typeof payload.userId === 'number' ? payload.userId : null,
    name: String(payload.name || 'Адміністратор'),
    login: String(payload.login || 'admin'),
    email: String(payload.email || ''),
    role,
    assigneeLabel: String(payload.assigneeLabel || payload.name || 'Адміністратор'),
  };
}

export function createClientSessionToken(customer: ClientSessionUser): string {
  return signEncodedPayload({
    kind: 'client',
    customerId: customer.customerId,
    name: customer.name.trim() || 'Клієнт',
    email: customer.email.trim().toLowerCase(),
    phone: customer.phone.trim(),
    city: customer.city.trim() || 'Одеса',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  });
}

export function verifyClientSessionToken(token: string): ClientSessionUser | null {
  const payload = verifyRawTokenPayload(token);
  if (!payload || payload.kind !== 'client') return null;
  const customerId = Number(payload.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) return null;
  return {
    customerId,
    name: String(payload.name || 'Клієнт'),
    email: String(payload.email || ''),
    phone: String(payload.phone || ''),
    city: String(payload.city || 'Одеса'),
  };
}

export function getCrmUser(req: Request): CrmSessionUser | null {
  return requestUserMap.get(req) ?? null;
}

export function getClientUser(req: Request): ClientSessionUser | null {
  return requestClientMap.get(req) ?? null;
}

export type StaffStateResult = {
  active: boolean;
  canLogin: boolean;
  role: StaffRole;
  name: string;
  login: string;
  email: string;
  assigneeLabel: string;
} | null;

export type StaffStateLookup = (userId: number) => StaffStateResult | Promise<StaffStateResult>;

export type ClientStateResult = {
  id: number;
  active: boolean;
  name: string;
  email: string;
  phone: string;
  city: string;
} | null;

export type ClientStateLookup = (customerId: number) => ClientStateResult | Promise<ClientStateResult>;

function isPromiseLike<T>(val: T | Promise<T>): val is Promise<T> {
  return Boolean(val && typeof (val as unknown as { then?: unknown }).then === 'function');
}

export function createRequireCrmAuth(lookupStaff?: StaffStateLookup) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Потрібна авторизація співробітника CRM' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    const sessionUser = verifySessionToken(token);
    if (!sessionUser) {
      res.status(401).json({ error: 'Сесія недійсна або завершена. Увійдіть повторно.' });
      return;
    }

    const applyFreshStaff = (fresh: StaffStateResult) => {
      if (!fresh || !fresh.active || !fresh.canLogin) {
        res.status(401).json({ error: 'Обліковий запис вимкнено або доступ до CRM відкликано' });
        return;
      }
      requestUserMap.set(req, {
        userId: sessionUser.userId,
        name: fresh.name,
        login: fresh.login,
        email: fresh.email,
        role: fresh.role,
        assigneeLabel: fresh.assigneeLabel,
      });
      next();
    };

    if (sessionUser.userId !== null && lookupStaff) {
      const result = lookupStaff(sessionUser.userId);
      if (isPromiseLike(result)) {
        result.then(applyFreshStaff).catch(() => {
          res.status(503).json({ error: 'Помилка перевірки сесії співробітника' });
        });
        return;
      }
      applyFreshStaff(result);
      return;
    }

    requestUserMap.set(req, sessionUser);
    next();
  };
}

export function createRequireClientAuth(lookupCustomer?: ClientStateLookup) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Потрібна авторизація в особистому кабінеті' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    const client = verifyClientSessionToken(token);
    if (!client) {
      res.status(401).json({ error: 'Сесія кабінету недійсна або завершена. Увійдіть повторно.' });
      return;
    }

    const applyFreshClient = (fresh: ClientStateResult) => {
      if (!fresh || !fresh.active) {
        res.status(401).json({ error: 'Акаунт клієнта вимкнено або не знайдено' });
        return;
      }
      requestClientMap.set(req, {
        customerId: fresh.id,
        name: fresh.name,
        email: fresh.email,
        phone: fresh.phone,
        city: fresh.city,
      });
      next();
    };

    if (lookupCustomer) {
      const result = lookupCustomer(client.customerId);
      if (isPromiseLike(result)) {
        result.then(applyFreshClient).catch(() => {
          res.status(503).json({ error: 'Помилка перевірки сесії клієнта' });
        });
        return;
      }
      applyFreshClient(result);
      return;
    }

    requestClientMap.set(req, client);
    next();
  };
}

export const requireAdminAuth = createRequireCrmAuth();

export function requireRoles(...allowed: StaffRole[]) {
  const allowedSet = new Set<StaffRole>(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getCrmUser(req);
    if (!user) {
      res.status(401).json({ error: 'Потрібна авторизація співробітника CRM' });
      return;
    }
    if (!allowedSet.has(user.role)) {
      res.status(403).json({ error: 'Недостатньо прав для виконання цієї дії' });
      return;
    }
    next();
  };
}
