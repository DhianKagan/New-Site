import { X, ShoppingBag, ArrowUpRight, CheckCircle2, ExternalLink, Heart } from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';

const CAT_LABELS: Record<string, string> = {
  kits: 'Готове рішення під ключ',
  inverters: 'Інвертори',
  batteries: 'Акумуляторні батареї',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі та захист',
};

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onOpenFullDetails?: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  usdUahRate: number | null;
}

export function QuickViewModal({
  product,
  onClose,
  onAddToCart,
  onRequestQuote,
  onOpenFullDetails,
  isWishlisted = false,
  onToggleWishlist,
  usdUahRate,
}: QuickViewModalProps) {
  if (!product) return null;

  const isRussian = getActiveLocale() === 'ru';
  const title = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
  const specs = isRussian
    ? product.specsRu ??
      product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
    : product.specs;
  const description = isRussian
    ? product.descriptionRu ?? localizeCatalogText(product.description)
    : product.description;

  const hasPrice = product.price > 0;
  const discountPct =
    product.oldPrice > product.price && product.price > 0
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 gap-3">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2 min-w-0 truncate">
            <span>{tr(CAT_LABELS[product.cat] || product.cat)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#0d1f33]">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">SKU {product.sku}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onToggleWishlist && (
              <button
                type="button"
                onClick={() => onToggleWishlist(product)}
                aria-pressed={isWishlisted}
                aria-label={
                  isWishlisted
                    ? tr('Прибрати зі списку бажань', 'Убрать из списка желаний')
                    : tr('Додати до списку бажань', 'Добавить в список желаний')
                }
                title={
                  isWishlisted
                    ? tr('Прибрати зі списку бажань', 'Убрать из списка желаний')
                    : tr('Додати до списку бажань', 'Добавить в список желаний')
                }
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Закрити', 'Закрыть')}
              className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769aa]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 sm:p-6">
          <div className="md:col-span-5 bg-[#f8fafc] border border-slate-200 rounded-xl h-64 md:h-72 overflow-hidden flex items-center justify-center relative">
            <SmartImage
              src={product.img}
              alt={title}
              className={`w-full h-full ${product.isKit ? 'object-cover' : 'object-contain p-5'}`}
            />
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-rose-600 text-white font-mono text-xs font-extrabold tabular-nums">
                -{discountPct}%
              </span>
            )}
          </div>

          <div className="md:col-span-7 flex flex-col justify-between gap-4 min-w-0">
            <div>
              <h2
                id="quick-view-modal-title"
                className="text-lg sm:text-xl font-extrabold text-[#0d1f33] leading-snug mb-2.5"
              >
                {title}
              </h2>

              <div className="flex items-baseline gap-3 mb-2.5">
                {hasPrice ? (
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
                  <span className="font-mono text-lg font-bold text-[#1769aa]">
                    {tr('Ціна за запитом', 'Цена по запросу')}
                  </span>
                )}
              </div>

              <div
                className={`flex items-center gap-1.5 text-xs font-semibold mb-4 ${
                  product.inStock ? 'text-[#169374]' : 'text-amber-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {product.isKit
                    ? tr('Інженерний підбір під ключ', 'Инженерный подбор под ключ')
                    : product.inStock
                      ? tr('В наявності на складі в Одесі', 'В наличии на складе в Одессе')
                      : tr('Поставка під замовлення', 'Поставка под заказ')}
                  {' · '}
                  {tr('Офіційна гарантія', 'Официальная гарантия')}
                </span>
              </div>

              {specs.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-1.5 mb-3.5">
                  {specs.slice(0, 4).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs gap-3">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-bold text-[#0d1f33] text-right">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {description && (
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {description}
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap gap-2.5">
                {hasPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToCart(product);
                      onClose();
                    }}
                    className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d1f33]"
                  >
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    {tr('Додати в кошик', 'Добавить в корзину')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestQuote(product);
                  }}
                  className={`${
                    hasPrice
                      ? 'border border-slate-300 bg-white hover:bg-slate-50 text-[#0d1f33]'
                      : 'flex-1 bg-[#1769aa] hover:bg-[#12568c] text-white'
                  } min-h-11 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769aa]`}
                >
                  {tr('Підбір під об’єкт', 'Подбор для объекта')}
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {onOpenFullDetails && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => onOpenFullDetails(product)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769aa] hover:underline cursor-pointer py-1"
                  >
                    {tr('Детальна сторінка та відгуки', 'Подробная страница и отзывы')}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
