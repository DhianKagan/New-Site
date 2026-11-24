import { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

interface ShopViewProps {
  products: Product[];
  initialCategory: ProductCategory | 'all';
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onBackHome: () => void;
}

const PAGE_SIZE = 24;

export function ShopView({
  products,
  initialCategory,
  onSelectProduct,
  onAddToCart,
  onRequestQuote,
  onBackHome,
}: ShopViewProps) {
  const [cat, setCat] = useState<ProductCategory | 'all'>(initialCategory);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [sort, setSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);

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
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
      if (inStockOnly && !p.inStock) return false;
      if (q) {
        const hit =
          p.title.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    if (sort === 'asc') {
      return [...list].sort((a, b) => (a.price || 999999) - (b.price || 999999));
    }
    if (sort === 'desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
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
          <nav aria-label="Хлібні крихти" className="flex items-center gap-2 text-xs text-slate-500 mb-2">
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
              Головна
            </a>
            <span aria-hidden="true">/</span>
            <span>Каталог обладнання</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
            Обладнання та готові рішення Energo Comfort
          </h1>
          <p className="text-sm text-[#52657a] max-w-2xl">
            Повний каталог позицій із energocomfort.shop ({products.length} товарів). Окремі інвертори, АКБ, панелі та
            захист додаються у кошик; готові комплекти підключаються через інженерний розрахунок.
          </p>
        </div>
      </section>

      <section className="py-10 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <h2 className="sr-only">Фільтри та перелік обладнання</h2>
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 w-fit max-w-full">
            {(
              [
                ['all', `Усі товари (${counts.all})`],
                ['kits', `Готові рішення (${counts.kits})`],
                ['inverters', `Інвертори (${counts.inverters})`],
                ['batteries', `Акумулятори (${counts.batteries})`],
                ['panels', `Сонячні панелі (${counts.panels})`],
                ['parts', `Комплектуючі (${counts.parts})`],
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
                {label}
              </button>
            ))}
          </div>

          {/* Search, Brand, Stock, Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-7">
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Пошук за моделлю, потужністю або SKU (напр. Deye 12, 10018)..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-[#1769aa]"
              />
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
                <option value="all">Усі бренди ({brands.length})</option>
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
                <option value="default">Рекомендовані</option>
                <option value="asc">Спочатку дешевші</option>
                <option value="desc">Спочатку дорожчі</option>
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
              В наявності
            </label>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
            <span>
              Знайдено позицій: <strong className="font-mono text-[#0d1f33]">{filtered.length}</strong>
            </span>
            {totalPages > 1 && (
              <span className="font-mono">
                Сторінка {safePage} з {totalPages}
              </span>
            )}
          </div>

          {paginated.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
              <p className="text-sm font-bold text-[#0d1f33] mb-1">За вашим запитом товарів не знайдено</p>
              <p className="text-xs text-slate-500 mb-4">Спробуйте змінити фільтр бренду, категорію або пошуковий запит.</p>
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
                Скинути фільтри
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
