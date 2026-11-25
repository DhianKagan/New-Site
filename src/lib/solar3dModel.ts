import type { Deal, Product } from '../types.ts';
import {
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  extractProductPowerKw,
  isFullSolarKit,
  matchConstructorEquipment,
  parseBatteryKwh,
} from './calculators.ts';

export type Solar3DMode = 'solar' | 'blackout' | 'night';
export type Solar3DPowerTier = 5 | 10 | 15;
export type Solar3DBatteryTier = 5 | 10 | 20;
export type Solar3DComponentId = 'panels' | 'inverter' | 'battery' | 'ats' | 'grid';
export type Solar3DCameraPreset = 'overview' | 'roof' | 'techwall' | 'battery';

export interface Solar3DSimInput {
  mode: Solar3DMode;
  hourOfDay: number;
  tierKw: Solar3DPowerTier;
  batteryKwh: Solar3DBatteryTier;
  usdUahRate: number | null;
}

export interface Solar3DTelemetry {
  mode: Solar3DMode;
  effectiveHour: number;
  pvKw: number;
  loadKw: number;
  batteryFlowKw: number; // + charging, - discharging
  batterySocPct: number;
  gridFlowKw: number; // + importing from grid, - exporting to grid
  gridOnline: boolean;
  autonomyHours: number;
  panelCount: number;
  batteryUnits: number;
  dailyGenKwh: number;
  dailySavingsUah: number | null;
  monthlySavingsUah: number | null;
  sunElevation: number; // 0..1 normalized
  sunAzimuthRad: number;
}

export interface Solar3DSeedConfig {
  tierKw: Solar3DPowerTier;
  batteryKwh: Solar3DBatteryTier;
  sourceLabelUk: string;
  sourceLabelRu: string;
  dealNumber?: string;
}

export interface Solar3DComponentInfo {
  id: Solar3DComponentId;
  titleUk: string;
  titleRu: string;
  roleUk: string;
  roleRu: string;
  specsUk: string[];
  specsRu: string[];
}

export function snapPowerTier(kw: number): Solar3DPowerTier {
  if (kw >= 12.5) return 15;
  if (kw >= 7.5) return 10;
  return 5;
}

export function snapBatteryTier(kwh: number): Solar3DBatteryTier {
  if (kwh >= 14) return 20;
  if (kwh >= 7.5) return 10;
  return 5;
}

export function getVisualPanelCount(tierKw: Solar3DPowerTier): number {
  if (tierKw === 15) return 20;
  if (tierKw === 10) return 14;
  return 8;
}

export function getVisualBatteryModules(batteryKwh: Solar3DBatteryTier): number {
  if (batteryKwh === 20) return 4;
  if (batteryKwh === 10) return 2;
  return 1;
}

export function deriveInitial3DConfig(params: {
  deals: Deal[];
  wishlistProducts: Product[];
  products: Product[];
}): Solar3DSeedConfig {
  const { deals, wishlistProducts, products } = params;

  for (const deal of deals) {
    if (deal.stage === 'archived') continue;
    let detectedKw: number | null = null;
    let detectedKwh: number | null = null;

    for (const item of deal.items) {
      const matched = products.find((p) => p.id === item.productId);
      const pseudoProduct: Product = matched ?? {
        id: item.productId,
        cat: 'kits',
        title: item.title,
        price: item.price,
        inStock: true,
        img: '',
        specs: [],
        description: item.title,
      };
      const kw = extractProductPowerKw(pseudoProduct);
      if (kw && (!detectedKw || kw > detectedKw)) {
        detectedKw = kw;
      }
      const kwhMatch = item.title.match(/(\d+(?:[.,]\d+)?)\s*(?:квт[·\s*]*год|kwh)/i);
      if (kwhMatch) {
        const parsed = Number(kwhMatch[1].replace(',', '.')) * Math.max(1, item.qty);
        if (Number.isFinite(parsed) && (!detectedKwh || parsed > detectedKwh)) {
          detectedKwh = parsed;
        }
      } else if (matched?.cat === 'batteries') {
        const kwh = parseBatteryKwh(matched) * Math.max(1, item.qty);
        if (!detectedKwh || kwh > detectedKwh) detectedKwh = kwh;
      }
    }

    if (!detectedKw) {
      const topicMatch = deal.topic.match(/(\d+(?:[.,]\d+)?)\s*(?:квт|kw)/i);
      if (topicMatch) {
        const kw = Number(topicMatch[1].replace(',', '.'));
        if (Number.isFinite(kw) && kw > 0) detectedKw = kw;
      }
    }

    if (detectedKw || detectedKwh) {
      const tierKw = snapPowerTier(detectedKw ?? 8);
      const batteryKwh = snapBatteryTier(detectedKwh ?? (tierKw >= 15 ? 20 : 10));
      return {
        tierKw,
        batteryKwh,
        sourceLabelUk: `Синхронізовано із заявкою ${deal.dealNumber}`,
        sourceLabelRu: `Синхронизировано с заявкой ${deal.dealNumber}`,
        dealNumber: deal.dealNumber,
      };
    }
  }

  for (const wp of wishlistProducts) {
    const kw = extractProductPowerKw(wp);
    if (kw && kw >= 3) {
      const tierKw = snapPowerTier(kw);
      const batteryKwh = wp.cat === 'batteries' ? snapBatteryTier(parseBatteryKwh(wp)) : tierKw >= 15 ? 20 : 10;
      return {
        tierKw,
        batteryKwh,
        sourceLabelUk: 'Підібрано за вашим списком бажань',
        sourceLabelRu: 'Подобрано по вашему списку желаний',
      };
    }
  }

  return {
    tierKw: 10,
    batteryKwh: 10,
    sourceLabelUk: 'Типова гібридна СЕС для будинку',
    sourceLabelRu: 'Типовая гибридная СЭС для дома',
  };
}

export function computeSolar3DTelemetry(input: Solar3DSimInput): Solar3DTelemetry {
  const { mode, tierKw, batteryKwh, usdUahRate } = input;
  const clampedHour = Number.isFinite(input.hourOfDay)
    ? Math.max(5, Math.min(22, input.hourOfDay))
    : 13;

  // In explicit night mode, keep sun down regardless of daylight slider position if user didn't drag to night
  const effectiveHour = mode === 'night' && clampedHour >= 7 && clampedHour <= 19 ? 21 : clampedHour;

  // Solar elevation normalized 0..1 across 06:00..20:00
  const sunSpan = Math.max(0, Math.min(1, (effectiveHour - 6) / 14));
  const rawElevation = effectiveHour >= 6 && effectiveHour <= 20 ? Math.sin(sunSpan * Math.PI) : 0;
  const sunElevation = mode === 'night' ? 0 : Math.max(0, rawElevation);
  const sunAzimuthRad = (sunSpan - 0.5) * Math.PI * 0.85;

  // Peak PV yield factor (~0.84 real ambient/cell temp derate)
  const pvKw =
    mode === 'night' || sunElevation <= 0.02
      ? 0
      : Math.round(tierKw * Math.pow(sunElevation, 1.15) * 0.86 * 10) / 10;

  // Realistic household load curve (evening spike, daytime appliances)
  const baseLoad = tierKw === 15 ? 1.8 : tierKw === 10 ? 1.3 : 0.8;
  const eveningPeak = Math.exp(-Math.pow((effectiveHour - 19.5) / 2.6, 2)) * (tierKw === 15 ? 2.6 : 1.7);
  const morningPeak = Math.exp(-Math.pow((effectiveHour - 8.5) / 1.8, 2)) * 0.9;
  const rawLoad = baseLoad + eveningPeak + morningPeak;
  const loadKw = Math.round((mode === 'blackout' ? rawLoad * 0.72 : rawLoad) * 10) / 10;

  const gridOnline = mode !== 'blackout';
  const maxChargeKw = Math.min(tierKw * 0.7, batteryKwh * 0.65);
  const maxDischargeKw = Math.min(tierKw * 0.95, batteryKwh * 0.85);

  let batteryFlowKw = 0;
  let gridFlowKw = 0;
  let batterySocPct = 78;

  if (mode === 'blackout') {
    const net = pvKw - loadKw;
    if (net >= 0) {
      batteryFlowKw = Math.round(Math.min(maxChargeKw, net) * 10) / 10;
      batterySocPct = Math.min(98, Math.round(74 + sunElevation * 22));
    } else {
      batteryFlowKw = -Math.round(Math.min(maxDischargeKw, Math.abs(net)) * 10) / 10;
      batterySocPct = Math.max(22, Math.round(68 - Math.abs(batteryFlowKw) * 4));
    }
    gridFlowKw = 0;
  } else if (mode === 'night' || pvKw < 0.2) {
    // Night: discharge battery first down to reserve, grid covers any remainder
    const batSupport = Math.min(maxDischargeKw, loadKw * 0.92);
    batteryFlowKw = -Math.round(batSupport * 10) / 10;
    const gridRemainder = Math.max(0, loadKw - Math.abs(batteryFlowKw));
    gridFlowKw = Math.round(gridRemainder * 10) / 10;
    batterySocPct = Math.max(25, Math.round(82 - Math.max(0, effectiveHour - 18) * 9));
  } else {
    // Solar day: PV powers load first, surplus charges battery, remainder exports to grid (Net Billing)
    const net = pvKw - loadKw;
    if (net >= 0) {
      const charge = Math.min(maxChargeKw, net * 0.72);
      batteryFlowKw = Math.round(charge * 10) / 10;
      const exportKw = Math.max(0, net - batteryFlowKw);
      gridFlowKw = -Math.round(exportKw * 10) / 10;
      batterySocPct = Math.min(100, Math.round(58 + sunElevation * 38));
    } else {
      const deficit = Math.abs(net);
      const batAssist = Math.min(maxDischargeKw, deficit * 0.85);
      batteryFlowKw = -Math.round(batAssist * 10) / 10;
      gridFlowKw = Math.round(Math.max(0, deficit - Math.abs(batteryFlowKw)) * 10) / 10;
      batterySocPct = Math.round(62 + sunElevation * 20);
    }
  }

  const usableKwh = batteryKwh * 0.85;
  const netDrainInBlackout = Math.max(0.4, loadKw - pvKw * 0.6);
  const autonomyHours = Math.min(48, Math.round((usableKwh / netDrainInBlackout) * 10) / 10);

  // Average seasonal daily yield in Odesa (~3.4 kWh/kWp/day annual avg)
  const dailyGenKwh = Math.round(tierKw * 3.4 * 10) / 10;
  const dailySavingsUah = Math.round(dailyGenKwh * 0.85 * DEFAULT_RESIDENTIAL_TARIFF_UAH);
  const monthlySavingsUah = usdUahRate ? dailySavingsUah * 30 : dailySavingsUah * 30;

  return {
    mode,
    effectiveHour,
    pvKw,
    loadKw,
    batteryFlowKw,
    batterySocPct,
    gridFlowKw,
    gridOnline,
    autonomyHours,
    panelCount: getVisualPanelCount(tierKw),
    batteryUnits: getVisualBatteryModules(batteryKwh),
    dailyGenKwh,
    dailySavingsUah,
    monthlySavingsUah,
    sunElevation,
    sunAzimuthRad,
  };
}

export function match3DEquipment(params: {
  products: Product[];
  tierKw: Solar3DPowerTier;
  batteryKwh: Solar3DBatteryTier;
}): {
  inverter: Product | null;
  battery: Product | null;
  batteryUnits: number;
  panel: Product | null;
  kit: Product | null;
  panelsCount: number;
  estimatedTotalUsd: number;
} {
  const { products, tierKw, batteryKwh } = params;
  const matched = matchConstructorEquipment({
    products,
    recommendedInverterKw: tierKw,
    recommendedBatteryKwh: batteryKwh,
    phases: tierKw >= 10 ? 3 : 1,
    solarKw: tierKw,
  });

  const bestKit =
    products
      .filter((p) => p.price > 0 && (isFullSolarKit(p) || p.isKit || p.cat === 'kits'))
      .sort((a, b) => {
        const aFull = isFullSolarKit(a) ? 1 : 0;
        const bFull = isFullSolarKit(b) ? 1 : 0;
        if (aFull !== bFull) return bFull - aFull;
        const aKw = extractProductPowerKw(a) ?? tierKw;
        const bKw = extractProductPowerKw(b) ?? tierKw;
        const diff = Math.abs(aKw - tierKw) - Math.abs(bKw - tierKw);
        if (diff !== 0) return diff;
        if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
        return a.price - b.price;
      })[0] ?? null;

  return {
    inverter: matched.inverter,
    battery: matched.battery,
    batteryUnits: matched.batteryUnits,
    panel: matched.panel,
    kit: bestKit,
    panelsCount: matched.panelsCount,
    estimatedTotalUsd: matched.estimatedEquipmentUsd || bestKit?.price || 0,
  };
}

export function getComponentInspectionMeta(
  id: Solar3DComponentId,
  tierKw: Solar3DPowerTier,
  batteryKwh: Solar3DBatteryTier,
): Solar3DComponentInfo {
  switch (id) {
    case 'panels':
      return {
        id,
        titleUk: 'Сонячне поле (TOPCon / Bifacial)',
        titleRu: 'Солнечное поле (TOPCon / Bifacial)',
        roleUk: `Покрівельний масив ${tierKw} кВт із захистом від затінення та алюмінієвою профільною системою кріплення.`,
        roleRu: `Кровельный массив ${tierKw} кВт с защитой от затенения и алюминиевой профильной системой крепления.`,
        specsUk: [
          `Потужність поля: ${tierKw} кВт (N-type 585+ Вт)`,
          `Орієнтація: Південь, кут 30–35°`,
          `Виробіток в Одесі: ~${Math.round(tierKw * 1230).toLocaleString('uk-UA')} кВт·год/рік`,
        ],
        specsRu: [
          `Мощность поля: ${tierKw} кВт (N-type 585+ Вт)`,
          `Ориентация: Юг, угол 30–35°`,
          `Выработка в Одессе: ~${Math.round(tierKw * 1230).toLocaleString('ru-RU')} кВт·ч/год`,
        ],
      };
    case 'inverter':
      return {
        id,
        titleUk: `Гібридний інвертор ${tierKw} кВт`,
        titleRu: `Гибридный инвертор ${tierKw} кВт`,
        roleUk: 'Керує потоками між панелями, батареєю та мережею. Миттєвий перехід на резерв (< 10 мс) без перезавантаження техніки.',
        roleRu: 'Управляет потоками между панелями, батареей и сетью. Мгновенный переход на резерв (< 10 мс) без перезагрузки техники.',
        specsUk: [
          `Номінальна потужність: ${tierKw} кВт (${tierKw >= 10 ? '3 фази 380В' : '1 фаза 220В'})`,
          '2 незалежних MPPT трекери для різних схилів',
          'Smart-підмішування + підтримка Net Billing',
        ],
        specsRu: [
          `Номинальная мощность: ${tierKw} кВт (${tierKw >= 10 ? '3 фазы 380В' : '1 фаза 220В'})`,
          '2 независимых MPPT трекера для разных скатов',
          'Smart-подмешивание + поддержка Net Billing',
        ],
      };
    case 'battery':
      return {
        id,
        titleUk: `Модульний блок АКБ LiFePO4 (${batteryKwh} кВт·год)`,
        titleRu: `Модульный блок АКБ LiFePO4 (${batteryKwh} кВт·ч)`,
        roleUk: 'Безпечна літій-залізо-фосфатна батарея з активною BMS та ресурсом понад 6000 циклів (до 15 років служби).',
        roleRu: 'Безопасная литий-железо-фосфатная батарея с активной BMS и ресурсом более 6000 циклов (до 15 лет службы).',
        specsUk: [
          `Корисна ємність: ${(batteryKwh * 0.9).toFixed(1)} кВт·год (90% DoD)`,
          'Безпечна хімія LiFePO4 без ризику займання',
          'CAN/RS485 зв’язок з інвертором у реальному часі',
        ],
        specsRu: [
          `Полезная ёмкость: ${(batteryKwh * 0.9).toFixed(1)} кВт·ч (90% DoD)`,
          'Безопасная химия LiFePO4 без риска возгорания',
          'CAN/RS485 связь с инвертором в реальном времени',
        ],
      };
    case 'ats':
      return {
        id,
        titleUk: 'Щит захисту DC/AC та АВР',
        titleRu: 'Щит защиты DC/AC и АВР',
        roleUk: 'Захищає обладнання від перенапруги, блискавки та коротких замикань, автоматично перемикає резервні лінії будинку.',
        roleRu: 'Защищает оборудование от перенапряжения, молнии и коротких замыканий, автоматически переключает резервные линии дома.',
        specsUk: [
          'ОПН (грозозахист) по DC та AC лініях',
          'Байпас для сервісного обслуговування',
          'Виділена лінія критичних навантажень',
        ],
        specsRu: [
          'УЗИП (грозозащита) по DC и AC линиям',
          'Байпас для сервисного обслуживания',
          'Выделенная линия критических нагрузок',
        ],
      };
    case 'grid':
      return {
        id,
        titleUk: 'Зовнішня мережа та двонаправлений лічильник',
        titleRu: 'Внешняя сеть и двунаправленный счётчик',
        roleUk: 'Дозволяє компенсувати споживання за механізмом Net Billing або повністю ізолювати будинок під час блекауту.',
        roleRu: 'Позволяет компенсировать потребление по механизму Net Billing или полностью изолировать дом при блэкауте.',
        specsUk: [
          `Режим: ${tierKw >= 10 ? '3 фази 380В + Net Billing' : '1 фаза 220В + Net Billing'}`,
          'Гальванічна ізоляція при зникненні мережі',
          'Підтримка зовнішнього генератора на порт GEN',
        ],
        specsRu: [
          `Режим: ${tierKw >= 10 ? '3 фазы 380В + Net Billing' : '1 фаза 220В + Net Billing'}`,
          'Гальваническая изоляция при пропадании сети',
          'Поддержка внешнего генератора на порт GEN',
        ],
      };
  }
}
