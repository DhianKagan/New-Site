import type { Product } from '../types.ts';

function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/.]+/g, '');
}

export function scoreProductSearchMatch(product: Product, rawQuery: string): number {
  const trimmed = rawQuery.trim().toLowerCase();
  if (!trimmed) return 1;

  const titleLower = product.title.toLowerCase();
  const skuLower = product.sku.toLowerCase();
  const brandLower = product.brand.toLowerCase();
  const descLower = product.description.toLowerCase();

  const compactQuery = normalizeCompact(trimmed);
  const compactSku = normalizeCompact(product.sku);
  const compactTitle = normalizeCompact(product.title);

  // Exact SKU match gets highest priority
  if (skuLower === trimmed || (compactQuery.length > 0 && compactSku === compactQuery)) {
    return 100;
  }

  // Direct substring match on SKU or Title
  if (skuLower.startsWith(trimmed) || (compactQuery.length > 1 && compactSku.startsWith(compactQuery))) {
    return 90;
  }
  if (skuLower.includes(trimmed) || (compactQuery.length > 1 && compactSku.includes(compactQuery))) {
    return 80;
  }
  if (titleLower.includes(trimmed) || (compactQuery.length > 1 && compactTitle.includes(compactQuery))) {
    return 70;
  }

  // Multi-token match across title and SKU (all tokens must match)
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const titleAndSku = `${titleLower} ${skuLower}`;
    const compactTitleAndSku = `${compactTitle} ${compactSku}`;
    const allInTitleOrSku = tokens.every((tok) => {
      const compactTok = normalizeCompact(tok);
      return titleAndSku.includes(tok) || (compactTok.length > 0 && compactTitleAndSku.includes(compactTok));
    });
    if (allInTitleOrSku) {
      return 60;
    }

    const combinedAll = `${titleLower} ${skuLower} ${brandLower} ${descLower}`;
    const allInCombined = tokens.every((tok) => combinedAll.includes(tok));
    if (allInCombined) {
      return 40;
    }
  }

  // Single-token fallback on brand or description
  if (brandLower.includes(trimmed) || descLower.includes(trimmed)) {
    return 30;
  }

  return 0;
}

export function filterAndRankProductsBySearch(
  products: Product[],
  rawQuery: string,
  preserveOrder = true,
): Product[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return products;

  const scored: Array<{ product: Product; score: number }> = [];
  for (const product of products) {
    const score = scoreProductSearchMatch(product, trimmed);
    if (score > 0) {
      scored.push({ product, score });
    }
  }

  if (!preserveOrder) {
    return scored.map((entry) => entry.product);
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.product);
}

export interface FeaturedBrandFilter {
  id: 'Deye' | 'SolaX' | 'Solis' | 'Dyness' | 'Trina';
  label: string;
  aliases: string[];
}

export const FEATURED_BRAND_FILTERS: FeaturedBrandFilter[] = [
  { id: 'Deye', label: 'Deye', aliases: ['deye'] },
  { id: 'SolaX', label: 'SolaX', aliases: ['solax'] },
  { id: 'Solis', label: 'Solis', aliases: ['solis'] },
  { id: 'Dyness', label: 'Dyness', aliases: ['dyness'] },
  { id: 'Trina', label: 'Trina', aliases: ['trina', 'trina solar'] },
];

export function matchesFeaturedBrand(product: Product, brandId: string): boolean {
  const brandLower = product.brand.trim().toLowerCase();
  const def = FEATURED_BRAND_FILTERS.find((item) => item.id === brandId);
  if (def) {
    return def.aliases.includes(brandLower);
  }
  return brandLower === brandId.trim().toLowerCase();
}

export function matchesBrandFilters(
  product: Product,
  selectedBrands: string[],
  dropdownBrand: string,
): boolean {
  if (selectedBrands.length > 0) {
    return selectedBrands.some((id) => matchesFeaturedBrand(product, id));
  }
  if (dropdownBrand !== 'all') {
    return product.brand === dropdownBrand;
  }
  return true;
}

