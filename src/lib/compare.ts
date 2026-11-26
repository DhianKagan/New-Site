import type { Product } from '../types.ts';
import { localizeCatalogText } from './i18n.ts';

export const COMPARE_STORAGE_KEY = 'ec_compare_v1';
export const MAX_COMPARE_PRODUCTS = 4;

export interface ToggleCompareResult {
  ids: string[];
  added: boolean;
  limitReached: boolean;
}

export interface ComparisonSpecRow {
  label: string;
  values: string[];
  differs: boolean;
}

export function normalizeCompareIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= MAX_COMPARE_PRODUCTS) break;
  }
  return out;
}

export function toggleCompareId(currentIds: string[], productId: string): ToggleCompareResult {
  const cleanId = productId.trim();
  const normalized = normalizeCompareIds(currentIds);
  if (!cleanId) {
    return { ids: normalized, added: false, limitReached: false };
  }
  if (normalized.includes(cleanId)) {
    return {
      ids: normalized.filter((id) => id !== cleanId),
      added: false,
      limitReached: false,
    };
  }
  if (normalized.length >= MAX_COMPARE_PRODUCTS) {
    return {
      ids: normalized,
      added: false,
      limitReached: true,
    };
  }
  return {
    ids: [...normalized, cleanId],
    added: true,
    limitReached: false,
  };
}

export function resolveCompareProducts(compareIds: string[], products: Product[]): Product[] {
  if (compareIds.length === 0 || products.length === 0) return [];
  const byId = new Map<string, Product>();
  for (const product of products) {
    byId.set(product.id, product);
  }
  const resolved: Product[] = [];
  for (const id of normalizeCompareIds(compareIds)) {
    const match = byId.get(id);
    if (match) resolved.push(match);
  }
  return resolved;
}

export function readCompareFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return normalizeCompareIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCompareToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizeCompareIds(ids)));
  } catch {
    // ignore storage quota errors
  }
}

export function getLocalizedProductSpecs(product: Product, isRussian: boolean): [string, string][] {
  if (!isRussian) return product.specs;
  return (
    product.specsRu ??
    product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
  );
}

export function doesRowDiffer(values: string[]): boolean {
  if (values.length < 2) return false;
  const distinct = new Set(values.map((v) => v.trim().toLowerCase()));
  return distinct.size > 1;
}

export function buildComparisonSpecRows(products: Product[], isRussian: boolean): ComparisonSpecRow[] {
  if (products.length === 0) return [];

  const labelOrder: string[] = [];
  const keyToLabel = new Map<string, string>();
  const productSpecMaps = products.map((product) => {
    const map = new Map<string, string>();
    for (const [rawKey, rawVal] of getLocalizedProductSpecs(product, isRussian)) {
      const displayKey = rawKey.trim();
      const normalizedKey = displayKey.toLowerCase();
      const cleanVal = rawVal.trim();
      if (!normalizedKey || !cleanVal) continue;
      if (!keyToLabel.has(normalizedKey)) {
        keyToLabel.set(normalizedKey, displayKey);
        labelOrder.push(normalizedKey);
      }
      if (!map.has(normalizedKey)) {
        map.set(normalizedKey, cleanVal);
      }
    }
    return map;
  });

  return labelOrder.map((normalizedKey) => {
    const label = keyToLabel.get(normalizedKey) ?? normalizedKey;
    const values = productSpecMaps.map((specMap) => specMap.get(normalizedKey) ?? '—');
    return {
      label,
      values,
      differs: doesRowDiffer(values),
    };
  });
}

export type CompareDetailSectionId = 'commercial' | 'electrical' | 'specs' | 'engineering';

export interface CompareDetailRow {
  id: string;
  section: CompareDetailSectionId;
  label: string;
  values: string[];
  differs: boolean;
  bestIndices?: number[];
  bestTag?: string;
}

export interface DetailedComparisonSection {
  id: CompareDetailSectionId;
  title: string;
  subtitle: string;
  rows: CompareDetailRow[];
}

export interface ProductDecisionMetrics {
  powerKw: number | null;
  batteryKwh: number | null;
  pricePerKwUsd: number | null;
  pricePerKwhUsd: number | null;
  phasesLabel: string | null;
  chemistryLabel: string | null;
  warrantyLabel: string | null;
  discountPct: number;
}

const CAT_DISPLAY_LABELS: Record<string, { uk: string; ru: string }> = {
  kits: { uk: 'Готове рішення', ru: 'Готовое решение' },
  inverters: { uk: 'Інвертори', ru: 'Инверторы' },
  batteries: { uk: 'Акумулятори', ru: 'Аккумуляторы' },
  panels: { uk: 'Сонячні панелі', ru: 'Солнечные панели' },
  parts: { uk: 'Комплектуючі', ru: 'Комплектующие' },
};

export function extractProductPowerKwForCompare(product: Product): number | null {
  const specsText = product.specs.map(([k, v]) => `${k} ${v}`).join(' ');
  const haystack = `${product.title} ${specsText}`;

  const kwMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:квт|kw)(?!\s*[·*./-]?\s*(?:год|ч|h))/i);
  if (kwMatch) {
    const val = Number(kwMatch[1].replace(',', '.'));
    if (Number.isFinite(val) && val > 0) return val;
  }

  // Handle solar panels / smaller loads rated in Watts (e.g., 460W, 580 Вт)
  const wattMatch = haystack.match(/(\d{3,4}(?:[.,]\d+)?)\s*(?:вт|w)(?!\s*(?:h|год|ч))/i);
  if (wattMatch) {
    const watts = Number(wattMatch[1].replace(',', '.'));
    if (Number.isFinite(watts) && watts >= 50) {
      return Number((watts / 1000).toFixed(3));
    }
  }

  return null;
}

export function extractProductBatteryKwhForCompare(product: Product): number | null {
  const specsText = product.specs.map(([k, v]) => `${k} ${v}`).join(' ');
  const haystack = `${product.title} ${specsText}`;
  const kwhMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:квт\s*[·*./-]?\s*(?:год|ч)|kwh)/i);
  if (!kwhMatch) return null;
  const val = Number(kwhMatch[1].replace(',', '.'));
  return Number.isFinite(val) && val > 0 ? val : null;
}

function findSpecValueByKeywords(
  specs: [string, string][],
  keywords: string[],
): string | null {
  for (const [rawKey, rawVal] of specs) {
    const keyLower = rawKey.toLowerCase();
    if (keywords.some((kw) => keyLower.includes(kw))) {
      const clean = rawVal.trim();
      if (clean) return clean;
    }
  }
  return null;
}

export function extractProductDecisionMetrics(
  product: Product,
  isRussian: boolean,
): ProductDecisionMetrics {
  const localizedSpecs = getLocalizedProductSpecs(product, isRussian);
  const powerKw = extractProductPowerKwForCompare(product);
  const batteryKwh = extractProductBatteryKwhForCompare(product);

  const pricePerKwUsd =
    product.price > 0 && powerKw && powerKw > 0
      ? Math.round(product.price / powerKw)
      : null;
  const pricePerKwhUsd =
    product.price > 0 && batteryKwh && batteryKwh > 0
      ? Math.round(product.price / batteryKwh)
      : null;

  const fullText = `${product.title} ${product.description} ${localizedSpecs
    .map(([k, v]) => `${k} ${v}`)
    .join(' ')}`.toLowerCase();

  let phasesLabel = findSpecValueByKeywords(localizedSpecs, ['фаз', 'phase']);
  if (!phasesLabel) {
    if (fullText.includes('3 ф') || fullText.includes('3-ф') || fullText.includes('трифаз') || fullText.includes('трёхфаз') || fullText.includes('380')) {
      phasesLabel = isRussian ? '3 фазы (380В)' : '3 фази (380В)';
    } else if (fullText.includes('1 ф') || fullText.includes('1-ф') || fullText.includes('однофаз') || fullText.includes('220')) {
      phasesLabel = isRussian ? '1 фаза (220В)' : '1 фаза (220В)';
    }
  }

  let chemistryLabel = findSpecValueByKeywords(localizedSpecs, [
    'технологі',
    'технологи',
    'хімі',
    'хими',
    'тип модуля',
    'тип батаре',
    'тип акб',
    'комірк',
    'ячеек',
  ]);
  if (!chemistryLabel) {
    if (fullText.includes('lifepo4')) chemistryLabel = 'LiFePO4';
    else if (fullText.includes('n-type') && fullText.includes('bifacial')) chemistryLabel = 'N-Type Bifacial';
    else if (fullText.includes('bifacial')) chemistryLabel = 'Bifacial';
  }

  const warrantyLabel = findSpecValueByKeywords(localizedSpecs, ['гарант', 'warranty']);

  const discountPct =
    product.oldPrice > product.price && product.price > 0
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;

  return {
    powerKw,
    batteryKwh,
    pricePerKwUsd,
    pricePerKwhUsd,
    phasesLabel,
    chemistryLabel,
    warrantyLabel,
    discountPct,
  };
}

export function findOptimalMetricIndices(
  values: (number | null)[],
  mode: 'min' | 'max',
): number[] {
  const validEntries = values
    .map((val, idx) => ({ val, idx }))
    .filter((entry): entry is { val: number; idx: number } => entry.val !== null && Number.isFinite(entry.val) && entry.val > 0);

  if (validEntries.length < 2) return [];
  const distinct = new Set(validEntries.map((entry) => entry.val));
  if (distinct.size < 2) return [];

  const target =
    mode === 'min'
      ? Math.min(...validEntries.map((entry) => entry.val))
      : Math.max(...validEntries.map((entry) => entry.val));

  return validEntries.filter((entry) => entry.val === target).map((entry) => entry.idx);
}

function formatNumberDisplay(value: number, maxFractionDigits = 2): string {
  return Number(value.toFixed(maxFractionDigits)).toString();
}

export function buildDetailedComparisonSections(
  products: Product[],
  isRussian: boolean,
  usdUahRate?: number | null,
): DetailedComparisonSection[] {
  if (products.length === 0) return [];

  const metrics = products.map((product) => extractProductDecisionMetrics(product, isRussian));
  const rate = typeof usdUahRate === 'number' && Number.isFinite(usdUahRate) && usdUahRate > 0 ? usdUahRate : null;

  const formatUsdUah = (usd: number): string => {
    const usdStr = `$${usd.toLocaleString('en-US')}`;
    if (!rate) return usdStr;
    const uah = Math.round(usd * rate);
    return `${uah.toLocaleString('uk-UA')} ₴ (${usdStr})`;
  };

  // 1. Commercial & Value Metrics
  const priceNumbers = products.map((p) => (p.price > 0 ? p.price : null));
  const priceValues = products.map((p) =>
    p.price > 0 ? formatUsdUah(p.price) : isRussian ? 'По запросу' : 'За запитом',
  );
  const pricePerKwNumbers = metrics.map((m) => m.pricePerKwUsd);
  const pricePerKwValues = metrics.map((m) =>
    m.pricePerKwUsd !== null ? formatUsdUah(m.pricePerKwUsd) : '—',
  );
  const pricePerKwhNumbers = metrics.map((m) => m.pricePerKwhUsd);
  const pricePerKwhValues = metrics.map((m) =>
    m.pricePerKwhUsd !== null ? formatUsdUah(m.pricePerKwhUsd) : '—',
  );
  const discountValues = metrics.map((m) => (m.discountPct > 0 ? `-${m.discountPct}%` : '—'));
  const brandValues = products.map((p) => p.brand || '—');
  const categoryValues = products.map((p) => {
    const meta = CAT_DISPLAY_LABELS[p.cat];
    return meta ? (isRussian ? meta.ru : meta.uk) : p.cat;
  });
  const stockValues = products.map((p) =>
    p.isKit
      ? isRussian
        ? 'Под ключ · Одесса / Украина'
        : 'Під ключ · Одеса / Україна'
      : p.inStock
        ? isRussian
          ? 'В наличии · Одесса'
          : 'В наявності · Одеса'
        : isRussian
          ? 'Под заказ'
          : 'Під замовлення',
  );
  const skuValues = products.map((p) => p.sku || '—');

  const commercialRows: CompareDetailRow[] = [
    {
      id: 'comm-price',
      section: 'commercial',
      label: isRussian ? 'Стоимость' : 'Вартість',
      values: priceValues,
      differs: doesRowDiffer(priceValues),
      bestIndices: findOptimalMetricIndices(priceNumbers, 'min'),
      bestTag: isRussian ? 'Мин. цена' : 'Найнижча ціна',
    },
    ...(pricePerKwValues.some((v) => v !== '—')
      ? [
          {
            id: 'comm-price-per-kw',
            section: 'commercial' as const,
            label: isRussian ? 'Цена за 1 кВт мощности' : 'Ціна за 1 кВт потужності',
            values: pricePerKwValues,
            differs: doesRowDiffer(pricePerKwValues),
            bestIndices: findOptimalMetricIndices(pricePerKwNumbers, 'min'),
            bestTag: isRussian ? 'Лучшее $/кВт' : 'Краща $/кВт',
          },
        ]
      : []),
    ...(pricePerKwhValues.some((v) => v !== '—')
      ? [
          {
            id: 'comm-price-per-kwh',
            section: 'commercial' as const,
            label: isRussian ? 'Цена за 1 кВт·ч АКБ' : 'Ціна за 1 кВт·год АКБ',
            values: pricePerKwhValues,
            differs: doesRowDiffer(pricePerKwhValues),
            bestIndices: findOptimalMetricIndices(pricePerKwhNumbers, 'min'),
            bestTag: isRussian ? 'Лучшее $/кВт·ч' : 'Краща $/кВт·год',
          },
        ]
      : []),
    ...(discountValues.some((v) => v !== '—')
      ? [
          {
            id: 'comm-discount',
            section: 'commercial' as const,
            label: isRussian ? 'Скидка' : 'Знижка',
            values: discountValues,
            differs: doesRowDiffer(discountValues),
            bestIndices: findOptimalMetricIndices(
              metrics.map((m) => (m.discountPct > 0 ? m.discountPct : null)),
              'max',
            ),
            bestTag: isRussian ? 'Макс. выгода' : 'Макс. вигода',
          },
        ]
      : []),
    {
      id: 'comm-brand',
      section: 'commercial',
      label: isRussian ? 'Производитель' : 'Виробник',
      values: brandValues,
      differs: doesRowDiffer(brandValues),
    },
    {
      id: 'comm-cat',
      section: 'commercial',
      label: isRussian ? 'Категория' : 'Категорія',
      values: categoryValues,
      differs: doesRowDiffer(categoryValues),
    },
    {
      id: 'comm-stock',
      section: 'commercial',
      label: isRussian ? 'Наличие и формат' : 'Наявність та формат',
      values: stockValues,
      differs: doesRowDiffer(stockValues),
    },
    {
      id: 'comm-sku',
      section: 'commercial',
      label: isRussian ? 'Артикул (SKU)' : 'Артикул (SKU)',
      values: skuValues,
      differs: doesRowDiffer(skuValues),
    },
  ];

  // 2. Electrical & Performance Summary Metrics
  const powerNumbers = metrics.map((m) => m.powerKw);
  const powerValues = metrics.map((m) => {
    if (m.powerKw === null) return '—';
    if (m.powerKw < 1) {
      return `${Math.round(m.powerKw * 1000)} ${isRussian ? 'Вт' : 'Вт'}`;
    }
    return `${formatNumberDisplay(m.powerKw)} ${isRussian ? 'кВт' : 'кВт'}`;
  });
  const batteryNumbers = metrics.map((m) => m.batteryKwh);
  const batteryValues = metrics.map((m) =>
    m.batteryKwh !== null
      ? `${formatNumberDisplay(m.batteryKwh)} ${isRussian ? 'кВт·ч' : 'кВт·год'}`
      : '—',
  );
  const phaseValues = metrics.map((m) => m.phasesLabel ?? '—');
  const chemistryValues = metrics.map((m) => m.chemistryLabel ?? '—');
  const warrantyValues = metrics.map((m) => m.warrantyLabel ?? '—');

  const electricalRows: CompareDetailRow[] = [
    ...(powerValues.some((v) => v !== '—')
      ? [
          {
            id: 'elec-power',
            section: 'electrical' as const,
            label: isRussian ? 'Номинальная мощность' : 'Номінальна потужність',
            values: powerValues,
            differs: doesRowDiffer(powerValues),
            bestIndices: findOptimalMetricIndices(powerNumbers, 'max'),
            bestTag: isRussian ? 'Макс. мощность' : 'Макс. потужність',
          },
        ]
      : []),
    ...(batteryValues.some((v) => v !== '—')
      ? [
          {
            id: 'elec-battery',
            section: 'electrical' as const,
            label: isRussian ? 'Ёмкость накопления (АКБ)' : 'Ємність накопичення (АКБ)',
            values: batteryValues,
            differs: doesRowDiffer(batteryValues),
            bestIndices: findOptimalMetricIndices(batteryNumbers, 'max'),
            bestTag: isRussian ? 'Макс. запас' : 'Макс. запас',
          },
        ]
      : []),
    ...(phaseValues.some((v) => v !== '—')
      ? [
          {
            id: 'elec-phases',
            section: 'electrical' as const,
            label: isRussian ? 'Сетевая архитектура' : 'Мережева архітектура',
            values: phaseValues,
            differs: doesRowDiffer(phaseValues),
          },
        ]
      : []),
    ...(chemistryValues.some((v) => v !== '—')
      ? [
          {
            id: 'elec-chemistry',
            section: 'electrical' as const,
            label: isRussian ? 'Технология / тип ячеек' : 'Технологія / тип комірок',
            values: chemistryValues,
            differs: doesRowDiffer(chemistryValues),
          },
        ]
      : []),
    ...(warrantyValues.some((v) => v !== '—')
      ? [
          {
            id: 'elec-warranty',
            section: 'electrical' as const,
            label: isRussian ? 'Гарантийный срок' : 'Гарантійний термін',
            values: warrantyValues,
            differs: doesRowDiffer(warrantyValues),
          },
        ]
      : []),
  ];

  // 3. Detailed Passport Technical Specs
  const specRows: CompareDetailRow[] = buildComparisonSpecRows(products, isRussian).map((row, idx) => ({
    id: `spec-${idx}-${row.label.toLowerCase().replace(/\s+/g, '-')}`,
    section: 'specs',
    label: row.label,
    values: row.values,
    differs: row.differs,
  }));

  // 4. Engineering & Application Notes
  const typeValues = products.map((p) =>
    p.isKit
      ? isRussian
        ? 'Готовый комплект с монтажом / настройкой'
        : 'Готовий комплект із монтажем / налаштуванням'
      : isRussian
        ? 'Отдельный компонент для СЭС / резерва'
        : 'Окремий компонент для СЕС / резерву',
  );
  const descValues = products.map((p) => {
    const text = isRussian ? p.descriptionRu ?? localizeCatalogText(p.description) : p.description;
    return text.trim() || '—';
  });

  const engineeringRows: CompareDetailRow[] = [
    {
      id: 'eng-type',
      section: 'engineering',
      label: isRussian ? 'Формат внедрения' : 'Формат впровадження',
      values: typeValues,
      differs: doesRowDiffer(typeValues),
    },
    {
      id: 'eng-desc',
      section: 'engineering',
      label: isRussian ? 'Инженерное описание' : 'Інженерний опис',
      values: descValues,
      differs: doesRowDiffer(descValues),
    },
  ];

  const sections: DetailedComparisonSection[] = [
    {
      id: 'commercial',
      title: isRussian ? 'Коммерческие условия и выгода' : 'Комерційні умови та вигода',
      subtitle: isRussian
        ? 'Стоимость, удельная цена за 1 кВт / кВт·ч и наличие'
        : 'Вартість, питома ціна за 1 кВт / кВт·год та наявність',
      rows: commercialRows,
    },
    ...(electricalRows.length > 0
      ? [
          {
            id: 'electrical' as const,
            title: isRussian ? 'Ключевые энергетические показатели' : 'Ключові енергетичні показники',
            subtitle: isRussian
              ? 'Сопоставление мощности, запаса энергии и архитектуры подключения'
              : 'Зіставлення потужності, запасу енергії та архітектури підключення',
            rows: electricalRows,
          },
        ]
      : []),
    {
      id: 'specs',
      title: isRussian ? 'Паспортные технические характеристики' : 'Паспортні технічні характеристики',
      subtitle: isRussian
        ? 'Полный перечень заводских спецификаций из карточки каждого товара'
        : 'Повний перелік заводських специфікацій із картки кожного товару',
      rows: specRows,
    },
    {
      id: 'engineering',
      title: isRussian ? 'Назначение и комплектация' : 'Призначення та комплектація',
      subtitle: isRussian
        ? 'Сценарии применения и краткое описание комплекта'
        : 'Сценарії застосування та стислий опис комплекту',
      rows: engineeringRows,
    },
  ];

  return sections;
}
