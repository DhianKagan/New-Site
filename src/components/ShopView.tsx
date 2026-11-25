import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X, MessageSquarePlus } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';
import { tr } from '../lib/i18n.ts';
import { filterAndRankProductsBySearch } from '../lib/shopSearch.ts';
import { toAnalyticsProductItem, track, trackEvent } from '../lib/analytics.ts';

interface ShopViewProps {
  products: Product[];
  initialCategory: ProductCategory | 'all';
  initialQuery?: string;
  onCategoryChange?: (cat: ProductCategory | 'all') => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onOpenCustomRequest?: (topic: string, notes?: string) => void;
  onBackHome: () => void;
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
  onCategoryChange,
  onSelectProduct,
  onAddToCart,
  onRequestQuote,
  onOpenCustomRequest,
  onBackHome,
  usdUahRate,
}: ShopViewProps) {
  const [cat, setCat] = useState<ProductCategory | 'all'>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [brand, setBrand] = useState('all');
  const [sort, setSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const lastTrackedListKeyRef = useRef('');
  const lastTrackedSearchRef = useRef('');

  useEffect(() => {
    setCat(initialCategory);
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

  const filtered = useMemo(() => {
    const baseFiltered = products.filter((p) => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
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
  }, [products, cat, brand, inStockOnly, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    if (paginated.length === 0) return;
    const listKey = `${cat}|${safePage}|${brand}|${inStockOnly}|${usdUahRate ?? 'usd'}`;
    if (lastTrackedListKeyRef.current === listKey) return;
    lastTrackedListKeyRef.current = listKey;

    trackEvent('view_item_list', {
      item_list_id: cat,
      item_list_name: CATEGORY_TITLES[cat] || cat,
      item_category: cat,
      items: paginated.slice(0, 10).map((p) => toAnalyticsProductItem(p, usdUahRate, 1)),
    });
  }, [cat, safePage, brand, inStockOnly, paginated, usdUahRate]);

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
    setPage(1);
    onCategoryChange?.(nextCat);
  }

  return (
    <div>
      <section className="bg-gradient-to-b from-[#f3f7fc] to-white border-b border-slate-200 py-8">
        <div className="max-w-[1180px] mx-auto px-5">
          <nav aria-label={tr('Хлібні крихти')} className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onBackHome();
                }
              }}
              className="text-[#1769aa] font-bold hover:underline"
            >
              {tr('Головна')}
            </a>
            <span aria-hidden="true">/</span>
            <span>{tr('Каталог обладнання')}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
            {tr('Обладнання та готові рішення Energo Comfort', 'Оборудование и готовые решения Energo Comfort')}
          </h1>
          <p className="text-sm text-[#52657a] max-w-2xl">
            {tr('Повний каталог позицій із energocomfort.shop', 'Полный каталог товаров energocomfort.shop')} ({products.length} {tr('товарів', 'товаров')}). {tr('Окремі інвертори, АКБ, панелі та захист додаються у кошик; готові комплекти підключаються через інженерний розрахунок.', 'Отдельные инверторы, аккумуляторы, панели и защита добавляются в корзину; готовые комплекты подбираются инженером.')}
          </p>
        </div>
      </section>

      <section className="py-10 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <h2 className="sr-only">{tr('Фільтри та перелік обладнання', 'Фильтры и каталог оборудования')}</h2>
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 w-fit max-w-full">
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
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  cat === key ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
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
                  setQuery(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    setQuery('');
                    setPage(1);
                  }
                }}
                placeholder={tr('Пошук за назвою або SKU (напр. Deye 8kW, 10018)...', 'Поиск по названию или SKU (напр. Deye 8kW, 10018)…')}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-[#1769aa]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                  }}
                  aria-label={tr('Очистити пошук', 'Очистить поиск')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-[#0d1f33] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="lg:col-span-3">
              <select
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#1769aa]"
              >
                <option value="all">{tr('Усі бренди', 'Все бренды')} ({brands.length})</option>
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
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#1769aa]"
              >
                <option value="default">{tr('Рекомендовані', 'Рекомендуемые')}</option>
                <option value="asc">{tr('Спочатку дешевші', 'Сначала дешевле')}</option>
                <option value="desc">{tr('Спочатку дорожчі', 'Сначала дороже')}</option>
              </select>
            </div>

            <label className="lg:col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="accent-[#169374]"
              />
              {tr('В наявності')}
            </label>
          </div>

          <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-4">
            <div className="flex items-center gap-3">
              <span>
                {tr('Знайдено позицій:', 'Найдено товаров:')} <strong className="font-mono text-[#0d1f33] tabular-nums">{filtered.length}</strong>
              </span>
              {query.trim() && (
                <span className="text-[11px] text-[#1769aa] font-semibold">
                  {tr('Пошук:', 'Поиск:')} «{query.trim()}»
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <span className="font-mono tabular-nums">
                {tr('Сторінка', 'Страница')} {safePage} {tr('з', 'из')} {totalPages}
              </span>
            )}
          </div>

          {paginated.length === 0 ? (
            <div className="p-10 sm:p-12 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
              <p className="text-sm font-bold text-[#0d1f33] mb-1">{tr('За вашим запитом товарів не знайдено', 'По вашему запросу товары не найдены')}</p>
              <p className="text-xs text-slate-500 mb-5">
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
                    setBrand('all');
                    setQuery('');
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
                          brand !== 'all' ? `Бренд: ${brand}` : '',
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginated.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={onSelectProduct}
                  onAddToCart={onAddToCart}
                  onRequestQuote={(prod) => onRequestQuote(prod)}
                  usdUahRate={usdUahRate}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-9 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-[#0d1f33] disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
              <span className="font-mono text-xs font-bold px-3 text-slate-600 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-[#0d1f33] disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                Далі
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {onOpenCustomRequest && paginated.length > 0 && (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-gradient-to-r from-[#f3f8fd] to-[#f8fafc] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-[#1769aa] mb-1">
                  {tr('Потрібна перевірка сумісності або оптова ціна?', 'Нужна проверка совместимости или оптовая цена?')}
                </div>
                <p className="text-sm font-extrabold text-[#0d1f33]">
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
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
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
