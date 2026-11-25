import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveAnalyticsMoney,
  toAnalyticsCartItem,
  toAnalyticsProductItem,
} from '../src/lib/analytics.ts';

test('resolveAnalyticsMoney converts USD to rounded UAH when exchange rate is active', () => {
  assert.deepEqual(resolveAnalyticsMoney(1000, 42.35), {
    value: 42350,
    currency: 'UAH',
  });
  assert.deepEqual(resolveAnalyticsMoney(1000, null), {
    value: 1000,
    currency: 'USD',
  });
  assert.deepEqual(resolveAnalyticsMoney(-50, 42), {
    value: 0,
    currency: 'UAH',
  });
});

test('toAnalyticsProductItem matches /feed.xml ID (sku || id) and UAH price', () => {
  const item = toAnalyticsProductItem(
    {
      id: 'kit-deye-8kw',
      sku: 'EC-8000',
      title: 'Комплект Deye 8 кВт',
      brand: 'Deye',
      cat: 'kits',
      price: 2000,
    },
    41.5,
    2,
  );

  assert.deepEqual(item, {
    item_id: 'EC-8000',
    item_name: 'Комплект Deye 8 кВт',
    item_brand: 'Deye',
    item_category: 'kits',
    price: 83000,
    quantity: 2,
  });
});

test('toAnalyticsCartItem uses sku fallback to id and UAH unit price', () => {
  const item = toAnalyticsCartItem(
    {
      id: 'bat-5kwh',
      sku: '',
      title: 'АКБ LiFePO4 5.12 кВт·год',
      price: 900,
      qty: 3,
    },
    42,
  );

  assert.deepEqual(item, {
    item_id: 'bat-5kwh',
    item_name: 'АКБ LiFePO4 5.12 кВт·год',
    item_brand: 'Energo Comfort',
    price: 37800,
    quantity: 3,
  });
});
