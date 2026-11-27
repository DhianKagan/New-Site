import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  createRequireCrmAuth,
  createSessionToken,
  requireRoles,
} from '../server/auth.ts';
import {
  buildSecurityHeaders,
  collectMissingProductionEnvWarnings,
  isRequestHttps,
  resolveTrustedRequestHost,
  shouldEnforceFrameProtection,
  verifyAdminSetupToken,
  verifyTelegramWebhookSecret,
} from '../server/security.ts';

test('verifyTelegramWebhookSecret rejects missing server secret with 503 and invalid token with 403', () => {
  const unconfigured = verifyTelegramWebhookSecret(undefined, 'anything');
  assert.equal(unconfigured.ok, false);
  if (!unconfigured.ok) {
    assert.equal(unconfigured.status, 503);
  }

  const blank = verifyTelegramWebhookSecret('   ', 'anything');
  assert.equal(blank.ok, false);
  if (!blank.ok) {
    assert.equal(blank.status, 503);
  }

  const wrong = verifyTelegramWebhookSecret('super-secret-token', 'wrong-token');
  assert.equal(wrong.ok, false);
  if (!wrong.ok) {
    assert.equal(wrong.status, 403);
  }

  const missingHeader = verifyTelegramWebhookSecret('super-secret-token', '');
  assert.equal(missingHeader.ok, false);
  if (!missingHeader.ok) {
    assert.equal(missingHeader.status, 403);
  }

  const valid = verifyTelegramWebhookSecret('super-secret-token', 'super-secret-token');
  assert.deepEqual(valid, { ok: true });
});

test('buildSecurityHeaders adds HSTS on HTTPS and frame protection only when enabled (e.g., Railway)', () => {
  const previewHeaders = buildSecurityHeaders({
    isHttps: true,
    enforceFrameProtection: false,
  });
  assert.equal(previewHeaders['X-Content-Type-Options'], 'nosniff');
  assert.equal(previewHeaders['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(previewHeaders['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
  assert.equal(previewHeaders['X-Permitted-Cross-Domain-Policies'], 'none');
  assert.equal(previewHeaders['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  assert.equal(previewHeaders['X-Frame-Options'], undefined);
  assert.doesNotMatch(previewHeaders['Content-Security-Policy'], /frame-ancestors/);

  const railwayHeaders = buildSecurityHeaders({
    isHttps: true,
    enforceFrameProtection: true,
  });
  assert.equal(railwayHeaders['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(railwayHeaders['Content-Security-Policy'], /frame-ancestors 'self'/);

  assert.equal(shouldEnforceFrameProtection({ RAILWAY_ENVIRONMENT: 'production' }), true);
  assert.equal(shouldEnforceFrameProtection({}), false);
  assert.equal(
    isRequestHttps({ secure: false, headers: { 'x-forwarded-proto': 'https, http' } }),
    true,
  );
});

test('resolveTrustedRequestHost prefers Host/X-Forwarded-Host header over query override', () => {
  assert.equal(
    resolveTrustedRequestHost('energocomfort.shop, proxy.local', 'spoofed.example.com'),
    'energocomfort.shop',
  );
  assert.equal(resolveTrustedRequestHost('', 'localhost'), 'localhost');
});

test('collectMissingProductionEnvWarnings flags unset critical secrets in production', () => {
  assert.deepEqual(collectMissingProductionEnvWarnings({ NODE_ENV: 'development' }), []);

  const warnings = collectMissingProductionEnvWarnings({ NODE_ENV: 'production' });
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /SESSION_SECRET/);
  assert.match(warnings[1], /ADMIN_PASSWORD/);
  assert.match(warnings[2], /TELEGRAM_WEBHOOK_SECRET/);

  assert.deepEqual(
    collectMissingProductionEnvWarnings({
      NODE_ENV: 'production',
      SESSION_SECRET: 's',
      ADMIN_PASSWORD: 'p',
      TELEGRAM_WEBHOOK_SECRET: 'w',
    }),
    [],
  );
});

test('CRM role middleware blocks installer from manager/engineer/admin mutations', () => {
  const installerToken = createSessionToken({
    userId: null,
    name: 'Монтажна бригада',
    login: 'brigade1',
    role: 'installer',
  });
  const engineerToken = createSessionToken({
    userId: null,
    name: 'Олександр',
    login: 'alex',
    role: 'engineer',
  });

  const authMw = createRequireCrmAuth();
  const dealRoleMw = requireRoles('admin', 'manager', 'engineer');

  const runChain = (token: string) => {
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    let statusCode = 200;
    let body: unknown = null;
    let passed = false;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    authMw(req, res, (() => {
      dealRoleMw(req, res, (() => {
        passed = true;
      }) as NextFunction);
    }) as NextFunction);

    return { statusCode, body, passed };
  };

  const installerRes = runChain(installerToken);
  assert.equal(installerRes.passed, false);
  assert.equal(installerRes.statusCode, 403);

  const engineerRes = runChain(engineerToken);
  assert.equal(engineerRes.passed, true);
  assert.equal(engineerRes.statusCode, 200);
});

test('server.ts enforces role restrictions on deals, contacts, and Telegram endpoints', () => {
  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert.match(serverSource, /app\.post\('\/api\/crm\/deals',\s*requireRoles\('admin',\s*'manager',\s*'engineer'\)/);
  assert.match(serverSource, /app\.patch\('\/api\/crm\/deals\/:id',\s*requireRoles\('admin',\s*'manager',\s*'engineer'\)/);
  assert.match(serverSource, /app\.post\('\/api\/crm\/telegram-test',\s*requireRoles\('admin',\s*'manager'\)/);
  assert.match(serverSource, /app\.get\('\/api\/crm\/telegram-webhook',\s*requireRoles\('admin'\)/);
  assert.match(serverSource, /verifyTelegramWebhookSecret\(/);
  assert.match(serverSource, /verifyAdminSetupToken\(/);
});

test('verifyAdminSetupToken requires ADMIN_SETUP_TOKEN (503) and validates X-Setup-Token (403/200)', () => {
  const unconfigured = verifyAdminSetupToken(undefined, 'anything');
  assert.equal(unconfigured.ok, false);
  if (!unconfigured.ok) {
    assert.equal(unconfigured.status, 503);
  }

  const missingHeader = verifyAdminSetupToken('one-time-setup-secret', '');
  assert.equal(missingHeader.ok, false);
  if (!missingHeader.ok) {
    assert.equal(missingHeader.status, 403);
  }

  const wrongHeader = verifyAdminSetupToken('one-time-setup-secret', 'wrong-secret');
  assert.equal(wrongHeader.ok, false);
  if (!wrongHeader.ok) {
    assert.equal(wrongHeader.status, 403);
  }

  const valid = verifyAdminSetupToken('one-time-setup-secret', '  one-time-setup-secret  ');
  assert.deepEqual(valid, { ok: true });
});
