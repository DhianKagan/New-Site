import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  getCatalogFacets,
  getPublicAnalyticsConfig,
  getSocialLinks,
  listProducts,
  listProjectCases,
  recordAnalyticsEvent,
  recordClientErrorLog,
} from '../server/db.ts';
import { getActiveStorefrontRate, getStoredCommercialRate } from '../server/exchangeRate.ts';
import { evaluateHealthResponse } from '../server/health.ts';
import {
  createLogger,
  getRequestId,
  requestLoggingMiddleware,
  resolveOrCreateRequestId,
} from '../server/logger.ts';

test('evaluateHealthResponse returns 503 when Postgres or configured Redis is unavailable and 200 when healthy', () => {
  const pgDown = evaluateHealthResponse({
    dbHealth: { ok: false, error: 'connection refused' },
    redisHealth: { configured: false, ok: false },
    telegramConfigured: false,
    uptimeSec: 12.4,
  });
  assert.equal(pgDown.statusCode, 503);
  assert.equal(pgDown.body.ok, false);
  assert.equal(pgDown.body.postgres, 'unavailable');
  assert.equal(pgDown.body.redis, 'disabled');

  const redisDown = evaluateHealthResponse({
    dbHealth: { ok: true, latencyMs: 2 },
    redisHealth: { configured: true, ok: false, error: 'timeout' },
    telegramConfigured: true,
    uptimeSec: 45,
  });
  assert.equal(redisDown.statusCode, 503);
  assert.equal(redisDown.body.ok, false);
  assert.equal(redisDown.body.postgres, 'ok');
  assert.equal(redisDown.body.redis, 'unavailable');

  const pgOkRedisDisabled = evaluateHealthResponse({
    dbHealth: { ok: true, latencyMs: 1 },
    redisHealth: { configured: false, ok: false },
    telegramConfigured: false,
    uptimeSec: 100,
  });
  assert.equal(pgOkRedisDisabled.statusCode, 200);
  assert.equal(pgOkRedisDisabled.body.ok, true);
  assert.equal(pgOkRedisDisabled.body.postgres, 'ok');
  assert.equal(pgOkRedisDisabled.body.redis, 'disabled');

  const allHealthy = evaluateHealthResponse({
    dbHealth: { ok: true, latencyMs: 1 },
    redisHealth: { configured: true, ok: true, latencyMs: 1 },
    telegramConfigured: true,
    uptimeSec: 100,
  });
  assert.equal(allHealthy.statusCode, 200);
  assert.equal(allHealthy.body.ok, true);
  assert.equal(allHealthy.body.postgres, 'ok');
  assert.equal(allHealthy.body.redis, 'ok');
});

test('resolveOrCreateRequestId and requestLoggingMiddleware propagate safe IDs and replace unsafe ones', () => {
  assert.equal(resolveOrCreateRequestId('req-abc_123.4'), 'req-abc_123.4');

  const unsafe = resolveOrCreateRequestId('bad id with spaces\n<script>');
  assert.match(unsafe, /^[0-9a-f-]{36}$/i);

  const req = {
    method: 'GET',
    path: '/api/health',
    headers: { 'x-request-id': 'trace-xyz-99' },
  } as unknown as Request;

  const emitter = new EventEmitter();
  const headers = new Map<string, string>();
  const res = Object.assign(emitter, {
    statusCode: 200,
    setHeader(name: string, val: string) {
      headers.set(name.toLowerCase(), val);
    },
  }) as unknown as Response;

  let nextCalled = false;
  requestLoggingMiddleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(headers.get('x-request-id'), 'trace-xyz-99');
  assert.equal(getRequestId(req), 'trace-xyz-99');
  emitter.emit('finish');
});

test('createLogger emits JSON logs and redacts secrets, tokens, and PII', () => {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString('utf-8'));
      callback();
    },
  });

  const testLogger = createLogger(sink);
  testLogger.info(
    {
      requestId: 'req-1',
      password: 'plain-password',
      token: 'jwt-secret-token',
      phone: '+380501234567',
      email: 'client@example.com',
      authorization: 'Bearer abc',
      cookie: 'session=xyz',
      customerName: 'Іван Петренко',
      nested: {
        password: 'nested-password',
        token: 'nested-token',
        phone: '+380670000000',
        email: 'nested@example.com',
      },
      safeField: 'visible',
    },
    'Audit event',
  );

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.equal(parsed.msg, 'Audit event');
  assert.equal(parsed.requestId, 'req-1');
  assert.equal(parsed.safeField, 'visible');
  assert.equal(parsed.password, '[REDACTED]');
  assert.equal(parsed.token, '[REDACTED]');
  assert.equal(parsed.phone, '[REDACTED]');
  assert.equal(parsed.email, '[REDACTED]');
  assert.equal(parsed.authorization, '[REDACTED]');
  assert.equal(parsed.cookie, '[REDACTED]');
  assert.equal(parsed.customerName, '[REDACTED]');

  const nested = parsed.nested as Record<string, unknown>;
  assert.equal(nested.password, '[REDACTED]');
  assert.equal(nested.token, '[REDACTED]');
  assert.equal(nested.phone, '[REDACTED]');
  assert.equal(nested.email, '[REDACTED]');
});

test('storefront read helpers degrade cleanly to seed/env defaults when DATABASE_URL is unset', async () => {
  const prevDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const [products, facets, projects, analytics, social, storedRate, activeRate] = await Promise.all([
      listProducts(),
      getCatalogFacets(),
      listProjectCases(),
      getPublicAnalyticsConfig(),
      getSocialLinks(),
      getStoredCommercialRate(),
      getActiveStorefrontRate(),
    ]);

    assert.ok(products.length > 0);
    assert.equal(facets.total, products.length);
    assert.ok(projects.length > 0);
    assert.equal(typeof analytics.analyticsEnabled, 'boolean');
    assert.ok(social.telegram.length > 0);
    assert.equal(storedRate.rate, null);
    assert.ok(activeRate.source === 'market_fallback' || activeRate.source === 'unavailable');

    await recordAnalyticsEvent('view_home', 'PageView', 'page_view', { route: '/' });
    await recordClientErrorLog({
      errorId: 'ec-test',
      kind: 'react_boundary',
      name: 'Error',
      message: 'test',
      stack: '',
      componentStack: '',
      route: '/',
      locale: 'uk',
    });
  } finally {
    if (prevDbUrl !== undefined) {
      process.env.DATABASE_URL = prevDbUrl;
    }
  }
});
