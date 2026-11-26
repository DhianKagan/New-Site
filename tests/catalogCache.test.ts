import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  computeCatalogFingerprint,
  diffCatalogItems,
  getLastCatalogSwrDiagnostics,
  normalizeAndMergeKits,
  readCachedCatalog,
  recordCatalogSwrDiagnostics,
  writeCachedCatalog,
  type StorageLike,
} from '../src/lib/catalogCache.ts';
import type { Product } from '../src/types.ts';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'deye-8k',
    title: 'Deye SUN-8K',
    sku: '10018',
    cat: 'inverters',
    rawCats: ['Інвертори'],
    brand: 'Deye',
    isKit: false,
    price: 1650,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    img: '/assets/products/deye-8k.png',
    specs: [['Потужність', '8 кВт']],
    description: 'Гібридний інвертор',
    sourceUrl: 'https://energocomfort.shop/shop/deye-8k',
    ...overrides,
  };
}

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

test('readCachedCatalog & writeCachedCatalog support v2 SWR payloads and legacy Product[] arrays', () => {
  const legacyItems = [makeProduct({ id: 'legacy-1', sku: '111' })];
  const storage = createMemoryStorage({
    ec_offline_catalog_v1: JSON.stringify(legacyItems),
  });

  const legacyRead = readCachedCatalog(storage, 'ec_offline_catalog_v1');
  assert.equal(legacyRead.items.length, 1);
  assert.equal(legacyRead.items[0].id, 'legacy-1');
  assert.equal(legacyRead.wasLegacyFormat, true);
  assert.equal(legacyRead.cachedAt, null);

  const freshItems = [
    makeProduct({ id: 'fresh-1', sku: '222' }),
    makeProduct({ id: 'kit-1', sku: '8011', cat: 'kits', isKit: true }),
  ];
  writeCachedCatalog(
    storage,
    'ec_offline_catalog_v1',
    freshItems,
    'https://energocomfort.up.railway.app',
    { environment: 'production', dataDirMode: 'custom', totalCount: 2, kitCount: 1 },
    1700000000000,
  );

  const v2Read = readCachedCatalog(storage, 'ec_offline_catalog_v1');
  assert.equal(v2Read.wasLegacyFormat, false);
  assert.equal(v2Read.items.length, 2);
  assert.equal(v2Read.cachedAt, 1700000000000);
  assert.equal(v2Read.cachedOrigin, 'https://energocomfort.up.railway.app');
  assert.equal(v2Read.serverMeta?.environment, 'production');
});

test('normalizeAndMergeKits repairs legacy kit categories, backfills empty SKUs, and injects missing kits', () => {
  const readyKit = makeProduct({
    id: 'kit-deye-8kw',
    sku: '8389',
    cat: 'kits',
    isKit: true,
    img: '/assets/products/kit-8kw.jpg',
  });
  const missingKit = makeProduct({
    id: 'kit-solax-10kw',
    sku: '8213',
    cat: 'kits',
    isKit: true,
  });

  const rawFromStaleEnv = [
    makeProduct({ id: 'deye-8k', sku: '10018', cat: 'inverters' }),
    makeProduct({
      id: 'kit-deye-8kw',
      sku: '',
      cat: 'parts',
      isKit: true,
      img: '',
    }),
  ];

  const report = normalizeAndMergeKits(rawFromStaleEnv, [readyKit, missingKit]);
  assert.equal(report.items.length, 3);
  assert.deepEqual(report.repairedKitIds, ['kit-deye-8kw']);
  assert.deepEqual(report.backfilledKitSkuIds, ['kit-deye-8kw']);
  assert.deepEqual(report.injectedMissingKitIds, ['kit-solax-10kw']);

  const repaired = report.items.find((p) => p.id === 'kit-deye-8kw')!;
  assert.equal(repaired.cat, 'kits');
  assert.equal(repaired.sku, '8389');
  assert.equal(repaired.img, '/assets/products/kit-8kw.jpg');
});

test('computeCatalogFingerprint and diffCatalogItems detect added, removed, updated products, and category deltas', () => {
  const cached = [
    makeProduct({ id: 'a', cat: 'inverters', price: 1000 }),
    makeProduct({ id: 'b', cat: 'parts', isKit: true, sku: '' }),
  ];
  const rawFingerprint = computeCatalogFingerprint(cached);
  assert.deepEqual(rawFingerprint.legacyKitCatMismatchIds, ['b']);
  assert.deepEqual(rawFingerprint.emptySkuKitIds, ['b']);

  const revalidated = [
    makeProduct({ id: 'a', cat: 'inverters', price: 1050 }),
    makeProduct({ id: 'c', cat: 'batteries', price: 900 }),
  ];
  const diff = diffCatalogItems(cached, revalidated);
  assert.equal(diff.hasChanges, true);
  assert.deepEqual(diff.addedIds, ['c']);
  assert.deepEqual(diff.removedIds, ['b']);
  assert.deepEqual(diff.updatedIds, ['a']);
  assert.deepEqual(diff.categoryCountDelta, {
    batteries: 1,
    parts: -1,
  });

  const identicalDiff = diffCatalogItems(revalidated, [...revalidated]);
  assert.equal(identicalDiff.hasChanges, false);
});

test('recordCatalogSwrDiagnostics logs warning on environment anomalies/fallbacks and info on clean SWR', () => {
  const infos: unknown[][] = [];
  const warns: unknown[][] = [];
  const origInfo = console.info;
  const origWarn = console.warn;

  console.info = (...args: unknown[]) => infos.push(args);
  console.warn = (...args: unknown[]) => warns.push(args);

  try {
    const items = [makeProduct({ id: 'k1', cat: 'kits', isKit: true, sku: '8011' })];
    const fp = computeCatalogFingerprint(items);

    recordCatalogSwrDiagnostics({
      timestamp: '2026-11-26T17:45:00.000Z',
      origin: 'https://energocomfort.up.railway.app',
      phase: 'revalidated_unchanged',
      cacheHit: true,
      cacheAgeMs: 1200,
      cachedOrigin: 'https://energocomfort.up.railway.app',
      originMismatch: false,
      normalizedFingerprint: fp,
      repairedKitIds: [],
      injectedMissingKitIds: [],
      backfilledKitSkuIds: [],
    });

    assert.equal(infos.length, 1);
    assert.equal(warns.length, 0);

    recordCatalogSwrDiagnostics({
      timestamp: '2026-11-26T17:45:05.000Z',
      origin: 'https://energocomfort.up.railway.app',
      phase: 'revalidated_updated',
      cacheHit: true,
      cacheAgeMs: 5000,
      cachedOrigin: 'http://localhost:3000',
      originMismatch: true,
      normalizedFingerprint: fp,
      repairedKitIds: ['k1'],
      injectedMissingKitIds: [],
      backfilledKitSkuIds: [],
    });

    assert.equal(warns.length, 1);
    assert.equal(getLastCatalogSwrDiagnostics()?.originMismatch, true);
  } finally {
    console.info = origInfo;
    console.warn = origWarn;
  }
});

test('App.tsx wires Stale-While-Revalidate initial cache hydration and background revalidation', () => {
  const appTsx = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appTsx, /readCachedCatalog\(/);
  assert.match(appTsx, /useState<Product\[\]>\(initialCatalogSnapshot\.items\)/);
  assert.match(appTsx, /useState\(!initialCatalogSnapshot\.hadCache\)/);
  assert.match(appTsx, /fetch\('\/api\/catalog',\s*\{\s*cache:\s*'no-store'\s*\}\)/);
  assert.match(appTsx, /recordCatalogSwrDiagnostics\(/);
});
