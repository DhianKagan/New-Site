import type { CSSProperties } from 'react';
import { ShoppingBag, ArrowUpRight, Eye, Heart, Calculator, Scale } from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import { cn } from '../lib/utils.ts';

const CAT_LABELS: Record<string, string> = {
  kits: 'Готове рішення',
  inverters: 'Інвертори',
  batteries: 'Акумулятори',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі',
};

export function getProductTitleSizeClass(title: string): string {
  const length = title.trim().length;
  if (length >= 80) {
    return 'text-[12.5px] sm:text-[13px] leading-[1.35]';
  }
  if (length >= 52) {
    return 'text-[13.5px] sm:text-[14px] leading-[1.35]';
  }
  return 'text-[15px] sm:text-[15.5px] leading-snug';
}

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickView?: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  isCompared?: boolean;
  onToggleCompare?: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  onCalculatePayback?: (product: Product) => void;
  usdUahRate: number | null;
  className?: string;
  style?: CSSProperties;
}

export function ProductCard({
  product,
  onSelect,
  onQuickView,
  isWishlisted = false,
  onToggleWishlist,
  isCompared = false,
  onToggleCompare,
  onAddToCart,
  onRequestQuote,
  onCalculatePayback,
  usdUahRate,
  className,
  style,
}: ProductCardProps) {
  const isRussian = getActiveLocale() === 'ru';
  const specs = isRussian
    ? product.specsRu ?? product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
    : product.specs;
  const localizedTitle = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
  const canBuyDirect = !product.isKit && product.price > 0;
  const isKitProduct = product.isKit || product.cat === 'kits';
  const showPaybackButton = Boolean(onCalculatePayback && product.cat !== 'parts');
  const wishlistLabel = isWishlisted
    ? tr('Прибрати зі списку бажань', 'Убрать из списка желаний')
    : tr('Додати до списку бажань', 'Добавить в список желаний');
  const compareLabel = isCompared
    ? tr('Прибрати з порівняння', 'Убрать из сравнения')
    : tr('Додати до порівняння', 'Добавить к сравнению');

  const useCoverImage = product.isKit && product.id !== 'vysokovoltna-sistema-solax-x3-ies-p15b15';

  return (
    <article
      style={style}
      className={cn(
        'ec-glass-card rounded-2xl overflow-hidden h-full min-w-0 flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:border-sky-300/80',
        className,
      )}
    >
      <div className="relative h-52 w-full bg-white/95 border-b border-sky-100 overflow-hidden group">
        <button
          type="button"
          onClick={() => onSelect(product)}
          aria-label={localizedTitle}
          className="w-full h-full block text-left cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2]"
        >
          <SmartImage
            src={product.img}
            alt={localizedTitle}
            loading="lazy"
            className={`w-full h-full transition-transform duration-200 group-hover:scale-[1.02] ${
              useCoverImage ? 'object-cover' : 'object-contain p-3.5'
            }`}
          />
        </button>

        {(onToggleCompare || onToggleWishlist || onQuickView) && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            {onToggleCompare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCompare(product);
                }}
                aria-pressed={isCompared}
                aria-label={`${compareLabel}: ${localizedTitle}`}
                title={compareLabel}
                className={`w-9 h-9 rounded-lg border shadow-xs flex items-center justify-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
                  isCompared
                    ? 'bg-[#0b66b2] border-[#0b66b2] text-white hover:bg-[#08508e]'
                    : 'bg-white/92 hover:bg-sky-50 text-[#061c36] hover:text-[#0b66b2] border-sky-100'
                }`}
              >
                <Scale className="w-4 h-4" />
              </button>
            )}

            {onToggleWishlist && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWishlist(product);
                }}
                aria-pressed={isWishlisted}
                aria-label={`${wishlistLabel}: ${localizedTitle}`}
                title={wishlistLabel}
                className={`w-9 h-9 rounded-lg border shadow-xs flex items-center justify-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'bg-white/92 hover:bg-rose-50 text-[#061c36] hover:text-rose-600 border-sky-100'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            )}

            {onQuickView && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(product);
                }}
                aria-label={`${tr('Швидкий перегляд', 'Быстрый просмотр')}: ${localizedTitle}`}
                title={tr('Швидкий перегляд', 'Быстрый просмотр')}
                className="w-9 h-9 rounded-lg bg-white/92 hover:bg-[#0b66b2] text-[#061c36] hover:text-white border border-sky-100 shadow-xs flex items-center justify-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2]"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#133659] mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <span>{tr(CAT_LABELS[product.cat] || product.cat)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#061c36] font-bold">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[10.5px]">SKU {product.sku}</span>
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="text-left block w-full min-w-0 cursor-pointer group"
          >
            <h3
              className={cn(
                'font-bold text-[#061c36] break-words hyphens-none min-h-[2.6rem] group-hover:text-[#0b66b2] transition-colors',
                getProductTitleSizeClass(localizedTitle),
              )}
            >
              {localizedTitle}
            </h3>
          </button>

          {specs.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-sky-200/75 space-y-1.5 min-h-[4.6rem]">
              {specs.slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 text-xs min-w-0">
                  <span className="text-[#133659] font-medium shrink-0">{k}</span>
                  <span className="font-semibold text-[#061c36] text-right overflow-hidden text-ellipsis whitespace-nowrap">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-sky-200/75 space-y-2.5">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="h-4 flex items-center">
                {product.price > 0 && product.oldPrice > product.price && (
                  <span className="font-mono text-[11px] leading-none text-sky-900/45 line-through tabular-nums truncate">
                    {formatUahFromUsd(product.oldPrice, usdUahRate)}
                  </span>
                )}
              </div>
              {product.price > 0 ? (
                <div className="font-mono text-[16px] sm:text-[17px] leading-tight font-bold text-[#061c36] tabular-nums whitespace-nowrap">
                  {formatUahFromUsd(product.price, usdUahRate)}
                </div>
              ) : (
                <div className="font-mono text-sm leading-tight font-bold text-[#0b66b2] whitespace-nowrap">
                  {tr('За запитом')}
                </div>
              )}
              <div
                className={`text-[11px] leading-snug font-semibold mt-0.5 truncate ${
                  product.inStock ? 'text-[#0d9488]' : 'text-amber-700'
                }`}
              >
                {product.isKit
                  ? product.inStock
                    ? tr('Інженерний підбір', 'Подбор инженера')
                    : tr('Під замовлення · Підбір інженера', 'Под заказ · Подбор инженера')
                  : product.inStock
                    ? tr('В наявності · Одеса')
                    : tr('Під замовлення')}
              </div>
            </div>

            {canBuyDirect ? (
              <button
                type="button"
                onClick={() => onAddToCart(product)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#061c36] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {tr('У кошик', 'В корзину')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequestQuote(product)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {tr('Розрахунок', 'Расчёт')}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showPaybackButton && (
            <button
              type="button"
              onClick={() => onCalculatePayback?.(product)}
              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
                isKitProduct
                  ? 'bg-amber-50/90 hover:bg-amber-100 border-amber-200 text-[#07213e]'
                  : 'bg-[#f0f7ff]/80 hover:bg-[#e0f0ff] border-sky-200/80 text-[#07213e] hover:text-[#0b66b2]'
              }`}
            >
              <Calculator className={`w-3.5 h-3.5 shrink-0 ${isKitProduct ? 'text-[#d97706]' : 'text-[#0b66b2]'}`} />
              <span>{tr('Розрахунок окупності', 'Расчёт окупаемости')}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
