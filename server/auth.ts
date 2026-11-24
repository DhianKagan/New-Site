import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

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

export function createSessionToken(): string {
  const payload = {
    role: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;

  const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return payload.role === 'admin' && typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Потрібна авторизація адміністратора' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: 'Сесія недійсна або завершена. Увійдіть повторно.' });
    return;
  }
  next();
}
