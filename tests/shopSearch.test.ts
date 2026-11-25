import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEATURED_BRAND_FILTERS,
  filterAndRankProductsBySearch,
  matchesBrandFilters,
} from '../src/lib/shopSearch.ts';
import type { Product } from '../src/types.ts';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'deye-8k',
    title: 'Гібридний інвертор Deye SUN-8K-SG01LP1-EU 8 кВт',
    sku: '10018',
    cat: 'inverters',
    rawCats: ['Інвертори'],
    brand: 'Deye',
    isKit: false,
    price: 1650,
    oldPrice: 1800,
    inStock: true,
    statusLabel: 'В наявності',
    img: '/assets/energocomfort/backup_deye_8kw.jpg',
    specs: [['Потужність', '8 кВт']],
    description: 'Однофазний гібридний інвертор 48V',
    sourceUrl: 'https://energocomfort.shop/shop/deye-8k',
  },
  {
    id: 'solax-6k',
    title: 'Гібридний інвертор SolaX X1-Hybrid-6.0-D',
    sku: 'SLX-6000',
    cat: 'inverters',
    rawCats: ['Інвертори'],
    brand: 'SolaX',
    isKit: false,
    price: 1420,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'В наявності',
    img: '/assets/energocomfort/house_6kw.png',
    specs: [['Потужність', '6 кВт']],
    description: 'Працює з високовольтними АКБ Deye та SolaX',
    sourceUrl: 'https://energocomfort.shop/shop/solax-6k',
  },
  {
    id: 'trina-615',
    title: 'Сонячна панель Trina Solar Vertex N 615 Wp Bifacial',
    sku: 'TRN-615',
    cat: 'panels',
    rawCats: ['Сонячні панелі'],
    brand: 'Trina Solar',
    isKit: false,
    price: 123,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'В наявності',
    img: '/assets/energocomfort/house_6kw.png',
    specs: [['Потужність', '615 Вт']],
    description: 'Bifacial N-type',
    sourceUrl: 'https://energocomfort.shop/shop/trina-615',
  },
];

test('filters products by exact SKU and compact SKU match', () => {
  const byExactSku = filterAndRankProductsBySearch(SAMPLE_PRODUCTS, '10018');
  assert.equal(byExactSku.length, 1);
  assert.equal(byExactSku[0].id, 'deye-8k');

  const byCompactSku = filterAndRankProductsBySearch(SAMPLE_PRODUCTS, 'slx6000');
  assert.equal(byCompactSku.length, 1);
  assert.equal(byCompactSku[0].id, 'solax-6k');
});

test('filters products by multi-token title match and ranks title/SKU matches first', () => {
  const byTokens = filterAndRankProductsBySearch(SAMPLE_PRODUCTS, 'deye 8k');
  assert.equal(byTokens.length, 1);
  assert.equal(byTokens[0].id, 'deye-8k');

  const ranked = filterAndRankProductsBySearch(SAMPLE_PRODUCTS, 'deye');
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 'deye-8k');
});

test('matches featured brand checkboxes including multi-select and Trina Solar alias', () => {
  assert.deepEqual(
    FEATURED_BRAND_FILTERS.map((b) => b.id),
    ['Deye', 'SolaX', 'Solis', 'Dyness', 'Trina'],
  );

  const multi = SAMPLE_PRODUCTS.filter((p) => matchesBrandFilters(p, ['Deye', 'Trina'], 'all'));
  assert.deepEqual(
    multi.map((p) => p.id),
    ['deye-8k', 'trina-615'],
  );

  const dropdownFallback = SAMPLE_PRODUCTS.filter((p) => matchesBrandFilters(p, [], 'SolaX'));
  assert.deepEqual(
    dropdownFallback.map((p) => p.id),
    ['solax-6k'],
  );
});
