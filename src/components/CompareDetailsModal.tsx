import { useEffect, useMemo, useState } from 'react';
import {
  X,
  TableProperties,
  ShoppingBag,
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  PlusCircle,
  Highlighter,
  Search,
  Award,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import {
  buildDetailedComparisonSections,
  extractProductDecisionMetrics,
  MAX_COMPARE_PRODUCTS,
  type CompareDetailSectionId,
} from '../lib/compare.ts';

export interface CompareDetailsModalProps {
  products: Product[];
  open?: boolean;
  usdUahRate?: number | null;
  onClose: () => void;
  onRemoveProduct?: (productId: string) => void;
  onClearAll?: () => void;
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onRequestQuote?: (product: Product) => void;
  onBrowseCatalog?: () => void;
  onBackToSummary?: () => void;
}

type SectionFilter = 'all' | CompareDetailSectionId;

export function CompareDetailsModal({
  products,
  open = true,
  usdUahRate = null,
  onClose,
  onRemoveProduct,
  onClearAll,
  onSelectProduct,
  onAddToCart,
  onRequestQuote,
  onBrowseCatalog,
  onBackToSummary,
}: CompareDetailsModalProps) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionFilter>('all');
  const [specQuery, setSpecQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const isRussian = getActiveLocale() === 'ru';

  const sections = useMemo(
    () => buildDetailedComparisonSections(products, isRussian, usdUahRate),
    [products, isRussian, usdUahRate],
  );

  const productMetrics = useMemo(
    () => products.map((product) => extractProductDecisionMetrics(product, isRussian)),
    [products, isRussian],
  );

  // Determine headline "winner" tags per product column for quick decision guidance
  const productHighlightTags = useMemo(() => {
    const tags: string[][] = products.map(() => []);
    if (products.length < 2) return tags;

    const addTagFromRow = (sectionId: CompareDetailSectionId, rowId: string, labelUk: string, labelRu: string) => {
      const section = sections.find((s) => s.id === sectionId);
      const row = section?.rows.find((r) => r.id === rowId);
      if (!row?.bestIndices || row.bestIndices.length === 0 || row.bestIndices.length === products.length) return;
      for (const idx of row.bestIndices) {
        if (tags[idx]) {
          tags[idx].push(isRussian ? labelRu : labelUk);
        }
      }
    };

    addTagFromRow('commercial', 'comm-price', 'Найвигідніша ціна', 'Лучшая цена');
    addTagFromRow('commercial', 'comm-price-per-kw', 'Топ ціна/кВт', 'Топ цена/кВт');
    addTagFromRow('commercial', 'comm-price-per-kwh', 'Топ ціна/кВт·год', 'Топ цена/кВт·ч');
    addTagFromRow('electrical', 'elec-power', 'Макс. потужність', 'Макс. мощность');
    addTagFromRow('electrical', 'elec-battery', 'Макс. запас АКБ', 'Макс. запас АКБ');

    return tags;
  }, [products, sections, isRussian]);

  const normalizedQuery = specQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return sections
      .filter((section) => activeSection === 'all' || section.id === activeSection)
      .map((section) => {
        const rows = section.rows.filter((row) => {
          if (onlyDifferences && !row.differs) return false;
          if (!normalizedQuery) return true;
          return (
            row.label.toLowerCase().includes(normalizedQuery) ||
            row.values.some((val) => val.toLowerCase().includes(normalizedQuery))
          );
        });
        return { ...section, rows };
      })
      .filter((section) => section.rows.length > 0);
  }, [sections, activeSection, onlyDifferences, normalizedQuery]);

  const totalRowsCount = useMemo(
    () => sections.reduce((sum, sec) => sum + sec.rows.length, 0),
    [sections],
  );

  const totalDifferencesCount = useMemo(
    () => sections.reduce((sum, sec) => sum + sec.rows.filter((row) => row.differs).length, 0),
    [sections],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/78 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-details-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0b66b2] text-white flex items-center justify-center shadow-xs shrink-0">
              <TableProperties className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="compare-details-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#07213e] leading-tight truncate"
              >
                {tr('Детальна технічна таблиця порівняння', 'Детальная техническая таблица сравнения')}
              </h2>
              <p className="text-xs text-[#1c3d5e] font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span>
                  {tr('Позицій:', 'Позиций:')}{' '}
                  <strong className="font-mono text-[#0b66b2]">
                    {products.length}/{MAX_COMPARE_PRODUCTS}
                  </strong>
                </span>
                {products.length >= 2 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {tr('Параметрів:', 'Параметров:')}{' '}
                      <strong className="font-mono text-[#07213e]">{totalRowsCount}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {tr('Відмінностей:', 'Отличий:')}{' '}
                      <strong className="font-mono text-[#d97706]">{totalDifferencesCount}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBackToSummary && (
              <button
                type="button"
                onClick={onBackToSummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-[#133659] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{tr('Короткий огляд', 'Краткий обзор')}</span>
              </button>
            )}

            {products.length > 0 && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr('Очистити все', 'Очистить всё')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Закрити', 'Закрыть')}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Filter & Search Controls */}
        {products.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0">
            {/* Section Filter Tabs */}
            <div
              role="tablist"
              aria-label={tr('Розділи характеристик', 'Разделы характеристик')}
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'all'}
                onClick={() => setActiveSection('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeSection === 'all'
                    ? 'bg-[#07213e] text-white'
                    : 'bg-slate-100 text-[#133659] hover:bg-slate-200/80'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>{tr('Усі параметри', 'Все параметры')}</span>
              </button>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    activeSection === section.id
                      ? 'bg-[#0b66b2] text-white'
                      : 'bg-slate-100 text-[#133659] hover:bg-slate-200/80'
                  }`}
                >
                  <span>
                    {section.id === 'commercial'
                      ? tr('Ціна та вигода', 'Цена и выгода')
                      : section.id === 'electrical'
                        ? tr('Енергетика', 'Энергетика')
                        : section.id === 'specs'
                          ? tr('Технічний паспорт', 'Техпаспорт')
                          : tr('Застосування', 'Применение')}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                      activeSection === section.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {section.rows.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search & Difference Switches */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[180px] sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={specQuery}
                  onChange={(e) => setSpecQuery(e.target.value)}
                  placeholder={tr('Пошук по характеристиках...', 'Поиск по характеристикам...')}
                  aria-label={tr('Пошук по характеристиках', 'Поиск по характеристикам')}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0b66b2] focus:outline-none text-xs text-[#07213e] placeholder:text-slate-400"
                />
              </div>

              {products.length >= 2 && (
                <>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={highlightDifferences}
                    onClick={() => setHighlightDifferences((prev) => !prev)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
                      highlightDifferences
                        ? 'border-amber-300 bg-amber-50 text-[#07213e] hover:bg-amber-100/80'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-[#07213e]'
                    }`}
                  >
                    <Highlighter
                      className={`w-3.5 h-3.5 shrink-0 ${
                        highlightDifferences ? 'text-[#d97706]' : 'text-slate-400'
                      }`}
                    />
                    <span>{tr('Підсвітити відмінності', 'Подсветить отличия')}</span>
                  </button>

                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-sky-200 bg-white text-xs font-bold text-[#07213e] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyDifferences}
                      onChange={(e) => setOnlyDifferences(e.target.checked)}
                      className="w-4 h-4 accent-[#0b66b2] cursor-pointer"
                    />
                    <span>{tr('Лише відмінності', 'Только отличия')}</span>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Comparison Table Body */}
        <div className="flex-1 overflow-auto bg-white">
          {products.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-bold text-[#07213e] mb-2">
                {tr('Немає товарів для детального порівняння', 'Нет товаров для детального сравнения')}
              </p>
              <p className="text-xs text-slate-600 mb-5 max-w-md mx-auto">
                {tr(
                  'Додайте від 2 до 4 позицій з каталогу, щоб зіставити технічні характеристики, вартість 1 кВт та умови монтажу поруч.',
                  'Добавьте от 2 до 4 позиций из каталога, чтобы сопоставить технические характеристики, стоимость 1 кВт и условия монтажа рядом.',
                )}
              </p>
              {onBrowseCatalog && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBrowseCatalog();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold cursor-pointer"
                >
                  {tr('Перейти до каталогу', 'Перейти в каталог')}
                </button>
              )}
            </div>
          ) : (
            <div className="min-w-full inline-block align-top">
              {products.length === 1 && (
                <div className="mx-4 sm:mx-6 mt-4 mb-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-900">
                    {tr(
                      'Для порівняння ключових відмінностей і підсвічування найкращих показників додайте ще хоча б один товар.',
                      'Для сравнения ключевых отличий и подсветки лучших показателей добавьте ещё хотя бы один товар.',
                    )}
                  </p>
                  {onBrowseCatalog && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onBrowseCatalog();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      {tr('Обрати ще товар', 'Выбрать ещё товар')}
                    </button>
                  )}
                </div>
              )}

              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 align-top">
                    <th
                      scope="col"
                      className="sm:sticky sm:left-0 z-20 bg-slate-50/95 backdrop-blur-xs min-w-[170px] w-[200px] sm:w-[240px] p-4 border-r border-slate-200 align-bottom"
                    >
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0b66b2] mb-1.5">
                        {tr('Технічна специфікація', 'Техническая спецификация')}
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-600 font-medium leading-snug">
                        <p className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#0d9488] shrink-0" aria-hidden="true" />
                          <span>{tr('Зеленим — кращий показник', 'Зелёным — лучший показатель')}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" aria-hidden="true" />
                          <span>
                            {highlightDifferences
                              ? tr('Жовтим — позиції відрізняються', 'Жёлтым — позиции отличаются')
                              : tr('Підсвічування відмінностей вимкнено', 'Подсветка отличий выключена')}
                          </span>
                        </p>
                      </div>
                    </th>

                    {products.map((product, productIndex) => {
                      const title = isRussian
                        ? product.titleRu ?? localizeCatalogText(product.title)
                        : product.title;
                      const canBuyDirect = !product.isKit && product.price > 0;
                      const metrics = productMetrics[productIndex];
                      const winnerTags = productHighlightTags[productIndex] ?? [];

                      return (
                        <th
                          key={product.id}
                          scope="col"
                          className="min-w-[225px] w-[255px] p-4 bg-white border-r border-slate-200/80 last:border-r-0 font-normal align-top"
                        >
                          <div className="flex flex-col h-full justify-between gap-3">
                            <div>
                              <div className="relative h-32 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden mb-2.5">
                                {onSelectProduct ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onSelectProduct(product);
                                    }}
                                    aria-label={title}
                                    className="w-full h-full block cursor-pointer"
                                  >
                                    <SmartImage
                                      src={product.img}
                                      alt={title}
                                      className={`w-full h-full ${
                                        product.isKit && product.id !== 'vysokovoltna-sistema-solax-x3-ies-p15b15'
                                          ? 'object-cover'
                                          : 'object-contain p-2.5'
                                      }`}
                                    />
                                  </button>
                                ) : (
                                  <SmartImage
                                    src={product.img}
                                    alt={title}
                                    className={`w-full h-full ${
                                      product.isKit && product.id !== 'vysokovoltna-sistema-solax-x3-ies-p15b15'
                                        ? 'object-cover'
                                        : 'object-contain p-2.5'
                                    }`}
                                  />
                                )}
                                {metrics.discountPct > 0 && (
                                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-extrabold">
                                    -{metrics.discountPct}%
                                  </span>
                                )}
                                {onRemoveProduct && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveProduct(product.id)}
                                    aria-label={`${tr('Видалити з порівняння', 'Удалить из сравнения')}: ${title}`}
                                    title={tr('Видалити з порівняння', 'Удалить из сравнения')}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/95 border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {winnerTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {winnerTags.slice(0, 2).map((tag) => (
                                    <span
                                      key={`${product.id}-${tag}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold"
                                    >
                                      <Award className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>{tag}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {onSelectProduct ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onSelectProduct(product);
                                  }}
                                  className="text-left block w-full min-w-0 overflow-hidden group cursor-pointer"
                                >
                                  <div className="text-[13px] font-bold text-[#07213e] group-hover:text-[#0b66b2] leading-snug line-clamp-2 overflow-hidden text-ellipsis min-h-[2.3rem] transition-colors">
                                    {title}
                                  </div>
                                </button>
                              ) : (
                                <div className="text-[13px] font-bold text-[#07213e] leading-snug line-clamp-2 overflow-hidden text-ellipsis min-h-[2.3rem]">
                                  {title}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div>
                                {product.price > 0 ? (
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="font-mono text-base font-extrabold text-[#07213e] tabular-nums">
                                      {formatUahFromUsd(product.price, usdUahRate)}
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                                      ${product.price.toLocaleString('en-US')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-sm font-bold text-[#0b66b2]">
                                    {tr('За запитом', 'По запросу')}
                                  </span>
                                )}
                                <div
                                  className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                                    product.inStock ? 'text-[#0d9488]' : 'text-amber-700'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  <span>
                                    {product.isKit
                                      ? tr('Інженерний підбір', 'Инженерный подбор')
                                      : product.inStock
                                        ? tr('В наявності', 'В наличии')
                                        : tr('Під замовлення', 'Под заказ')}
                                  </span>
                                </div>
                              </div>

                              {canBuyDirect && onAddToCart ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onAddToCart(product);
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#07213e] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  <span>{tr('У кошик', 'В корзину')}</span>
                                </button>
                              ) : onRequestQuote ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onRequestQuote(product);
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <span>{tr('Замовити розрахунок', 'Заказать расчёт')}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {filteredSections.length === 0 ? (
                    <tr>
                      <td colSpan={products.length + 1} className="px-6 py-10 text-center text-xs text-slate-600">
                        <div className="space-y-2.5 max-w-md mx-auto">
                          <p className="font-bold text-[#07213e]">
                            {normalizedQuery
                              ? tr(
                                  'За вашим запитом параметрів не знайдено.',
                                  'По вашему запросу параметров не найдено.',
                                )
                              : tr(
                                  'У вибраному розділі всі характеристики збігаються.',
                                  'В выбранном разделе все характеристики совпадают.',
                                )}
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            {normalizedQuery && (
                              <button
                                type="button"
                                onClick={() => setSpecQuery('')}
                                className="text-[#0b66b2] font-bold hover:underline cursor-pointer"
                              >
                                {tr('Скинути пошук', 'Сбросить поиск')}
                              </button>
                            )}
                            {onlyDifferences && (
                              <button
                                type="button"
                                onClick={() => setOnlyDifferences(false)}
                                className="text-[#0b66b2] font-bold hover:underline cursor-pointer"
                              >
                                {tr('Показати всі характеристики', 'Показать все характеристики')}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSections.map((section) => (
                      <FragmentGroup key={section.id}>
                        <tr className="bg-slate-100/90 border-y border-slate-200">
                          <th
                            colSpan={products.length + 1}
                            className="px-4 py-2.5 text-left"
                          >
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#07213e]">
                              {section.title}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500">
                              {section.subtitle}
                            </div>
                          </th>
                        </tr>
                        {section.rows.map((row) => {
                          const isHighlighted = highlightDifferences && row.differs;
                          const bestSet = new Set(row.bestIndices ?? []);

                          return (
                            <tr
                              key={row.id}
                              data-differs={row.differs ? 'true' : 'false'}
                              data-highlighted={isHighlighted ? 'true' : 'false'}
                              className={`border-b border-slate-200/80 transition-colors ${
                                isHighlighted ? 'bg-amber-50/60' : 'bg-white'
                              }`}
                            >
                              <th
                                scope="row"
                                className={`sm:sticky sm:left-0 z-10 px-4 py-3 text-xs border-r border-slate-200 align-top transition-colors ${
                                  isHighlighted
                                    ? 'bg-[#fff8e6] font-bold text-[#07213e] shadow-[inset_4px_0_0_#f59e0b]'
                                    : 'bg-white font-semibold text-[#133659]'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  {isHighlighted && (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" aria-hidden="true" />
                                      <span className="sr-only">{tr('Відрізняється:', 'Отличается:')} </span>
                                    </>
                                  )}
                                  <span>{row.label}</span>
                                </span>
                              </th>
                              {row.values.map((val, idx) => {
                                const isBest = bestSet.has(idx);
                                const isMissing = val === '—';
                                return (
                                  <td
                                    key={`${row.id}-${products[idx].id}`}
                                    data-best={isBest ? 'true' : 'false'}
                                    className={`px-4 py-3 text-xs border-r border-slate-200/70 last:border-r-0 align-top leading-relaxed transition-colors ${
                                      isMissing
                                        ? isHighlighted
                                          ? 'bg-amber-50/35 text-slate-400 font-normal'
                                          : 'text-slate-400 font-normal'
                                        : isBest
                                          ? 'bg-emerald-50/85 font-extrabold text-emerald-950'
                                          : isHighlighted
                                            ? 'bg-amber-50/40 font-bold text-[#07213e]'
                                            : 'font-medium text-slate-700'
                                    }`}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <span>{val}</span>
                                      {isBest && row.bestTag && (
                                        <span className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                          <Award className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                          <span>{row.bestTag}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </FragmentGroup>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
