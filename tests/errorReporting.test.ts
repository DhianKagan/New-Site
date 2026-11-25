import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearErrorReportingDedupCache,
  createClientErrorPayload,
  sanitizeErrorText,
  sanitizeRoutePathname,
  shouldSkipDuplicateError,
} from '../src/lib/errorReporting.ts';
import { clientErrorReportSchema, scrubSensitiveErrorText } from '../server/validation.ts';

test('scrubs tokens, API keys, and query secrets from error messages and routes', () => {
  const dirty = 'Failed auth with Bearer secret.jwt.token and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig1234567890 key=AIzaSyDGjpO0dWOv8mENVqqReLTlgvxWBaQbMKk https://example.com/crm?token=abc123&mode=1';
  const cleanedClient = sanitizeErrorText(dirty);
  assert.equal(cleanedClient.includes('secret.jwt.token'), false);
  assert.equal(cleanedClient.includes('AIzaSyDGjpO0dWOv8mENVqqReLTlgvxWBaQbMKk'), false);
  assert.equal(cleanedClient.includes('abc123'), false);

  const cleanedServer = scrubSensitiveErrorText(dirty);
  assert.equal(cleanedServer.includes('secret.jwt.token'), false);
  assert.equal(cleanedServer.includes('AIzaSyDGjpO0dWOv8mENVqqReLTlgvxWBaQbMKk'), false);
  assert.equal(cleanedServer.includes('abc123'), false);

  assert.equal(sanitizeRoutePathname('https://energo-comfort-crm.ai.studio/crm?token=secret#hash'), '/crm');
  assert.equal(sanitizeRoutePathname('/shop/item-1?q=test'), '/shop/item-1');
});

test('creates valid client error payloads, deduplicates bursts, and passes server schema', () => {
  clearErrorReportingDedupCache();
  const payload = createClientErrorPayload({
    errorId: 'ec-test123',
    kind: 'react_boundary',
    error: new TypeError('Cannot read properties of undefined'),
    componentStack: 'at ShopView\nat AppContent',
    route: '/shop?secret=123',
    locale: 'uk',
  });

  assert.equal(payload.route, '/shop');
  assert.equal(payload.kind, 'react_boundary');
  assert.equal(payload.name, 'TypeError');

  const parsed = clientErrorReportSchema.safeParse(payload);
  assert.equal(parsed.success, true);

  assert.equal(shouldSkipDuplicateError(payload), false);
  assert.equal(shouldSkipDuplicateError(payload), true);
});
