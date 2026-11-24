import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';
import { tr } from '../lib/i18n.ts';
import { filterAndRankProductsBySearch } from '../lib/shopSearch.ts';

interface ShopViewProps {
  products: Product[];
  initialCategory: ProductCategory | 'all';
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onBackHome: () => void;
  usdUahRate: number | null;
}

const PAGE_SIZE = 24;

export function ShopView({
  products,
  initialCategory,
  onSelectProduct,
  onAddToCart,
  onRequestQuote,
  onBackHome,
  usdUahRate,
}: ShopViewProps) {
  const [cat, setCat] = useState<ProductCategory | 'all'>(initialCategory);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [sort, setSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCat(initialCategory);
    setPage(1);
  }, [initialCategory]);

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
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleCategoryChange(nextCat: ProductCategory | 'all') {
    setCat(nextCat);
    setPage(1);
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
            <div className="p-12 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
              <p className="text-sm font-bold text-[#0d1f33] mb-1">{tr('За вашим запитом товарів не знайдено', 'По вашему запросу товары не найдены')}</p>
              <p className="text-xs text-slate-500 mb-4">{tr('Спробуйте змінити фільтр бренду, категорію або пошуковий запит.', 'Измените фильтр бренда, категорию или поисковый запрос.')}</p>
              <button
                type="button"
                onClick={() => {
                  setCat('all');
                  setBrand('all');
                  setQuery('');
                  setInStockOnly(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#1769aa] text-white text-xs font-bold cursor-pointer"
              >
                {tr('Скинути фільтри', 'Сбросить фильтры')}
              </button>
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
        </div>
      </section>
    </div>
  );
}
