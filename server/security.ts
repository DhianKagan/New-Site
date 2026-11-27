import crypto from 'node:crypto';
import type { Request } from 'express';

export interface SecurityHeaderOptions {
  isHttps: boolean;
  enforceFrameProtection: boolean;
}

export function isRequestHttps(req: Pick<Request, 'secure' | 'headers'>): boolean {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return forwardedProto === 'https';
}

export function shouldEnforceFrameProtection(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = (env.ENFORCE_FRAME_PROTECTION || '').trim().toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;
  return Boolean(env.RAILWAY_ENVIRONMENT?.trim() || env.RAILWAY_PROJECT_ID?.trim());
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const cspDirectives = ["base-uri 'self'", "object-src 'none'"];
  if (options.enforceFrameProtection) {
    cspDirectives.push("frame-ancestors 'self'");
  }

  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Content-Security-Policy': cspDirectives.join('; '),
  };

  if (options.enforceFrameProtection) {
    headers['X-Frame-Options'] = 'SAMEORIGIN';
  }

  if (options.isHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

export type TelegramWebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 503; error: string }
  | { ok: false; status: 403; error: string };

export function verifyTelegramWebhookSecret(
  expectedSecret: string | undefined,
  providedSecret: string | undefined,
): TelegramWebhookAuthResult {
  const expected = expectedSecret?.trim() || '';
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'TELEGRAM_WEBHOOK_SECRET is not configured on the server',
    };
  }

  const provided = typeof providedSecret === 'string' ? providedSecret : '';
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  if (!provided || !crypto.timingSafeEqual(providedHash, expectedHash)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden',
    };
  }

  return { ok: true };
}

export type AdminSetupTokenResult =
  | { ok: true }
  | { ok: false; status: 503; error: string }
  | { ok: false; status: 403; error: string };

export function verifyAdminSetupToken(
  expectedToken: string | undefined,
  providedToken: string | undefined,
): AdminSetupTokenResult {
  const expected = expectedToken?.trim() || '';
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'Задайте ADMIN_SETUP_TOKEN у змінних оточення сервера для первинного налаштування адміністратора',
    };
  }

  const provided = typeof providedToken === 'string' ? providedToken.trim() : '';
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  if (!provided || !crypto.timingSafeEqual(providedHash, expectedHash)) {
    return {
      ok: false,
      status: 403,
      error: 'Невірний або відсутній одноразовий токен налаштування (X-Setup-Token)',
    };
  }

  return { ok: true };
}

export function resolveTrustedRequestHost(
  headerHost: string | undefined,
  queryHost: string | undefined,
): string {
  const cleanHeader = (headerHost || '').split(',')[0].trim();
  if (cleanHeader) return cleanHeader;
  return (queryHost || '').trim();
}

export function collectMissingProductionEnvWarnings(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const warnings: string[] = [];
  if (!env.SESSION_SECRET?.trim()) {
    warnings.push('SESSION_SECRET is not set; using an ephemeral in-memory signing key (sessions reset on restart).');
  }
  if (!env.ADMIN_PASSWORD?.trim()) {
    warnings.push('ADMIN_PASSWORD is not set; master admin relies on claimed DB setup hash.');
  }
  if (!env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
    warnings.push('TELEGRAM_WEBHOOK_SECRET is not set; /api/telegram/webhook will reject requests until configured.');
  }
  return warnings;
}
