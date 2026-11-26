import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Calculator, Check, Sun, X, Zap } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import {
  calculateSolarPayback,
  DEFAULT_BUSINESS_TARIFF_UAH,
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  ODESA_ANNUAL_YIELD_PER_KW,
  type PaybackSystemMode,
  type PaybackTariffType,
} from '../lib/calculators.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { track, trackEvent } from '../lib/analytics.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import { SmartImage } from './SmartImage.tsx';

export interface SolarSavingsCalculatorProps {
  products: Product[];
  usdUahRate: number | null;
  initialMonthlyKwh?: number;
  onSelectProduct?: (product: Product) => void;
  onNavigateCategory?: (cat: ProductCategory | 'all') => void;
  onOpenCustomRequest?: (topic: string, notes?: string) => void;
  onClose?: () => void;
}

const CONSUMPTION_PRESETS = [300, 600, 1000, 2500, 5000] as const;

export function SolarSavingsCalculator({
  products,
  usdUahRate,
  initialMonthlyKwh = 600,
  onSelectProduct,
  onNavigateCategory,
  onOpenCustomRequest,
  onClose,
}: SolarSavingsCalculatorProps) {
  const [monthlyKwhInput, setMonthlyKwhInput] = useState<string>(String(initialMonthlyKwh));
  const [tariffType, setTariffType] = useState<PaybackTariffType>('home');
  const [systemMode, setSystemMode] = useState<PaybackSystemMode>('hybrid');
  const [tariffUah, setTariffUah] = useState<number>(DEFAULT_RESIDENTIAL_TARIFF_UAH);
  const trackedRef = useRef(false);

  const isRussian = getActiveLocale() === 'ru';
  const parsedMonthlyKwh = Number(monthlyKwhInput);
  const effectiveMonthlyKwh =
    Number.isFinite(parsedMonthlyKwh) && parsedMonthlyKwh > 0 ? parsedMonthlyKwh : 600;

  const result = useMemo(
    () =>
      calculateSolarPayback({
        monthlyKwh: effectiveMonthlyKwh,
        tariffType,
        systemMode,
        tariffUah,
        usdUahRate,
        products,
      }),
    [effectiveMonthlyKwh, tariffType, systemMode, tariffUah, usdUahRate, products],
  );

  function recordInteraction(nextKwh: number, nextTariffType = tariffType) {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackEvent('calculator_used', {
      calculator_type: 'solar_savings',
      tariff_type: nextTariffType,
      monthly_kwh: nextKwh,
      recommended_kw: result.recommendedKw,
    });
  }

  function handleTariffTypeChange(nextType: PaybackTariffType) {
    setTariffType(nextType);
    setTariffUah(
      nextType === 'business' ? DEFAULT_BUSINESS_TARIFF_UAH : DEFAULT_RESIDENTIAL_TARIFF_UAH,
    );
    recordInteraction(result.safeMonthlyKwh, nextType);
  }

  function handleMonthlyChange(nextValue: number) {
    const clamped = Math.max(50, Math.min(50000, Math.round(nextValue)));
    setMonthlyKwhInput(String(clamped));
    recordInteraction(clamped);
  }

  const paybackYearsLabel = result.paybackYears
    ? `${result.paybackYears.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${tr('р.', 'г.')}`
    : '—';

  const paybackMonthsLabel = result.paybackMonths
    ? `~${result.paybackMonths} ${tr('міс.', 'мес.')}`
    : '—';

  return (
    <section
      id="solar-savings-calculator"
      aria-labelledby="solar-savings-calc-heading"
      className="ec-glass-plate rounded-2xl border border-sky-200/90 p-5 sm:p-7 mb-7 break-words hyphens-none"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 mb-6 border-b border-sky-200/80">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0b66b2] mb-1.5">
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span>{tr('Калькулятор окупності СЕС · PVGIS Одеса', 'Калькулятор окупаемости СЭС · PVGIS Одесса')}</span>
          </div>
          <h2
            id="solar-savings-calc-heading"
            className="text-xl sm:text-2xl font-extrabold text-[#07213e] leading-tight text-balance"
          >
            {tr(
              'Розрахуйте орієнтовний термін окупності сонячної станції',
              'Рассчитайте ориентировочный срок окупаемости солнечной станции',
            )}
          </h2>
          <p className="mt-1.5 text-sm text-[#1c3d5e] font-medium leading-relaxed">
            {tr(
              'Вкажіть ваше середньомісячне споживання електроенергії у кВт·год, щоб оцінити оптимальну потужність СЕС, річну економію та строк повернення інвестицій.',
              'Укажите ваше среднемесячное потребление электроэнергии в кВт·ч, чтобы оценить оптимальную мощность СЭС, годовую экономию и срок возврата инвестиций.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start shrink-0">
          <div
            role="group"
            aria-label={tr('Категорія споживача', 'Категория потребителя')}
            className="inline-flex p-1 bg-sky-100/80 border border-sky-200/80 rounded-xl"
          >
            <button
              type="button"
              onClick={() => handleTariffTypeChange('home')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
                tariffType === 'home'
                  ? 'bg-[#0b66b2] text-white shadow-xs'
                  : 'text-[#1c3d5e] hover:text-[#07213e]'
              }`}
            >
              {tr('Дім (4.32 ₴)', 'Дом (4.32 ₴)')}
            </button>
            <button
              type="button"
              onClick={() => handleTariffTypeChange('business')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2] ${
                tariffType === 'business'
                  ? 'bg-[#0b66b2] text-white shadow-xs'
                  : 'text-[#1c3d5e] hover:text-[#07213e]'
              }`}
            >
              {tr('Бізнес (9.60 ₴)', 'Бизнес (9.60 ₴)')}
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Згорнути калькулятор', 'Свернуть калькулятор')}
              title={tr('Згорнути калькулятор', 'Свернуть калькулятор')}
              className="w-10 h-10 rounded-xl border border-sky-200 bg-white/90 hover:bg-white text-[#1c3d5e] hover:text-[#07213e] flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Controls */}
        <div className="lg:col-span-5 bg-white/85 rounded-2xl border border-sky-200/80 p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-5">
            {/* Monthly Consumption Input */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label
                  htmlFor="solar-savings-kwh-input"
                  className="text-xs font-extrabold text-[#07213e]"
                >
                  {tr('Середнє споживання (кВт·год/міс.)', 'Среднее потребление (кВт·ч/мес.)')}
                </label>
                <span className="font-mono text-sm font-extrabold text-[#0b66b2] tabular-nums">
                  {result.safeMonthlyKwh.toLocaleString('uk-UA')} {tr('кВт·год', 'кВт·ч')}
                </span>
              </div>

              <div className="relative mb-3">
                <input
                  id="solar-savings-kwh-input"
                  name="monthlyKwh"
                  type="number"
                  min={50}
                  max={50000}
                  step={50}
                  inputMode="numeric"
                  value={monthlyKwhInput}
                  onChange={(e) => {
                    setMonthlyKwhInput(e.target.value);
                    const val = Number(e.target.value);
                    if (Number.isFinite(val) && val >= 50) {
                      recordInteraction(val);
                    }
                  }}
                  className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-sky-200 bg-white font-mono text-base font-bold text-[#07213e] tabular-nums focus:outline-none focus:border-[#0b66b2]"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#1c3d5e]/70">
                  {tr('кВт·год', 'кВт·ч')}
                </span>
              </div>

              <input
                type="range"
                aria-label={tr('Регулятор середнього споживання у кВт·год на місяць', 'Регулятор среднего потребления в кВт·ч в месяц')}
                min={100}
                max={6000}
                step={50}
                value={Math.min(6000, Math.max(100, result.safeMonthlyKwh))}
                onChange={(e) => handleMonthlyChange(Number(e.target.value))}
                className="w-full accent-[#0b66b2] cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 mt-3">
                {CONSUMPTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMonthlyChange(preset)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                      result.safeMonthlyKwh === preset
                        ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#0b66b2]'
                        : 'bg-white border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                    }`}
                  >
                    {preset.toLocaleString('uk-UA')}
                  </button>
                ))}
              </div>
            </div>

            {/* Station Mode */}
            <div>
              <span className="block text-xs font-extrabold text-[#07213e] mb-2">
                {tr('Архітектура системи', 'Архитектура системы')}
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSystemMode('hybrid');
                    recordInteraction(result.safeMonthlyKwh);
                  }}
                  className={`px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    systemMode === 'hybrid'
                      ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                      : 'bg-white border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap">
                    {tr('Гібридна з АКБ', 'Гибридная с АКБ')}
                  </div>
                  <div className="text-[11px] font-medium text-[#1c3d5e]/80 mt-0.5">
                    {tr('Резерв + вечір', 'Резерв + вечер')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSystemMode('ongrid');
                    recordInteraction(result.safeMonthlyKwh);
                  }}
                  className={`px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    systemMode === 'ongrid'
                      ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                      : 'bg-white border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap">
                    {tr('Мережева (без АКБ)', 'Сетевая (без АКБ)')}
                  </div>
                  <div className="text-[11px] font-medium text-[#1c3d5e]/80 mt-0.5">
                    {tr('Швидша окупність', 'Быстрее окупаемость')}
                  </div>
                </button>
              </div>
            </div>

            {/* Tariff Input */}
            <div>
              <label
                htmlFor="solar-savings-tariff-input"
                className="block text-xs font-extrabold text-[#07213e] mb-1.5"
              >
                {tr('Тариф на електроенергію (грн/кВт·год)', 'Тариф на электроэнергию (грн/кВт·ч)')}
              </label>
              <input
                id="solar-savings-tariff-input"
                name="tariffUah"
                type="number"
                min={1}
                max={30}
                step={0.1}
                value={tariffUah}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTariffUah(Number.isFinite(val) ? val : 0);
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-sky-200 bg-white font-mono text-sm font-bold text-[#07213e] tabular-nums focus:outline-none focus:border-[#0b66b2]"
              />
            </div>
          </div>

          <p className="text-xs text-[#1c3d5e] font-medium leading-relaxed pt-3 border-t border-sky-100">
            {tr(
              `Розрахунок за PVGIS для Одеси (${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·год/рік з 1 кВт), пряме заміщення ${result.directSelfPct}% та залік надлишків за Net Billing.`,
              `Расчёт по PVGIS для Одессы (${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·ч/год с 1 кВт), прямое замещение ${result.directSelfPct}% и зачёт излишков по Net Billing.`,
            )}
          </p>
        </div>

        {/* Right: Results & Recommended System */}
        <div className="lg:col-span-7 ec-glass-sapphire text-white rounded-2xl p-5 sm:p-7 flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#fbbf24]">
                <Sun className="w-4 h-4 shrink-0" />
                <span>{tr('Результат прогнозу окупності', 'Результат прогноза окупаемости')}</span>
              </div>
              <span className="text-xs text-sky-100/90 font-medium tabular-nums">
                {tr('Покриття рахунків:', 'Покрытие счетов:')}{' '}
                <strong className="font-mono text-white">{result.coveragePct}%</strong>
              </span>
            </div>

            {/* 4 Key KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-xs text-sky-100/85 mb-1">
                  {tr('Термін окупності', 'Срок окупаемости')}
                </div>
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-[#fbbf24] tabular-nums leading-tight">
                  {paybackYearsLabel}
                </div>
                <div className="font-mono text-xs text-sky-100/85 tabular-nums mt-0.5">
                  {paybackMonthsLabel}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-xs text-sky-100/85 mb-1">
                  {tr('Потужність СЕС', 'Мощность СЭС')}
                </div>
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-white tabular-nums leading-tight">
                  {result.recommendedKw} {tr('кВт', 'кВт')}
                </div>
                <div className="font-mono text-xs text-sky-100/85 tabular-nums mt-0.5">
                  ~{result.estimatedAnnualGenKwh.toLocaleString('uk-UA')} {tr('кВт·год/р.', 'кВт·ч/г.')}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-xs text-sky-100/85 mb-1">
                  {tr('Економія / місяць', 'Экономия / месяц')}
                </div>
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-300 tabular-nums leading-tight">
                  ~{result.monthlySavingsUah.toLocaleString('uk-UA')} ₴
                </div>
                <div className="text-xs text-sky-100/85 mt-0.5">
                  {tr('середня за рік', 'средняя за год')}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-xs text-sky-100/85 mb-1">
                  {tr('Вигода за рік', 'Выгода за год')}
                </div>
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-white tabular-nums leading-tight">
                  ~{result.annualSavingsUah.toLocaleString('uk-UA')} ₴
                </div>
                <div className="font-mono text-xs text-sky-100/85 tabular-nums mt-0.5">
                  {result.indicativeCapexUah
                    ? `${tr('Бюджет ~', 'Бюджет ~')}${result.indicativeCapexUah.toLocaleString('uk-UA')} ₴`
                    : `${result.capexPerKwUsd} $/кВт`}
                </div>
              </div>
            </div>

            {/* Matched Recommendations from Catalog */}
            {result.matchedProducts.length > 0 && (
              <div className="mt-5 pt-4 border-t border-sky-200/15">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-sky-100">
                    {tr('Підібрані позиції з каталогу під ваше споживання', 'Подобранные позиции из каталога под ваше потребление')}
                  </span>
                  {onNavigateCategory && (
                    <button
                      type="button"
                      onClick={() => onNavigateCategory(systemMode === 'hybrid' ? 'kits' : 'inverters')}
                      className="text-xs font-bold text-[#fbbf24] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      {systemMode === 'hybrid'
                        ? tr('Усі готові рішення', 'Все готовые решения')
                        : tr('Усі інвертори', 'Все инверторы')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {result.matchedProducts.slice(0, 2).map((item) => {
                    const itemTitle = isRussian
                      ? item.titleRu ?? localizeCatalogText(item.title)
                      : item.title;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectProduct?.(item)}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-sky-200/20 text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0">
                          <SmartImage
                            src={item.img}
                            alt={itemTitle}
                            className={`w-full h-full ${
                              item.isKit && item.id !== 'vysokovoltna-sistema-solax-x3-ies-p15b15'
                                ? 'object-cover'
                                : 'object-contain p-1'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white group-hover:text-[#fbbf24] line-clamp-2 leading-snug transition-colors">
                            {itemTitle}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-sky-100/90 font-mono tabular-nums">
                            <span>{formatUahFromUsd(item.price, usdUahRate)}</span>
                            <span aria-hidden="true">·</span>
                            <span>${item.price.toLocaleString('en-US')}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-sky-200/15">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sky-100/90">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span>{tr('Генерація:', 'Генерация:')} ~{result.effectiveOffsetKwh.toLocaleString('uk-UA')} {tr('кВт·год/рік', 'кВт·ч/год')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>{result.usedCatalogKitPrice ? tr('За ціною комплекту з каталогу', 'По цене комплекта из каталога') : tr('За ринковим бюджетом під ключ', 'По рыночному бюджету под ключ')}</span>
              </span>
            </div>

            {onOpenCustomRequest && (
              <button
                type="button"
                onClick={() => {
                  const notes = [
                    `Споживання: ${result.safeMonthlyKwh} кВт·год/міс.`,
                    `Режим: ${systemMode === 'hybrid' ? 'Гібридна СЕС з АКБ' : 'Мережева СЕС'}`,
                    `Тариф: ${result.safeTariffUah.toFixed(2)} грн/кВт·год (${tariffType === 'business' ? 'Бізнес' : 'Дім'})`,
                    `Рекомендована потужність: ${result.recommendedKw} кВт`,
                    `Орієнтовна окупність: ${paybackYearsLabel} (${paybackMonthsLabel})`,
                  ].join('\n');
                  track({ name: 'cta_click', placement: 'section', scenario: systemMode === 'hybrid' ? 'hybrid' : 'solar' });
                  onOpenCustomRequest(
                    `Розрахунок окупності СЕС ${result.recommendedKw} кВт (${result.safeMonthlyKwh} кВт·год/міс.)`,
                    notes,
                  );
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#07213e] hover:text-white text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]"
              >
                <span>{tr('Отримати точний кошторис', 'Получить точную смету')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
