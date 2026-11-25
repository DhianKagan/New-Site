import type { Product } from '../types.ts';

export const WISHLIST_STORAGE_KEY = 'ec_wishlist_v1';
export const WISHLIST_MAX_ITEMS = 200;

export function normalizeWishlistIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= WISHLIST_MAX_ITEMS) break;
  }
  return out;
}

export function toggleWishlistId(currentIds: string[], productId: string): string[] {
  const cleanId = productId.trim();
  if (!cleanId) return normalizeWishlistIds(currentIds);
  const normalized = normalizeWishlistIds(currentIds);
  if (normalized.includes(cleanId)) {
    return normalized.filter((id) => id !== cleanId);
  }
  return [cleanId, ...normalized].slice(0, WISHLIST_MAX_ITEMS);
}

export function mergeWishlistIds(serverIds: string[], localIds: string[]): string[] {
  return normalizeWishlistIds([...localIds, ...serverIds]);
}

export function resolveWishlistProducts(wishlistIds: string[], products: Product[]): Product[] {
  if (wishlistIds.length === 0 || products.length === 0) return [];
  const byId = new Map<string, Product>();
  for (const product of products) {
    byId.set(product.id, product);
  }
  const resolved: Product[] = [];
  for (const id of normalizeWishlistIds(wishlistIds)) {
    const match = byId.get(id);
    if (match) resolved.push(match);
  }
  return resolved;
}

export function readWishlistFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    return normalizeWishlistIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeWishlistToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(normalizeWishlistIds(ids)));
  } catch {
    // ignore storage quota errors
  }
}
