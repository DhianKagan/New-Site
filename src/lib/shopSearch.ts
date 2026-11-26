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

export function getProductSearchSuggestions(
  products: Product[],
  rawQuery: string,
  limit = 6,
): { suggestions: Product[]; totalMatches: number } {
  const trimmed = rawQuery.trim();
  if (!trimmed || limit <= 0) {
    return { suggestions: [], totalMatches: 0 };
  }
  const ranked = filterAndRankProductsBySearch(products, trimmed, true);
  return {
    suggestions: ranked.slice(0, limit),
    totalMatches: ranked.length,
  };
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

export type EquipmentTypeFilterId = 'inverters' | 'batteries' | 'panels' | 'kits';

export interface EquipmentTypeFilter {
  id: EquipmentTypeFilterId;
  labelUk: string;
  labelRu: string;
}

export const EQUIPMENT_TYPE_FILTERS: EquipmentTypeFilter[] = [
  { id: 'inverters', labelUk: 'Інвертори', labelRu: 'Инверторы' },
  { id: 'batteries', labelUk: 'Акумулятори', labelRu: 'Аккумуляторы' },
  { id: 'panels', labelUk: 'Сонячні панелі', labelRu: 'Солнечные панели' },
  { id: 'kits', labelUk: 'Комплекти', labelRu: 'Комплекты' },
];

export function matchesEquipmentTypes(
  product: Product,
  selectedTypes: EquipmentTypeFilterId[],
): boolean {
  if (selectedTypes.length === 0) return true;
  if (selectedTypes.includes('kits') && (product.cat === 'kits' || product.isKit)) {
    return true;
  }
  return selectedTypes.includes(product.cat as EquipmentTypeFilterId);
}

export type InverterPowerRangeId = 'up_to_5' | 'from_5_to_10' | 'over_10';

export interface InverterPowerRangeFilter {
  id: InverterPowerRangeId;
  labelUk: string;
  labelRu: string;
}

export const INVERTER_POWER_FILTERS: InverterPowerRangeFilter[] = [
  { id: 'up_to_5', labelUk: 'до 5 кВт', labelRu: 'до 5 кВт' },
  { id: 'from_5_to_10', labelUk: '5–10 кВт', labelRu: '5–10 кВт' },
  { id: 'over_10', labelUk: 'понад 10 кВт', labelRu: 'свыше 10 кВт' },
];

export function extractInverterPowerKw(product: Product): number | null {
  if (product.cat !== 'inverters') return null;

  const powerSpec = product.specs.find(([k]) => /потужн|мощн|power/i.test(k));
  if (powerSpec) {
    const rawVal = powerSpec[1].replace(',', '.');
    const match = rawVal.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = Number.parseFloat(match[1]);
      if (Number.isFinite(num) && num > 0) {
        const isWattsOnly =
          /(?:^|\s|\d)(?:Вт|W)(?![a-zA-Zа-яА-ЯіІїЇєЄґҐ])/i.test(rawVal) &&
          !/(?:кВт|kW)/i.test(rawVal);
        return isWattsOnly ? num / 1000 : num;
      }
    }
  }

  const titleMatch = product.title
    .replace(',', '.')
    .match(/(\d+(?:\.\d+)?)\s*(?:кВт|kW)(?![a-zA-Zа-яА-ЯіІїЇєЄґҐ])/i);
  if (titleMatch) {
    const num = Number.parseFloat(titleMatch[1]);
    if (Number.isFinite(num) && num > 0) return num;
  }

  return null;
}

export function matchesInverterPowerRanges(
  product: Product,
  selectedRanges: InverterPowerRangeId[],
): boolean {
  if (selectedRanges.length === 0) return true;
  const kw = extractInverterPowerKw(product);
  if (kw === null) return false;
  return selectedRanges.some((rangeId) => {
    if (rangeId === 'up_to_5') return kw <= 5;
    if (rangeId === 'from_5_to_10') return kw > 5 && kw <= 10;
    return kw > 10;
  });
}

export function computeEquipmentTypeCounts(
  products: Product[],
  options: {
    selectedBrands?: string[];
    dropdownBrand?: string;
    powerRanges?: InverterPowerRangeId[];
    inStockOnly?: boolean;
    query?: string;
  } = {},
): Record<EquipmentTypeFilterId, number> {
  const {
    selectedBrands = [],
    dropdownBrand = 'all',
    powerRanges = [],
    inStockOnly = false,
    query = '',
  } = options;

  const base = products.filter((p) => {
    if (!matchesBrandFilters(p, selectedBrands, dropdownBrand)) return false;
    if (!matchesInverterPowerRanges(p, powerRanges)) return false;
    if (inStockOnly && !p.inStock) return false;
    return true;
  });

  const matchingQuery = query.trim() ? filterAndRankProductsBySearch(base, query, false) : base;

  const map: Record<EquipmentTypeFilterId, number> = {
    inverters: 0,
    batteries: 0,
    panels: 0,
    kits: 0,
  };

  for (const product of matchingQuery) {
    for (const item of EQUIPMENT_TYPE_FILTERS) {
      if (matchesEquipmentTypes(product, [item.id])) {
        map[item.id] += 1;
      }
    }
  }

  return map;
}

export function computeFeaturedBrandCounts(
  products: Product[],
  options: {
    category?: string;
    equipmentTypes?: EquipmentTypeFilterId[];
    inStockOnly?: boolean;
    query?: string;
    powerRanges?: InverterPowerRangeId[];
  } = {},
): Record<string, number> {
  const {
    category = 'all',
    equipmentTypes = [],
    inStockOnly = false,
    query = '',
    powerRanges = [],
  } = options;

  const base = products.filter((p) => {
    if (category !== 'all' && p.cat !== category) return false;
    if (!matchesEquipmentTypes(p, equipmentTypes)) return false;
    if (inStockOnly && !p.inStock) return false;
    if (!matchesInverterPowerRanges(p, powerRanges)) return false;
    return true;
  });

  const matchingQuery = query.trim() ? filterAndRankProductsBySearch(base, query, false) : base;

  const map: Record<string, number> = {};
  for (const item of FEATURED_BRAND_FILTERS) {
    map[item.id] = 0;
  }
  for (const product of matchingQuery) {
    for (const item of FEATURED_BRAND_FILTERS) {
      if (matchesFeaturedBrand(product, item.id)) {
        map[item.id] += 1;
      }
    }
  }
  return map;
}

export function computeInverterPowerCounts(
  products: Product[],
  options: {
    category?: string;
    equipmentTypes?: EquipmentTypeFilterId[];
    selectedBrands?: string[];
    dropdownBrand?: string;
    inStockOnly?: boolean;
    query?: string;
  } = {},
): Record<InverterPowerRangeId, number> {
  const {
    category = 'all',
    equipmentTypes = [],
    selectedBrands = [],
    dropdownBrand = 'all',
    inStockOnly = false,
    query = '',
  } = options;

  const base = products.filter((p) => {
    if (category !== 'all' && p.cat !== category) return false;
    if (!matchesEquipmentTypes(p, equipmentTypes)) return false;
    if (!matchesBrandFilters(p, selectedBrands, dropdownBrand)) return false;
    if (inStockOnly && !p.inStock) return false;
    return p.cat === 'inverters';
  });

  const matchingQuery = query.trim() ? filterAndRankProductsBySearch(base, query, false) : base;

  const map: Record<InverterPowerRangeId, number> = {
    up_to_5: 0,
    from_5_to_10: 0,
    over_10: 0,
  };

  for (const product of matchingQuery) {
    const kw = extractInverterPowerKw(product);
    if (kw === null) continue;
    if (kw <= 5) {
      map.up_to_5 += 1;
    } else if (kw <= 10) {
      map.from_5_to_10 += 1;
    } else {
      map.over_10 += 1;
    }
  }

  return map;
}

