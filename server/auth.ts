import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { CrmSessionUser, StaffRole } from '../src/types.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');
const VALID_ROLES = new Set<StaffRole>(['admin', 'manager', 'engineer', 'installer']);

const requestUserMap = new WeakMap<Request, CrmSessionUser>();

function getSigningSecret(): string {
  return process.env.SESSION_SECRET?.trim() || EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyScryptPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
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

export function createSessionToken(user?: Partial<CrmSessionUser>): string {
  const role: StaffRole = user?.role && VALID_ROLES.has(user.role) ? user.role : 'admin';
  const payload = {
    userId: typeof user?.userId === 'number' ? user.userId : null,
    name: user?.name?.trim() || 'Адміністратор',
    login: user?.login?.trim() || 'admin',
    email: user?.email?.trim() || '',
    role,
    assigneeLabel: user?.assigneeLabel?.trim() || user?.name?.trim() || 'Адміністратор',
    exp: Date.now() + 24 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): CrmSessionUser | null {
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
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      userId?: number | null;
      name?: string;
      login?: string;
      email?: string;
      role?: string;
      assigneeLabel?: string;
      exp?: number;
    };
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
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
  } catch {
    return null;
  }
}

export function getCrmUser(req: Request): CrmSessionUser | null {
  return requestUserMap.get(req) ?? null;
}

export type StaffStateLookup = (userId: number) => {
  active: boolean;
  canLogin: boolean;
  role: StaffRole;
  name: string;
  login: string;
  email: string;
  assigneeLabel: string;
} | null;

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

    if (sessionUser.userId !== null && lookupStaff) {
      const fresh = lookupStaff(sessionUser.userId);
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
    } else {
      requestUserMap.set(req, sessionUser);
    }

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
