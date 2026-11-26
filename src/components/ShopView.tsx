import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X, MessageSquarePlus, SlidersHorizontal, Zap, Layers, Scale } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { tr } from '../lib/i18n.ts';
import {
  computeEquipmentTypeCounts,
  computeFeaturedBrandCounts,
  computeInverterPowerCounts,
  EQUIPMENT_TYPE_FILTERS,
  FEATURED_BRAND_FILTERS,
  filterAndRankProductsBySearch,
  INVERTER_POWER_FILTERS,
  matchesBrandFilters,
  matchesEquipmentTypes,
  matchesInverterPowerRanges,
  type EquipmentTypeFilterId,
  type InverterPowerRangeId,
} from '../lib/shopSearch.ts';
import { toAnalyticsProductItem, track, trackEvent } from '../lib/analytics.ts';

interface ShopViewProps {
  products: Product[];
  initialCategory: ProductCategory | 'all';
  initialQuery?: string;
  wishlistIds?: string[];
  compareIds?: string[];
  onCategoryChange?: (cat: ProductCategory | 'all') => void;
  onQueryChange?: (query: string) => void;
  onSelectProduct: (product: Product) => void;
  onQuickViewProduct?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onToggleCompare?: (product: Product) => void;
  onOpenCompare?: () => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onCalculatePayback?: (product: Product) => void;
  onOpenCustomRequest?: (topic: string, notes?: string) => void;
  onBackHome?: () => void;
  usdUahRate: number | null;
}

const PAGE_SIZE = 24;

const CATEGORY_TITLES: Record<ProductCategory | 'all', string> = {
  all: 'Усі товари',
  kits: 'Готові рішення',
  inverters: 'Інвертори',
  batteries: 'Акумулятори LiFePO4',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі та захист',
};

export function ShopView({
  products,
  initialCategory,
  initialQuery = '',
  wishlistIds = [],
  compareIds = [],
  onCategoryChange,
  onQueryChange,
  onSelectProduct,
  onQuickViewProduct,
  onToggleWishlist,
  onToggleCompare,
  onOpenCompare,
  onAddToCart,
  onRequestQuote,
  onCalculatePayback,
  onOpenCustomRequest,
  usdUahRate,
}: ShopViewProps) {
  const [cat, setCat] = useState<ProductCategory | 'all'>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [brand, setBrand] = useState('all');
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState<EquipmentTypeFilterId[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPowerRanges, setSelectedPowerRanges] = useState<InverterPowerRangeId[]>([]);
  const [sort, setSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const lastTrackedListKeyRef = useRef('');
  const lastTrackedSearchRef = useRef('');

  useEffect(() => {
    setCat(initialCategory);
    setSelectedEquipmentTypes([]);
    setPage(1);
  }, [initialCategory]);

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: products.length, kits: 0, inverters: 0, batteries: 0, panels: 0, parts: 0 };
    for (const p of products) {
      map[p.cat] = (map[p.cat] || 0) + 1;
    }
    return map;
  }, [products]);

  const brands = useMemo(() => {
    const bMap = new Map<string, number>();
    for (const p of products) {
      bMap.set(p.brand, (bMap.get(p.brand) || 0) + 1);
    }
    return Array.from(bMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const equipmentTypeCounts = useMemo(
    () =>
      computeEquipmentTypeCounts(products, {
        selectedBrands,
        dropdownBrand: brand,
        powerRanges: selectedPowerRanges,
        inStockOnly,
        query,
      }),
    [products, selectedBrands, brand, selectedPowerRanges, inStockOnly, query],
  );

  const featuredBrandCounts = useMemo(
    () =>
      computeFeaturedBrandCounts(products, {
        category: cat,
        equipmentTypes: selectedEquipmentTypes,
        inStockOnly,
        query,
        powerRanges: selectedPowerRanges,
      }),
    [products, cat, selectedEquipmentTypes, inStockOnly, query, selectedPowerRanges],
  );

  const inverterPowerCounts = useMemo(
    () =>
      computeInverterPowerCounts(products, {
        category: cat,
        equipmentTypes: selectedEquipmentTypes,
        selectedBrands,
        dropdownBrand: brand,
        inStockOnly,
        query,
      }),
    [products, cat, selectedEquipmentTypes, selectedBrands, brand, inStockOnly, query],
  );

  const filtered = useMemo(() => {
    const baseFiltered = products.filter((p) => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (!matchesEquipmentTypes(p, selectedEquipmentTypes)) return false;
      if (!matchesBrandFilters(p, selectedBrands, brand)) return false;
      if (!matchesInverterPowerRanges(p, selectedPowerRanges)) return false;
      if (inStockOnly && !p.inStock) return false;
      return true;
    });

    const searched = filterAndRankProductsBySearch(baseFiltered, query, sort === 'default');

    if (sort === 'asc') {
      return [...searched].sort((a, b) => (a.price || 999999) - (b.price || 999999));
    }
    if (sort === 'desc') {
      return [...searched].sort((a, b) => b.price - a.price);
    }
    return searched;
  }, [products, cat, selectedEquipmentTypes, brand, selectedBrands, selectedPowerRanges, inStockOnly, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    if (paginated.length === 0) return;
    const typeKey = selectedEquipmentTypes.slice().sort().join(',');
    const brandKey = selectedBrands.length > 0 ? selectedBrands.slice().sort().join(',') : brand;
    const powerKey = selectedPowerRanges.slice().sort().join(',');
    const listKey = `${cat}|${typeKey}|${safePage}|${brandKey}|${powerKey}|${inStockOnly}|${usdUahRate ?? 'usd'}`;
    if (lastTrackedListKeyRef.current === listKey) return;
    lastTrackedListKeyRef.current = listKey;

    trackEvent('view_item_list', {
      item_list_id: cat,
      item_list_name: CATEGORY_TITLES[cat] || cat,
      item_category: cat,
      items: paginated.slice(0, 10).map((p) => toAnalyticsProductItem(p, usdUahRate, 1)),
    });
  }, [cat, safePage, selectedEquipmentTypes, brand, selectedBrands, selectedPowerRanges, inStockOnly, paginated, usdUahRate]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const searchKey = `${trimmed.toLowerCase()}|${cat}`;
    if (lastTrackedSearchRef.current === searchKey) return;

    const timer = window.setTimeout(() => {
      lastTrackedSearchRef.current = searchKey;
      trackEvent('search', {
        search_term: trimmed,
        item_category: cat,
        items_count: filtered.length,
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [query, cat, filtered.length]);

  function handleCategoryChange(nextCat: ProductCategory | 'all') {
    setCat(nextCat);
    setSelectedEquipmentTypes([]);
    setPage(1);
    onCategoryChange?.(nextCat);
  }

  function handleToggleEquipmentTypeCheckbox(typeId: EquipmentTypeFilterId) {
    if (cat !== 'all') {
      setCat('all');
      onCategoryChange?.('all');
    }
    setSelectedEquipmentTypes((prev) =>
      prev.includes(typeId) ? prev.filter((item) => item !== typeId) : [...prev, typeId],
    );
    setPage(1);
  }

  function handleToggleBrandCheckbox(brandId: string) {
    setSelectedBrands((prev) =>
      prev.includes(brandId) ? prev.filter((item) => item !== brandId) : [...prev, brandId],
    );
    setBrand('all');
    setPage(1);
  }

  function handleTogglePowerRangeCheckbox(rangeId: InverterPowerRangeId) {
    setSelectedPowerRanges((prev) =>
      prev.includes(rangeId) ? prev.filter((item) => item !== rangeId) : [...prev, rangeId],
    );
    setPage(1);
  }

  function handleDropdownBrandChange(nextBrand: string) {
    if (nextBrand === 'all') {
      setBrand('all');
      setSelectedBrands([]);
      setPage(1);
      return;
    }
    const matchedFeatured = FEATURED_BRAND_FILTERS.find((item) =>
      item.aliases.includes(nextBrand.trim().toLowerCase()),
    );
    if (matchedFeatured) {
      setSelectedBrands([matchedFeatured.id]);
      setBrand('all');
    } else {
      setBrand(nextBrand);
      setSelectedBrands([]);
    }
    setPage(1);
  }

  const activeEquipmentTypeLabel = EQUIPMENT_TYPE_FILTERS.filter((t) =>
    selectedEquipmentTypes.includes(t.id),
  )
    .map((t) => tr(t.labelUk, t.labelRu))
    .join(', ');
  const activeBrandLabel = selectedBrands.length > 0 ? selectedBrands.join(', ') : brand !== 'all' ? brand : '';
  const activePowerLabel = INVERTER_POWER_FILTERS.filter((r) => selectedPowerRanges.includes(r.id))
    .map((r) => tr(r.labelUk, r.labelRu))
    .join(', ');

  return (
    <div>
      <section className="ec-banner text-[#061c36]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#061c36] mb-2">
            {tr('Обладнання та готові рішення Energo Comfort', 'Оборудование и готовые решения Energo Comfort')}
          </h1>
          <p className="text-sm text-[#133659] font-medium max-w-2xl leading-[1.6]">
            {tr('Повний каталог позицій із energocomfort.shop', 'Полный каталог товаров energocomfort.shop')} ({products.length} {tr('товарів', 'товаров')}). {tr('Окремі інвертори, АКБ, панелі та захист додаються у кошик; готові комплекти підключаються через інженерний розрахунок.', 'Отдельные инверторы, аккумуляторы, панели и защита добавляются в корзину; готовые комплекты подбираются инженером.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="sky" start={8} end={20} brightness={0.56} />
        <div className="relative max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="sr-only">{tr('Фільтри та перелік обладнання', 'Фильтры и каталог оборудования')}</h2>
          {/* Category Filter Tabs */}
          <div className="ec-glass-plate flex flex-wrap gap-1.5 p-1.5 rounded-2xl mb-6 w-fit max-w-full">
            {(
              [
                ['all', 'Усі товари'],
                ['kits', 'Готові рішення'],
                ['inverters', 'Інвертори'],
                ['batteries', 'Акумулятори'],
                ['panels', 'Сонячні панелі'],
                ['parts', 'Комплектуючі'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleCategoryChange(key)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  cat === key
                    ? 'bg-[#0b66b2] text-white shadow-sm'
                    : 'text-[#1c3d5e] hover:bg-white/65 hover:text-[#07213e]'
                }`}
              >
                {tr(label)} ({counts[key]})
              </button>
            ))}
          </div>

          {/* Search, Brand, Stock, Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-7">
            <div className="lg:col-span-5 relative">
              <label htmlFor="shop-equipment-search" className="sr-only">
                {tr('Пошук обладнання за назвою або SKU', 'Поиск оборудования по названию или SKU')}
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shop-equipment-search"
                type="search"
                value={query}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  setQuery(nextQuery);
                  onQueryChange?.(nextQuery);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    setQuery('');
                    onQueryChange?.('');
                    setPage(1);
                  }
                }}
                placeholder={tr('Пошук за назвою або SKU (напр. Deye 8kW, 10018)...', 'Поиск по названию или SKU (напр. Deye 8kW, 10018)…')}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-white/75 bg-white/80 backdrop-blur-md text-[#07213e] placeholder:text-[#1c3d5e]/60 text-xs sm:text-sm font-medium shadow-sm focus:outline-none focus:border-[#0b66b2]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    onQueryChange?.('');
                    setPage(1);
                  }}
                  aria-label={tr('Очистити пошук', 'Очистить поиск')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#1c3d5e] hover:text-[#07213e] hover:bg-sky-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="lg:col-span-3">
              <select
                aria-label={tr('Фільтр за брендом', 'Фильтр по бренду')}
                value={selectedBrands.length > 0 ? 'all' : brand}
                onChange={(e) => handleDropdownBrandChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/75 text-xs sm:text-sm font-medium text-[#07213e] bg-white/80 backdrop-blur-md shadow-sm focus:outline-none focus:border-[#0b66b2]"
              >
                <option value="all">
                  {selectedBrands.length > 0
                    ? `${tr('Обрано брендів:', 'Выбрано брендов:')} ${selectedBrands.length}`
                    : `${tr('Усі бренди', 'Все бренды')} (${brands.length})`}
                </option>
                {brands.map(([bName, bCount]) => (
                  <option key={bName} value={bName}>
                    {bName} ({bCount})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'default' | 'asc' | 'desc')}
                className="w-full px-3 py-2.5 rounded-xl border border-white/75 text-xs sm:text-sm font-medium text-[#07213e] bg-white/80 backdrop-blur-md shadow-sm focus:outline-none focus:border-[#0b66b2]"
              >
                <option value="default">{tr('Рекомендовані', 'Рекомендуемые')}</option>
                <option value="asc">{tr('Спочатку дешевші', 'Сначала дешевле')}</option>
                <option value="desc">{tr('Спочатку дорожчі', 'Сначала дороже')}</option>
              </select>
            </div>

            <label className="lg:col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/75 bg-white/80 backdrop-blur-md text-xs font-bold text-[#07213e] shadow-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="accent-[#0d9488]"
              />
              {tr('В наявності')}
            </label>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sidebar Filters: Equipment Type, Brand, Inverter Power */}
            <aside
              aria-label={tr('Фільтри каталогу', 'Фильтры каталога')}
              className="w-full lg:w-[240px] xl:w-[255px] shrink-0 ec-glass-plate rounded-2xl p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
            >
              {/* Equipment Type Checkboxes */}
              <div className="pb-4 mb-4 border-b border-sky-200/80">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-200/80">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#07213e] uppercase tracking-wide">
                    <Layers className="w-3.5 h-3.5 text-[#0b66b2]" />
                    <span>{tr('Тип обладнання', 'Тип оборудования')}</span>
                  </div>
                  {selectedEquipmentTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEquipmentTypes([]);
                        setPage(1);
                      }}
                      className="text-[11px] font-bold text-[#0b66b2] hover:underline cursor-pointer"
                    >
                      {tr('Скинути', 'Сбросить')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {EQUIPMENT_TYPE_FILTERS.map((item) => {
                    const checked = selectedEquipmentTypes.includes(item.id);
                    const count = equipmentTypeCounts[item.id] ?? 0;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer select-none ${
                          checked
                            ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                            : count === 0
                              ? 'bg-white/55 border-sky-100 text-[#1c3d5e]/55 hover:border-sky-200'
                              : 'bg-white/80 border-sky-100 text-[#1c3d5e] hover:border-sky-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleEquipmentTypeCheckbox(item.id)}
                            className="w-4 h-4 rounded accent-[#0b66b2] cursor-pointer shrink-0"
                          />
                          <span className="truncate">{tr(item.labelUk, item.labelRu)}</span>
                        </span>
                        <span
                          aria-label={`${count} ${tr('товарів', 'товаров')}`}
                          className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                            count === 0
                              ? 'bg-sky-50 text-[#1c3d5e]/45'
                              : checked
                                ? 'bg-[#0b66b2]/15 text-[#0b66b2]'
                                : 'bg-sky-50 text-[#1c3d5e]'
                          }`}
                        >
                          ({count})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-200/80">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#07213e] uppercase tracking-wide">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#0b66b2]" />
                  <span>{tr('Бренди', 'Бренды')}</span>
                </div>
                {(selectedBrands.length > 0 || brand !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrands([]);
                      setBrand('all');
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-[#0b66b2] hover:underline cursor-pointer"
                  >
                    {tr('Скинути', 'Сбросить')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                {FEATURED_BRAND_FILTERS.map((item) => {
                  const checked = selectedBrands.includes(item.id);
                  const count = featuredBrandCounts[item.id] ?? 0;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer select-none ${
                        checked
                          ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                          : count === 0
                            ? 'bg-white/55 border-sky-100 text-[#1c3d5e]/55 hover:border-sky-200'
                            : 'bg-white/80 border-sky-100 text-[#1c3d5e] hover:border-sky-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleBrandCheckbox(item.id)}
                          className="w-4 h-4 rounded accent-[#0b66b2] cursor-pointer shrink-0"
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span
                        aria-label={`${count} ${tr('товарів', 'товаров')}`}
                        className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                          count === 0
                            ? 'bg-sky-50 text-[#1c3d5e]/45'
                            : checked
                              ? 'bg-[#0b66b2]/15 text-[#0b66b2]'
                              : 'bg-sky-50 text-[#1c3d5e]'
                        }`}
                      >
                        ({count})
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="pt-4 mt-4 border-t border-sky-200/80">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-200/80">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#07213e] uppercase tracking-wide">
                    <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>{tr('Потужність інвертора', 'Мощность инвертора')}</span>
                  </div>
                  {selectedPowerRanges.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPowerRanges([]);
                        setPage(1);
                      }}
                      className="text-[11px] font-bold text-[#0b66b2] hover:underline cursor-pointer"
                    >
                      {tr('Скинути', 'Сбросить')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                  {INVERTER_POWER_FILTERS.map((item) => {
                    const checked = selectedPowerRanges.includes(item.id);
                    const count = inverterPowerCounts[item.id] ?? 0;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer select-none ${
                          checked
                            ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                            : count === 0
                              ? 'bg-white/55 border-sky-100 text-[#1c3d5e]/55 hover:border-sky-200'
                              : 'bg-white/80 border-sky-100 text-[#1c3d5e] hover:border-sky-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleTogglePowerRangeCheckbox(item.id)}
                            className="w-4 h-4 rounded accent-[#0b66b2] cursor-pointer shrink-0"
                          />
                          <span className="truncate">{tr(item.labelUk, item.labelRu)}</span>
                        </span>
                        <span
                          aria-label={`${count} ${tr('товарів', 'товаров')}`}
                          className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                            count === 0
                              ? 'bg-sky-50 text-[#1c3d5e]/45'
                              : checked
                                ? 'bg-[#0b66b2]/15 text-[#0b66b2]'
                                : 'bg-sky-50 text-[#1c3d5e]'
                          }`}
                        >
                          ({count})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Product Grid & Results */}
            <div className="flex-1 min-w-0 w-full">
              <div aria-live="polite" className="ec-glass-plate flex flex-wrap items-center justify-between gap-2 text-xs text-[#07213e] font-semibold rounded-2xl px-5 py-3 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    {tr('Знайдено позицій:', 'Найдено товаров:')} <strong className="font-mono text-[#0b66b2] tabular-nums">{filtered.length}</strong>
                  </span>
                  {activeEquipmentTypeLabel && (
                    <span className="text-[11px] text-[#07213e] font-semibold">
                      {tr('Тип:', 'Тип:')} {activeEquipmentTypeLabel}
                    </span>
                  )}
                  {activeBrandLabel && (
                    <span className="text-[11px] text-[#07213e] font-semibold">
                      {tr('Бренд:', 'Бренд:')} {activeBrandLabel}
                    </span>
                  )}
                  {activePowerLabel && (
                    <span className="text-[11px] text-[#07213e] font-semibold">
                      {tr('Потужність:', 'Мощность:')} {activePowerLabel}
                    </span>
                  )}
                  {query.trim() && (
                    <span className="text-[11px] text-[#0b66b2] font-bold">
                      {tr('Пошук:', 'Поиск:')} «{query.trim()}»
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {compareIds.length > 0 && onOpenCompare && (
                    <button
                      type="button"
                      onClick={onOpenCompare}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b66b2] hover:bg-[#08508e] text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>
                        {tr('Порівняти', 'Сравнить')} ({compareIds.length})
                      </span>
                    </button>
                  )}
                  {totalPages > 1 && (
                    <span className="font-mono tabular-nums text-[#1c3d5e]">
                      {tr('Сторінка', 'Страница')} {safePage} {tr('з', 'из')} {totalPages}
                    </span>
                  )}
                </div>
              </div>

              {paginated.length === 0 ? (
                <div className="ec-glass-plate p-10 sm:p-12 text-center rounded-2xl">
                  <p className="text-sm font-bold text-[#07213e] mb-1">{tr('За вашим запитом товарів не знайдено', 'По вашему запросу товары не найдены')}</p>
                  <p className="text-xs text-[#1c3d5e] font-medium mb-5">
                    {tr(
                      'Спробуйте змінити фільтр або залиште запит — інженер перевірить наявність на складі та підбере сумісний аналог за 15 хв.',
                      'Измените фильтр или оставьте запрос — инженер проверит наличие на складе и подберёт совместимый аналог за 15 мин.',
                    )}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleCategoryChange('all');
                        setSelectedEquipmentTypes([]);
                        setBrand('all');
                        setSelectedBrands([]);
                        setSelectedPowerRanges([]);
                        setQuery('');
                        onQueryChange?.('');
                        setInStockOnly(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-[#0d1f33] text-xs font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      {tr('Скинути фільтри', 'Сбросить фильтры')}
                    </button>
                    {onOpenCustomRequest && (
                      <button
                        type="button"
                        onClick={() => {
                          track({ name: 'cta_click', placement: 'section', scenario: 'unspecified' });
                          onOpenCustomRequest(
                            query.trim()
                              ? `Підбір за запитом: ${query.trim()}`
                              : `Інженерний підбір (${CATEGORY_TITLES[cat] || cat})`,
                            [
                              query.trim() ? `Пошуковий запит: ${query.trim()}` : '',
                              activeEquipmentTypeLabel ? `Тип обладнання: ${activeEquipmentTypeLabel}` : '',
                              activeBrandLabel ? `Бренд: ${activeBrandLabel}` : '',
                              activePowerLabel ? `Потужність інвертора: ${activePowerLabel}` : '',
                              `Категорія: ${CATEGORY_TITLES[cat] || cat}`,
                            ]
                              .filter(Boolean)
                              .join('\n'),
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        {tr('Підібрати з інженером за 15 хв', 'Подобрать с инженером за 15 мин')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 items-stretch">
                  {paginated.map((p, index) => (
                    <ProductCard
                      key={`${cat}-${safePage}-${p.id}`}
                      product={p}
                      onSelect={onSelectProduct}
                      onQuickView={onQuickViewProduct}
                      isWishlisted={wishlistIds.includes(p.id)}
                      onToggleWishlist={onToggleWishlist}
                      isCompared={compareIds.includes(p.id)}
                      onToggleCompare={onToggleCompare}
                      onAddToCart={onAddToCart}
                      onRequestQuote={(prod) => onRequestQuote(prod)}
                      onCalculatePayback={onCalculatePayback}
                      usdUahRate={usdUahRate}
                      className="shop-card-fade-in duration-200 ease-out motion-safe:hover:scale-[1.015]"
                      style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-9 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="ec-glass-plate inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-[#07213e] disabled:opacity-40 hover:bg-white/95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
              <span className="ec-glass-plate font-mono text-xs font-bold px-4 py-2 rounded-xl text-[#07213e] tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="ec-glass-plate inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-[#07213e] disabled:opacity-40 hover:bg-white/95 cursor-pointer"
              >
                Далі
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {onOpenCustomRequest && paginated.length > 0 && (
            <div className="mt-10 ec-glass-plate rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-[#0b66b2] mb-1">
                  {tr('Потрібна перевірка сумісності або оптова ціна?', 'Нужна проверка совместимости или оптовая цена?')}
                </div>
                <p className="text-sm font-extrabold text-[#07213e]">
                  {tr(
                    'Не знайшли потрібну модель чи комплект? Інженер підбере рішення під ваш бюджет за 15 хв',
                    'Не нашли нужную модель или комплект? Инженер подберёт решение под ваш бюджет за 15 мин',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  track({ name: 'cta_click', placement: 'section', scenario: 'unspecified' });
                  onOpenCustomRequest(
                    `Запит на підбір із каталогу (${CATEGORY_TITLES[cat] || cat})`,
                    query.trim() ? `Фільтр пошуку: ${query.trim()}` : undefined,
                  );
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
              >
                <MessageSquarePlus className="w-4 h-4" />
                {tr('Підібрати під об’єкт', 'Подобрать под объект')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
