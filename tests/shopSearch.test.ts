import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeEquipmentTypeCounts,
  computeFeaturedBrandCounts,
  computeInverterPowerCounts,
  EQUIPMENT_TYPE_FILTERS,
  extractInverterPowerKw,
  FEATURED_BRAND_FILTERS,
  filterAndRankProductsBySearch,
  getProductSearchSuggestions,
  INVERTER_POWER_FILTERS,
  matchesBrandFilters,
  matchesEquipmentTypes,
  matchesInverterPowerRanges,
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

test('computeFeaturedBrandCounts reflects category, stock, and search query filters', () => {
  const allCounts = computeFeaturedBrandCounts(SAMPLE_PRODUCTS);
  assert.deepEqual(allCounts, {
    Deye: 1,
    SolaX: 1,
    Solis: 0,
    Dyness: 0,
    Trina: 1,
  });

  const invertersOnly = computeFeaturedBrandCounts(SAMPLE_PRODUCTS, { category: 'inverters' });
  assert.deepEqual(invertersOnly, {
    Deye: 1,
    SolaX: 1,
    Solis: 0,
    Dyness: 0,
    Trina: 0,
  });

  const queryFiltered = computeFeaturedBrandCounts(SAMPLE_PRODUCTS, { query: '8k' });
  assert.deepEqual(queryFiltered, {
    Deye: 1,
    SolaX: 0,
    Solis: 0,
    Dyness: 0,
    Trina: 0,
  });
});

test('extractInverterPowerKw and matchesInverterPowerRanges cover up to 5, 5-10, and over 10 kW', () => {
  assert.deepEqual(
    INVERTER_POWER_FILTERS.map((f) => f.id),
    ['up_to_5', 'from_5_to_10', 'over_10'],
  );

  const inverterCatalog: Product[] = [
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'solis-5k',
      brand: 'Solis',
      title: 'Інвертор Solis S6-GR1P5K (5 кВт)',
      specs: [['Потужність', '5 кВт']],
    },
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'deye-8k-watt',
      brand: 'Deye',
      title: 'Інвертор Deye 8 kW',
      specs: [['Потужність', '8000 Вт']],
    },
    {
      ...SAMPLE_PRODUCTS[1],
      id: 'solax-15k',
      brand: 'SolaX',
      title: 'Інвертор SolaX X3-15.0 (15 кВт)',
      specs: [],
    },
    SAMPLE_PRODUCTS[2], // panel (must be ignored by inverter power extraction)
  ];

  assert.equal(extractInverterPowerKw(inverterCatalog[0]), 5);
  assert.equal(extractInverterPowerKw(inverterCatalog[1]), 8);
  assert.equal(extractInverterPowerKw(inverterCatalog[2]), 15);
  assert.equal(extractInverterPowerKw(inverterCatalog[3]), null);

  assert.deepEqual(
    inverterCatalog.filter((p) => matchesInverterPowerRanges(p, ['up_to_5'])).map((p) => p.id),
    ['solis-5k'],
  );
  assert.deepEqual(
    inverterCatalog.filter((p) => matchesInverterPowerRanges(p, ['from_5_to_10'])).map((p) => p.id),
    ['deye-8k-watt'],
  );
  assert.deepEqual(
    inverterCatalog.filter((p) => matchesInverterPowerRanges(p, ['up_to_5', 'over_10'])).map((p) => p.id),
    ['solis-5k', 'solax-15k'],
  );

  assert.deepEqual(computeInverterPowerCounts(inverterCatalog), {
    up_to_5: 1,
    from_5_to_10: 1,
    over_10: 1,
  });

  assert.deepEqual(computeInverterPowerCounts(inverterCatalog, { selectedBrands: ['Deye'] }), {
    up_to_5: 0,
    from_5_to_10: 1,
    over_10: 0,
  });
});

test('matchesEquipmentTypes and computeEquipmentTypeCounts filter inverters, batteries, panels, and kits', () => {
  assert.deepEqual(
    EQUIPMENT_TYPE_FILTERS.map((f) => f.id),
    ['inverters', 'batteries', 'panels', 'kits'],
  );

  const mixedCatalog: Product[] = [
    ...SAMPLE_PRODUCTS, // 2 inverters (Deye, SolaX), 1 panel (Trina Solar)
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'dyness-b4850',
      cat: 'batteries',
      brand: 'Dyness',
      title: 'Акумулятор Dyness B4850 2.4 кВт·год',
      specs: [['Ємність', '2.4 кВт·год']],
    },
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'deye-kit-6k',
      cat: 'kits',
      isKit: true,
      brand: 'Deye',
      title: 'Комплект резервного живлення Deye 6 кВт',
      specs: [['Потужність', '6 кВт']],
    },
  ];

  assert.deepEqual(computeEquipmentTypeCounts(mixedCatalog), {
    inverters: 2,
    batteries: 1,
    panels: 1,
    kits: 1,
  });

  assert.deepEqual(computeEquipmentTypeCounts(mixedCatalog, { selectedBrands: ['Deye'] }), {
    inverters: 1,
    batteries: 0,
    panels: 0,
    kits: 1,
  });

  assert.deepEqual(
    mixedCatalog.filter((p) => matchesEquipmentTypes(p, ['batteries', 'kits'])).map((p) => p.id),
    ['dyness-b4850', 'deye-kit-6k'],
  );

  assert.deepEqual(
    computeFeaturedBrandCounts(mixedCatalog, { equipmentTypes: ['kits'] }),
    {
      Deye: 1,
      SolaX: 0,
      Solis: 0,
      Dyness: 0,
      Trina: 0,
    },
  );
});

test('ShopView renders ShopEmptyState with reset-all-filters button and search suggestions', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const emptyStateSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ShopEmptyState.tsx'),
    'utf-8',
  );
  const shopViewSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ShopView.tsx'),
    'utf-8',
  );

  assert.match(emptyStateSource, /export function ShopEmptyState/);
  assert.match(emptyStateSource, /onResetFilters/);
  assert.match(emptyStateSource, /Скинути всі фільтри/);
  assert.match(emptyStateSource, /Сбросить все фильтры/);
  assert.match(shopViewSource, /<ShopEmptyState/);
  assert.match(shopViewSource, /onResetFilters=\{handleResetAllFilters\}/);
});

test('getProductSearchSuggestions returns ranked, capped product suggestions and total match count', () => {
  assert.deepEqual(getProductSearchSuggestions(SAMPLE_PRODUCTS, '   '), {
    suggestions: [],
    totalMatches: 0,
  });

  const skuMatch = getProductSearchSuggestions(SAMPLE_PRODUCTS, '10018', 5);
  assert.equal(skuMatch.totalMatches, 1);
  assert.equal(skuMatch.suggestions[0].id, 'deye-8k');

  const deyeCapped = getProductSearchSuggestions(SAMPLE_PRODUCTS, 'deye', 1);
  assert.equal(deyeCapped.totalMatches, 2);
  assert.equal(deyeCapped.suggestions.length, 1);
  assert.equal(deyeCapped.suggestions[0].id, 'deye-8k');
});

test('ShopView renders accessible combobox search suggestion dropdown wired to getProductSearchSuggestions', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const shopViewSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ShopView.tsx'),
    'utf-8',
  );

  assert.match(shopViewSource, /getProductSearchSuggestions/);
  assert.match(shopViewSource, /role="combobox"/);
  assert.match(shopViewSource, /id="shop-search-suggestions"/);
  assert.match(shopViewSource, /role="listbox"/);
  assert.match(shopViewSource, /role="option"/);
});

test('ProductCard displays full product titles with adaptive typography and no line-clamp truncation', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ProductCard.tsx'),
    'utf-8',
  );

  assert.doesNotMatch(cardSource, /line-clamp-/);
  assert.match(cardSource, /getProductTitleSizeClass/);
});


