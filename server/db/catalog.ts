import fs from 'node:fs';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type { Product, ProductCategory, ProjectCase, RecentChangeRecord } from '../../src/types.ts';
import { getDb, isDatabaseConfigured } from './client.ts';
import { logger } from '../logger.ts';
import { isRedisConfigured, redisDel, redisGetJson, redisSetJson } from '../redis.ts';
import { safeJsonParse, SEED_CATALOG_PATH, SEED_PROJECTS_PATH, writeJsonFileAtomic } from './utils.ts';

const CATALOG_CACHE_TTL_SEC = 300;
const KEY_CATALOG_ALL = 'ec:v1:catalog:all';
const KEY_CATALOG_FACETS = 'ec:v1:catalog:facets';
const KEY_SITEMAP_PRODUCTS = 'ec:v1:catalog:sitemap_products';
const KEY_SITEMAP_CATEGORIES = 'ec:v1:catalog:sitemap_categories';
const KEY_PROJECTS_ALL = 'ec:v1:projects:all';
const KEY_LATEST_UPDATED_AT = 'ec:v1:catalog_projects:latest_updated_at';

let cachedCatalogAll: Product[] | null = null;
let cachedCatalogById: Map<string, Product> | null = null;
let cachedCatalogFacets: {
  total: number;
  byCategory: Record<string, number>;
  brands: Array<{ brand: string; count: number }>;
} | null = null;
let cachedSitemapProducts: Array<{ id: string; title: string; img: string; updatedAt: string }> | null = null;
let cachedSitemapCategories: Array<{ cat: string; updatedAt: string; itemCount: number }> | null = null;
let cachedProjectsList: ProjectCase[] | null = null;
let cachedLatestCatalogOrProjectUpdatedAt: string | null = null;

export async function invalidateCatalogCache(): Promise<void> {
  cachedCatalogAll = null;
  cachedCatalogById = null;
  cachedCatalogFacets = null;
  cachedSitemapProducts = null;
  cachedSitemapCategories = null;
  cachedLatestCatalogOrProjectUpdatedAt = null;
  await redisDel(
    KEY_CATALOG_ALL,
    KEY_CATALOG_FACETS,
    KEY_SITEMAP_PRODUCTS,
    KEY_SITEMAP_CATEGORIES,
    KEY_LATEST_UPDATED_AT,
  );
}

export async function invalidateProjectsCache(): Promise<void> {
  cachedProjectsList = null;
  cachedLatestCatalogOrProjectUpdatedAt = null;
  await redisDel(KEY_PROJECTS_ALL, KEY_LATEST_UPDATED_AT);
}

function rowToProduct(r: typeof schema.productsTable.$inferSelect): Product {
  return {
    id: r.id,
    sku: r.sku,
    title: r.title,
    cat: r.cat as ProductCategory,
    rawCats: safeJsonParse<string[]>(r.rawCatsJson, []),
    brand: r.brand,
    isKit: Number(r.isKit) === 1,
    price: Number(r.price),
    oldPrice: Number(r.oldPrice),
    inStock: Number(r.inStock) === 1,
    statusLabel: r.statusLabel,
    img: r.img,
    specs: safeJsonParse<[string, string][]>(r.specsJson, []),
    description: r.description,
    sourceUrl: r.sourceUrl,
  };
}

function rowToProjectCase(r: typeof schema.projectsTable.$inferSelect): ProjectCase {
  return {
    id: r.id,
    seg: r.seg === 'b2b' ? 'b2b' : 'b2c',
    tag: r.tag,
    title: r.title,
    img: r.img,
    task: r.task,
    solution: r.solution,
    specs: r.specs,
    result: r.result,
  };
}

async function syncCatalogSeedFile(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.productsTable)
    .orderBy(desc(schema.productsTable.isKit), desc(schema.productsTable.price), asc(schema.productsTable.title));
  writeJsonFileAtomic(SEED_CATALOG_PATH, rows.map(rowToProduct));
}

async function syncProjectsSeedFile(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.projectsTable)
    .orderBy(asc(schema.projectsTable.sortOrder), desc(schema.projectsTable.createdAt));
  writeJsonFileAtomic(SEED_PROJECTS_PATH, rows.map(rowToProjectCase));
}

export async function seedCatalogIfEmpty(): Promise<void> {
  const db = getDb();
  const [cntRow] = await db.select({ cnt: count() }).from(schema.productsTable);
  if (Number(cntRow?.cnt ?? 0) > 0 || !fs.existsSync(SEED_CATALOG_PATH)) return;

  const raw = JSON.parse(fs.readFileSync(SEED_CATALOG_PATH, 'utf-8')) as Product[];
  if (!Array.isArray(raw) || raw.length === 0) return;

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const p of raw) {
      await tx
        .insert(schema.productsTable)
        .values({
          id: p.id,
          sku: p.sku,
          title: p.title,
          cat: p.cat,
          rawCatsJson: JSON.stringify(p.rawCats ?? []),
          brand: p.brand,
          isKit: p.isKit ? 1 : 0,
          price: p.price ?? 0,
          oldPrice: p.oldPrice ?? 0,
          inStock: p.inStock ? 1 : 0,
          statusLabel: p.statusLabel ?? 'в наявності',
          img: p.img ?? '',
          specsJson: JSON.stringify(p.specs ?? []),
          description: p.description ?? '',
          sourceUrl: p.sourceUrl ?? '',
          updatedAt: now,
        })
        .onConflictDoNothing({ target: schema.productsTable.id });
    }
  });
  await invalidateCatalogCache();
}

export async function reconcileSeedCatalogOnStartup(
  seedCatalogPath: string = SEED_CATALOG_PATH,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // 1. Normalize any legacy kit rows where is_kit = 1 was stored under another category (e.g. 'parts')
  const legacyFixed = await db
    .update(schema.productsTable)
    .set({ cat: 'kits', updatedAt: now })
    .where(sql`${schema.productsTable.isKit} = 1 AND ${schema.productsTable.cat} != 'kits'`)
    .returning({ id: schema.productsTable.id });
  const normalizedLegacyKitRows = legacyFixed.length;

  if (!fs.existsSync(seedCatalogPath)) return;

  let seedProducts: Product[];
  try {
    seedProducts = JSON.parse(fs.readFileSync(seedCatalogPath, 'utf-8')) as Product[];
  } catch {
    return;
  }
  if (!Array.isArray(seedProducts) || seedProducts.length === 0) return;

  const [syncedRow] = await db
    .select({ value: schema.settingsTable.value })
    .from(schema.settingsTable)
    .where(eq(schema.settingsTable.key, 'catalog_seed_synced_ids_v1'))
    .limit(1);

  let previouslySyncedIds = new Set<string>();
  if (syncedRow?.value) {
    const parsed = safeJsonParse<unknown>(syncedRow.value, []);
    if (Array.isArray(parsed)) {
      previouslySyncedIds = new Set(parsed.map(String));
    }
  }

  const existingRows = await db
    .select({
      id: schema.productsTable.id,
      sku: schema.productsTable.sku,
      cat: schema.productsTable.cat,
      isKit: schema.productsTable.isKit,
      img: schema.productsTable.img,
    })
    .from(schema.productsTable);
  const existingById = new Map(existingRows.map((r) => [r.id, r]));

  let insertedMissingSeedCount = 0;
  let normalizedSeedKitCount = 0;
  let backfilledSkuCount = 0;
  let backfilledImgCount = 0;

  await db.transaction(async (tx) => {
    for (const p of seedProducts) {
      const existing = existingById.get(p.id);
      if (!existing) {
        if (!previouslySyncedIds.has(p.id)) {
          const inserted = await tx
            .insert(schema.productsTable)
            .values({
              id: p.id,
              sku: p.sku,
              title: p.title,
              cat: p.isKit ? 'kits' : p.cat,
              rawCatsJson: JSON.stringify(p.rawCats ?? []),
              brand: p.brand,
              isKit: p.isKit ? 1 : 0,
              price: p.price ?? 0,
              oldPrice: p.oldPrice ?? 0,
              inStock: p.inStock ? 1 : 0,
              statusLabel: p.statusLabel ?? 'в наявності',
              img: p.img ?? '',
              specsJson: JSON.stringify(p.specs ?? []),
              description: p.description ?? '',
              sourceUrl: p.sourceUrl ?? '',
              updatedAt: now,
            })
            .onConflictDoNothing({ target: schema.productsTable.id })
            .returning({ id: schema.productsTable.id });
          insertedMissingSeedCount += inserted.length;
        }
        continue;
      }

      if (p.isKit && p.cat === 'kits' && (existing.cat !== 'kits' || Number(existing.isKit) !== 1)) {
        const res = await tx
          .update(schema.productsTable)
          .set({ cat: 'kits', isKit: 1, updatedAt: now })
          .where(sql`${schema.productsTable.id} = ${p.id} AND (${schema.productsTable.cat} != 'kits' OR ${schema.productsTable.isKit} != 1)`)
          .returning({ id: schema.productsTable.id });
        normalizedSeedKitCount += res.length;
      }

      if (p.sku?.trim() && !String(existing.sku ?? '').trim()) {
        const res = await tx
          .update(schema.productsTable)
          .set({ sku: p.sku.trim(), updatedAt: now })
          .where(sql`${schema.productsTable.id} = ${p.id} AND BTRIM(COALESCE(${schema.productsTable.sku}, '')) = ''`)
          .returning({ id: schema.productsTable.id });
        backfilledSkuCount += res.length;
      }

      if (p.img?.trim() && !String(existing.img ?? '').trim()) {
        const res = await tx
          .update(schema.productsTable)
          .set({ img: p.img.trim(), updatedAt: now })
          .where(sql`${schema.productsTable.id} = ${p.id} AND BTRIM(COALESCE(${schema.productsTable.img}, '')) = ''`)
          .returning({ id: schema.productsTable.id });
        backfilledImgCount += res.length;
      }
    }

    const nextSyncedIds = Array.from(new Set([...previouslySyncedIds, ...seedProducts.map((p) => p.id)]));
    await tx
      .insert(schema.settingsTable)
      .values({
        key: 'catalog_seed_synced_ids_v1',
        value: JSON.stringify(nextSyncedIds),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.settingsTable.key,
        set: { value: JSON.stringify(nextSyncedIds), updatedAt: now },
      });
  });

  await invalidateCatalogCache();

  const [finalCountRow] = await db.select({ cnt: count() }).from(schema.productsTable);
  const finalCount = Number(finalCountRow?.cnt ?? 0);
  if (
    normalizedLegacyKitRows > 0 ||
    insertedMissingSeedCount > 0 ||
    normalizedSeedKitCount > 0 ||
    backfilledSkuCount > 0 ||
    backfilledImgCount > 0 ||
    finalCount !== seedProducts.length
  ) {
    logger.info(
      {
        env: process.env.NODE_ENV || 'development',
        dbCountBefore: existingRows.length,
        dbCountAfter: finalCount,
        seedCount: seedProducts.length,
        normalizedLegacyKitRows,
        normalizedSeedKitCount,
        insertedMissingSeedCount,
        backfilledSkuCount,
        backfilledImgCount,
      },
      'Startup DB/seed reconciliation diagnostics',
    );
  }
}

function readSeedCatalogItems(): Product[] {
  if (!fs.existsSync(SEED_CATALOG_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(SEED_CATALOG_PATH, 'utf-8')) as Product[];
    if (!Array.isArray(raw)) return [];
    return raw.slice().sort((a, b) => {
      const aHasPrice = (a.price ?? 0) > 0 ? 0 : 1;
      const bHasPrice = (b.price ?? 0) > 0 ? 0 : 1;
      if (aHasPrice !== bHasPrice) return aHasPrice - bHasPrice;
      const kitDiff = Number(Boolean(b.isKit)) - Number(Boolean(a.isKit));
      if (kitDiff !== 0) return kitDiff;
      const stockDiff = Number(Boolean(b.inStock)) - Number(Boolean(a.inStock));
      if (stockDiff !== 0) return stockDiff;
      return String(a.id).localeCompare(String(b.id));
    });
  } catch {
    return [];
  }
}

function getSeedFileMtimeIso(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).mtime.toISOString();
    }
  } catch {
    // ignore stat failure
  }
  return new Date(0).toISOString();
}

async function ensureCatalogCache(): Promise<Product[]> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<Product[]>(KEY_CATALOG_ALL);
    if (redisHit) {
      return redisHit;
    }
  } else if (cachedCatalogAll && cachedCatalogById) {
    return cachedCatalogAll;
  }

  let items: Product[];
  if (!isDatabaseConfigured()) {
    items = readSeedCatalogItems();
  } else {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.productsTable)
      .orderBy(
        sql`CASE WHEN ${schema.productsTable.price} > 0 THEN 0 ELSE 1 END`,
        desc(schema.productsTable.isKit),
        desc(schema.productsTable.inStock),
        asc(schema.productsTable.id),
      );
    items = rows.map(rowToProduct);
  }

  if (isRedisConfigured()) {
    await redisSetJson(KEY_CATALOG_ALL, items, CATALOG_CACHE_TTL_SEC);
  } else {
    const byId = new Map<string, Product>();
    for (const item of items) {
      byId.set(item.id, item);
    }
    cachedCatalogAll = items;
    cachedCatalogById = byId;
  }
  return items;
}

export async function listProducts(filters?: {
  cat?: string;
  brand?: string;
  q?: string;
  inStockOnly?: boolean;
  sort?: string;
}): Promise<Product[]> {
  const hasCat = Boolean(filters?.cat && filters.cat !== 'all');
  const hasBrand = Boolean(filters?.brand && filters.brand !== 'all');
  const hasStock = Boolean(filters?.inStockOnly);
  const hasQuery = Boolean(filters?.q && filters.q.trim());
  const sort = filters?.sort;

  const allItems = await ensureCatalogCache();
  if (!hasCat && !hasBrand && !hasStock && !hasQuery && !sort) {
    return allItems.slice();
  }

  let items = allItems;
  if (hasCat) {
    items = items.filter((p) =>
      filters!.cat === 'kits'
        ? p.cat === 'kits' || p.isKit
        : (p.isKit ? 'kits' : p.cat) === filters!.cat,
    );
  }
  if (hasBrand) {
    items = items.filter((p) => p.brand === filters!.brand);
  }
  if (hasStock) {
    items = items.filter((p) => p.inStock);
  }
  if (hasQuery) {
    const q = filters!.q!.trim().toLowerCase();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }

  if (sort === 'asc') {
    return [...items].sort((a, b) => (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1) || a.price - b.price);
  }
  if (sort === 'desc') {
    return [...items].sort((a, b) => b.price - a.price);
  }
  if (sort === 'featured') {
    return [...items].sort(
      (a, b) =>
        (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1) ||
        Number(b.inStock) - Number(a.inStock) ||
        b.price - a.price,
    );
  }
  return items === allItems ? items.slice() : items;
}

export async function getCatalogFacets(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  brands: Array<{ brand: string; count: number }>;
}> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<{
      total: number;
      byCategory: Record<string, number>;
      brands: Array<{ brand: string; count: number }>;
    }>(KEY_CATALOG_FACETS);
    if (redisHit) return redisHit;
  } else if (cachedCatalogFacets) {
    return cachedCatalogFacets;
  }

  let result: {
    total: number;
    byCategory: Record<string, number>;
    brands: Array<{ brand: string; count: number }>;
  };

  if (!isDatabaseConfigured()) {
    const items = await ensureCatalogCache();
    const byCategory: Record<string, number> = {};
    const brandMap = new Map<string, number>();
    for (const item of items) {
      const cat = String(item.cat || 'parts');
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      const brand = String(item.brand || '');
      brandMap.set(brand, (brandMap.get(brand) ?? 0) + 1);
    }
    const brands = Array.from(brandMap.entries())
      .map(([brand, brandCount]) => ({ brand, count: brandCount }))
      .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
    result = { total: items.length, byCategory, brands };
  } else {
    const db = getDb();
    const [totalRows, catRows, brandRows] = await Promise.all([
      db.select({ cnt: count() }).from(schema.productsTable),
      db
        .select({ cat: schema.productsTable.cat, cnt: count() })
        .from(schema.productsTable)
        .groupBy(schema.productsTable.cat),
      db
        .select({ brand: schema.productsTable.brand, cnt: count() })
        .from(schema.productsTable)
        .groupBy(schema.productsTable.brand)
        .orderBy(desc(count()), asc(schema.productsTable.brand)),
    ]);

    const byCategory: Record<string, number> = {};
    for (const r of catRows) {
      byCategory[String(r.cat)] = Number(r.cnt);
    }
    const brands = brandRows.map((r) => ({
      brand: String(r.brand),
      count: Number(r.cnt),
    }));

    result = {
      total: Number(totalRows[0]?.cnt ?? 0),
      byCategory,
      brands,
    };
  }
  if (isRedisConfigured()) {
    await redisSetJson(KEY_CATALOG_FACETS, result, CATALOG_CACHE_TTL_SEC);
  } else {
    cachedCatalogFacets = result;
  }
  return result;
}

export async function getProductById(id: string): Promise<Product | null> {
  const items = await ensureCatalogCache();
  if (!isRedisConfigured() && cachedCatalogById) {
    return cachedCatalogById.get(id) ?? null;
  }
  return items.find((item) => item.id === id) ?? null;
}

export async function updateProduct(
  id: string,
  patch: {
    title?: string;
    sku?: string;
    cat?: ProductCategory;
    brand?: string;
    isKit?: boolean;
    price?: number;
    oldPrice?: number;
    inStock?: boolean;
    statusLabel?: string;
    img?: string;
    specs?: [string, string][];
    description?: string;
  },
): Promise<Product | null> {
  const db = getDb();
  const existing = await getProductById(id);
  if (!existing) return null;

  const title = patch.title !== undefined ? String(patch.title).trim() || existing.title : existing.title;
  const sku = patch.sku !== undefined ? String(patch.sku).trim() : existing.sku;
  const cat = patch.cat !== undefined ? patch.cat : existing.cat;
  const brand = patch.brand !== undefined ? String(patch.brand).trim() || existing.brand : existing.brand;
  const isKit = patch.isKit !== undefined ? patch.isKit : existing.isKit;
  const price = patch.price !== undefined ? Math.max(0, Math.round(Number(patch.price) || 0)) : existing.price;
  const oldPrice =
    patch.oldPrice !== undefined ? Math.max(0, Math.round(Number(patch.oldPrice) || 0)) : existing.oldPrice;
  const inStock = patch.inStock !== undefined ? patch.inStock : existing.inStock;
  const statusLabel =
    patch.statusLabel !== undefined && String(patch.statusLabel).trim()
      ? String(patch.statusLabel).trim()
      : patch.inStock !== undefined
        ? inStock
          ? 'в наявності'
          : 'під замовлення'
        : existing.statusLabel;
  const img = patch.img !== undefined ? String(patch.img).trim() : existing.img;
  const specsJson = patch.specs !== undefined ? JSON.stringify(patch.specs) : JSON.stringify(existing.specs);
  const description = patch.description !== undefined ? String(patch.description).trim() : existing.description;
  const now = new Date().toISOString();

  await db
    .update(schema.productsTable)
    .set({
      sku,
      title,
      cat,
      brand,
      isKit: isKit ? 1 : 0,
      price,
      oldPrice,
      inStock: inStock ? 1 : 0,
      statusLabel,
      img,
      specsJson,
      description,
      updatedAt: now,
    })
    .where(eq(schema.productsTable.id, id));

  await invalidateCatalogCache();
  await syncCatalogSeedFile();
  return getProductById(id);
}

export async function createProduct(input: {
  title: string;
  sku: string;
  cat: ProductCategory;
  brand: string;
  isKit?: boolean;
  price: number;
  oldPrice?: number;
  inStock: boolean;
  statusLabel?: string;
  img?: string;
  specs?: [string, string][];
  description?: string;
}): Promise<Product> {
  const db = getDb();
  const now = new Date().toISOString();
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const id = `${slugBase || 'item'}-${Date.now().toString(36)}`;
  const isKit = input.isKit ?? input.cat === 'kits';
  const statusLabel =
    input.statusLabel?.trim() || (input.inStock ? 'в наявності' : 'під замовлення');

  const [inserted] = await db
    .insert(schema.productsTable)
    .values({
      id,
      sku: input.sku.trim() || id.slice(0, 8).toUpperCase(),
      title: input.title.trim(),
      cat: input.cat,
      rawCatsJson: '[]',
      brand: input.brand.trim() || 'Energo Comfort',
      isKit: isKit ? 1 : 0,
      price: Math.max(0, Math.round(Number(input.price) || 0)),
      oldPrice: Math.max(0, Math.round(Number(input.oldPrice) || 0)),
      inStock: input.inStock ? 1 : 0,
      statusLabel,
      img: (input.img ?? '').trim(),
      specsJson: JSON.stringify(input.specs ?? []),
      description: (input.description ?? '').trim(),
      sourceUrl: '',
      updatedAt: now,
    })
    .returning();

  await invalidateCatalogCache();
  await syncCatalogSeedFile();
  return rowToProduct(inserted);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.productsTable)
    .where(eq(schema.productsTable.id, id))
    .returning({ id: schema.productsTable.id });
  if (deleted.length > 0) {
    await invalidateCatalogCache();
    await syncCatalogSeedFile();
    return true;
  }
  return false;
}

export async function seedProjectsIfEmpty(): Promise<void> {
  const db = getDb();
  const [cntRow] = await db.select({ cnt: count() }).from(schema.projectsTable);
  if (Number(cntRow?.cnt ?? 0) > 0) return;

  const initialProjects: ProjectCase[] = [
    {
      id: 'sto',
      seg: 'b2b',
      tag: 'B2B · Одеса',
      title: 'СТО для вантажного транспорту',
      img: '/assets/energocomfort/sto_110kw.jpg',
      task: 'Забезпечити безперебійну роботу енергоємного обладнання (підйомників, компресорів) в умовах лімітів потужності мережі.',
      solution: 'Змонтовано сонячне поле 110 кВт, встановлено трифазний гібридний інвертор 80 кВт та блок акумуляторів ємністю 160 кВт·год.',
      specs: 'PV 110 кВт · Гібрид 80 кВт · АКБ 160 кВт·год',
      result: 'Денне заміщення власного споживання та тривала автономність сервісу навіть під час тривалих відключень.',
    },
    {
      id: 'factory',
      seg: 'b2b',
      tag: 'B2B · Одеська обл.',
      title: 'Завод з виробництва тротуарної плитки',
      img: '/assets/energocomfort/factory_110kw.png',
      task: 'Зменшити навантаження на електромережу та оптимізувати денні витрати промислового виробництва.',
      solution: 'Промислове покрівельне сонячне поле потужністю 110 кВт із мережевою та гібридною архітектурою 380 В.',
      specs: 'PV 110 кВт · Промислова СЕС · 380 В',
      result: 'Стабільна генерація для виробничої лінії у робочу зміну та швидка окупність обладнання.',
    },
    {
      id: 'school',
      seg: 'b2b',
      tag: 'B2B · Заклад освіти',
      title: 'Навчальний заклад',
      img: '/assets/energocomfort/school_55kw.png',
      task: 'Забезпечити безперервний навчальний процес освітленням та живленням систем безпеки і серверів.',
      solution: 'Монтаж 55 кВт сонячних панелей та балансування критичного навантаження на 3-фазній мережі.',
      specs: 'PV 55 кВт · 3 фази · Проєкт під ключ',
      result: 'Безперебійна робота навчального комплексу під час графіків відключень.',
    },
    {
      id: 'hotel',
      seg: 'b2b',
      tag: 'B2B · Узбережжя',
      title: 'Готельний комплекс',
      img: '/assets/energocomfort/hotel_35kw.png',
      task: 'Провести аудит споживання та організувати автоматичне резервування інженерних систем готелю.',
      solution: 'Сонячне поле 35 кВт, високовольтний гібридний інвертор Deye 30 кВт та блок АКБ 30 кВт·год.',
      specs: 'PV 35 кВт · Deye 30 кВт · АКБ 30 кВт·год',
      result: 'Миттєве перемикання без зупинки сервісу, ліфтів, насосів та систем кондиціонування для гостей.',
    },
    {
      id: 'recreation',
      seg: 'b2b',
      tag: 'B2B · Одеська обл.',
      title: 'База відпочинку',
      img: '/assets/energocomfort/recreation_36kw.jpg',
      task: 'Забезпечити безперебійне енергопостачання та оптимізувати витрати у піковий курортний сезон.',
      solution: 'Встановлено 60 сонячних панелей (36 кВт), трифазний інвертор Deye 30 кВт та акумуляторний блок 30,6 кВт·год.',
      specs: 'PV 36 кВт · Deye 30 кВт · АКБ 30,6 кВт·год',
      result: 'Повна автономність ключової інфраструктури комплексу та зниження рахунків за електроенергію.',
    },
    {
      id: 'office',
      seg: 'b2b',
      tag: 'B2B · Центр Одеси',
      title: 'Офісний центр',
      img: '/assets/energocomfort/office_16kw.png',
      task: 'Живлення робочих місць, серверної групи, зв’язку та клімат-контролю без простоїв.',
      solution: 'СЕС 16 кВт, гібридний інвертор 12 кВт та запас енергії в АКБ LiFePO4 20 кВт·год.',
      specs: 'PV 16 кВт · Інвертор 12 кВт · АКБ 20 кВт·год',
      result: 'Команда працює у штатному режимі за будь-яких мережевих обмежень.',
    },
    {
      id: 'houseSolar',
      seg: 'b2c',
      tag: 'B2C · Одеський р-н',
      title: 'Приватний будинок із СЕС',
      img: '/assets/energocomfort/house_6kw.png',
      task: 'Власна денна генерація та надійний нічний резерв для родини.',
      solution: 'Сонячне поле 6 кВт, гібридний інвертор 10 кВт і акумуляторна система 15 кВт·год.',
      specs: 'PV 6 кВт · Інвертор 10 кВт · АКБ 15 кВт·год',
      result: 'Стабільне живлення будинку незалежно від зовнішньої мережі та економія на тарифі.',
    },
    {
      id: 'houseBackup',
      seg: 'b2c',
      tag: 'B2C · Одеса',
      title: 'Резервне живлення квартири та дому',
      img: '/assets/energocomfort/backup_deye_8kw.jpg',
      task: 'Тихий автопідхват опалення, освітлення та побутової техніки без втрати простору в кімнатах.',
      solution: 'Однофазний гібридний інвертор Deye 6–8 кВт та компактний LiFePO4 блок Deye 12 кВт·год із захистом AC/DC.',
      specs: 'Без СЕС · Deye 6–8 кВт (1ф) · АКБ 12 кВт·год',
      result: 'Повністю автоматизована тиха система резервного живлення з можливістю подальшого підключення панелей.',
    },
  ];

  let seedList: ProjectCase[] = initialProjects;
  if (fs.existsSync(SEED_PROJECTS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SEED_PROJECTS_PATH, 'utf-8')) as ProjectCase[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        seedList = parsed;
      }
    } catch {
      seedList = initialProjects;
    }
  } else {
    writeJsonFileAtomic(SEED_PROJECTS_PATH, initialProjects);
  }

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (let idx = 0; idx < seedList.length; idx++) {
      const p = seedList[idx];
      await tx
        .insert(schema.projectsTable)
        .values({
          id: p.id,
          seg: p.seg,
          tag: p.tag,
          title: p.title,
          img: p.img,
          task: p.task,
          solution: p.solution,
          specs: p.specs,
          result: p.result,
          sortOrder: idx + 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: schema.projectsTable.id });
    }
  });
  await invalidateProjectsCache();
}

function readSeedProjectsList(): ProjectCase[] {
  if (fs.existsSync(SEED_PROJECTS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SEED_PROJECTS_PATH, 'utf-8')) as ProjectCase[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore malformed seed file
    }
  }
  return [];
}

export async function listProjectCases(): Promise<ProjectCase[]> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<ProjectCase[]>(KEY_PROJECTS_ALL);
    if (redisHit) return redisHit.slice();
  } else if (cachedProjectsList) {
    return cachedProjectsList.slice();
  }

  let list: ProjectCase[];
  if (!isDatabaseConfigured()) {
    list = readSeedProjectsList();
  } else {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.projectsTable)
      .orderBy(asc(schema.projectsTable.sortOrder), desc(schema.projectsTable.createdAt));
    list = rows.map(rowToProjectCase);
  }
  if (isRedisConfigured()) {
    await redisSetJson(KEY_PROJECTS_ALL, list, CATALOG_CACHE_TTL_SEC);
  } else {
    cachedProjectsList = list;
  }
  return list.slice();
}

export async function getProjectCaseById(id: string): Promise<ProjectCase | null> {
  const list = await listProjectCases();
  return list.find((p) => p.id === id) ?? null;
}

export async function createProjectCase(input: {
  seg: 'b2b' | 'b2c';
  tag: string;
  title: string;
  img: string;
  task: string;
  solution: string;
  specs: string;
  result: string;
}): Promise<ProjectCase> {
  const db = getDb();
  const now = new Date().toISOString();
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  const id = `${slugBase || 'case'}-${Date.now().toString(36)}`;
  const [minRow] = await db
    .select({ minSort: sql<number | null>`MIN(${schema.projectsTable.sortOrder})` })
    .from(schema.projectsTable);
  const nextSort = Number(minRow?.minSort ?? 1) - 1;

  const [inserted] = await db
    .insert(schema.projectsTable)
    .values({
      id,
      seg: input.seg === 'b2b' ? 'b2b' : 'b2c',
      tag: input.tag.trim() || (input.seg === 'b2b' ? 'B2B · Одеса' : 'B2C · Одеса'),
      title: input.title.trim(),
      img: input.img.trim() || '/assets/energocomfort/house_6kw.png',
      task: input.task.trim(),
      solution: input.solution.trim(),
      specs: input.specs.trim(),
      result: input.result.trim(),
      sortOrder: nextSort,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await invalidateProjectsCache();
  await syncProjectsSeedFile();
  return rowToProjectCase(inserted);
}

export async function updateProjectCase(
  id: string,
  patch: Partial<{
    seg: 'b2b' | 'b2c';
    tag: string;
    title: string;
    img: string;
    task: string;
    solution: string;
    specs: string;
    result: string;
  }>,
): Promise<ProjectCase | null> {
  const db = getDb();
  const existing = await getProjectCaseById(id);
  if (!existing) return null;

  const seg = patch.seg === 'b2b' || patch.seg === 'b2c' ? patch.seg : existing.seg;
  const tag = patch.tag !== undefined ? patch.tag.trim() : existing.tag;
  const title = patch.title !== undefined ? patch.title.trim() : existing.title;
  const img = patch.img !== undefined ? patch.img.trim() : existing.img;
  const task = patch.task !== undefined ? patch.task.trim() : existing.task;
  const solution = patch.solution !== undefined ? patch.solution.trim() : existing.solution;
  const specs = patch.specs !== undefined ? patch.specs.trim() : existing.specs;
  const result = patch.result !== undefined ? patch.result.trim() : existing.result;
  const now = new Date().toISOString();

  const [updated] = await db
    .update(schema.projectsTable)
    .set({
      seg,
      tag,
      title,
      img,
      task,
      solution,
      specs,
      result,
      updatedAt: now,
    })
    .where(eq(schema.projectsTable.id, id))
    .returning();

  await invalidateProjectsCache();
  await syncProjectsSeedFile();
  return updated ? rowToProjectCase(updated) : null;
}

export async function deleteProjectCase(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.projectsTable)
    .where(eq(schema.projectsTable.id, id))
    .returning({ id: schema.projectsTable.id });
  if (deleted.length > 0) {
    await invalidateProjectsCache();
    await syncProjectsSeedFile();
    return true;
  }
  return false;
}

export async function listSitemapProductEntries(): Promise<
  Array<{ id: string; title: string; img: string; updatedAt: string }>
> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<Array<{ id: string; title: string; img: string; updatedAt: string }>>(
      KEY_SITEMAP_PRODUCTS,
    );
    if (redisHit) return redisHit;
  } else if (cachedSitemapProducts) {
    return cachedSitemapProducts;
  }
  let entries: Array<{ id: string; title: string; img: string; updatedAt: string }>;
  if (!isDatabaseConfigured()) {
    const seedUpdatedAt = getSeedFileMtimeIso(SEED_CATALOG_PATH);
    entries = (await ensureCatalogCache())
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({
        id: p.id,
        title: p.title || '',
        img: p.img || '',
        updatedAt: seedUpdatedAt,
      }));
  } else {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.productsTable.id,
        title: schema.productsTable.title,
        img: schema.productsTable.img,
        updatedAt: schema.productsTable.updatedAt,
      })
      .from(schema.productsTable)
      .orderBy(asc(schema.productsTable.id));

    entries = rows.map((r) => ({
      id: r.id,
      title: r.title || '',
      img: r.img || '',
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
  }
  if (isRedisConfigured()) {
    await redisSetJson(KEY_SITEMAP_PRODUCTS, entries, CATALOG_CACHE_TTL_SEC);
  } else {
    cachedSitemapProducts = entries;
  }
  return entries;
}

export async function listSitemapCategoryEntries(): Promise<
  Array<{ cat: string; updatedAt: string; itemCount: number }>
> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<Array<{ cat: string; updatedAt: string; itemCount: number }>>(
      KEY_SITEMAP_CATEGORIES,
    );
    if (redisHit) return redisHit;
  } else if (cachedSitemapCategories) {
    return cachedSitemapCategories;
  }

  let entries: Array<{ cat: string; updatedAt: string; itemCount: number }>;
  if (!isDatabaseConfigured()) {
    const seedUpdatedAt = getSeedFileMtimeIso(SEED_CATALOG_PATH);
    const counts = new Map<string, number>();
    for (const item of await ensureCatalogCache()) {
      const cat = String(item.cat || '');
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    entries = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, itemCount]) => ({ cat, updatedAt: seedUpdatedAt, itemCount }));
  } else {
    const db = getDb();
    const rows = await db
      .select({
        cat: schema.productsTable.cat,
        lastUpdated: sql<string | null>`MAX(${schema.productsTable.updatedAt})`,
        itemCount: count(),
      })
      .from(schema.productsTable)
      .groupBy(schema.productsTable.cat)
      .orderBy(asc(schema.productsTable.cat));

    entries = rows.map((r) => ({
      cat: r.cat || '',
      updatedAt: r.lastUpdated || new Date().toISOString(),
      itemCount: Number(r.itemCount || 0),
    }));
  }
  if (isRedisConfigured()) {
    await redisSetJson(KEY_SITEMAP_CATEGORIES, entries, CATALOG_CACHE_TTL_SEC);
  } else {
    cachedSitemapCategories = entries;
  }
  return entries;
}

export async function getLatestCatalogOrProjectUpdatedAt(): Promise<string> {
  if (isRedisConfigured()) {
    const redisHit = await redisGetJson<string>(KEY_LATEST_UPDATED_AT);
    if (redisHit) return redisHit;
  } else if (cachedLatestCatalogOrProjectUpdatedAt) {
    return cachedLatestCatalogOrProjectUpdatedAt;
  }

  let latest: string;
  if (!isDatabaseConfigured()) {
    const dates = [
      getSeedFileMtimeIso(SEED_CATALOG_PATH),
      getSeedFileMtimeIso(SEED_PROJECTS_PATH),
    ].sort();
    latest = dates[dates.length - 1] || new Date().toISOString();
  } else {
    const db = getDb();
    const [[prodMax], [projMax]] = await Promise.all([
      db.select({ latest: sql<string | null>`MAX(${schema.productsTable.updatedAt})` }).from(schema.productsTable),
      db.select({ latest: sql<string | null>`MAX(${schema.projectsTable.updatedAt})` }).from(schema.projectsTable),
    ]);
    const dates = [prodMax?.latest, projMax?.latest].filter((v): v is string => Boolean(v));
    dates.sort();
    latest = dates[dates.length - 1] || new Date().toISOString();
  }
  if (isRedisConfigured()) {
    await redisSetJson(KEY_LATEST_UPDATED_AT, latest, CATALOG_CACHE_TTL_SEC);
  } else {
    cachedLatestCatalogOrProjectUpdatedAt = latest;
  }
  return latest;
}

export async function getRecentCatalogAndProjectChanges(limit = 12): Promise<RecentChangeRecord[]> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(30, Math.round(limit)));
  const [prodRows, projRows] = await Promise.all([
    db
      .select({
        id: schema.productsTable.id,
        title: schema.productsTable.title,
        updatedAt: schema.productsTable.updatedAt,
      })
      .from(schema.productsTable)
      .orderBy(desc(schema.productsTable.updatedAt))
      .limit(safeLimit),
    db
      .select({
        id: schema.projectsTable.id,
        title: schema.projectsTable.title,
        updatedAt: schema.projectsTable.updatedAt,
      })
      .from(schema.projectsTable)
      .orderBy(desc(schema.projectsTable.updatedAt))
      .limit(safeLimit),
  ]);

  const combined: RecentChangeRecord[] = [
    ...prodRows.map((r) => ({ kind: 'product' as const, id: r.id, title: r.title, updatedAt: r.updatedAt })),
    ...projRows.map((r) => ({ kind: 'project' as const, id: r.id, title: r.title, updatedAt: r.updatedAt })),
  ];
  combined.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return combined.slice(0, safeLimit);
}
