import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialExchangeRatePutSchema } from '../server/validation.ts';

test('commercialExchangeRatePutSchema accepts valid numeric and string rates', () => {
  const numResult = commercialExchangeRatePutSchema.safeParse({ rate: 45.75 });
  assert.equal(numResult.success, true);
  if (numResult.success) {
    assert.equal(numResult.data.rate, 45.75);
  }

  const commaResult = commercialExchangeRatePutSchema.safeParse({ rate: '45,80' });
  assert.equal(commaResult.success, true);
  if (commaResult.success) {
    assert.equal(commaResult.data.rate, 45.8);
  }
});

test('commercialExchangeRatePutSchema rejects out-of-range or invalid rates', () => {
  assert.equal(commercialExchangeRatePutSchema.safeParse({ rate: 9.99 }).success, false);
  assert.equal(commercialExchangeRatePutSchema.safeParse({ rate: 500.01 }).success, false);
  assert.equal(commercialExchangeRatePutSchema.safeParse({ rate: 'abc' }).success, false);
  assert.equal(commercialExchangeRatePutSchema.safeParse({}).success, false);
});
