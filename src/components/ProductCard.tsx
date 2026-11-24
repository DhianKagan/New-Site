import { ShoppingBag, ArrowUpRight } from 'lucide-react';
import type { Product } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';

const CAT_LABELS: Record<string, string> = {
  kits: 'Готове рішення',
  inverters: 'Інвертори',
  batteries: 'Акумулятори',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі',
};

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  usdUahRate: number | null;
}

export function ProductCard({ product, onSelect, onAddToCart, onRequestQuote, usdUahRate }: ProductCardProps) {
  const isRussian = getActiveLocale() === 'ru';
  const specs = isRussian
    ? product.specsRu ?? product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
    : product.specs;
  const localizedTitle = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
  const canBuyDirect = !product.isKit && product.price > 0;

  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <button
        type="button"
        onClick={() => onSelect(product)}
        className="relative h-52 w-full bg-[#f8fafc] border-b border-slate-100 overflow-hidden text-left cursor-pointer group"
      >
        <SmartImage
          src={product.img}
          alt={product.title}
          className={`w-full h-full transition-transform duration-200 group-hover:scale-[1.02] ${
            product.isKit ? 'object-cover' : 'object-contain p-4'
          }`}
        />
      </button>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1.5 truncate">
            <span>{tr(CAT_LABELS[product.cat] || product.cat)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#0d1f33] font-semibold">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[10.5px]">SKU {product.sku}</span>
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="text-left block w-full cursor-pointer group"
          >
            <h3 className="text-[15px] font-bold text-[#0d1f33] leading-snug line-clamp-2 group-hover:text-[#1769aa] transition-colors">
              {localizedTitle}
            </h3>
          </button>

          {specs.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
              {specs.slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-[#0d1f33] text-right truncate">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {product.price > 0 ? (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[17px] font-bold text-[#0d1f33] tabular-nums">
                  {formatUahFromUsd(product.price, usdUahRate)}
                </span>
                {product.oldPrice > product.price && (
                  <span className="font-mono text-xs text-slate-400 line-through tabular-nums">
                    {formatUahFromUsd(product.oldPrice, usdUahRate)}
                  </span>
                )}
              </div>
            ) : (
              <span className="font-mono text-sm font-bold text-[#1769aa]">{tr('За запитом')}</span>
            )}
            <div
              className={`text-[11px] font-semibold mt-0.5 ${
                product.inStock ? 'text-[#169374]' : 'text-amber-700'
              }`}
            >
              {product.isKit
                ? tr('Інженерний підбір')
                : product.inStock
                  ? tr('В наявності · Одеса')
                  : tr('Під замовлення')}
            </div>
          </div>

          {canBuyDirect ? (
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              У кошик
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRequestQuote(product)}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Розрахунок
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
