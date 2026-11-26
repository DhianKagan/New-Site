import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, Check, X, Zap } from 'lucide-react';
import type { Product } from '../types.ts';
import {
  calculateProductPayback,
  DEFAULT_BUSINESS_TARIFF_UAH,
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  getDefaultConsumptionForProduct,
  ODESA_ANNUAL_YIELD_PER_KW,
  type PaybackTariffType,
  type ProductPaybackCapexBasis,
} from '../lib/calculators.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import { track, trackEvent } from '../lib/analytics.ts';
import { SmartImage } from './SmartImage.tsx';

interface ProductPaybackModalProps {
  product: Product | null;
  usdUahRate: number | null;
  onClose: () => void;
  onRequestQuote: (product: Product, calculationSummary: string, estimatedCapexUsd?: number) => void;
}

const CAPEX_BASIS_LABELS: Record<ProductPaybackCapexBasis, { uk: string; ru: string }> = {
  kit_price: {
    uk: 'за фактичною ціною цього готового сонячного комплекту під ключ',
    ru: 'по фактической цене этого готового солнечного комплекта под ключ',
  },
  kit_plus_panels: {
    uk: 'комплект резерву + орієнтовне поле сонячних панелей під потужність системи',
    ru: 'комплект резерва + ориентировочное поле солнечных панелей под мощность системы',
  },
  turnkey_station: {
    uk: 'орієнтовна вартість СЕС під ключ на базі цього інвертора',
    ru: 'ориентировочная стоимость СЭС под ключ на базе этого инвертора',
  },
  battery_station: {
    uk: 'орієнтовна вартість гібридної СЕС під ключ із цією АКБ',
    ru: 'ориентировочная стоимость гибридной СЭС под ключ с этой АКБ',
  },
  panel_array: {
    uk: 'орієнтовна вартість гібридної СЕС під ключ під ваше споживання',
    ru: 'ориентировочная стоимость гибридной СЭС под ключ под ваше потребление',
  },
};

export function ProductPaybackModal({
  product,
  usdUahRate,
  onClose,
  onRequestQuote,
}: ProductPaybackModalProps) {
  const isRussian = getActiveLocale() === 'ru';
  const productId = product?.id ?? null;

  const [monthlyKwh, setMonthlyKwh] = useState(500);
  const [tariffType, setTariffType] = useState<PaybackTariffType>('home');
  const [tariffUah, setTariffUah] = useState(DEFAULT_RESIDENTIAL_TARIFF_UAH);

  useEffect(() => {
    if (!product) return;
    const defaults = getDefaultConsumptionForProduct(product);
    setMonthlyKwh(defaults.monthlyKwh);
    setTariffType(defaults.tariffType);
    setTariffUah(defaults.tariffUah);
  }, [productId, product]);

  const result = useMemo(() => {
    if (!product) return null;
    return calculateProductPayback({
      product,
      monthlyKwh,
      tariffType,
      tariffUah,
      usdUahRate,
    });
  }, [product, monthlyKwh, tariffType, tariffUah, usdUahRate]);

  if (!product || !result) return null;

  const title = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
  const sliderMax = Math.max(3000, result.safeMonthlyKwh > 3000 ? 10000 : 3000);
  const basisLabel = CAPEX_BASIS_LABELS[result.capexBasis];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-payback-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-[#d97706] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="product-payback-modal-title"
                className="text-sm sm:text-base font-extrabold text-[#0d1f33] truncate"
              >
                {tr('Розрахунок окупності системи', 'Расчёт окупаемости системы')}
              </h2>
              <div className="text-[11px] text-slate-500 truncate">
                {product.brand} · SKU {product.sku}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Закрити', 'Закрыть')}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769aa]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Selected Product Strip */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#f8fafc] border border-slate-200">
            <SmartImage
              src={product.img}
              alt={title}
              className={`w-14 h-14 rounded-lg border border-slate-200 bg-white shrink-0 ${
                product.isKit ? 'object-cover' : 'object-contain p-1.5'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-[#0d1f33] line-clamp-2">{title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>
                  {tr('Потужність розрахунку:', 'Расчётная мощность:')}{' '}
                  <strong className="font-mono text-[#0d1f33]">{result.systemKw} кВт</strong>
                </span>
                {product.price > 0 && (
                  <span>
                    {tr('Ціна позиції:', 'Цена позиции:')}{' '}
                    <strong className="font-mono text-[#1769aa]">
                      {formatUahFromUsd(product.price, usdUahRate)}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Interactive Inputs */}
            <div className="md:col-span-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="modal-payback-kwh"
                    className="text-xs font-extrabold text-[#0d1f33]"
                  >
                    {tr('Середнє споживання (кВт·год/міс)', 'Среднее потребление (кВт·ч/мес)')}
                  </label>
                  <span className="font-mono text-xs font-extrabold text-[#1769aa] tabular-nums">
                    {result.safeMonthlyKwh.toLocaleString('uk-UA')} {tr('кВт·год', 'кВт·ч')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="modal-payback-kwh-range"
                    type="range"
                    min={100}
                    max={sliderMax}
                    step={50}
                    value={Math.min(sliderMax, result.safeMonthlyKwh)}
                    onChange={(e) => setMonthlyKwh(Number(e.target.value))}
                    aria-label={tr('Середнє споживання електроенергії слайдер', 'Слайдер среднего потребления')}
                    className="flex-1 accent-[#1769aa] cursor-pointer"
                  />
                  <input
                    id="modal-payback-kwh"
                    type="number"
                    min={50}
                    max={50000}
                    step={50}
                    value={monthlyKwh}
                    onChange={(e) => setMonthlyKwh(Number(e.target.value) || 0)}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-sm font-bold text-[#0d1f33] text-right focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div className="flex justify-between text-[10.5px] text-slate-400 font-mono mt-1">
                  <span>100</span>
                  <span>{Math.round(sliderMax / 2).toLocaleString('uk-UA')}</span>
                  <span>{sliderMax.toLocaleString('uk-UA')} {tr('кВт·год', 'кВт·ч')}</span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-extrabold text-[#0d1f33] mb-1.5">
                  {tr('Тип об’єкта та тариф', 'Тип объекта и тариф')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTariffType('home');
                      setTariffUah(DEFAULT_RESIDENTIAL_TARIFF_UAH);
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold text-left transition-colors cursor-pointer ${
                      tariffType === 'home'
                        ? 'bg-[#eff6fc] border-[#1769aa] text-[#0d1f33]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div>{tr('Дім / Квартира', 'Дом / Квартира')}</div>
                    <div className="text-[10.5px] font-mono text-slate-500">4.32 ₴</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTariffType('business');
                      setTariffUah(DEFAULT_BUSINESS_TARIFF_UAH);
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold text-left transition-colors cursor-pointer ${
                      tariffType === 'business'
                        ? 'bg-[#eff6fc] border-[#1769aa] text-[#0d1f33]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div>{tr('Бізнес (380 В)', 'Бизнес (380 В)')}</div>
                    <div className="text-[10.5px] font-mono text-slate-500">~9.60 ₴</div>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="modal-payback-tariff"
                  className="block text-xs font-extrabold text-[#0d1f33] mb-1.5"
                >
                  {tr('Тариф електроенергії (грн/кВт·год)', 'Тариф электроэнергии (грн/кВт·ч)')}
                </label>
                <input
                  id="modal-payback-tariff"
                  type="number"
                  min={1}
                  max={30}
                  step={0.1}
                  value={tariffUah}
                  onChange={(e) => setTariffUah(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm font-bold text-[#0d1f33] focus:outline-none focus:border-[#1769aa]"
                />
              </div>
            </div>

            {/* Live Calculation Output */}
            <div className="md:col-span-6 rounded-xl bg-[#0d1f33] text-white p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wide mb-3">
                  {tr('Орієнтовна окупність (Одеса PVGIS)', 'Ориентировочная окупаемость (Одесса PVGIS)')}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3">
                    <div className="text-[11px] text-slate-300 mb-1">
                      {tr('Термін окупності', 'Срок окупаемости')}
                    </div>
                    <div className="font-mono text-2xl font-extrabold text-sky-300 tabular-nums">
                      {result.paybackMonths ? `~${result.paybackMonths} ${tr('міс.', 'мес.')}` : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3">
                    <div className="text-[11px] text-slate-300 mb-1">
                      {tr('Економія / місяць', 'Экономия / месяц')}
                    </div>
                    <div className="font-mono text-xl font-extrabold text-emerald-300 tabular-nums">
                      ~{result.monthlySavingsUah.toLocaleString('uk-UA')} ₴
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3">
                    <div className="text-[11px] text-slate-300 mb-1">
                      {tr('Вигода за рік', 'Выгода за год')}
                    </div>
                    <div className="font-mono text-lg font-extrabold text-[#fbbf24] tabular-nums">
                      ~{result.annualSavingsUah.toLocaleString('uk-UA')} ₴
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3">
                    <div className="text-[11px] text-slate-300 mb-1">
                      {tr('База окупності', 'База окупаемости')}
                    </div>
                    <div className="font-mono text-lg font-extrabold text-white tabular-nums">
                      {result.indicativeCapexUah
                        ? `~${result.indicativeCapexUah.toLocaleString('uk-UA')} ₴`
                        : `~$${result.capexUsd.toLocaleString('en-US')}`}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                    <span>
                      {tr('Генерація:', 'Генерация:')}{' '}
                      <strong className="font-mono text-white">
                        ~{result.estimatedAnnualGenKwh.toLocaleString('uk-UA')} {tr('кВт·год/рік', 'кВт·ч/год')}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {tr('Покриття споживання:', 'Покрытие потребления:')}{' '}
                      <strong className="font-mono text-white">{result.coveragePct}%</strong>
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed pt-3 border-t border-white/10">
                {tr(
                  `Розраховано ${basisLabel.uk} (~${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·год/кВт·рік, власне споживання ${result.directSelfPct}% + Net Billing).`,
                  `Рассчитано ${basisLabel.ru} (~${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·ч/кВт·год, собственное потребление ${result.directSelfPct}% + Net Billing).`,
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
            >
              {tr('Закрити', 'Закрыть')}
            </button>

            <button
              type="button"
              onClick={() => {
                const summary = [
                  `${tr('Товар', 'Товар')}: ${title} (SKU ${product.sku})`,
                  `${tr('Споживання', 'Потребление')}: ${result.safeMonthlyKwh} ${tr('кВт·год/міс', 'кВт·ч/мес')}`,
                  `${tr('Тариф', 'Тариф')}: ${result.safeTariffUah} грн/кВт·год (${tariffType === 'business' ? tr('Бізнес 380 В', 'Бизнес 380 В') : tr('Дім / Квартира', 'Дом / Квартира')})`,
                  `${tr('Орієнтовна економія', 'Ориентировочная экономия')}: ~${result.annualSavingsUah.toLocaleString('uk-UA')} грн/рік${result.paybackMonths ? ` · ${tr('окупність', 'окупаемость')} ~${result.paybackMonths} ${tr('міс.', 'мес.')}` : ''}`,
                ].join('\n');

                track({ name: 'cta_click', placement: 'section', scenario: 'solar' });
                trackEvent('calculator_used', {
                  tariff_type: tariffType,
                  monthly_kwh: result.safeMonthlyKwh,
                  recommended_kw: result.systemKw,
                  submitted: true,
                });

                onClose();
                onRequestQuote(product, summary, result.capexUsd);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
            >
              {tr('Отримати точний кошторис', 'Получить точную смету')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
