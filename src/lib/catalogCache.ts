import type { Product } from '../types.ts';

export interface CatalogEnvironmentMeta {
  environment?: string;
  dataDirMode?: 'custom' | 'default';
  totalCount?: number;
  kitCount?: number;
  legacyKitCategoryMismatchCount?: number;
  missingSkuKitCount?: number;
  latestUpdatedAt?: string | null;
}

export interface CatalogFingerprint {
  totalCount: number;
  byCat: Record<string, number>;
  isKitTrueCount: number;
  legacyKitCatMismatchIds: string[];
  emptySkuKitIds: string[];
  contentHash: string;
}

export interface CatalogCachePayload {
  version: 2;
  cachedAt: number;
  origin: string;
  items: Product[];
  serverMeta?: CatalogEnvironmentMeta;
}

export interface CachedCatalogReadResult {
  items: Product[];
  cachedAt: number | null;
  cachedOrigin: string | null;
  serverMeta?: CatalogEnvironmentMeta;
  wasLegacyFormat: boolean;
}

export interface CatalogDiffSummary {
  hasChanges: boolean;
  addedIds: string[];
  removedIds: string[];
  updatedIds: string[];
  categoryCountDelta: Record<string, number>;
}

export interface CatalogNormalizationReport {
  items: Product[];
  repairedKitIds: string[];
  injectedMissingKitIds: string[];
  backfilledKitSkuIds: string[];
}

export type CatalogSwrPhase =
  | 'cache_hydrated'
  | 'revalidated_unchanged'
  | 'revalidated_updated'
  | 'fallback_cache'
  | 'fallback_seed'
  | 'fallback_kits';

export interface CatalogSwrDiagnostics {
  timestamp: string;
  origin: string;
  phase: CatalogSwrPhase;
  cacheHit: boolean;
  cacheAgeMs: number | null;
  cachedOrigin: string | null;
  originMismatch: boolean;
  serverMeta?: CatalogEnvironmentMeta;
  rawServerFingerprint?: CatalogFingerprint;
  normalizedFingerprint: CatalogFingerprint;
  repairedKitIds: string[];
  injectedMissingKitIds: string[];
  backfilledKitSkuIds: string[];
  diffFromCache?: CatalogDiffSummary;
  errorMessage?: string;
}

const CATALOG_CATEGORIES = ['kits', 'inverters', 'batteries', 'panels', 'parts'] as const;

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildProductSignature(product: Product): string {
  return [
    product.id,
    product.sku,
    product.cat,
    product.isKit ? '1' : '0',
    String(product.price),
    String(product.oldPrice),
    product.inStock ? '1' : '0',
    product.statusLabel,
    product.title,
    product.brand,
    product.img,
  ].join('|');
}

export function normalizeAndMergeKits(
  items: Product[],
  readyToUseKits: Product[],
): CatalogNormalizationReport {
  const kitById = new Map(readyToUseKits.map((kit) => [kit.id, kit]));
  const repairedKitIds: string[] = [];
  const backfilledKitSkuIds: string[] = [];

  const normalized = items.map((item) => {
    const knownKit = kitById.get(item.id);
    const shouldBeKit = Boolean(item.isKit) || Boolean(knownKit);
    if (!shouldBeKit) return item;

    const nextCat = item.cat === 'kits' ? item.cat : 'kits';
    const nextSku = item.sku?.trim() ? item.sku : (knownKit?.sku ?? item.sku ?? '');
    const nextImg = item.img?.trim() ? item.img : (knownKit?.img ?? item.img ?? '');

    if (item.cat !== 'kits' || !item.isKit) {
      repairedKitIds.push(item.id);
    }
    if (!item.sku?.trim() && nextSku.trim()) {
      backfilledKitSkuIds.push(item.id);
    }

    if (
      item.isKit === true &&
      nextCat === item.cat &&
      nextSku === item.sku &&
      nextImg === item.img
    ) {
      return item;
    }

    return {
      ...item,
      isKit: true,
      cat: nextCat,
      sku: nextSku,
      img: nextImg,
    };
  });

  const existingIds = new Set(normalized.map((item) => item.id));
  const missingKits = readyToUseKits.filter((kit) => !existingIds.has(kit.id));
  const injectedMissingKitIds = missingKits.map((kit) => kit.id);

  return {
    items: missingKits.length > 0 ? [...normalized, ...missingKits] : normalized,
    repairedKitIds,
    injectedMissingKitIds,
    backfilledKitSkuIds,
  };
}

export function computeCatalogFingerprint(items: Product[]): CatalogFingerprint {
  const byCat: Record<string, number> = {
    kits: 0,
    inverters: 0,
    batteries: 0,
    panels: 0,
    parts: 0,
  };
  let isKitTrueCount = 0;
  const legacyKitCatMismatchIds: string[] = [];
  const emptySkuKitIds: string[] = [];

  const signatures = items.map((item) => {
    byCat[item.cat] = (byCat[item.cat] || 0) + 1;
    if (item.isKit) {
      isKitTrueCount += 1;
      if (item.cat !== 'kits') {
        legacyKitCatMismatchIds.push(item.id);
      }
    }
    if ((item.cat === 'kits' || item.isKit) && !item.sku?.trim()) {
      emptySkuKitIds.push(item.id);
    }
    return buildProductSignature(item);
  });

  signatures.sort();
  return {
    totalCount: items.length,
    byCat,
    isKitTrueCount,
    legacyKitCatMismatchIds,
    emptySkuKitIds,
    contentHash: fnv1aHex(signatures.join('\n')),
  };
}

export function diffCatalogItems(previous: Product[], next: Product[]): CatalogDiffSummary {
  const prevMap = new Map<string, string>();
  const prevCatCounts: Record<string, number> = {};
  for (const item of previous) {
    prevMap.set(item.id, buildProductSignature(item));
    prevCatCounts[item.cat] = (prevCatCounts[item.cat] || 0) + 1;
  }

  const nextMap = new Map<string, string>();
  const nextCatCounts: Record<string, number> = {};
  for (const item of next) {
    nextMap.set(item.id, buildProductSignature(item));
    nextCatCounts[item.cat] = (nextCatCounts[item.cat] || 0) + 1;
  }

  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  const removedIds: string[] = [];

  for (const [id, sig] of nextMap.entries()) {
    const prevSig = prevMap.get(id);
    if (prevSig === undefined) {
      addedIds.push(id);
    } else if (prevSig !== sig) {
      updatedIds.push(id);
    }
  }

  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      removedIds.push(id);
    }
  }

  const categoryCountDelta: Record<string, number> = {};
  const allCats = new Set([
    ...CATALOG_CATEGORIES,
    ...Object.keys(prevCatCounts),
    ...Object.keys(nextCatCounts),
  ]);
  for (const cat of allCats) {
    const delta = (nextCatCounts[cat] || 0) - (prevCatCounts[cat] || 0);
    if (delta !== 0) {
      categoryCountDelta[cat] = delta;
    }
  }

  return {
    hasChanges: addedIds.length > 0 || removedIds.length > 0 || updatedIds.length > 0,
    addedIds,
    removedIds,
    updatedIds,
    categoryCountDelta,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readCachedCatalog(
  storage: StorageLike | null | undefined,
  storageKey: string,
): CachedCatalogReadResult {
  if (!storage) {
    return { items: [], cachedAt: null, cachedOrigin: null, wasLegacyFormat: false };
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return { items: [], cachedAt: null, cachedOrigin: null, wasLegacyFormat: false };
    }
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return {
        items: parsed.filter(Boolean) as Product[],
        cachedAt: null,
        cachedOrigin: null,
        wasLegacyFormat: true,
      };
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as CatalogCachePayload).items)
    ) {
      const payload = parsed as CatalogCachePayload;
      return {
        items: payload.items.filter(Boolean),
        cachedAt: typeof payload.cachedAt === 'number' && Number.isFinite(payload.cachedAt)
          ? payload.cachedAt
          : null,
        cachedOrigin: typeof payload.origin === 'string' ? payload.origin : null,
        serverMeta: payload.serverMeta,
        wasLegacyFormat: false,
      };
    }
  } catch {
    // ignore malformed cache payloads
  }

  return { items: [], cachedAt: null, cachedOrigin: null, wasLegacyFormat: false };
}

export function writeCachedCatalog(
  storage: StorageLike | null | undefined,
  storageKey: string,
  items: Product[],
  origin: string,
  serverMeta?: CatalogEnvironmentMeta,
  nowMs: number = Date.now(),
): void {
  if (!storage) return;
  try {
    const payload: CatalogCachePayload = {
      version: 2,
      cachedAt: nowMs,
      origin,
      items,
      ...(serverMeta ? { serverMeta } : {}),
    };
    storage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

let lastCatalogSwrDiagnostics: CatalogSwrDiagnostics | null = null;

export function getLastCatalogSwrDiagnostics(): CatalogSwrDiagnostics | null {
  return lastCatalogSwrDiagnostics;
}

export function recordCatalogSwrDiagnostics(entry: CatalogSwrDiagnostics): void {
  lastCatalogSwrDiagnostics = entry;
  if (typeof window !== 'undefined') {
    (window as Window & { __EC_CATALOG_SWR__?: CatalogSwrDiagnostics }).__EC_CATALOG_SWR__ = entry;
  }

  const hasEnvironmentAnomaly =
    entry.originMismatch ||
    entry.repairedKitIds.length > 0 ||
    entry.injectedMissingKitIds.length > 0 ||
    entry.backfilledKitSkuIds.length > 0 ||
    (entry.rawServerFingerprint?.legacyKitCatMismatchIds.length ?? 0) > 0 ||
    (entry.rawServerFingerprint?.emptySkuKitIds.length ?? 0) > 0;

  if (entry.phase.startsWith('fallback_') || hasEnvironmentAnomaly) {
    console.warn(`[CatalogSWR] ${entry.phase} (environment mismatch or fallback detected)`, {
      origin: entry.origin,
      cachedOrigin: entry.cachedOrigin,
      originMismatch: entry.originMismatch,
      cacheAgeMs: entry.cacheAgeMs,
      serverMeta: entry.serverMeta,
      rawTotal: entry.rawServerFingerprint?.totalCount,
      rawByCat: entry.rawServerFingerprint?.byCat,
      normalizedTotal: entry.normalizedFingerprint.totalCount,
      normalizedByCat: entry.normalizedFingerprint.byCat,
      repairedKitIds: entry.repairedKitIds,
      injectedMissingKitIds: entry.injectedMissingKitIds,
      backfilledKitSkuIds: entry.backfilledKitSkuIds,
      diffFromCache: entry.diffFromCache,
      errorMessage: entry.errorMessage,
    });
    return;
  }

  if (entry.phase === 'revalidated_updated') {
    console.info('[CatalogSWR] Revalidated catalog updated in background', {
      origin: entry.origin,
      cacheAgeMs: entry.cacheAgeMs,
      serverMeta: entry.serverMeta,
      totalCount: entry.normalizedFingerprint.totalCount,
      byCat: entry.normalizedFingerprint.byCat,
      diffFromCache: entry.diffFromCache,
    });
    return;
  }

  if (entry.phase === 'cache_hydrated') {
    console.info('[CatalogSWR] Hydrated stale catalog immediately; revalidating in background', {
      origin: entry.origin,
      cacheAgeMs: entry.cacheAgeMs,
      totalCount: entry.normalizedFingerprint.totalCount,
      byCat: entry.normalizedFingerprint.byCat,
      contentHash: entry.normalizedFingerprint.contentHash,
    });
    return;
  }

  console.info('[CatalogSWR] Revalidated catalog matches cache', {
    origin: entry.origin,
    cacheAgeMs: entry.cacheAgeMs,
    serverMeta: entry.serverMeta,
    totalCount: entry.normalizedFingerprint.totalCount,
    byCat: entry.normalizedFingerprint.byCat,
    contentHash: entry.normalizedFingerprint.contentHash,
  });
}
