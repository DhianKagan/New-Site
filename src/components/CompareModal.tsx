import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Scale,
  ShoppingBag,
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  PlusCircle,
  Highlighter,
} from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import {
  buildComparisonSpecRows,
  doesRowDiffer,
  MAX_COMPARE_PRODUCTS,
} from '../lib/compare.ts';

const CAT_LABELS: Record<string, { uk: string; ru: string }> = {
  kits: { uk: 'Готове рішення', ru: 'Готовое решение' },
  inverters: { uk: 'Інвертори', ru: 'Инверторы' },
  batteries: { uk: 'Акумулятори', ru: 'Аккумуляторы' },
  panels: { uk: 'Сонячні панелі', ru: 'Солнечные панели' },
  parts: { uk: 'Комплектуючі', ru: 'Комплектующие' },
};

interface CompareModalProps {
  open: boolean;
  products: Product[];
  usdUahRate: number | null;
  onClose: () => void;
  onRemoveProduct: (productId: string) => void;
  onClearAll: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onBrowseCatalog: () => void;
}

export function CompareModal({
  open,
  products,
  usdUahRate,
  onClose,
  onRemoveProduct,
  onClearAll,
  onSelectProduct,
  onAddToCart,
  onRequestQuote,
  onBrowseCatalog,
}: CompareModalProps) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [highlightDifferences, setHighlightDifferences] = useState(true);

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

  const specRows = useMemo(
    () => buildComparisonSpecRows(products, isRussian),
    [products, isRussian],
  );

  const overviewRows = useMemo(() => {
    if (products.length === 0) return [];
    const brandValues = products.map((p) => p.brand || '—');
    const categoryValues = products.map((p) => {
      const catMeta = CAT_LABELS[p.cat];
      return catMeta ? (isRussian ? catMeta.ru : catMeta.uk) : p.cat;
    });
    const skuValues = products.map((p) => p.sku || '—');
    const stockValues = products.map((p) =>
      p.isKit
        ? isRussian
          ? 'Инженерный подбор'
          : 'Інженерний підбір'
        : p.inStock
          ? isRussian
            ? 'В наличии · Одесса'
            : 'В наявності · Одеса'
          : isRussian
            ? 'Под заказ'
            : 'Під замовлення',
    );
    const typeValues = products.map((p) =>
      p.isKit
        ? isRussian
          ? 'Готовый комплект'
          : 'Готовий комплект'
        : isRussian
          ? 'Отдельное оборудование'
          : 'Окреме обладнання',
    );

    return [
      {
        label: tr('Бренд', 'Бренд'),
        values: brandValues,
        differs: doesRowDiffer(brandValues),
      },
      {
        label: tr('Категорія', 'Категория'),
        values: categoryValues,
        differs: doesRowDiffer(categoryValues),
      },
      {
        label: tr('Тип позиції', 'Тип позиции'),
        values: typeValues,
        differs: doesRowDiffer(typeValues),
      },
      {
        label: tr('Наявність', 'Наличие'),
        values: stockValues,
        differs: doesRowDiffer(stockValues),
      },
      {
        label: 'SKU',
        values: skuValues,
        differs: doesRowDiffer(skuValues),
      },
    ];
  }, [products, isRussian]);

  const visibleOverviewRows = useMemo(
    () => (onlyDifferences ? overviewRows.filter((row) => row.differs) : overviewRows),
    [onlyDifferences, overviewRows],
  );

  const visibleSpecRows = useMemo(
    () => (onlyDifferences ? specRows.filter((row) => row.differs) : specRows),
    [onlyDifferences, specRows],
  );

  const totalDifferencesCount = useMemo(
    () =>
      overviewRows.filter((row) => row.differs).length +
      specRows.filter((row) => row.differs).length,
    [overviewRows, specRows],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#e6f2fc] border border-sky-200 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-[#0b66b2]" />
            </div>
            <div>
              <h2 id="compare-modal-title" className="text-base sm:text-lg font-extrabold text-[#07213e] leading-tight">
                {tr('Порівняння характеристик', 'Сравнение характеристик')}
              </h2>
              <p className="text-xs text-[#1c3d5e] font-medium">
                {tr('Обрано позицій:', 'Выбрано позиций:')}{' '}
                <span className="font-mono font-bold text-[#0b66b2]">
                  {products.length}/{MAX_COMPARE_PRODUCTS}
                </span>
                {products.length >= 2 && (
                  <>
                    {' · '}
                    <span>
                      {tr('Відмінностей:', 'Отличий:')}{' '}
                      <strong className="font-mono text-[#07213e]">{totalDifferencesCount}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
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
                  <span
                    aria-hidden="true"
                    className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                      highlightDifferences ? 'bg-[#f59e0b] justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </span>
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

            {products.length > 0 && (
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
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Comparison Content */}
        <div className="flex-1 overflow-auto">
          {products.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-bold text-[#07213e] mb-2">
                {tr('Список порівняння порожній', 'Список сравнения пуст')}
              </p>
              <p className="text-xs text-slate-600 mb-5">
                {tr(
                  'Оберіть від 2 до 4 позицій у каталозі, щоб порівняти потужність, параметри та ціни поруч.',
                  'Выберите от 2 до 4 позиций в каталоге, чтобы сравнить мощность, параметры и цены рядом.',
                )}
              </p>
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
            </div>
          ) : (
            <div className="min-w-full inline-block align-top">
              {products.length === 1 && (
                <div className="mx-4 sm:mx-6 mt-4 mb-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-900">
                    {tr(
                      'Додайте ще хоча б один товар із каталогу для повноцінного порівняння характеристик.',
                      'Добавьте ещё хотя бы один товар из каталога для полноценного сравнения характеристик.',
                    )}
                  </p>
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
                </div>
              )}

              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 align-top">
                    <th
                      scope="col"
                      className="sm:sticky sm:left-0 z-20 bg-slate-50/95 backdrop-blur-xs min-w-[150px] w-[170px] sm:w-[210px] p-4 border-r border-slate-200 align-bottom"
                    >
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0b66b2] mb-1">
                        {tr('Параметр', 'Параметр')}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-snug flex items-center gap-1.5">
                        {highlightDifferences ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" aria-hidden="true" />
                            <span>
                              {tr(
                                'Рядки з відмінностями підсвічені',
                                'Строки с отличиями подсвечены',
                              )}
                            </span>
                          </>
                        ) : (
                          <span>
                            {tr(
                              'Підсвічування відмінностей вимкнено',
                              'Подсветка отличий выключена',
                            )}
                          </span>
                        )}
                      </p>
                    </th>

                    {products.map((product) => {
                      const title = isRussian
                        ? product.titleRu ?? localizeCatalogText(product.title)
                        : product.title;
                      const canBuyDirect = !product.isKit && product.price > 0;
                      const discountPct =
                        product.oldPrice > product.price && product.price > 0
                          ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                          : 0;

                      return (
                        <th
                          key={product.id}
                          scope="col"
                          className="min-w-[210px] w-[240px] p-4 bg-white border-r border-slate-200/80 last:border-r-0 font-normal align-top"
                        >
                          <div className="flex flex-col h-full justify-between gap-3">
                            <div>
                              <div className="relative h-36 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden mb-3">
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
                                        : 'object-contain p-3'
                                    }`}
                                  />
                                </button>
                                {discountPct > 0 && (
                                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-extrabold">
                                    -{discountPct}%
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onRemoveProduct(product.id)}
                                  aria-label={`${tr('Видалити з порівняння', 'Удалить из сравнения')}: ${title}`}
                                  title={tr('Видалити з порівняння', 'Удалить из сравнения')}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/95 border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

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
                            </div>

                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                              <div>
                                {product.price > 0 ? (
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="font-mono text-base font-extrabold text-[#07213e] tabular-nums">
                                      {formatUahFromUsd(product.price, usdUahRate)}
                                    </span>
                                    {product.oldPrice > product.price && (
                                      <span className="font-mono text-[11px] text-slate-400 line-through tabular-nums">
                                        {formatUahFromUsd(product.oldPrice, usdUahRate)}
                                      </span>
                                    )}
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

                              {canBuyDirect ? (
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onRequestQuote(product);
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <span>{tr('Розрахунок', 'Расчёт')}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* Key Commercial & Classification Attributes */}
                  {visibleOverviewRows.length > 0 && (
                    <>
                      <tr className="bg-slate-100/80 border-b border-slate-200">
                        <th
                          colSpan={products.length + 1}
                          className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#133659]"
                        >
                          {tr('Загальні параметри', 'Общие параметры')}
                        </th>
                      </tr>
                      {visibleOverviewRows.map((row) => {
                        const isHighlighted = highlightDifferences && row.differs;
                        return (
                          <tr
                            key={`overview-${row.label}`}
                            data-differs={row.differs ? 'true' : 'false'}
                            data-highlighted={isHighlighted ? 'true' : 'false'}
                            className={`border-b border-slate-200/80 transition-colors ${
                              isHighlighted ? 'bg-amber-50/70' : 'bg-white'
                            }`}
                          >
                            <th
                              scope="row"
                              className={`sm:sticky sm:left-0 z-10 px-4 py-2.5 text-xs border-r border-slate-200 transition-colors ${
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
                            {row.values.map((val, idx) => (
                              <td
                                key={`${row.label}-${products[idx].id}`}
                                className={`px-4 py-2.5 text-xs border-r border-slate-200/70 last:border-r-0 transition-colors ${
                                  isHighlighted
                                    ? 'bg-amber-50/45 font-bold text-[#07213e]'
                                    : 'font-medium text-slate-700'
                                }`}
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </>
                  )}

                  {/* Technical Specifications Matrix */}
                  <tr className="bg-slate-100/80 border-b border-slate-200">
                    <th
                      colSpan={products.length + 1}
                      className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#133659]"
                    >
                      {tr('Технічні характеристики', 'Технические характеристики')}
                    </th>
                  </tr>

                  {visibleSpecRows.length === 0 ? (
                    <tr>
                      <td colSpan={products.length + 1} className="px-6 py-8 text-center text-xs text-slate-600">
                        {onlyDifferences ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-[#07213e]">
                              {tr(
                                'Усі зазначені технічні характеристики збігаються.',
                                'Все указанные технические характеристики совпадают.',
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => setOnlyDifferences(false)}
                              className="text-[#0b66b2] font-bold hover:underline cursor-pointer"
                            >
                              {tr('Показати всі характеристики', 'Показать все характеристики')}
                            </button>
                          </div>
                        ) : (
                          tr(
                            'Для обраних позицій технічні характеристики не вказані.',
                            'Для выбранных позиций технические характеристики не указаны.',
                          )
                        )}
                      </td>
                    </tr>
                  ) : (
                    visibleSpecRows.map((row) => {
                      const isHighlighted = highlightDifferences && row.differs;
                      return (
                        <tr
                          key={`spec-${row.label}`}
                          data-differs={row.differs ? 'true' : 'false'}
                          data-highlighted={isHighlighted ? 'true' : 'false'}
                          className={`border-b border-slate-200/80 transition-colors ${
                            isHighlighted ? 'bg-amber-50/70' : 'bg-white'
                          }`}
                        >
                          <th
                            scope="row"
                            className={`sm:sticky sm:left-0 z-10 px-4 py-2.5 text-xs border-r border-slate-200 transition-colors ${
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
                          {row.values.map((val, idx) => (
                            <td
                              key={`${row.label}-${products[idx].id}`}
                              className={`px-4 py-2.5 text-xs border-r border-slate-200/70 last:border-r-0 transition-colors ${
                                val === '—'
                                  ? isHighlighted
                                    ? 'bg-amber-50/35 text-slate-400 font-normal'
                                    : 'text-slate-400 font-normal'
                                  : isHighlighted
                                    ? 'bg-amber-50/45 font-bold text-[#07213e]'
                                    : 'font-medium text-slate-700'
                              }`}
                            >
                              {val}
                            </td>
                          ))}
                        </tr>
                      );
                    })
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
