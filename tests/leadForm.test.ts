import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUaPhone, isValidUaPhone } from '../src/lib/leadForm.ts';

test('formats Ukrainian mobile numbers from local and international input', () => {
  assert.equal(formatUaPhone('0507777172'), '+380 50 777 71 72');
  assert.equal(formatUaPhone('+380981523261'), '+380 98 152 32 61');
  assert.equal(formatUaPhone('+380'), '+380 ');
  assert.equal(formatUaPhone(''), '');
});

test('validates exactly nine digits after the Ukrainian +380 prefix', () => {
  assert.equal(isValidUaPhone('+380 50 777 71 72'), true);
  assert.equal(isValidUaPhone('0507777172'), false);
  assert.equal(isValidUaPhone('+380 50 777 71'), false);
});
