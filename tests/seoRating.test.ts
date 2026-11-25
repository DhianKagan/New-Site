import assert from 'node:assert/strict';
import test from 'node:test';
import { getProductAggregateRating } from '../src/lib/seoRating.ts';

test('produces valid deterministic Schema.org AggregateRating for products', () => {
  const first = getProductAggregateRating({ id: 'deye-sun-8k', sku: '10018', isKit: false });
  const second = getProductAggregateRating({ id: 'deye-sun-8k', sku: '10018', isKit: false });

  assert.deepEqual(first, second);
  assert.equal(first['@type'], 'AggregateRating');
  assert.equal(first.bestRating, '5');
  assert.equal(first.worstRating, '1');

  const numericRating = Number(first.ratingValue);
  assert.ok(numericRating >= 4.7 && numericRating <= 5.0);
  assert.ok(first.reviewCount >= 9 && first.reviewCount <= 45);
});
