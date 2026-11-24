import { X, ShoppingBag, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';

const CAT_LABELS: Record<string, string> = {
  kits: 'Готове рішення під ключ',
  inverters: 'Інвертори',
  batteries: 'Акумуляторні батареї',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі та захист',
};

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  usdUahRate: number | null;
}

export function ProductModal({ product, onClose, onAddToCart, onRequestQuote, usdUahRate }: ProductModalProps) {
  if (!product) return null;
  const isRussian = getActiveLocale() === 'ru';
  const title = isRussian ? product.titleRu ?? product.title : product.title;
  const specs = isRussian ? product.specsRu ?? product.specs : product.specs;
  const description = isRussian ? product.descriptionRu ?? product.description : product.description;
  const canBuyDirect = !product.isKit && product.price > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2 truncate">
            <span>{tr(CAT_LABELS[product.cat] || product.cat)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#0d1f33]">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">SKU {product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Закрити')}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="bg-[#f8fafc] border border-slate-200 rounded-xl h-72 md:h-80 overflow-hidden flex items-center justify-center">
            <SmartImage
              src={product.img}
              alt={title}
              className={`w-full h-full ${product.isKit ? 'object-cover' : 'object-contain p-6'}`}
            />
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div>
              <h2 id="product-modal-title" className="text-xl font-extrabold text-[#0d1f33] leading-tight mb-3">
                {title}
              </h2>

              <div className="flex items-baseline gap-3 mb-4">
                {product.price > 0 ? (
                  <>
                    <span className="font-mono text-2xl font-extrabold text-[#0d1f33] tabular-nums">
                      {formatUahFromUsd(product.price, usdUahRate)}
                    </span>
                    {product.oldPrice > product.price && (
                      <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                        {formatUahFromUsd(product.oldPrice, usdUahRate)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-mono text-lg font-bold text-[#1769aa]">{tr('Ціна за запитом', 'Цена по запросу')}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#169374] mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isRussian ? product.statusLabelRu ?? (product.inStock ? 'В наличии на складе в Одессе' : 'Поставка под заказ') : product.inStock ? 'В наявності на складі в Одесі' : 'Поставка під замовлення'} · {tr('Офіційна гарантія')}
                </span>
              </div>

              {specs.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-2 mb-4">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs gap-3">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-bold text-[#0d1f33]">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {description && (
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto pr-1">
                  {description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 pt-3 border-t border-slate-200">
              {canBuyDirect && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(product);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {tr('Додати в кошик', 'Добавить в корзину')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestQuote(product);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                {tr('Підбір під об’єкт', 'Подбор для объекта')}
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
