import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BatteryCharging, Check, Clock, ShieldCheck, Zap } from 'lucide-react';
import type { Product, ProductCategory } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';
import { track, trackEvent } from '../lib/analytics.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import {
  BATTERY_SIZING_DAILY_PRESETS,
  BATTERY_SIZING_DURATION_PRESETS,
  calculateBatterySizing,
} from '../lib/calculators.ts';
import { tr } from '../lib/i18n.ts';

interface BatterySizingCalculatorProps {
  products: Product[];
  usdUahRate: number | null;
  wishlistIds?: string[];
  compareIds?: string[];
  onNavigateShop: (cat?: ProductCategory | 'all') => void;
  onSelectProduct: (product: Product) => void;
  onQuickViewProduct?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onToggleCompare?: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onCalculatePayback?: (product: Product) => void;
  onOpenLeadModal: (
    topic: string,
    estimatedTotalUsd?: number,
    placement?: 'hero' | 'sticky' | 'section' | 'footer',
    initialNotes?: string,
  ) => void;
  compactHeader?: boolean;
  embedded?: boolean;
  criticalSharePct?: 65 | 100;
  onCriticalShareChange?: (value: 65 | 100) => void;
}

export function BatterySizingCalculator({
  products,
  usdUahRate,
  wishlistIds = [],
  compareIds = [],
  onNavigateShop,
  onSelectProduct,
  onQuickViewProduct,
  onToggleWishlist,
  onToggleCompare,
  onAddToCart,
  onCalculatePayback,
  onOpenLeadModal,
  compactHeader = false,
  embedded = false,
  criticalSharePct: controlledCriticalSharePct,
  onCriticalShareChange,
}: BatterySizingCalculatorProps) {
  const [dailyKwh, setDailyKwh] = useState(15);
  const [backupHours, setBackupHours] = useState(12);
  const [internalCriticalSharePct, setInternalCriticalSharePct] = useState<65 | 100>(100);
  const criticalSharePct = controlledCriticalSharePct ?? internalCriticalSharePct;
  const setCriticalSharePct = onCriticalShareChange ?? setInternalCriticalSharePct;
  const trackedRef = useRef(false);

  const sizing = useMemo(
    () =>
      calculateBatterySizing({
        dailyKwh,
        backupHours,
        criticalLoadSharePct: criticalSharePct,
        usdUahRate,
        products,
      }),
    [dailyKwh, backupHours, criticalSharePct, usdUahRate, products],
  );

  function trackInteraction(nextDaily: number, nextHours: number) {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackEvent('calculator_used', {
      calculator_type: 'battery_sizing',
      daily_kwh: nextDaily,
      backup_hours: nextHours,
      recommended_kwh: sizing.recommendedCapacityKwh,
    });
  }

  const gridClass =
    sizing.matchedOptions.length === 1
      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
      : sizing.matchedOptions.length === 2
        ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
        : 'grid grid-cols-1 md:grid-cols-3 gap-6';

  const primaryOption = sizing.matchedOptions[0] ?? null;

  return (
    <div id={embedded ? undefined : 'battery-sizing-calculator'} className="break-words hyphens-none">
      {/* Header Plate (rendered standalone; HomeView provides a unified switcher header when embedded) */}
      {!embedded && (
        <div
          className={`ec-glass-plate rounded-2xl p-4 sm:p-6 lg:p-7 mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5 ${
            compactHeader ? 'mb-5' : ''
          }`}
        >
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>{tr('Підбір накопичувача LiFePO4', 'Подбор накопителя LiFePO4')}</span>
            </div>
            <h2 className="text-[clamp(1.2rem,4.5vw,1.875rem)] font-extrabold text-[#07213e] leading-tight mb-2">
              {tr('Калькулятор ємності акумуляторів', 'Калькулятор ёмкости аккумуляторов')}
            </h2>
            <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed">
              {tr(
                'Оберіть добове споживання та бажаний час резервного живлення, щоб розрахувати необхідну ємність LiFePO4 батарей і орієнтовний бюджет з каталогу.',
                'Выберите суточное потребление и желаемое время резервного питания, чтобы рассчитать нужную ёмкость LiFePO4 батарей и ориентировочный бюджет из каталога.',
              )}
            </p>
          </div>

          <div className="inline-flex p-1 bg-sky-100/80 border border-sky-200/80 rounded-xl self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setCriticalSharePct(100)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                criticalSharePct === 100
                  ? 'bg-[#0b66b2] text-white shadow-sm'
                  : 'text-[#1c3d5e] hover:text-[#07213e]'
              }`}
            >
              {tr('Весь обʼєкт (100%)', 'Весь объект (100%)')}
            </button>
            <button
              type="button"
              onClick={() => setCriticalSharePct(65)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                criticalSharePct === 65
                  ? 'bg-[#0b66b2] text-white shadow-sm'
                  : 'text-[#1c3d5e] hover:text-[#07213e]'
              }`}
            >
              {tr('Критична група (65%)', 'Критическая группа (65%)')}
            </button>
          </div>
        </div>
      )}

      {/* Main Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
        {/* Inputs */}
        <div className="lg:col-span-5 ec-glass-card rounded-2xl p-5 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-5">
            {/* Daily Energy Consumption */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label htmlFor="battery-daily-kwh" className="text-xs font-extrabold text-[#07213e]">
                  {tr('Добове споживання (кВт·год/день)', 'Суточное потребление (кВт·ч/день)')}
                </label>
                <span className="font-mono text-sm font-extrabold text-[#0b66b2] tabular-nums">
                  {sizing.safeDailyKwh.toLocaleString('uk-UA')} {tr('кВт·год', 'кВт·ч')}
                </span>
              </div>
              <input
                id="battery-daily-kwh"
                name="dailyKwh"
                type="number"
                min={1}
                max={500}
                step={1}
                value={dailyKwh}
                onChange={(e) => {
                  const next = Number(e.target.value) || 1;
                  setDailyKwh(next);
                  trackInteraction(next, backupHours);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sky-200 bg-white/85 font-mono text-base font-bold text-[#07213e] focus:outline-none focus:border-[#0b66b2] mb-3"
              />
              <input
                type="range"
                aria-label={tr('Регулятор добового споживання у кВт·год', 'Регулятор суточного потребления в кВт·ч')}
                min={2}
                max={80}
                step={1}
                value={Math.min(80, Math.max(2, sizing.safeDailyKwh))}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setDailyKwh(next);
                  trackInteraction(next, backupHours);
                }}
                className="w-full accent-[#0b66b2] cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {BATTERY_SIZING_DAILY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDailyKwh(preset);
                      trackInteraction(preset, backupHours);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                      sizing.safeDailyKwh === preset
                        ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#0b66b2]'
                        : 'bg-white/75 border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                    }`}
                  >
                    {preset} {tr('кВт·год', 'кВт·ч')}
                  </button>
                ))}
              </div>
            </div>

            {/* Backup Duration */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label htmlFor="battery-backup-hours" className="text-xs font-extrabold text-[#07213e] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0b66b2]" />
                  <span>{tr('Бажаний час резерву (годин)', 'Желаемое время резерва (часов)')}</span>
                </label>
                <span className="font-mono text-sm font-extrabold text-[#0b66b2] tabular-nums">
                  {sizing.safeBackupHours} {tr('год', 'ч')}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {BATTERY_SIZING_DURATION_PRESETS.map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => {
                      setBackupHours(hrs);
                      trackInteraction(dailyKwh, hrs);
                    }}
                    className={`py-2 px-1.5 rounded-xl border text-xs font-mono font-bold text-center transition-colors cursor-pointer ${
                      sizing.safeBackupHours === hrs
                        ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#0b66b2] shadow-xs'
                        : 'bg-white/75 border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                    }`}
                  >
                    {hrs} {tr('год', 'ч')}
                  </button>
                ))}
              </div>
              <input
                id="battery-backup-hours"
                name="backupHours"
                type="number"
                min={1}
                max={72}
                step={1}
                value={backupHours}
                onChange={(e) => {
                  const next = Number(e.target.value) || 1;
                  setBackupHours(next);
                  trackInteraction(dailyKwh, next);
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-sky-200 bg-white/85 font-mono text-sm font-bold text-[#07213e] focus:outline-none focus:border-[#0b66b2] mb-2.5"
              />
              <input
                type="range"
                aria-label={tr('Регулятор тривалості резерву у годинах', 'Регулятор длительности резерва в часах')}
                min={2}
                max={48}
                step={1}
                value={Math.min(48, Math.max(2, sizing.safeBackupHours))}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setBackupHours(next);
                  trackInteraction(dailyKwh, next);
                }}
                className="w-full accent-[#0b66b2] cursor-pointer"
              />
            </div>
          </div>

          <p className="text-[11px] text-[#1c3d5e] font-medium leading-relaxed pt-3 border-t border-sky-200/75">
            {tr(
              `Інженерний розрахунок LiFePO4: глибина розряду ${sizing.dodPct}% (DoD) × ККД інвертора ${sizing.inverterEfficiencyPct}% = 84.6% корисної ємності, ресурс ${sizing.cyclesRated.toLocaleString('uk-UA')}+ циклів.`,
              `Инженерный расчёт LiFePO4: глубина разряда ${sizing.dodPct}% (DoD) × КПД инвертора ${sizing.inverterEfficiencyPct}% = 84.6% полезной ёмкости, ресурс ${sizing.cyclesRated.toLocaleString('uk-UA')}+ циклов.`,
            )}
          </p>
        </div>

        {/* Outputs */}
        <div className="lg:col-span-7 ec-glass-sapphire text-white rounded-2xl p-5 sm:p-7 flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-[#fbbf24] uppercase tracking-wider">
                {tr('Рекомендований LiFePO4 накопичувач', 'Рекомендуемый LiFePO4 накопитель')}
              </span>
              <span className="text-[11px] font-semibold text-sky-200/90">
                {tr('Потреба за резервом:', 'Потребность на резерв:')}{' '}
                <strong className="font-mono text-white">
                  {sizing.usableEnergyNeededKwh} {tr('кВт·год', 'кВт·ч')}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3">
              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-[11px] text-sky-100/85 mb-1">
                  {tr('Ємність АКБ (ном.)', 'Ёмкость АКБ (ном.)')}
                </div>
                <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                  {sizing.recommendedCapacityKwh} {tr('кВт·год', 'кВт·ч')}
                </div>
                {sizing.primaryBattery && sizing.actualBankKwh !== sizing.recommendedCapacityKwh && (
                  <div className="text-[10px] text-sky-200/85 mt-1 font-mono">
                    {tr('банк:', 'банк:')} {sizing.actualBankKwh} {tr('кВт·год', 'кВт·ч')}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-[11px] text-sky-100/85 mb-1">
                  {tr('Корисна енергія', 'Полезная энергия')}
                </div>
                <div className="font-mono text-xl font-extrabold text-emerald-300 tabular-nums">
                  {sizing.usableCapacityKwh} {tr('кВт·год', 'кВт·ч')}
                </div>
                <div className="text-[10px] text-sky-200/85 mt-1">
                  {tr('при 90% DoD', 'при 90% DoD')}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-[11px] text-sky-100/85 mb-1">
                  {tr('Модулі в збірці', 'Модули в сборке')}
                </div>
                <div className="font-mono text-xl font-extrabold text-sky-200 tabular-nums">
                  {sizing.recommendedModules}{' '}
                  <span className="text-sm font-bold">
                    × {primaryOption ? primaryOption.moduleKwh : 5} {tr('кВт·год', 'кВт·ч')}
                  </span>
                </div>
                <div className="text-[10px] text-sky-200/85 mt-1 truncate">
                  {sizing.primaryBattery ? sizing.primaryBattery.brand : 'LiFePO4 48V'}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                <div className="text-[11px] text-sky-100/85 mb-1">
                  {tr('Орієнт. вартість', 'Ориент. стоимость')}
                </div>
                <div className="font-mono text-lg sm:text-xl font-extrabold text-[#fbbf24] tabular-nums leading-tight">
                  ~{formatUahFromUsd(sizing.estimatedCostUsd, usdUahRate)}
                </div>
                <div className="text-[10px] text-sky-200/85 mt-1 font-mono">
                  ~${sizing.estimatedCostUsd.toLocaleString('uk-UA')}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sky-100">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
                {tr('Середнє навантаження:', 'Средняя нагрузка:')}{' '}
                <strong className="font-mono text-white">~{sizing.averageLoadKw} {tr('кВт', 'кВт')}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                {tr('Ресурс:', 'Ресурс:')}{' '}
                <strong className="font-mono text-white">{sizing.cyclesRated.toLocaleString('uk-UA')}+ {tr('циклів', 'циклов')}</strong>
              </span>
              {sizing.primaryBattery && (
                <span className="inline-flex items-center gap-1.5 text-sky-100/90">
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  {tr('База розрахунку:', 'База расчёта:')}{' '}
                  <strong className="text-white">{sizing.primaryBattery.brand}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-sky-200/15">
            <span className="text-xs text-sky-100/85 max-w-md">
              {tr(
                'Перевіримо сумісність із вашим інвертором (LV 48 В або HV), кабелі та захист DC і зафіксуємо вартість зі складу в Одесі.',
                'Проверим совместимость с вашим инвертором (LV 48 В или HV), кабели и защиту DC и зафиксируем цену со склада в Одессе.',
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                const summaryNote = [
                  `${tr('Добове споживання', 'Суточное потребление')}: ${sizing.safeDailyKwh} ${tr('кВт·год/день', 'кВт·ч/день')} (${sizing.safeCriticalSharePct}% ${tr('навантаження', 'нагрузки')})`,
                  `${tr('Час резерву', 'Время резерва')}: ${sizing.safeBackupHours} ${tr('год', 'ч')}`,
                  `${tr('Рекомендована ємність LiFePO4', 'Рекомендованная ёмкость LiFePO4')}: ${sizing.recommendedCapacityKwh} ${tr('кВт·год', 'кВт·ч')} (${tr('корисна', 'полезная')}: ${sizing.usableCapacityKwh} ${tr('кВт·год', 'кВт·ч')})`,
                  sizing.primaryBattery
                    ? `${tr('Підібрані модулі', 'Подобранные модули')}: ${sizing.recommendedModules} × ${sizing.primaryBattery.title} (${formatUahFromUsd(sizing.estimatedCostUsd, usdUahRate)})`
                    : `${tr('Орієнтовна вартість АКБ', 'Ориентировочная стоимость АКБ')}: ${formatUahFromUsd(sizing.estimatedCostUsd, usdUahRate)}`,
                ].join('\n');

                track({ name: 'cta_click', placement: 'section', scenario: 'backup' });
                trackEvent('calculator_used', {
                  calculator_type: 'battery_sizing',
                  daily_kwh: sizing.safeDailyKwh,
                  backup_hours: sizing.safeBackupHours,
                  recommended_kwh: sizing.recommendedCapacityKwh,
                  submitted: true,
                });
                onOpenLeadModal(
                  `Підбір АКБ LiFePO4: ${sizing.recommendedCapacityKwh} кВт·год (${sizing.safeDailyKwh} кВт·год/день, ${sizing.safeBackupHours} год резерву)`,
                  sizing.estimatedCostUsd,
                  'section',
                  summaryNote,
                );
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07213e] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
            >
              {tr('Замовити підбір АКБ', 'Заказать подбор АКБ')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Matched Catalog LiFePO4 Batteries */}
      {sizing.matchedOptions.length > 0 && (
        <div>
          <div className="ec-glass-plate rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-[#07213e]">
              {tr('Рекомендовані LiFePO4 акумулятори з каталогу під', 'Рекомендуемые LiFePO4 аккумуляторы из каталога под')}{' '}
              <span className="text-[#0b66b2]">
                {sizing.recommendedCapacityKwh} {tr('кВт·год', 'кВт·ч')}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateShop('batteries')}
              className="text-xs font-extrabold text-[#0b66b2] hover:underline cursor-pointer"
            >
              {tr('Усі акумулятори в каталозі →', 'Все аккумуляторы в каталоге →')}
            </button>
          </div>

          <div className={gridClass}>
            {sizing.matchedOptions.map((opt) => (
              <div key={`bat-calc-${opt.product.id}`} className="flex flex-col gap-2">
                <div className="ec-glass-plate rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#07213e]">
                    {opt.modulesCount} × {opt.moduleKwh} {tr('кВт·год', 'кВт·ч')} ={' '}
                    <span className="text-[#0b66b2] font-mono font-extrabold">
                      {opt.totalBankKwh} {tr('кВт·год', 'кВт·ч')}
                    </span>
                  </span>
                  <span className="font-mono font-extrabold text-[#07213e] tabular-nums">
                    ~{formatUahFromUsd(opt.totalPriceUsd, usdUahRate)}
                  </span>
                </div>
                <ProductCard
                  usdUahRate={usdUahRate}
                  product={opt.product}
                  onSelect={onSelectProduct}
                  onQuickView={onQuickViewProduct}
                  isWishlisted={wishlistIds.includes(opt.product.id)}
                  onToggleWishlist={onToggleWishlist}
                  isCompared={compareIds.includes(opt.product.id)}
                  onToggleCompare={onToggleCompare}
                  onAddToCart={onAddToCart}
                  onCalculatePayback={onCalculatePayback}
                  onRequestQuote={(p) =>
                    onOpenLeadModal(
                      `Розрахунок АКБ (${opt.modulesCount} × ${opt.moduleKwh} кВт·год): ${p.title}`,
                      opt.totalPriceUsd,
                      'section',
                      `${tr('Споживання', 'Потребление')}: ${sizing.safeDailyKwh} ${tr('кВт·год/день', 'кВт·ч/день')} · ${tr('Резерв', 'Резерв')}: ${sizing.safeBackupHours} ${tr('год', 'ч')}`,
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
