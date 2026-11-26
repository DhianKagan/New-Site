import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X, MessageSquarePlus, SlidersHorizontal, Zap, Layers, Scale, Banknote, Calculator, Hash } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { PerformanceProfiler } from './PerformanceProfiler.tsx';
import { ProductCard } from './ProductCard.tsx';
import { ShopEmptyState } from './ShopEmptyState.tsx';
import { SmartImage } from './SmartImage.tsx';
import { SolarSavingsCalculator } from './SolarSavingsCalculator.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { tr } from '../lib/i18n.ts';
import {
  computeEquipmentTypeCounts,
  computeFeaturedBrandCounts,
  computeInverterPowerCounts,
  computePriceBounds,
  EQUIPMENT_TYPE_FILTERS,
  FEATURED_BRAND_FILTERS,
  filterAndRankProductsBySearch,
  getPriceBudgetPresets,
  getProductSearchSuggestions,
  INVERTER_POWER_FILTERS,
  matchesBrandFilters,
  matchesEquipmentTypes,
  matchesInverterPowerRanges,
  matchesPriceRange,
  matchesSkuFilter,
  normalizePriceBounds,
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
  const [skuFilter, setSkuFilter] = useState('');
  const [brand, setBrand] = useState('all');
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState<EquipmentTypeFilterId[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPowerRanges, setSelectedPowerRanges] = useState<InverterPowerRangeId[]>([]);
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [sort, setSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [savingsCalcOpen, setSavingsCalcOpen] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#solar-savings-calculator',
  );
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const lastTrackedListKeyRef = useRef('');
  const lastTrackedSearchRef = useRef('');

  useEffect(() => {
    setIsEntering(true);
    setCardsVisible(false);
    setCat(initialCategory);
    setSelectedEquipmentTypes([]);
    setPage(1);
  }, [initialCategory]);

  useEffect(() => {
    setIsEntering(true);
    setCardsVisible(false);
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setCardsVisible(true);
      });
    });
    const doneTimer = window.setTimeout(() => {
      setIsEntering(false);
    }, 850);
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      window.clearTimeout(doneTimer);
    };
  }, [cat]);

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, []);

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

  const priceBounds = useMemo(
    () => computePriceBounds(products, usdUahRate),
    [products, usdUahRate],
  );
  const budgetPresets = useMemo(() => getPriceBudgetPresets(usdUahRate), [usdUahRate]);
  const { min: activeMinPrice, max: activeMaxPrice } = useMemo(
    () => normalizePriceBounds(priceMinInput, priceMaxInput),
    [priceMinInput, priceMaxInput],
  );
  const hasActivePriceFilter = activeMinPrice !== null || activeMaxPrice !== null;
  const priceCurrencyUnit = usdUahRate && usdUahRate > 0 ? '₴' : '$';

  const equipmentTypeCounts = useMemo(
    () =>
      computeEquipmentTypeCounts(products, {
        selectedBrands,
        dropdownBrand: brand,
        powerRanges: selectedPowerRanges,
        inStockOnly,
        query,
        skuQuery: skuFilter,
        minPrice: activeMinPrice,
        maxPrice: activeMaxPrice,
        usdUahRate,
      }),
    [products, selectedBrands, brand, selectedPowerRanges, inStockOnly, query, skuFilter, activeMinPrice, activeMaxPrice, usdUahRate],
  );

  const featuredBrandCounts = useMemo(
    () =>
      computeFeaturedBrandCounts(products, {
        category: cat,
        equipmentTypes: selectedEquipmentTypes,
        inStockOnly,
        query,
        skuQuery: skuFilter,
        powerRanges: selectedPowerRanges,
        minPrice: activeMinPrice,
        maxPrice: activeMaxPrice,
        usdUahRate,
      }),
    [products, cat, selectedEquipmentTypes, inStockOnly, query, skuFilter, selectedPowerRanges, activeMinPrice, activeMaxPrice, usdUahRate],
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
        skuQuery: skuFilter,
        minPrice: activeMinPrice,
        maxPrice: activeMaxPrice,
        usdUahRate,
      }),
    [products, cat, selectedEquipmentTypes, selectedBrands, brand, inStockOnly, query, skuFilter, activeMinPrice, activeMaxPrice, usdUahRate],
  );

  const filtered = useMemo(() => {
    const baseFiltered = products.filter((p) => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (!matchesEquipmentTypes(p, selectedEquipmentTypes)) return false;
      if (!matchesBrandFilters(p, selectedBrands, brand)) return false;
      if (!matchesInverterPowerRanges(p, selectedPowerRanges)) return false;
      if (!matchesPriceRange(p, activeMinPrice, activeMaxPrice, usdUahRate)) return false;
      if (!matchesSkuFilter(p, skuFilter)) return false;
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
  }, [products, cat, selectedEquipmentTypes, brand, selectedBrands, selectedPowerRanges, activeMinPrice, activeMaxPrice, usdUahRate, skuFilter, inStockOnly, query, sort]);

  const suggestionPool = useMemo(
    () => (skuFilter.trim() ? products.filter((p) => matchesSkuFilter(p, skuFilter)) : products),
    [products, skuFilter],
  );

  const { suggestions, totalMatches: totalSuggestionMatches } = useMemo(
    () => getProductSearchSuggestions(suggestionPool, query, 6),
    [suggestionPool, query],
  );
  const showSuggestionsDropdown = isSuggestionsOpen && query.trim().length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );
  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds]);
  const compareSet = useMemo(() => new Set(compareIds), [compareIds]);

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
    if (nextCat !== cat) {
      setIsEntering(true);
      setCardsVisible(false);
    }
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
  const activePriceLabel = useMemo(() => {
    if (!hasActivePriceFilter) return '';
    const formatVal = (val: number) => `${val.toLocaleString('uk-UA')} ${priceCurrencyUnit}`;
    if (activeMinPrice !== null && activeMaxPrice !== null) {
      return `${activeMinPrice.toLocaleString('uk-UA')} – ${formatVal(activeMaxPrice)}`;
    }
    if (activeMinPrice !== null) {
      return `${tr('від', 'от')} ${formatVal(activeMinPrice)}`;
    }
    if (activeMaxPrice !== null) {
      return `${tr('до', 'до')} ${formatVal(activeMaxPrice)}`;
    }
    return '';
  }, [hasActivePriceFilter, activeMinPrice, activeMaxPrice, priceCurrencyUnit]);

  function handleResetPriceFilter() {
    setPriceMinInput('');
    setPriceMaxInput('');
    setPage(1);
  }

  function handleSelectBudgetPreset(min: number | null, max: number | null) {
    const isSame = activeMinPrice === min && activeMaxPrice === max;
    if (isSame) {
      handleResetPriceFilter();
      return;
    }
    setPriceMinInput(min !== null ? String(min) : '');
    setPriceMaxInput(max !== null ? String(max) : '');
    setPage(1);
  }

  function handleResetAllFilters() {
    handleCategoryChange('all');
    setSelectedEquipmentTypes([]);
    setBrand('all');
    setSelectedBrands([]);
    setSelectedPowerRanges([]);
    setPriceMinInput('');
    setPriceMaxInput('');
    setSkuFilter('');
    setSort('default');
    setQuery('');
    onQueryChange?.('');
    setInStockOnly(false);
    setPage(1);
  }

  function handleApplySuggestedQuery(term: string) {
    handleCategoryChange('all');
    setSelectedEquipmentTypes([]);
    setBrand('all');
    setSelectedBrands([]);
    setSelectedPowerRanges([]);
    setPriceMinInput('');
    setPriceMaxInput('');
    setSkuFilter('');
    setInStockOnly(false);
    setQuery(term);
    onQueryChange?.(term);
    setPage(1);
  }

  function handleQuickOpenSavingsCalculator(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setSavingsCalcOpen(true);
    window.requestAnimationFrame(() => {
      const section = document.getElementById('solar-savings-calculator');
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const input = document.getElementById('solar-savings-kwh-input') as HTMLInputElement | null;
      input?.focus({ preventScroll: true });
    });
  }

  return (
    <div>
      <section className="ec-banner text-[#061c36] break-words hyphens-none">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[clamp(1.25rem,4.8vw,1.875rem)] font-extrabold text-[#061c36] leading-tight mb-2">
              {tr('Обладнання та готові рішення Energo Comfort', 'Оборудование и готовые решения Energo Comfort')}
            </h1>
            <p className="text-sm text-[#133659] font-medium max-w-2xl leading-[1.6]">
              {tr('Повний каталог позицій із energocomfort.shop', 'Полный каталог товаров energocomfort.shop')} ({products.length} {tr('товарів', 'товаров')}). {tr('Окремі інвертори, АКБ, панелі та захист додаються у кошик; готові комплекти підключаються через інженерний розрахунок.', 'Отдельные инверторы, аккумуляторы, панели и защита добавляются в корзину; готовые комплекты подбираются инженером.')}
            </p>
          </div>

          <a
            href="#solar-savings-calculator"
            onClick={handleQuickOpenSavingsCalculator}
            aria-expanded={savingsCalcOpen}
            aria-controls="solar-savings-calculator"
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 self-start md:self-auto transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
              savingsCalcOpen
                ? 'bg-[#0b66b2] border-[#0b66b2] text-white shadow-sm'
                : 'bg-white/90 hover:bg-white border-sky-300/80 text-[#0b66b2] shadow-xs'
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span>{tr('Калькулятор окупності (кВт·год)', 'Калькулятор окупаемости (кВт·ч)')}</span>
          </a>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="sky" start={8} end={20} brightness={0.56} />
        <div className="relative max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 break-words hyphens-none">
          <h2 className="sr-only">{tr('Фільтри та перелік обладнання', 'Фильтры и каталог оборудования')}</h2>

          {savingsCalcOpen && (
            <SolarSavingsCalculator
              products={products}
              usdUahRate={usdUahRate}
              onSelectProduct={onSelectProduct}
              onNavigateCategory={(nextCat) => {
                handleCategoryChange(nextCat);
                setSavingsCalcOpen(false);
              }}
              onOpenCustomRequest={onOpenCustomRequest}
              onClose={() => setSavingsCalcOpen(false)}
            />
          )}

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
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap max-w-full overflow-hidden text-ellipsis cursor-pointer ${
                  cat === key
                    ? 'bg-[#0b66b2] text-white shadow-sm'
                    : 'text-[#1c3d5e] hover:bg-white/65 hover:text-[#07213e]'
                }`}
              >
                {tr(label)} ({counts[key]})
              </button>
            ))}
          </div>

          {/* Search, SKU, Brand, Stock, Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-7">
            <div ref={searchContainerRef} className="sm:col-span-2 lg:col-span-4 relative z-30">
              <label htmlFor="shop-equipment-search" className="sr-only">
                {tr('Пошук обладнання за назвою або SKU', 'Поиск оборудования по названию или SKU')}
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shop-equipment-search"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestionsDropdown}
                aria-controls="shop-search-suggestions"
                aria-activedescendant={
                  showSuggestionsDropdown &&
                  activeSuggestionIndex >= 0 &&
                  suggestions[activeSuggestionIndex]
                    ? `shop-search-option-${suggestions[activeSuggestionIndex].id}`
                    : undefined
                }
                autoComplete="off"
                value={query}
                onFocus={() => {
                  if (query.trim().length > 0) {
                    setIsSuggestionsOpen(true);
                  }
                }}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  setQuery(nextQuery);
                  onQueryChange?.(nextQuery);
                  setPage(1);
                  setIsSuggestionsOpen(nextQuery.trim().length > 0);
                  setActiveSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && query.trim().length > 0) {
                    e.preventDefault();
                    setIsSuggestionsOpen(true);
                    if (suggestions.length > 0) {
                      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                    }
                    return;
                  }
                  if (e.key === 'ArrowUp' && showSuggestionsDropdown && suggestions.length > 0) {
                    e.preventDefault();
                    setActiveSuggestionIndex((prev) =>
                      prev <= 0 ? suggestions.length - 1 : prev - 1,
                    );
                    return;
                  }
                  if (e.key === 'Enter' && showSuggestionsDropdown) {
                    const selectedSuggestion =
                      activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : undefined;
                    if (selectedSuggestion) {
                      e.preventDefault();
                      setIsSuggestionsOpen(false);
                      setActiveSuggestionIndex(-1);
                      onSelectProduct(selectedSuggestion);
                    } else {
                      setIsSuggestionsOpen(false);
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    if (isSuggestionsOpen) {
                      e.preventDefault();
                      setIsSuggestionsOpen(false);
                      setActiveSuggestionIndex(-1);
                      return;
                    }
                    if (query) {
                      setQuery('');
                      onQueryChange?.('');
                      setPage(1);
                    }
                  }
                }}
                placeholder={tr('Пошук за назвою або SKU (напр. Deye 8kW, 10018)...', 'Поиск по названию или SKU (напр. Deye 8kW, 10018)…')}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-white/75 bg-white/85 backdrop-blur-md text-[#07213e] placeholder:text-[#1c3d5e]/60 text-xs sm:text-sm font-medium shadow-sm focus:outline-none focus:border-[#0b66b2]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    onQueryChange?.('');
                    setIsSuggestionsOpen(false);
                    setActiveSuggestionIndex(-1);
                    setPage(1);
                  }}
                  aria-label={tr('Очистити пошук', 'Очистить поиск')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#1c3d5e] hover:text-[#07213e] hover:bg-sky-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {showSuggestionsDropdown && (
                <div
                  id="shop-search-suggestions"
                  role="listbox"
                  aria-label={tr('Підказки пошуку товарів', 'Подсказки поиска товаров')}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-sky-200/90 bg-white/95 backdrop-blur-xl shadow-[0_18px_42px_rgba(7,33,62,0.22)] overflow-hidden"
                >
                  {suggestions.length > 0 ? (
                    <PerformanceProfiler id="ShopView.SearchSuggestions" itemCount={suggestions.length}>
                      <div className="max-h-[340px] overflow-y-auto divide-y divide-sky-100">
                        {suggestions.map((item, idx) => {
                          const isActive = idx === activeSuggestionIndex;
                          const displayPrice =
                            item.price > 0
                              ? formatUahFromUsd(item.price, usdUahRate)
                              : tr('За запитом', 'По запросу');

                          return (
                            <button
                              key={item.id}
                              id={`shop-search-option-${item.id}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActiveSuggestionIndex(idx)}
                              onClick={() => {
                                setIsSuggestionsOpen(false);
                                setActiveSuggestionIndex(-1);
                                onSelectProduct(item);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                                isActive ? 'bg-sky-50/95' : 'hover:bg-sky-50/75'
                              }`}
                            >
                              <SmartImage
                                src={item.img}
                                alt={item.title}
                                className="w-10 h-10 rounded-lg object-contain bg-white border border-sky-100 p-0.5 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-[13px] font-bold text-[#07213e] truncate">
                                  {item.title}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#1c3d5e]">
                                  {item.brand && <span className="font-semibold">{item.brand}</span>}
                                  {item.sku && (
                                    <span className="font-mono text-[#0b66b2]">SKU: {item.sku}</span>
                                  )}
                                  <span
                                    className={`font-semibold ${
                                      item.inStock ? 'text-[#0d9488]' : 'text-amber-700'
                                    }`}
                                  >
                                    {item.inStock
                                      ? tr('В наявності', 'В наличии')
                                      : tr('Під замовлення', 'Под заказ')}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-xs font-extrabold text-[#07213e] tabular-nums whitespace-nowrap">
                                  {displayPrice}
                                </div>
                                {item.price > 0 && (
                                  <div className="font-mono text-[10px] text-[#1c3d5e]/75 tabular-nums whitespace-nowrap">
                                    ${item.price.toLocaleString('uk-UA')}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {totalSuggestionMatches > suggestions.length && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCategoryChange('all');
                            setSelectedEquipmentTypes([]);
                            setBrand('all');
                            setSelectedBrands([]);
                            setSelectedPowerRanges([]);
                            setPriceMinInput('');
                            setPriceMaxInput('');
                            setInStockOnly(false);
                            setIsSuggestionsOpen(false);
                            setActiveSuggestionIndex(-1);
                          }}
                          className="w-full px-3.5 py-2 border-t border-sky-100 bg-sky-50/80 hover:bg-sky-100/80 text-xs font-bold text-[#0b66b2] text-center transition-colors cursor-pointer"
                        >
                          {tr(
                            `Показати всі знайдені товари (${totalSuggestionMatches})`,
                            `Показать все найденные товары (${totalSuggestionMatches})`,
                          )}
                        </button>
                      )}
                    </PerformanceProfiler>
                  ) : (
                    <div className="px-4 py-3 text-xs text-[#1c3d5e] flex items-center justify-between gap-2">
                      <span className="truncate">
                        {tr('Нічого не знайдено за запитом', 'Ничего не найдено по запросу')} «{query.trim()}»
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          onQueryChange?.('');
                          setIsSuggestionsOpen(false);
                          setActiveSuggestionIndex(-1);
                          setPage(1);
                        }}
                        className="shrink-0 font-bold text-[#0b66b2] hover:underline cursor-pointer"
                      >
                        {tr('Скинути', 'Сбросить')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 relative">
              <label htmlFor="shop-sku-filter" className="sr-only">
                {tr('Фільтр за SKU (артикулом)', 'Фильтр по SKU (артикулу)')}
              </label>
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shop-sku-filter"
                type="search"
                autoComplete="off"
                value={skuFilter}
                onChange={(e) => {
                  setSkuFilter(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && skuFilter) {
                    e.preventDefault();
                    setSkuFilter('');
                    setPage(1);
                  }
                }}
                placeholder={tr('SKU (напр. 10018)', 'SKU (напр. 10018)')}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-white/75 bg-white/85 backdrop-blur-md text-[#07213e] placeholder:text-[#1c3d5e]/60 font-mono text-xs sm:text-sm font-medium shadow-sm focus:outline-none focus:border-[#0b66b2]"
              />
              {skuFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSkuFilter('');
                    setPage(1);
                  }}
                  aria-label={tr('Очистити фільтр SKU', 'Очистить фильтр SKU')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[#1c3d5e] hover:text-[#07213e] hover:bg-sky-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="lg:col-span-2">
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

              {/* Price Range Filter */}
              <div className="pb-4 mb-4 border-b border-sky-200/80">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-200/80">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#07213e] uppercase tracking-wide">
                    <Banknote className="w-3.5 h-3.5 text-[#0d9488]" />
                    <span>
                      {tr('Ціна', 'Цена')} ({usdUahRate && usdUahRate > 0 ? 'грн' : 'USD'})
                    </span>
                  </div>
                  {hasActivePriceFilter && (
                    <button
                      type="button"
                      onClick={handleResetPriceFilter}
                      className="text-[11px] font-bold text-[#0b66b2] hover:underline cursor-pointer"
                    >
                      {tr('Скинути', 'Сбросить')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <label htmlFor="shop-price-min" className="block text-[10px] font-bold text-[#1c3d5e] mb-1">
                      {tr('Від', 'От')}
                    </label>
                    <input
                      id="shop-price-min"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={priceMinInput}
                      onChange={(e) => {
                        setPriceMinInput(e.target.value);
                        setPage(1);
                      }}
                      placeholder={priceBounds.min > 0 ? String(priceBounds.min) : '0'}
                      aria-label={tr('Мінімальна ціна', 'Минимальная цена')}
                      className="w-full pl-2.5 pr-6 py-1.5 rounded-lg border border-sky-200 bg-white/90 text-xs font-mono font-bold text-[#07213e] placeholder:text-[#1c3d5e]/45 focus:outline-none focus:border-[#0b66b2]"
                    />
                    <span className="pointer-events-none absolute right-2 bottom-1.5 text-[11px] font-bold text-[#1c3d5e]/70">
                      {priceCurrencyUnit}
                    </span>
                  </div>
                  <div className="relative">
                    <label htmlFor="shop-price-max" className="block text-[10px] font-bold text-[#1c3d5e] mb-1">
                      {tr('До', 'До')}
                    </label>
                    <input
                      id="shop-price-max"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={priceMaxInput}
                      onChange={(e) => {
                        setPriceMaxInput(e.target.value);
                        setPage(1);
                      }}
                      placeholder={priceBounds.max > 0 ? String(priceBounds.max) : ''}
                      aria-label={tr('Максимальна ціна', 'Максимальная цена')}
                      className="w-full pl-2.5 pr-6 py-1.5 rounded-lg border border-sky-200 bg-white/90 text-xs font-mono font-bold text-[#07213e] placeholder:text-[#1c3d5e]/45 focus:outline-none focus:border-[#0b66b2]"
                    />
                    <span className="pointer-events-none absolute right-2 bottom-1.5 text-[11px] font-bold text-[#1c3d5e]/70">
                      {priceCurrencyUnit}
                    </span>
                  </div>
                </div>

                {priceBounds.max > priceBounds.min && (
                  <div className="mt-3">
                    <label htmlFor="shop-price-slider" className="flex items-center justify-between text-[11px] font-semibold text-[#1c3d5e] mb-1">
                      <span>{tr('Верхня межа бюджету', 'Верхний предел бюджета')}</span>
                      <span className="font-mono font-bold text-[#0b66b2] tabular-nums">
                        {activeMaxPrice !== null
                          ? `${activeMaxPrice.toLocaleString('uk-UA')} ${priceCurrencyUnit}`
                          : tr('Усі', 'Все')}
                      </span>
                    </label>
                    <input
                      id="shop-price-slider"
                      type="range"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      step={usdUahRate && usdUahRate > 0 ? 500 : 25}
                      value={Math.min(priceBounds.max, Math.max(priceBounds.min, activeMaxPrice ?? priceBounds.max))}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= priceBounds.max) {
                          setPriceMaxInput('');
                        } else {
                          setPriceMaxInput(String(val));
                        }
                        setPage(1);
                      }}
                      className="w-full h-1.5 rounded-lg accent-[#0b66b2] cursor-pointer"
                    />
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {budgetPresets.map((preset) => {
                    const isSelected = activeMinPrice === preset.min && activeMaxPrice === preset.max;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectBudgetPreset(preset.min, preset.max)}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center transition-colors cursor-pointer whitespace-nowrap truncate ${
                          isSelected
                            ? 'bg-[#0b66b2] border-[#0b66b2] text-white shadow-xs'
                            : 'bg-white/80 border-sky-100 text-[#1c3d5e] hover:border-sky-300 hover:bg-white'
                        }`}
                      >
                        {tr(preset.labelUk, preset.labelRu)}
                      </button>
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
                  {activePriceLabel && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-bold">
                      <span>{tr('Ціна:', 'Цена:')} {activePriceLabel}</span>
                      <button
                        type="button"
                        onClick={handleResetPriceFilter}
                        aria-label={tr('Скинути фільтр ціни', 'Сбросить фильтр цены')}
                        className="p-0.5 rounded hover:bg-sky-100 text-[#0b66b2] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {skuFilter.trim() && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0b66b2] font-bold">
                      <span>SKU: {skuFilter.trim()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSkuFilter('');
                          setPage(1);
                        }}
                        aria-label={tr('Очистити фільтр SKU', 'Очистить фильтр SKU')}
                        className="p-0.5 rounded hover:bg-sky-100 text-[#0b66b2] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
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
                <ShopEmptyState
                  query={query}
                  categoryLabel={cat !== 'all' ? tr(CATEGORY_TITLES[cat] || cat) : undefined}
                  activeEquipmentTypeLabel={activeEquipmentTypeLabel}
                  activeBrandLabel={activeBrandLabel}
                  activePowerLabel={activePowerLabel}
                  activePriceLabel={activePriceLabel}
                  activeSkuLabel={skuFilter.trim()}
                  inStockOnly={inStockOnly}
                  onResetFilters={handleResetAllFilters}
                  onClearSearch={() => {
                    setQuery('');
                    onQueryChange?.('');
                    setPage(1);
                  }}
                  onSelectSuggestion={handleApplySuggestedQuery}
                  onOpenCustomRequest={
                    onOpenCustomRequest
                      ? () => {
                          track({ name: 'cta_click', placement: 'section', scenario: 'unspecified' });
                          onOpenCustomRequest(
                            query.trim()
                              ? `Підбір за запитом: ${query.trim()}`
                              : skuFilter.trim()
                                ? `Підбір за SKU: ${skuFilter.trim()}`
                                : `Інженерний підбір (${CATEGORY_TITLES[cat] || cat})`,
                            [
                              query.trim() ? `Пошуковий запит: ${query.trim()}` : '',
                              skuFilter.trim() ? `SKU: ${skuFilter.trim()}` : '',
                              activeEquipmentTypeLabel ? `Тип обладнання: ${activeEquipmentTypeLabel}` : '',
                              activeBrandLabel ? `Бренд: ${activeBrandLabel}` : '',
                              activePowerLabel ? `Потужність інвертора: ${activePowerLabel}` : '',
                              activePriceLabel ? `Бюджет: ${activePriceLabel}` : '',
                              `Категорія: ${CATEGORY_TITLES[cat] || cat}`,
                            ]
                              .filter(Boolean)
                              .join('\n'),
                          );
                        }
                      : undefined
                  }
                />
              ) : (
                <PerformanceProfiler id="ShopView.ProductList" itemCount={paginated.length}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 items-stretch">
                    {paginated.map((p, index) => (
                      <ProductCard
                        key={`${cat}-${p.id}`}
                        product={p}
                        onSelect={onSelectProduct}
                        onQuickView={onQuickViewProduct}
                        isWishlisted={wishlistSet.has(p.id)}
                        onToggleWishlist={onToggleWishlist}
                        isCompared={compareSet.has(p.id)}
                        onToggleCompare={onToggleCompare}
                        onAddToCart={onAddToCart}
                        onRequestQuote={onRequestQuote}
                        onCalculatePayback={onCalculatePayback}
                        usdUahRate={usdUahRate}
                        className={
                          isEntering
                            ? `motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out motion-safe:hover:scale-[1.015] ${
                                cardsVisible
                                  ? 'opacity-100 translate-y-0'
                                  : 'motion-safe:opacity-0 motion-safe:translate-y-4'
                              }`
                            : 'opacity-100 translate-y-0 duration-200 ease-out motion-safe:hover:scale-[1.015]'
                        }
                        style={isEntering ? { transitionDelay: `${Math.min(index, 11) * 30}ms` } : undefined}
                      />
                    ))}
                  </div>
                </PerformanceProfiler>
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
