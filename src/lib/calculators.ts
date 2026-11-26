import type { Product } from '../types.ts';

/**
 * PVGIS-5 (SARAH) benchmark for Odesa & Odesa Oblast (46.48 N, 30.73 E):
 * optimal 32-36 deg south tilt, ~14% system losses -> 1,200-1,260 kWh/kWp/year.
 */
export const ODESA_ANNUAL_YIELD_PER_KW = 1230;

export const ODESA_SEASONAL_YIELD_PER_KW = {
  summer: 5.1,
  spring_autumn: 3.7,
  winter: 1.5,
} as const;

export const DEFAULT_RESIDENTIAL_TARIFF_UAH = 4.32;
export const DEFAULT_BUSINESS_TARIFF_UAH = 9.6;

export const PAYBACK_POWER_TIERS = [5, 6, 8, 10, 12, 15, 20, 30, 50, 80, 110] as const;

export type PaybackTariffType = 'home' | 'business';
export type PaybackSystemMode = 'hybrid' | 'ongrid';
export type ConstructorSeasonMode = keyof typeof ODESA_SEASONAL_YIELD_PER_KW;
export type ConstructorPresetId = 'apartment' | 'house' | 'business' | 'factory';

export interface PaybackCalculatorInput {
  monthlyKwh: number;
  tariffType: PaybackTariffType;
  systemMode: PaybackSystemMode;
  tariffUah: number;
  usdUahRate: number | null;
  products: Product[];
}

export interface PaybackCalculatorResult {
  safeMonthlyKwh: number;
  safeTariffUah: number;
  annualConsumptionKwh: number;
  recommendedKw: number;
  estimatedAnnualGenKwh: number;
  directConsumedKwh: number;
  effectiveOffsetKwh: number;
  annualSavingsUah: number;
  monthlySavingsUah: number;
  coveragePct: number;
  directSelfPct: number;
  matchedProducts: Product[];
  primaryKit: Product | null;
  usedCatalogKitPrice: boolean;
  capexPerKwUsd: number;
  indicativeCapexUah: number | null;
  paybackYears: number | null;
  paybackMonths: number | null;
}

export function extractProductPowerKw(p: Product): number | null {
  const haystack = `${p.title} ${p.specs.map(([, v]) => v).join(' ')}`;
  const match = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:квт|kw)(?![\s*·]*год)/i);
  if (!match) return null;
  const val = Number(match[1].replace(',', '.'));
  return Number.isFinite(val) ? val : null;
}

export function isFullSolarKit(p: Product): boolean {
  if (!(p.isKit || p.cat === 'kits')) return false;
  const text = `${p.id} ${p.title} ${p.description}`.toLowerCase();
  const hasPanels = text.includes('trina') || text.includes('bifacial') || text.includes('панел') || /\+\s*\d+x/.test(text);
  const isSolarBrandOrName = text.includes('сес') || text.includes('соняч');
  return hasPanels && isSolarBrandOrName;
}

export function isOnGridInverter(p: Product): boolean {
  if (p.cat !== 'inverters') return false;
  const text = `${p.id} ${p.title} ${p.description}`.toLowerCase();
  return text.includes('мережев') || text.includes('sun2000') || text.includes('x3-pro') || text.includes('s5-gr') || text.includes('s6-gc') || text.includes('x3-fth') || /-\d+k-g\d*/.test(text);
}

export function isHybridInverter(p: Product): boolean {
  if (p.cat !== 'inverters') return false;
  const text = `${p.id} ${p.title} ${p.description}`.toLowerCase();
  return text.includes('гібрид') || text.includes('гибрид') || text.includes('hybrid') || /sg\d+[lh]p|x1-hyb|x1-lite|x3-neo|x3-ult|x3-aelio|h1-hybrid|h3-hybrid/.test(text);
}

export function getTurnkeyCapexPerKwUsd(recommendedKw: number, systemMode: PaybackSystemMode): number {
  if (systemMode === 'ongrid') {
    if (recommendedKw <= 10) return 620;
    if (recommendedKw <= 29) return 560;
    if (recommendedKw <= 79) return 510;
    return 460;
  }
  if (recommendedKw <= 15) return 860;
  if (recommendedKw <= 49) return 780;
  return 720;
}

export function computeEffectiveAnnualSolarOffset(params: {
  annualConsumptionKwh: number;
  annualGenKwh: number;
  hasBattery: boolean;
  isBusiness: boolean;
}): {
  directSelfRatio: number;
  directConsumedKwh: number;
  effectiveOffsetKwh: number;
} {
  const { annualConsumptionKwh, annualGenKwh, hasBattery, isBusiness } = params;
  const directSelfRatio = isBusiness
    ? hasBattery
      ? 0.88
      : 0.72
    : hasBattery
      ? 0.78
      : 0.38;

  // Net Billing virtual balance value vs full retail tariff (midday RDV vs retail + DTEK distribution)
  const netBillingValueRatio = isBusiness ? 0.50 : 0.62;

  const baseLoad = Math.min(annualConsumptionKwh, annualGenKwh);
  const directConsumedKwh = baseLoad * directSelfRatio;
  const exportedSurplusKwh = Math.max(0, annualGenKwh - directConsumedKwh);
  const remainingBillKwh = Math.max(0, annualConsumptionKwh - directConsumedKwh);
  const creditedEquivalentKwh = Math.min(remainingBillKwh, exportedSurplusKwh * netBillingValueRatio);

  return {
    directSelfRatio,
    directConsumedKwh,
    effectiveOffsetKwh: Math.round(directConsumedKwh + creditedEquivalentKwh),
  };
}

export function calculateSolarPayback(input: PaybackCalculatorInput): PaybackCalculatorResult {
  const safeMonthlyKwh = Number.isFinite(input.monthlyKwh)
    ? Math.max(50, Math.min(50000, input.monthlyKwh))
    : 600;
  const safeTariffUah = Number.isFinite(input.tariffUah)
    ? Math.max(1, Math.min(30, input.tariffUah))
    : DEFAULT_RESIDENTIAL_TARIFF_UAH;

  const annualConsumptionKwh = safeMonthlyKwh * 12;
  const rawRequiredKw = annualConsumptionKwh / ODESA_ANNUAL_YIELD_PER_KW;
  const recommendedKw = PAYBACK_POWER_TIERS.reduce(
    (best, tier) => (Math.abs(tier - rawRequiredKw) < Math.abs(best - rawRequiredKw) ? tier : best),
    PAYBACK_POWER_TIERS[0],
  );

  const estimatedAnnualGenKwh = Math.round(recommendedKw * ODESA_ANNUAL_YIELD_PER_KW);
  const isBusiness = input.tariffType === 'business';
  const hasBattery = input.systemMode === 'hybrid';

  const { directSelfRatio, directConsumedKwh, effectiveOffsetKwh } = computeEffectiveAnnualSolarOffset({
    annualConsumptionKwh,
    annualGenKwh: estimatedAnnualGenKwh,
    hasBattery,
    isBusiness,
  });

  const annualSavingsUah = Math.round(effectiveOffsetKwh * safeTariffUah);
  const monthlySavingsUah = Math.round(annualSavingsUah / 12);
  const coveragePct = Math.min(
    100,
    Math.round((effectiveOffsetKwh / Math.max(annualConsumptionKwh, 1)) * 100),
  );

  const matchedProducts = [...input.products]
    .filter(
      (p) =>
        p.price > 0 &&
        (isFullSolarKit(p) ||
          (hasBattery && (p.isKit || p.cat === 'kits') && recommendedKw >= 12) ||
          (recommendedKw >= 15 && p.cat === 'inverters')),
    )
    .sort((a, b) => {
      const aFullKit = isFullSolarKit(a) ? 1 : 0;
      const bFullKit = isFullSolarKit(b) ? 1 : 0;

      if (recommendedKw <= 15 && hasBattery) {
        if (aFullKit !== bFullKit) return bFullKit - aFullKit;
      } else {
        const aTargetMode =
          input.systemMode === 'ongrid'
            ? isOnGridInverter(a)
              ? 1
              : 0
            : aFullKit || isHybridInverter(a)
              ? 1
              : 0;
        const bTargetMode =
          input.systemMode === 'ongrid'
            ? isOnGridInverter(b)
              ? 1
              : 0
            : bFullKit || isHybridInverter(b)
              ? 1
              : 0;
        if (aTargetMode !== bTargetMode) return bTargetMode - aTargetMode;
      }

      const aKw = extractProductPowerKw(a) ?? recommendedKw * 2;
      const bKw = extractProductPowerKw(b) ?? recommendedKw * 2;
      const diff = Math.abs(aKw - recommendedKw) - Math.abs(bKw - recommendedKw);
      if (diff !== 0) return diff;
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return a.price - b.price;
    })
    .slice(0, 3);

  const primaryKit = matchedProducts[0] ?? null;
  const primaryKitKw = primaryKit ? extractProductPowerKw(primaryKit) : null;
  const usedCatalogKitPrice = Boolean(
    hasBattery &&
      primaryKit &&
      isFullSolarKit(primaryKit) &&
      primaryKit.price > 0 &&
      input.usdUahRate &&
      primaryKitKw &&
      primaryKitKw >= recommendedKw * 0.75 &&
      primaryKitKw <= recommendedKw * 1.35,
  );

  const capexPerKwUsd = getTurnkeyCapexPerKwUsd(recommendedKw, input.systemMode);
  const indicativeCapexUah = input.usdUahRate
    ? usedCatalogKitPrice && primaryKit
      ? Math.round(primaryKit.price * input.usdUahRate)
      : Math.round(recommendedKw * capexPerKwUsd * input.usdUahRate)
    : null;

  const paybackYears =
    indicativeCapexUah && annualSavingsUah > 0
      ? Number((indicativeCapexUah / annualSavingsUah).toFixed(1))
      : null;

  const paybackMonths =
    indicativeCapexUah && annualSavingsUah > 0
      ? Math.max(1, Math.round((indicativeCapexUah / annualSavingsUah) * 12))
      : null;

  return {
    safeMonthlyKwh,
    safeTariffUah,
    annualConsumptionKwh,
    recommendedKw,
    estimatedAnnualGenKwh,
    directConsumedKwh: Math.round(directConsumedKwh),
    effectiveOffsetKwh,
    annualSavingsUah,
    monthlySavingsUah,
    coveragePct,
    directSelfPct: Math.round(directSelfRatio * 100),
    matchedProducts,
    primaryKit,
    usedCatalogKitPrice,
    capexPerKwUsd,
    indicativeCapexUah,
    paybackYears,
    paybackMonths,
  };
}

export type ProductPaybackCapexBasis =
  | 'kit_price'
  | 'kit_plus_panels'
  | 'turnkey_station'
  | 'panel_array'
  | 'battery_station';

export interface ProductPaybackInput {
  product: Product;
  monthlyKwh: number;
  tariffType: PaybackTariffType;
  tariffUah: number;
  usdUahRate: number | null;
}

export interface ProductPaybackResult {
  safeMonthlyKwh: number;
  safeTariffUah: number;
  annualConsumptionKwh: number;
  systemKw: number;
  systemMode: PaybackSystemMode;
  estimatedAnnualGenKwh: number;
  directConsumedKwh: number;
  effectiveOffsetKwh: number;
  annualSavingsUah: number;
  monthlySavingsUah: number;
  coveragePct: number;
  directSelfPct: number;
  capexUsd: number;
  solarFieldAddonUsd: number;
  capexBasis: ProductPaybackCapexBasis;
  indicativeCapexUah: number | null;
  paybackYears: number | null;
  paybackMonths: number | null;
}

export function getDefaultConsumptionForProduct(product: Product): {
  monthlyKwh: number;
  tariffType: PaybackTariffType;
  tariffUah: number;
} {
  const kw = extractProductPowerKw(product);
  if (kw !== null && kw > 25) {
    return { monthlyKwh: 5000, tariffType: 'business', tariffUah: DEFAULT_BUSINESS_TARIFF_UAH };
  }
  if (kw !== null && kw > 12) {
    return { monthlyKwh: 2000, tariffType: 'business', tariffUah: DEFAULT_BUSINESS_TARIFF_UAH };
  }
  if (kw !== null && kw > 6) {
    return { monthlyKwh: 900, tariffType: 'home', tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH };
  }
  return { monthlyKwh: 500, tariffType: 'home', tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH };
}

export function calculateProductPayback(input: ProductPaybackInput): ProductPaybackResult {
  const { product } = input;
  const safeMonthlyKwh = Number.isFinite(input.monthlyKwh)
    ? Math.max(50, Math.min(50000, input.monthlyKwh))
    : 600;
  const safeTariffUah = Number.isFinite(input.tariffUah)
    ? Math.max(1, Math.min(30, input.tariffUah))
    : DEFAULT_RESIDENTIAL_TARIFF_UAH;

  const annualConsumptionKwh = safeMonthlyKwh * 12;
  const extractedKw = extractProductPowerKw(product);

  let systemKw = extractedKw ?? 6;
  let systemMode: PaybackSystemMode = 'hybrid';
  let capexUsd = 0;
  let solarFieldAddonUsd = 0;
  let capexBasis: ProductPaybackCapexBasis = 'turnkey_station';

  if (isFullSolarKit(product)) {
    systemKw = extractedKw ?? 6;
    systemMode = 'hybrid';
    capexUsd =
      product.price > 0
        ? product.price
        : Math.round(systemKw * getTurnkeyCapexPerKwUsd(systemKw, 'hybrid'));
    capexBasis = 'kit_price';
  } else if (product.isKit || product.cat === 'kits') {
    systemKw = extractedKw ?? 6;
    systemMode = 'hybrid';
    solarFieldAddonUsd = Math.round(systemKw * 260);
    capexUsd =
      product.price > 0
        ? product.price + solarFieldAddonUsd
        : Math.round(systemKw * getTurnkeyCapexPerKwUsd(systemKw, 'hybrid'));
    capexBasis = 'kit_plus_panels';
  } else if (product.cat === 'inverters') {
    systemKw = extractedKw ?? 8;
    systemMode = isOnGridInverter(product) ? 'ongrid' : 'hybrid';
    const turnkeyUsd = Math.round(systemKw * getTurnkeyCapexPerKwUsd(systemKw, systemMode));
    capexUsd = Math.max(turnkeyUsd, product.price > 0 ? product.price : 0);
    capexBasis = 'turnkey_station';
  } else if (product.cat === 'batteries') {
    const kwh = parseBatteryKwh(product);
    systemKw = kwh > 15 ? 15 : kwh > 7 ? 10 : 6;
    systemMode = 'hybrid';
    capexUsd = Math.round(systemKw * getTurnkeyCapexPerKwUsd(systemKw, 'hybrid'));
    capexBasis = 'battery_station';
  } else {
    const rawRequiredKw = annualConsumptionKwh / ODESA_ANNUAL_YIELD_PER_KW;
    systemKw = PAYBACK_POWER_TIERS.reduce(
      (best, tier) => (Math.abs(tier - rawRequiredKw) < Math.abs(best - rawRequiredKw) ? tier : best),
      PAYBACK_POWER_TIERS[0],
    );
    systemMode = 'hybrid';
    capexUsd = Math.round(systemKw * getTurnkeyCapexPerKwUsd(systemKw, 'hybrid'));
    capexBasis = 'panel_array';
  }

  const estimatedAnnualGenKwh = Math.round(systemKw * ODESA_ANNUAL_YIELD_PER_KW);
  const isBusiness = input.tariffType === 'business';
  const hasBattery = systemMode === 'hybrid';

  const { directSelfRatio, directConsumedKwh, effectiveOffsetKwh } = computeEffectiveAnnualSolarOffset({
    annualConsumptionKwh,
    annualGenKwh: estimatedAnnualGenKwh,
    hasBattery,
    isBusiness,
  });

  const annualSavingsUah = Math.round(effectiveOffsetKwh * safeTariffUah);
  const monthlySavingsUah = Math.round(annualSavingsUah / 12);
  const coveragePct = Math.min(
    100,
    Math.round((effectiveOffsetKwh / Math.max(annualConsumptionKwh, 1)) * 100),
  );

  const indicativeCapexUah =
    input.usdUahRate && Number.isFinite(input.usdUahRate)
      ? Math.round(capexUsd * input.usdUahRate)
      : null;

  const paybackYears =
    indicativeCapexUah && annualSavingsUah > 0
      ? Number((indicativeCapexUah / annualSavingsUah).toFixed(1))
      : null;

  const paybackMonths =
    indicativeCapexUah && annualSavingsUah > 0
      ? Math.max(1, Math.round((indicativeCapexUah / annualSavingsUah) * 12))
      : null;

  return {
    safeMonthlyKwh,
    safeTariffUah,
    annualConsumptionKwh,
    systemKw,
    systemMode,
    estimatedAnnualGenKwh,
    directConsumedKwh: Math.round(directConsumedKwh),
    effectiveOffsetKwh,
    annualSavingsUah,
    monthlySavingsUah,
    coveragePct,
    directSelfPct: Math.round(directSelfRatio * 100),
    capexUsd,
    solarFieldAddonUsd,
    capexBasis,
    indicativeCapexUah,
    paybackYears,
    paybackMonths,
  };
}

export interface ConstructorLoadItem {
  id: string;
  watts: number;
  surgeMult: number;
  qty: number;
  hoursPerDay: number;
  critical: boolean;
}

export interface ConstructorCalcInput {
  loads: ConstructorLoadItem[];
  simultaneity: number;
  autonomyHours: number;
  phases: 1 | 3;
  solarKw: number;
  season: ConstructorSeasonMode;
  tariffUah: number;
  preset: ConstructorPresetId;
  panelWatts?: number;
  panelAreaM2?: number;
}

export interface ConstructorCalcResult {
  activeCount: number;
  connectedKw: number;
  workingKw: number;
  peakSurgeKw: number;
  dailyConsumptionKwh: number;
  neededAutonomyKwh: number;
  recommendedBatteryKwh: number;
  recommendedInverterKw: number;
  dailySolarGenKwh: number;
  annualSolarGenKwh: number;
  panelsCount: number;
  roofAreaM2: number;
  monthlySavingsUah: number;
  coveragePct: number;
  hourlySim: Array<{ hour: number; pvKw: number; loadKw: number }>;
}

const RAW_SOLAR_CURVE = Array.from({ length: 24 }, (_, hour) =>
  hour >= 6 && hour <= 19 ? Math.sin(((hour - 6) / 13) * Math.PI) ** 1.4 : 0,
);
const SOLAR_CURVE_SUM = RAW_SOLAR_CURVE.reduce((s, v) => s + v, 0) || 1;

const RAW_LOAD_FACTORS = Array.from({ length: 24 }, (_, hour) => {
  if (hour >= 7 && hour <= 9) return 1.35;
  if (hour >= 18 && hour <= 22) return 1.55;
  if (hour >= 0 && hour <= 5) return 0.45;
  return 0.95;
});
const LOAD_FACTOR_SUM = RAW_LOAD_FACTORS.reduce((s, v) => s + v, 0) || 24;

export function parseInverterPhases(p: Product): 1 | 3 | null {
  const specPhase = p.specs.find(([k]) => /мережа|фаз/i.test(k))?.[1] ?? '';
  const text = `${specPhase} ${p.title} ${p.id}`;
  if (/1\s*фаз|однофаз|sg\d+lp1|x1-|og648|4024|6248/i.test(text)) return 1;
  if (/3\s*фаз|трифаз|трехфаз|sg\d+[lh]p3|x3-|gr3p|gc\d+k|ktl/i.test(text)) return 3;
  return null;
}

export function isHighVoltageBatteryOrInverter(p: Product): boolean {
  const text = `${p.title} ${p.specs.map(([k, v]) => `${k} ${v}`).join(' ')}`.toLowerCase();
  return text.includes('високовольт') || text.includes('high voltage') || text.includes('(hv)') || /\b(?:hp3|ult|h5\.8|h s3\.6|h s5\.1|tb-hr|bos-g)\b/i.test(text);
}

export function parsePanelWatts(p: Product): number {
  const specVal = p.specs.find(([k]) => /потужн|мощн/i.test(k))?.[1] ?? '';
  const m = `${specVal} ${p.title}`.match(/(\d{3})\s*(?:вт|wp|w)\b/i);
  if (m) return Number(m[1]);
  const modelMatch = p.title.match(/[- ](\d{3})(?:\s|$|\/|wp|lb|gd|ht)/i);
  if (modelMatch && Number(modelMatch[1]) >= 350 && Number(modelMatch[1]) <= 750) {
    return Number(modelMatch[1]);
  }
  return 585;
}

export function estimatePanelAreaM2(watts: number): number {
  if (watts <= 475) return 2.05;
  if (watts <= 550) return 2.35;
  if (watts <= 605) return 2.6;
  return 2.72;
}

export function parseBatteryKwh(p: Product): number {
  const specVal = p.specs.find(([k]) => /ємність|емкость/i.test(k))?.[1] ?? '';
  const m = `${specVal} ${p.title} ${p.sku}`.match(/(\d+(?:[.,]\d+)?)\s*(?:квт[*·\s]*год|kwh)/i);
  if (m) return Number(m[1].replace(',', '.'));
  const mAh = `${p.title}`.match(/(\d+(?:[.,]\d+)?)\s*v\D+(\d+)\s*ah/i);
  if (mAh) return Math.round((Number(mAh[1].replace(',', '.')) * Number(mAh[2])) / 100) / 10;
  return 5.12;
}

export function isBatteryModule(p: Product): boolean {
  if (p.cat !== 'batteries' || p.price <= 0) return false;
  const text = `${p.id} ${p.title}`.toLowerCase();
  if (/bms|pdu|блок\s*управл|блок\s*керув|база\s+для/.test(text)) return false;
  return parseBatteryKwh(p) >= 2.4;
}

export function calculateSolarConstructor(input: ConstructorCalcInput): ConstructorCalcResult {
  const active = input.loads.filter((l) => l.qty > 0);
  const connectedWatts = active.reduce((sum, l) => sum + l.watts * l.qty, 0);
  const workingKw = Math.round(((connectedWatts * input.simultaneity) / 1000) * 10) / 10;

  // Incremental locked-rotor surge above steady-state draw of the largest inductive appliance
  const maxIncrementalSurgeW = active.reduce(
    (max, l) => Math.max(max, l.watts * Math.max(0, l.surgeMult - 1)),
    0,
  );
  const maxSinglePeakW = active.reduce((max, l) => Math.max(max, l.watts * l.surgeMult), 0);
  const peakSurgeKw =
    Math.round((Math.max(connectedWatts * input.simultaneity + maxIncrementalSurgeW, maxSinglePeakW) / 1000) * 10) / 10;

  const dailyConsumptionKwh =
    Math.round(active.reduce((sum, l) => sum + (l.watts * l.qty * l.hoursPerDay) / 1000, 0) * 10) / 10;

  const criticalDailyKwh = active
    .filter((l) => l.critical)
    .reduce((sum, l) => sum + (l.watts * l.qty * l.hoursPerDay) / 1000, 0);

  // Critical loads run across active ~16h waking window + inverter self-consumption (~50W 1-ph / ~90W 3-ph)
  const inverterIdleKw = input.phases === 3 ? 0.09 : 0.05;
  const blackoutHourlyKwh = Math.max(
    criticalDailyKwh / 16 + inverterIdleKw,
    (dailyConsumptionKwh / 24) * 0.75 + inverterIdleKw,
  );
  const neededAutonomyKwh = Math.round(blackoutHourlyKwh * input.autonomyHours * 10) / 10;
  // LiFePO4 90% DoD × 94% inverter discharge efficiency = 0.846
  const recommendedBatteryKwh = Math.max(5, Math.ceil((neededAutonomyKwh / 0.846) / 2.5) * 2.5);

  const standardInvSizes =
    input.phases === 1 ? [3, 5, 6, 8, 10, 12] : [6, 8, 10, 12, 15, 20, 30, 50, 80, 100];
  const targetInvKw = Math.max(workingKw * 1.2, peakSurgeKw / 1.8, input.solarKw * 0.75);
  const recommendedInverterKw =
    standardInvSizes.find((s) => s >= targetInvKw) ?? Math.ceil(targetInvKw / 10) * 10;

  const seasonYieldPerKw = ODESA_SEASONAL_YIELD_PER_KW[input.season];
  const dailySolarGenKwh = Math.round(input.solarKw * seasonYieldPerKw * 10) / 10;
  const annualSolarGenKwh = Math.round(input.solarKw * ODESA_ANNUAL_YIELD_PER_KW);

  const panelW = input.panelWatts && input.panelWatts >= 350 ? input.panelWatts : 585;
  const panelArea = input.panelAreaM2 && input.panelAreaM2 > 1 ? input.panelAreaM2 : estimatePanelAreaM2(panelW);
  const panelsCount = input.solarKw > 0 ? Math.ceil((input.solarKw * 1000) / panelW) : 0;
  const roofAreaM2 = Math.round(panelsCount * panelArea);

  const isBusiness = input.preset === 'business' || input.preset === 'factory' || input.tariffUah >= 7;
  const { effectiveOffsetKwh } = computeEffectiveAnnualSolarOffset({
    annualConsumptionKwh: dailyConsumptionKwh * 365,
    annualGenKwh: annualSolarGenKwh,
    hasBattery: true,
    isBusiness,
  });

  const safeTariff = Number.isFinite(input.tariffUah) ? Math.max(1, Math.min(30, input.tariffUah)) : DEFAULT_RESIDENTIAL_TARIFF_UAH;
  const monthlySavingsUah = input.solarKw > 0 ? Math.round((effectiveOffsetKwh / 12) * safeTariff) : 0;

  // Daily seasonal solar coverage for the selected season (with battery buffer)
  const directSeasonalDaily = Math.min(dailyConsumptionKwh, dailySolarGenKwh * 0.94);
  const batteryBufferedDaily = Math.min(
    Math.max(0, dailyConsumptionKwh - directSeasonalDaily),
    Math.min(recommendedBatteryKwh * 0.85, Math.max(0, dailySolarGenKwh - directSeasonalDaily)),
  );
  const coveragePct =
    dailyConsumptionKwh > 0
      ? Math.min(100, Math.round(((directSeasonalDaily + batteryBufferedDaily) / dailyConsumptionKwh) * 100))
      : 0;

  const hourlySim = Array.from({ length: 24 }, (_, hour) => {
    const pvKw = input.solarKw > 0 ? (dailySolarGenKwh * RAW_SOLAR_CURVE[hour]) / SOLAR_CURVE_SUM : 0;
    const loadKw = (dailyConsumptionKwh * RAW_LOAD_FACTORS[hour]) / LOAD_FACTOR_SUM;
    return {
      hour,
      pvKw: Math.round(pvKw * 100) / 100,
      loadKw: Math.round(loadKw * 100) / 100,
    };
  });

  return {
    activeCount: active.length,
    connectedKw: Math.round((connectedWatts / 1000) * 10) / 10,
    workingKw,
    peakSurgeKw,
    dailyConsumptionKwh,
    neededAutonomyKwh,
    recommendedBatteryKwh,
    recommendedInverterKw,
    dailySolarGenKwh,
    annualSolarGenKwh,
    panelsCount,
    roofAreaM2,
    monthlySavingsUah,
    coveragePct,
    hourlySim,
  };
}

export function matchConstructorEquipment(params: {
  products: Product[];
  recommendedInverterKw: number;
  recommendedBatteryKwh: number;
  phases: 1 | 3;
  solarKw: number;
}): {
  inverter: Product | null;
  battery: Product | null;
  batteryUnits: number;
  panel: Product | null;
  panelWatts: number;
  panelAreaM2: number;
  panelsCount: number;
  roofAreaM2: number;
  estimatedEquipmentUsd: number;
} {
  const { products, recommendedInverterKw, recommendedBatteryKwh, phases, solarKw } = params;

  const inverters = products
    .filter((p) => p.cat === 'inverters' && p.price > 0)
    .map((p) => ({
      p,
      kw: extractProductPowerKw(p) ?? 0,
      phaseMatch: parseInverterPhases(p),
      hybrid: isHybridInverter(p),
    }))
    .filter((x) => x.kw >= Math.max(3, recommendedInverterKw * 0.8))
    .sort((a, b) => {
      const aPhaseOk = a.phaseMatch === phases ? 2 : a.phaseMatch === null ? 1 : 0;
      const bPhaseOk = b.phaseMatch === phases ? 2 : b.phaseMatch === null ? 1 : 0;
      if (aPhaseOk !== bPhaseOk) return bPhaseOk - aPhaseOk;
      if (a.hybrid !== b.hybrid) return a.hybrid ? -1 : 1;
      const diff = Math.abs(a.kw - recommendedInverterKw) - Math.abs(b.kw - recommendedInverterKw);
      if (diff !== 0) return diff;
      if (a.p.inStock !== b.p.inStock) return a.p.inStock ? -1 : 1;
      return a.p.price - b.p.price;
    });

  const pickedInverter = inverters[0]?.p ?? null;
  const invIsHv = pickedInverter ? isHighVoltageBatteryOrInverter(pickedInverter) : false;

  const targetSingleModuleKwh = recommendedBatteryKwh >= 12 ? Math.min(16, recommendedBatteryKwh) : 5.12;
  const batteries = products
    .filter(isBatteryModule)
    .map((p) => ({
      p,
      kwh: parseBatteryKwh(p),
      hv: isHighVoltageBatteryOrInverter(p),
    }))
    .sort((a, b) => {
      const aVoltOk = a.hv === invIsHv ? 1 : 0;
      const bVoltOk = b.hv === invIsHv ? 1 : 0;
      if (aVoltOk !== bVoltOk) return bVoltOk - aVoltOk;
      const diff = Math.abs(a.kwh - targetSingleModuleKwh) - Math.abs(b.kwh - targetSingleModuleKwh);
      if (diff !== 0) return diff;
      if (a.p.inStock !== b.p.inStock) return a.p.inStock ? -1 : 1;
      return a.p.price - b.p.price;
    });

  const pickedBattery = batteries[0]?.p ?? null;
  const batteryUnits = pickedBattery
    ? Math.max(1, Math.min(16, Math.round(recommendedBatteryKwh / Math.max(3.5, parseBatteryKwh(pickedBattery)))))
    : 1;

  const panels = products
    .filter((p) => p.cat === 'panels' && p.price > 0)
    .map((p) => ({ p, watts: parsePanelWatts(p) }))
    .sort((a, b) => {
      // Prefer 580-635W N-type Bifacial/TOPCon modules for roofs/ground; for <=6 kW accept 460-600W
      const aPref = solarKw <= 6 ? (a.watts >= 450 && a.watts <= 600 ? 1 : 0) : (a.watts >= 580 ? 1 : 0);
      const bPref = solarKw <= 6 ? (b.watts >= 450 && b.watts <= 600 ? 1 : 0) : (b.watts >= 580 ? 1 : 0);
      if (aPref !== bPref) return bPref - aPref;
      if (a.p.inStock !== b.p.inStock) return a.p.inStock ? -1 : 1;
      return a.p.price / a.watts - b.p.price / b.watts;
    });

  const pickedPanel = solarKw > 0 ? (panels[0]?.p ?? null) : null;
  const panelWatts = pickedPanel ? parsePanelWatts(pickedPanel) : 585;
  const panelAreaM2 = estimatePanelAreaM2(panelWatts);
  const panelsCount = solarKw > 0 ? Math.ceil((solarKw * 1000) / panelWatts) : 0;
  const roofAreaM2 = Math.round(panelsCount * panelAreaM2);

  const estimatedEquipmentUsd =
    (pickedInverter?.price ?? 0) +
    (pickedBattery ? pickedBattery.price * batteryUnits : 0) +
    (pickedPanel ? pickedPanel.price * panelsCount : 0);

  return {
    inverter: pickedInverter,
    battery: pickedBattery,
    batteryUnits,
    panel: pickedPanel,
    panelWatts,
    panelAreaM2,
    panelsCount,
    roofAreaM2,
    estimatedEquipmentUsd,
  };
}

export interface BatteryLifecycleResult {
  lfpCostUsd: number;
  lfpTotal10yUsd: number;
  lfpYears: number;
  lfpCostPerKwhCents: number;
  lfpEfficiencyPct: number;
  agmCostUsd: number;
  agmYears: number;
  agmReplacements10y: number;
  agmTotal10yUsd: number;
  agmCostPerKwhCents: number;
  agmEfficiencyPct: number;
}

/**
 * Benchmarks calibrated to Energo Comfort 2025-2026 LV catalog & open battery datasheets:
 * - LiFePO4: 6,000 cycles @ 90% DoD, 15-yr calendar life cap, 95% round-trip efficiency, ~$185/kWh nominal.
 * - AGM/Gel: 450 cycles @ 50% DoD, 4.5-yr calendar life cap (sulfation/corrosion), 80% efficiency, ~$160/kWh nominal.
 */
export function calculateBatteryLifecycle(cyclesPerYear: number, usableKwhNeeded: number): BatteryLifecycleResult {
  const safeCycles = Number.isFinite(cyclesPerYear) ? Math.max(30, Math.min(365, cyclesPerYear)) : 220;
  const safeUsable = Number.isFinite(usableKwhNeeded) ? Math.max(1, Math.min(100, usableKwhNeeded)) : 10;

  const lfpNominalKwh = safeUsable / 0.9;
  const lfpCostUsd = Math.round(lfpNominalKwh * 185);
  const lfpYears = Math.min(15, Math.round((6000 / safeCycles) * 10) / 10);
  const lfpReplacements10y = Math.max(1, Math.ceil(10 / Math.max(1, lfpYears)));
  const lfpTotal10yUsd = lfpCostUsd * lfpReplacements10y;
  const lfpRealizedCycles = Math.min(6000, safeCycles * lfpYears);
  const lfpCostPerKwhCents = Math.round((lfpCostUsd / (safeUsable * lfpRealizedCycles)) * 100);

  const agmNominalKwh = safeUsable / 0.5;
  const agmCostUsd = Math.round(agmNominalKwh * 160);
  const agmYears = Math.min(4.5, Math.round((450 / safeCycles) * 10) / 10);
  const agmReplacements10y = Math.max(1, Math.ceil(10 / Math.max(0.5, agmYears)));
  const agmTotal10yUsd = agmCostUsd * agmReplacements10y;
  const agmRealizedCycles = Math.min(450, safeCycles * agmYears);
  const agmCostPerKwhCents = Math.round((agmCostUsd / (safeUsable * agmRealizedCycles)) * 100);

  return {
    lfpCostUsd,
    lfpTotal10yUsd,
    lfpYears,
    lfpCostPerKwhCents,
    lfpEfficiencyPct: 95,
    agmCostUsd,
    agmYears,
    agmReplacements10y,
    agmTotal10yUsd,
    agmCostPerKwhCents,
    agmEfficiencyPct: 80,
  };
}

export const BATTERY_SIZING_DAILY_PRESETS = [6, 10, 15, 25, 40] as const;
export const BATTERY_SIZING_DURATION_PRESETS = [4, 8, 12, 24, 48] as const;

/**
 * Standard LiFePO4 battery sizing constants:
 * - 90% usable Depth of Discharge (DoD)
 * - 94% DC-to-AC inverter discharge efficiency -> 0.846 combined usable factor
 * - $185/kWh fallback benchmark calibrated to Energo Comfort 2025-2026 LV LiFePO4 catalog
 */
export const LIFEPO4_USABLE_FACTOR = 0.9 * 0.94;
export const LIFEPO4_BENCHMARK_USD_PER_KWH = 185;

export interface BatterySizingInput {
  dailyKwh: number;
  backupHours: number;
  criticalLoadSharePct?: number;
  usdUahRate: number | null;
  products: Product[];
}

export interface BatterySizingMatchedOption {
  product: Product;
  moduleKwh: number;
  modulesCount: number;
  totalBankKwh: number;
  totalPriceUsd: number;
  totalPriceUah: number | null;
}

export interface BatterySizingResult {
  safeDailyKwh: number;
  safeBackupHours: number;
  safeCriticalSharePct: number;
  averageLoadKw: number;
  usableEnergyNeededKwh: number;
  rawNominalKwh: number;
  recommendedCapacityKwh: number;
  usableCapacityKwh: number;
  recommendedModules: number;
  actualBankKwh: number;
  primaryBattery: Product | null;
  matchedBatteries: Product[];
  matchedOptions: BatterySizingMatchedOption[];
  usedCatalogPricing: boolean;
  estimatedCostUsd: number;
  estimatedCostUah: number | null;
  benchmarkCostUsd: number;
  benchmarkCostUah: number | null;
  cyclesRated: number;
  dodPct: number;
  inverterEfficiencyPct: number;
}

function is24VoltBattery(p: Product): boolean {
  return /24\s*v|25[.,-]6\s*v|lp16-24/i.test(`${p.id} ${p.title}`);
}

export function calculateBatterySizing(input: BatterySizingInput): BatterySizingResult {
  const safeDailyKwh = Number.isFinite(input.dailyKwh)
    ? Math.max(1, Math.min(500, input.dailyKwh))
    : 12;
  const safeBackupHours = Number.isFinite(input.backupHours)
    ? Math.max(1, Math.min(72, input.backupHours))
    : 12;
  const safeCriticalSharePct =
    input.criticalLoadSharePct !== undefined && Number.isFinite(input.criticalLoadSharePct)
      ? Math.max(25, Math.min(100, Math.round(input.criticalLoadSharePct)))
      : 100;

  const shareRatio = safeCriticalSharePct / 100;
  const averageLoadKw = Math.round(((safeDailyKwh * shareRatio) / 24) * 100) / 100;
  const usableEnergyNeededKwh =
    Math.round(safeDailyKwh * shareRatio * (safeBackupHours / 24) * 10) / 10;
  const rawNominalKwh = usableEnergyNeededKwh / LIFEPO4_USABLE_FACTOR;

  // Step to practical 2.5 kWh LiFePO4 planning tiers starting at 5 kWh
  const recommendedCapacityKwh = Math.max(5, Math.ceil(rawNominalKwh / 2.5) * 2.5);
  const usableCapacityKwh = Math.round(recommendedCapacityKwh * LIFEPO4_USABLE_FACTOR * 10) / 10;

  const rate =
    input.usdUahRate && Number.isFinite(input.usdUahRate) && input.usdUahRate > 0
      ? input.usdUahRate
      : null;

  const candidates = input.products
    .filter(isBatteryModule)
    .map((p) => {
      const moduleKwh = parseBatteryKwh(p);
      const hv = isHighVoltageBatteryOrInverter(p);
      const is24v = is24VoltBattery(p);
      const modulesCount = Math.max(1, Math.min(16, Math.ceil((rawNominalKwh - 0.15) / moduleKwh)));
      const totalBankKwh = Math.round(modulesCount * moduleKwh * 100) / 100;
      const totalPriceUsd = Math.round(p.price * modulesCount);
      return {
        p,
        moduleKwh,
        hv,
        is24v,
        modulesCount,
        totalBankKwh,
        totalPriceUsd,
      };
    })
    .sort((a, b) => {
      // Standard 48V/51.2V LV or HV preferred over legacy 24V modules
      if (a.is24v !== b.is24v) return a.is24v ? 1 : -1;
      // For residential/small commercial (< 20 kWh), strongly prefer 48V LV modules
      if (recommendedCapacityKwh < 20 && a.hv !== b.hv) return a.hv ? 1 : -1;
      // Prefer practical stack sizes (1-4 units) over stacking many small bricks
      const aPractical = a.modulesCount <= 4 ? 1 : 0;
      const bPractical = b.modulesCount <= 4 ? 1 : 0;
      if (aPractical !== bPractical) return bPractical - aPractical;
      // Prefer closer fit to recommended nominal capacity (small overshoot penalized lightly)
      const aFit = Math.abs(a.totalBankKwh - recommendedCapacityKwh);
      const bFit = Math.abs(b.totalBankKwh - recommendedCapacityKwh);
      if (Math.abs(aFit - bFit) > 1.2) return aFit - bFit;
      if (a.p.inStock !== b.p.inStock) return a.p.inStock ? -1 : 1;
      return a.totalPriceUsd - b.totalPriceUsd;
    });

  // Deduplicate by brand+capacity bracket when picking up to 3 diverse options if available
  const picked: typeof candidates = [];
  const seenKeys = new Set<string>();
  for (const item of candidates) {
    const key = `${item.p.brand.toLowerCase()}-${Math.round(item.moduleKwh)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    picked.push(item);
    if (picked.length >= 3) break;
  }
  if (picked.length < 3) {
    for (const item of candidates) {
      if (picked.some((x) => x.p.id === item.p.id)) continue;
      picked.push(item);
      if (picked.length >= 3) break;
    }
  }

  const matchedOptions: BatterySizingMatchedOption[] = picked.map((item) => ({
    product: item.p,
    moduleKwh: item.moduleKwh,
    modulesCount: item.modulesCount,
    totalBankKwh: item.totalBankKwh,
    totalPriceUsd: item.totalPriceUsd,
    totalPriceUah: rate ? Math.round(item.totalPriceUsd * rate) : null,
  }));

  const primaryOption = matchedOptions[0] ?? null;
  const benchmarkCostUsd = Math.round(recommendedCapacityKwh * LIFEPO4_BENCHMARK_USD_PER_KWH);
  const benchmarkCostUah = rate ? Math.round(benchmarkCostUsd * rate) : null;

  const usedCatalogPricing = Boolean(primaryOption && primaryOption.totalPriceUsd > 0);
  const estimatedCostUsd = usedCatalogPricing && primaryOption ? primaryOption.totalPriceUsd : benchmarkCostUsd;
  const estimatedCostUah = rate ? Math.round(estimatedCostUsd * rate) : null;

  return {
    safeDailyKwh,
    safeBackupHours,
    safeCriticalSharePct,
    averageLoadKw,
    usableEnergyNeededKwh,
    rawNominalKwh: Math.round(rawNominalKwh * 10) / 10,
    recommendedCapacityKwh,
    usableCapacityKwh,
    recommendedModules: primaryOption ? primaryOption.modulesCount : Math.max(1, Math.ceil(recommendedCapacityKwh / 5)),
    actualBankKwh: primaryOption ? primaryOption.totalBankKwh : recommendedCapacityKwh,
    primaryBattery: primaryOption ? primaryOption.product : null,
    matchedBatteries: matchedOptions.map((o) => o.product),
    matchedOptions,
    usedCatalogPricing,
    estimatedCostUsd,
    estimatedCostUah,
    benchmarkCostUsd,
    benchmarkCostUah,
    cyclesRated: 6000,
    dodPct: 90,
    inverterEfficiencyPct: 94,
  };
}

