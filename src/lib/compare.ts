import type { Product } from '../types.ts';
import { localizeCatalogText } from './i18n.ts';

export const COMPARE_STORAGE_KEY = 'ec_compare_v1';
export const MAX_COMPARE_PRODUCTS = 4;

export interface ToggleCompareResult {
  ids: string[];
  added: boolean;
  limitReached: boolean;
}

export interface ComparisonSpecRow {
  label: string;
  values: string[];
  differs: boolean;
}

export function normalizeCompareIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= MAX_COMPARE_PRODUCTS) break;
  }
  return out;
}

export function toggleCompareId(currentIds: string[], productId: string): ToggleCompareResult {
  const cleanId = productId.trim();
  const normalized = normalizeCompareIds(currentIds);
  if (!cleanId) {
    return { ids: normalized, added: false, limitReached: false };
  }
  if (normalized.includes(cleanId)) {
    return {
      ids: normalized.filter((id) => id !== cleanId),
      added: false,
      limitReached: false,
    };
  }
  if (normalized.length >= MAX_COMPARE_PRODUCTS) {
    return {
      ids: normalized,
      added: false,
      limitReached: true,
    };
  }
  return {
    ids: [...normalized, cleanId],
    added: true,
    limitReached: false,
  };
}

export function resolveCompareProducts(compareIds: string[], products: Product[]): Product[] {
  if (compareIds.length === 0 || products.length === 0) return [];
  const byId = new Map<string, Product>();
  for (const product of products) {
    byId.set(product.id, product);
  }
  const resolved: Product[] = [];
  for (const id of normalizeCompareIds(compareIds)) {
    const match = byId.get(id);
    if (match) resolved.push(match);
  }
  return resolved;
}

export function readCompareFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return normalizeCompareIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCompareToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizeCompareIds(ids)));
  } catch {
    // ignore storage quota errors
  }
}

export function getLocalizedProductSpecs(product: Product, isRussian: boolean): [string, string][] {
  if (!isRussian) return product.specs;
  return (
    product.specsRu ??
    product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
  );
}

export function doesRowDiffer(values: string[]): boolean {
  if (values.length < 2) return false;
  const distinct = new Set(values.map((v) => v.trim().toLowerCase()));
  return distinct.size > 1;
}

export function buildComparisonSpecRows(products: Product[], isRussian: boolean): ComparisonSpecRow[] {
  if (products.length === 0) return [];

  const labelOrder: string[] = [];
  const keyToLabel = new Map<string, string>();
  const productSpecMaps = products.map((product) => {
    const map = new Map<string, string>();
    for (const [rawKey, rawVal] of getLocalizedProductSpecs(product, isRussian)) {
      const displayKey = rawKey.trim();
      const normalizedKey = displayKey.toLowerCase();
      const cleanVal = rawVal.trim();
      if (!normalizedKey || !cleanVal) continue;
      if (!keyToLabel.has(normalizedKey)) {
        keyToLabel.set(normalizedKey, displayKey);
        labelOrder.push(normalizedKey);
      }
      if (!map.has(normalizedKey)) {
        map.set(normalizedKey, cleanVal);
      }
    }
    return map;
  });

  return labelOrder.map((normalizedKey) => {
    const label = keyToLabel.get(normalizedKey) ?? normalizedKey;
    const values = productSpecMaps.map((specMap) => specMap.get(normalizedKey) ?? '—');
    return {
      label,
      values,
      differs: doesRowDiffer(values),
    };
  });
}
