import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeWishlistIds,
  normalizeWishlistIds,
  resolveWishlistProducts,
  toggleWishlistId,
} from '../src/lib/wishlist.ts';
import { clientWishlistPutSchema } from '../server/validation.ts';
import type { Product } from '../src/types.ts';

function makeProduct(id: string): Product {
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
    specs: [['Потужність', '8 кВт']],
    description: 'Тестовий опис',
    sourceUrl: 'https://energocomfort.shop',
  };
}

test('wishlist client helpers normalize, toggle, merge, and resolve products', () => {
  assert.deepEqual(normalizeWishlistIds([' p1 ', 'p2', 'p1', '', 42, 'p3']), ['p1', 'p2', 'p3']);

  const added = toggleWishlistId(['p1', 'p2'], 'p3');
  assert.deepEqual(added, ['p3', 'p1', 'p2']);

  const removed = toggleWishlistId(added, 'p1');
  assert.deepEqual(removed, ['p3', 'p2']);

  const merged = mergeWishlistIds(['srv1', 'shared', 'srv2'], ['loc1', 'shared']);
  assert.deepEqual(merged, ['loc1', 'shared', 'srv1', 'srv2']);

  const catalog = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')];
  const resolved = resolveWishlistProducts(['p3', 'missing-id', 'p1'], catalog);
  assert.deepEqual(
    resolved.map((p) => p.id),
    ['p3', 'p1'],
  );
});

test('clientWishlistPutSchema validates payload bounds', () => {
  const valid = clientWishlistPutSchema.safeParse({ productIds: ['deye-8kw', 'dyness-5kwh'] });
  assert.equal(valid.success, true);

  const emptyItem = clientWishlistPutSchema.safeParse({ productIds: ['deye-8kw', '   '] });
  assert.equal(emptyItem.success, false);

  const tooMany = clientWishlistPutSchema.safeParse({
    productIds: Array.from({ length: 201 }, (_, i) => `item-${i}`),
  });
  assert.equal(tooMany.success, false);
});

test(
  'server Postgres wishlist persists ordered unique items per customer',
  { skip: !process.env.DATABASE_URL ? 'DATABASE_URL not set' : false },
  async () => {
    const dbMod = await import('../server/db.ts');
    let createdCustomerId: number | null = null;
    try {
      await dbMod.initDatabase();
      const customer = await dbMod.createCustomerAccountByCrm({
        name: 'Wishlist Tester',
        email: `wishlist-tester-${Date.now()}@example.com`,
        phone: '+380501112233',
        city: 'Одеса',
        password: 'password123',
      });
      createdCustomerId = customer.id;

      assert.deepEqual(await dbMod.getCustomerWishlistIds(customer.id), []);

      const saved = await dbMod.setCustomerWishlistIds(customer.id, [
        'deye-sun-8k',
        'dyness-dl5',
        'deye-sun-8k',
        '  ',
        'trina-585w',
      ]);
      assert.deepEqual(saved, ['deye-sun-8k', 'dyness-dl5', 'trina-585w']);
      assert.deepEqual(await dbMod.getCustomerWishlistIds(customer.id), ['deye-sun-8k', 'dyness-dl5', 'trina-585w']);

      const cleared = await dbMod.setCustomerWishlistIds(customer.id, []);
      assert.deepEqual(cleared, []);
      assert.deepEqual(await dbMod.getCustomerWishlistIds(customer.id), []);
    } finally {
      if (createdCustomerId !== null) {
        await dbMod.deleteCustomerAccount(createdCustomerId).catch(() => undefined);
      }
      await dbMod.closeDatabasePool();
    }
  },
);
