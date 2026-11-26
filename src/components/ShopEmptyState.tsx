import { MessageSquarePlus, RotateCcw, Search, SearchX, X } from 'lucide-react';
import { tr } from '../lib/i18n.ts';

interface ShopEmptyStateProps {
  query: string;
  categoryLabel?: string;
  activeEquipmentTypeLabel?: string;
  activeBrandLabel?: string;
  activePowerLabel?: string;
  activePriceLabel?: string;
  activeSkuLabel?: string;
  inStockOnly?: boolean;
  onResetFilters: () => void;
  onClearSearch?: () => void;
  onSelectSuggestion?: (term: string) => void;
  onOpenCustomRequest?: () => void;
}

const SUGGESTED_TERMS = ['Deye 8kW', 'LiFePO4 5 kWh', 'SolaX', 'Trina'];

export function ShopEmptyState({
  query,
  categoryLabel,
  activeEquipmentTypeLabel,
  activeBrandLabel,
  activePowerLabel,
  activePriceLabel,
  activeSkuLabel,
  inStockOnly = false,
  onResetFilters,
  onClearSearch,
  onSelectSuggestion,
  onOpenCustomRequest,
}: ShopEmptyStateProps) {
  const trimmedQuery = query.trim();

  const activeFilters: Array<{ label: string; value: string }> = [];
  if (categoryLabel) {
    activeFilters.push({
      label: tr('Категорія', 'Категория'),
      value: categoryLabel,
    });
  }
  if (activeEquipmentTypeLabel) {
    activeFilters.push({
      label: tr('Тип', 'Тип'),
      value: activeEquipmentTypeLabel,
    });
  }
  if (activeBrandLabel) {
    activeFilters.push({
      label: tr('Бренд', 'Бренд'),
      value: activeBrandLabel,
    });
  }
  if (activePowerLabel) {
    activeFilters.push({
      label: tr('Потужність', 'Мощность'),
      value: activePowerLabel,
    });
  }
  if (activePriceLabel) {
    activeFilters.push({
      label: tr('Ціна', 'Цена'),
      value: activePriceLabel,
    });
  }
  if (activeSkuLabel) {
    activeFilters.push({
      label: 'SKU',
      value: activeSkuLabel,
    });
  }
  if (inStockOnly) {
    activeFilters.push({
      label: tr('Наявність', 'Наличие'),
      value: tr('В наявності', 'В наличии'),
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="shop-empty-state"
      className="ec-glass-plate p-8 sm:p-12 text-center rounded-2xl max-w-2xl mx-auto"
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#e6f2fc] border border-sky-200 flex items-center justify-center shadow-xs">
        <SearchX className="w-7 h-7 text-[#0b66b2]" aria-hidden="true" />
      </div>

      <h3 className="text-base sm:text-lg font-extrabold text-[#07213e] mb-2">
        {trimmedQuery
          ? tr(
              `За запитом «${trimmedQuery}» нічого не знайдено`,
              `По запросу «${trimmedQuery}» ничего не найдено`,
            )
          : tr('У вибраній комбінації фільтрів товарів не знайдено', 'В выбранной комбинации фильтров товары не найдены')}
      </h3>

      <p className="text-xs sm:text-sm text-[#1c3d5e] font-medium leading-relaxed max-w-lg mx-auto mb-5">
        {tr(
          'Спробуйте скинути активні фільтри або ввести інший пошуковий запит — наприклад, модель інвертора, SKU (артикул), потужність у кВт чи назву бренду.',
          'Попробуйте сбросить активные фильтры или ввести другой поисковый запрос — например, модель инвертора, SKU (артикул), мощность в кВт или название бренда.',
        )}
      </p>

      {(activeFilters.length > 0 || trimmedQuery) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
          {trimmedQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-bold text-[#0b66b2]">
              <Search className="w-3 h-3 shrink-0" />
              <span>«{trimmedQuery}»</span>
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  aria-label={tr('Очистити пошук', 'Очистить поиск')}
                  className="ml-0.5 p-0.5 rounded hover:bg-sky-100 text-[#0b66b2] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}
          {activeFilters.map((item) => (
            <span
              key={`${item.label}-${item.value}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/85 border border-sky-200/80 text-[11px] font-semibold text-[#133659]"
            >
              <span className="text-[#1c3d5e]/75">{item.label}:</span>
              <span className="font-bold text-[#07213e]">{item.value}</span>
            </span>
          ))}
        </div>
      )}

      {onSelectSuggestion && (
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1c3d5e]/75 mb-2">
            {tr('Популярні запити:', 'Популярные запросы:')}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {SUGGESTED_TERMS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSelectSuggestion(term)}
                className="px-2.5 py-1 rounded-lg border border-sky-200 bg-white/85 hover:bg-[#e6f2fc] hover:border-[#0b66b2] text-xs font-bold text-[#07213e] transition-colors cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07213e]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{tr('Скинути всі фільтри', 'Сбросить все фильтры')}</span>
        </button>

        {onOpenCustomRequest && (
          <button
            type="button"
            onClick={onOpenCustomRequest}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-[#07213e] text-xs font-bold transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-[#0b66b2]" />
            <span>{tr('Підібрати з інженером за 15 хв', 'Подобрать с инженером за 15 мин')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
