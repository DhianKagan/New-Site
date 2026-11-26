import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildComparisonSpecRows,
  doesRowDiffer,
  MAX_COMPARE_PRODUCTS,
  normalizeCompareIds,
  resolveCompareProducts,
  toggleCompareId,
} from '../src/lib/compare.ts';
import type { Product } from '../src/types.ts';

function makeProduct(
  id: string,
  specs: [string, string][],
  specsRu?: [string, string][],
): Product {
  return {
    id,
    sku: id.toUpperCase(),
    title: `Product ${id}`,
    cat: 'inverters',
    rawCats: ['Інвертори'],
    brand: 'Deye',
    isKit: false,
    price: 1200,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'В наявності',
    img: '/assets/energocomfort/backup_deye_8kw.jpg',
    specs,
    specsRu,
    description: 'Тестовий опис',
    sourceUrl: 'https://energocomfort.shop',
  };
}

test('normalizeCompareIds deduplicates, trims, and caps at MAX_COMPARE_PRODUCTS', () => {
  const normalized = normalizeCompareIds([
    ' p1 ',
    'p2',
    'p1',
    '',
    null,
    42,
    'p3',
    'p4',
    'p5',
  ]);
  assert.deepEqual(normalized, ['p1', 'p2', 'p3', 'p4']);
  assert.equal(normalized.length, MAX_COMPARE_PRODUCTS);
});

test('toggleCompareId adds, removes, and enforces 4-item limit', () => {
  const r1 = toggleCompareId([], 'inv-1');
  assert.deepEqual(r1, { ids: ['inv-1'], added: true, limitReached: false });

  const r2 = toggleCompareId(r1.ids, 'inv-2');
  const r3 = toggleCompareId(r2.ids, 'inv-3');
  const r4 = toggleCompareId(r3.ids, 'inv-4');
  assert.deepEqual(r4, {
    ids: ['inv-1', 'inv-2', 'inv-3', 'inv-4'],
    added: true,
    limitReached: false,
  });

  // 5th item hits limit without mutating selected list
  const r5 = toggleCompareId(r4.ids, 'inv-5');
  assert.deepEqual(r5, {
    ids: ['inv-1', 'inv-2', 'inv-3', 'inv-4'],
    added: false,
    limitReached: true,
  });

  // Toggling an already selected item removes it
  const removed = toggleCompareId(r4.ids, 'inv-2');
  assert.deepEqual(removed, {
    ids: ['inv-1', 'inv-3', 'inv-4'],
    added: false,
    limitReached: false,
  });
});

test('resolveCompareProducts preserves selection order and skips unknown IDs', () => {
  const catalog = [
    makeProduct('a', [['Потужність', '5 кВт']]),
    makeProduct('b', [['Потужність', '8 кВт']]),
    makeProduct('c', [['Потужність', '12 кВт']]),
  ];
  const resolved = resolveCompareProducts(['c', 'unknown-id', 'a'], catalog);
  assert.deepEqual(
    resolved.map((p) => p.id),
    ['c', 'a'],
  );
});

test('buildComparisonSpecRows merges spec keys across products and detects differences', () => {
  const p1 = makeProduct(
    'p1',
    [
      ['Потужність', '8 кВт'],
      ['Фази', '1 фаза (220В)'],
      ['Напруга АКБ', '48 В'],
    ],
    [
      ['Мощность', '8 кВт'],
      ['Фазы', '1 фаза (220В)'],
      ['Напряжение АКБ', '48 В'],
    ],
  );
  const p2 = makeProduct(
    'p2',
    [
      ['Потужність', '12 кВт'],
      ['Фази', '1 фаза (220В)'],
      ['Ступінь захисту', 'IP65'],
    ],
    [
      ['Мощность', '12 кВт'],
      ['Фазы', '1 фаза (220В)'],
      ['Степень защиты', 'IP65'],
    ],
  );

  const ukRows = buildComparisonSpecRows([p1, p2], false);
  assert.deepEqual(ukRows, [
    { label: 'Потужність', values: ['8 кВт', '12 кВт'], differs: true },
    { label: 'Фази', values: ['1 фаза (220В)', '1 фаза (220В)'], differs: false },
    { label: 'Напруга АКБ', values: ['48 В', '—'], differs: true },
    { label: 'Ступінь захисту', values: ['—', 'IP65'], differs: true },
  ]);

  const ruRows = buildComparisonSpecRows([p1, p2], true);
  assert.deepEqual(ruRows, [
    { label: 'Мощность', values: ['8 кВт', '12 кВт'], differs: true },
    { label: 'Фазы', values: ['1 фаза (220В)', '1 фаза (220В)'], differs: false },
    { label: 'Напряжение АКБ', values: ['48 В', '—'], differs: true },
    { label: 'Степень защиты', values: ['—', 'IP65'], differs: true },
  ]);

  assert.equal(doesRowDiffer(['IP65', 'ip65']), false);
  assert.equal(doesRowDiffer(['IP65']), false);
});

test('CompareModal exposes Highlight differences switch and distinguishes varying spec rows', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'CompareModal.tsx'),
    'utf-8',
  );
  assert.match(source, /const \[highlightDifferences, setHighlightDifferences\] = useState\(true\)/);
  assert.match(source, /role="switch"/);
  assert.match(source, /aria-checked=\{highlightDifferences\}/);
  assert.match(source, /Підсвітити відмінності/);
  assert.match(source, /const isHighlighted = highlightDifferences && row\.differs/);
  assert.match(source, /data-highlighted=\{isHighlighted \? 'true' : 'false'\}/);
});

