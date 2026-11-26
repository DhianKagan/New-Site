import { Scale, Trash2, X, ArrowRight, AlertCircle } from 'lucide-react';
import type { Product } from '../types.ts';
import { MAX_COMPARE_PRODUCTS } from '../lib/compare.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import { SmartImage } from './SmartImage.tsx';

interface CompareBarProps {
  products: Product[];
  limitNotice: boolean;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onOpenModal: () => void;
}

export function CompareBar({
  products,
  limitNotice,
  onRemove,
  onClear,
  onOpenModal,
}: CompareBarProps) {
  if (products.length === 0) return null;

  const isRussian = getActiveLocale() === 'ru';
  const canCompare = products.length >= 2;

  return (
    <div
      role="region"
      aria-label={tr('Панель порівняння товарів', 'Панель сравнения товаров')}
      className="fixed bottom-3 inset-x-0 z-30 px-3 sm:px-5 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-[1160px] mx-auto rounded-2xl bg-white/95 backdrop-blur-xl border border-sky-200/90 shadow-2xl px-3.5 py-2.5 sm:px-4 sm:py-3">
        {limitNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {tr(
                `Можна порівняти до ${MAX_COMPARE_PRODUCTS} товарів одночасно. Видаліть один, щоб додати інший.`,
                `Можно сравнить до ${MAX_COMPARE_PRODUCTS} товаров одновременно. Удалите один, чтобы добавить другой.`,
              )}
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#e6f2fc] border border-sky-200 text-[#07213e] text-xs font-extrabold shrink-0">
              <Scale className="w-3.5 h-3.5 text-[#0b66b2]" />
              <span>{tr('Порівняння', 'Сравнение')}</span>
              <span className="font-mono text-[#0b66b2] tabular-nums">
                {products.length}/{MAX_COMPARE_PRODUCTS}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar min-w-0">
              {products.map((product) => {
                const title = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
                return (
                  <div
                    key={product.id}
                    className="inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-xl bg-slate-50 border border-slate-200/90 max-w-[190px] sm:max-w-[220px] shrink-0"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
                      <SmartImage
                        src={product.img}
                        alt={title}
                        className={`w-full h-full ${product.isKit ? 'object-cover' : 'object-contain p-0.5'}`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-[#07213e] truncate">{title}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(product.id)}
                      aria-label={`${tr('Прибрати з порівняння', 'Убрать из сравнения')}: ${title}`}
                      className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 hover:text-[#07213e] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{tr('Очистити', 'Очистить')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenModal}
              disabled={!canCompare}
              title={
                canCompare
                  ? tr('Відкрити таблицю порівняння', 'Открыть таблицу сравнения')
                  : tr('Оберіть ще хоча б 1 товар для порівняння', 'Выберите ещё хотя бы 1 товар для сравнения')
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap ${
                canCompare
                  ? 'bg-[#0b66b2] hover:bg-[#08508e] text-white shadow-sm cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>
                {canCompare
                  ? `${tr('Порівняти', 'Сравнить')} (${products.length})`
                  : tr('Додайте ще 1 товар', 'Добавьте ещё 1 товар')}
              </span>
              {canCompare && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
