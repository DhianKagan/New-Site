import { useMemo, useState } from 'react';
import {
  BatteryCharging,
  Check,
  Cpu,
  Plus,
  ShoppingBag,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import type { Product } from '../../types.ts';
import {
  calculateSolarConstructor,
  DEFAULT_BUSINESS_TARIFF_UAH,
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  matchConstructorEquipment,
  type ConstructorPresetId,
  type ConstructorSeasonMode,
} from '../../lib/calculators.ts';
import { formatUahFromUsd } from '../../lib/currency.ts';
import { tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface SolarConstructorTabProps {
  products: Product[];
  usdUahRate: number | null;
  onAddToCart: (product: Product) => void;
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, notes?: string) => void;
}

type ObjectPresetId = ConstructorPresetId;
type SeasonMode = ConstructorSeasonMode;

interface LoadItem {
  id: string;
  nameUk: string;
  nameRu: string;
  watts: number;
  surgeMult: number;
  qty: number;
  hoursPerDay: number;
  critical: boolean;
}

const DEFAULT_LOADS: LoadItem[] = [
  { id: 'fridge', nameUk: 'Холодильник інверторний', nameRu: 'Холодильник инверторный', watts: 140, surgeMult: 3.0, qty: 1, hoursPerDay: 8, critical: true },
  { id: 'boiler_gas', nameUk: 'Газовий котел + насоси', nameRu: 'Газовый котёл + насосы', watts: 130, surgeMult: 1.5, qty: 1, hoursPerDay: 10, critical: true },
  { id: 'it_lights', nameUk: 'Wi-Fi, ноутбуки, LED-освітлення', nameRu: 'Wi-Fi, ноутбуки, LED-освещение', watts: 220, surgeMult: 1.1, qty: 1, hoursPerDay: 8, critical: true },
  { id: 'pump', nameUk: 'Скважинний / водяний насос', nameRu: 'Скважинный / водяной насос', watts: 1100, surgeMult: 2.8, qty: 0, hoursPerDay: 1.5, critical: false },
  { id: 'ac', nameUk: 'Кондиціонер інверторний', nameRu: 'Кондиционер инверторный', watts: 1200, surgeMult: 1.4, qty: 0, hoursPerDay: 5, critical: false },
  { id: 'kettle', nameUk: 'Електрочайник / кавомашина', nameRu: 'Электрочайник / кофемашина', watts: 2000, surgeMult: 1.0, qty: 1, hoursPerDay: 0.4, critical: false },
  { id: 'water_heater', nameUk: 'Бойлер електричний', nameRu: 'Бойлер электрический', watts: 1800, surgeMult: 1.0, qty: 0, hoursPerDay: 2.5, critical: false },
  { id: 'washer', nameUk: 'Пральна машина', nameRu: 'Стиральная машина', watts: 2100, surgeMult: 1.3, qty: 0, hoursPerDay: 1.0, critical: false },
  { id: 'stove', nameUk: 'Індукційна плита / духова шафа', nameRu: 'Индукционная плита / духовка', watts: 3200, surgeMult: 1.0, qty: 0, hoursPerDay: 1.0, critical: false },
  { id: 'ev_charger', nameUk: 'Зарядка електромобіля / верстат', nameRu: 'Зарядка электромобиля / станок', watts: 7000, surgeMult: 1.1, qty: 0, hoursPerDay: 2.0, critical: false },
];

const PRESET_CONFIGS: Record<
  ObjectPresetId,
  {
    uk: string;
    ru: string;
    img: string;
    phases: 1 | 3;
    autonomyHours: number;
    solarKw: number;
    tariffUah: number;
    activeLoads: Record<string, { qty: number; hours: number }>;
  }
> = {
  apartment: {
    uk: 'Квартира (ДБЖ)',
    ru: 'Квартира (ИБП)',
    img: '/assets/energocomfort/backup_deye_8kw.jpg',
    phases: 1,
    autonomyHours: 8,
    solarKw: 0,
    tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH,
    activeLoads: {
      fridge: { qty: 1, hours: 8 },
      boiler_gas: { qty: 1, hours: 10 },
      it_lights: { qty: 1, hours: 8 },
      kettle: { qty: 1, hours: 0.4 },
      pump: { qty: 0, hours: 1 },
      ac: { qty: 0, hours: 4 },
      water_heater: { qty: 0, hours: 2 },
      washer: { qty: 0, hours: 1 },
      stove: { qty: 0, hours: 1 },
      ev_charger: { qty: 0, hours: 2 },
    },
  },
  house: {
    uk: 'Приватний будинок',
    ru: 'Частный дом',
    img: '/assets/energocomfort/house_6kw.png',
    phases: 3,
    autonomyHours: 10,
    solarKw: 10,
    tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH,
    activeLoads: {
      fridge: { qty: 1, hours: 8 },
      boiler_gas: { qty: 1, hours: 12 },
      it_lights: { qty: 2, hours: 8 },
      pump: { qty: 1, hours: 1.5 },
      ac: { qty: 1, hours: 5 },
      kettle: { qty: 1, hours: 0.5 },
      water_heater: { qty: 1, hours: 2.5 },
      washer: { qty: 1, hours: 1 },
      stove: { qty: 0, hours: 1 },
      ev_charger: { qty: 0, hours: 2 },
    },
  },
  business: {
    uk: 'Офіс / Магазин',
    ru: 'Офис / Магазин',
    img: '/assets/energocomfort/office_16kw.png',
    phases: 3,
    autonomyHours: 6,
    solarKw: 20,
    tariffUah: DEFAULT_BUSINESS_TARIFF_UAH,
    activeLoads: {
      fridge: { qty: 2, hours: 10 },
      boiler_gas: { qty: 0, hours: 8 },
      it_lights: { qty: 4, hours: 10 },
      pump: { qty: 0, hours: 1 },
      ac: { qty: 3, hours: 7 },
      kettle: { qty: 1, hours: 0.8 },
      water_heater: { qty: 1, hours: 2 },
      washer: { qty: 0, hours: 1 },
      stove: { qty: 0, hours: 1 },
      ev_charger: { qty: 0, hours: 2 },
    },
  },
  factory: {
    uk: 'Виробництво / СТО',
    ru: 'Производство / СТО',
    img: '/assets/energocomfort/factory_110kw.png',
    phases: 3,
    autonomyHours: 4,
    solarKw: 50,
    tariffUah: 10.2,
    activeLoads: {
      fridge: { qty: 2, hours: 10 },
      boiler_gas: { qty: 1, hours: 10 },
      it_lights: { qty: 5, hours: 12 },
      pump: { qty: 1, hours: 3 },
      ac: { qty: 3, hours: 8 },
      kettle: { qty: 1, hours: 1 },
      water_heater: { qty: 1, hours: 3 },
      washer: { qty: 0, hours: 1 },
      stove: { qty: 0, hours: 1 },
      ev_charger: { qty: 2, hours: 4 },
    },
  },
};

export function SolarConstructorTab({
  products,
  usdUahRate,
  onAddToCart,
  onOpenLeadModal,
}: SolarConstructorTabProps) {
  const [preset, setPreset] = useState<ObjectPresetId>('house');
  const [phases, setPhases] = useState<1 | 3>(3);
  const [autonomyHours, setAutonomyHours] = useState(10);
  const [solarKw, setSolarKw] = useState(10);
  const [season, setSeason] = useState<SeasonMode>('spring_autumn');
  const [tariffUah, setTariffUah] = useState(4.32);
  const [simultaneity, setSimultaneity] = useState(0.65);

  const [loads, setLoads] = useState<LoadItem[]>(() =>
    DEFAULT_LOADS.map((item) => {
      const p = PRESET_CONFIGS.house.activeLoads[item.id];
      return p ? { ...item, qty: p.qty, hoursPerDay: p.hours } : item;
    }),
  );

  // Custom appliance creator
  const [customName, setCustomName] = useState('');
  const [customWatts, setCustomWatts] = useState('500');
  const [customHours, setCustomHours] = useState('3');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  function applyPreset(nextPreset: ObjectPresetId) {
    const cfg = PRESET_CONFIGS[nextPreset];
    setPreset(nextPreset);
    setPhases(cfg.phases);
    setAutonomyHours(cfg.autonomyHours);
    setSolarKw(cfg.solarKw);
    setTariffUah(cfg.tariffUah);
    setLoads((prev) =>
      prev.map((item) => {
        const match = cfg.activeLoads[item.id];
        return match ? { ...item, qty: match.qty, hoursPerDay: match.hours } : item;
      }),
    );
  }

  function updateLoadQty(id: string, delta: number) {
    setLoads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(0, Math.min(20, item.qty + delta)) } : item)),
    );
  }

  function updateLoadHours(id: string, hours: number) {
    setLoads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, hoursPerDay: Math.max(0.1, Math.min(24, hours)) } : item)),
    );
  }

  function addCustomLoad() {
    const cleanName = customName.trim();
    const watts = Math.max(10, Math.min(50000, Number(customWatts) || 0));
    const hours = Math.max(0.2, Math.min(24, Number(customHours) || 1));
    if (!cleanName || watts <= 0) return;

    setLoads((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        nameUk: cleanName,
        nameRu: cleanName,
        watts,
        surgeMult: 1.2,
        qty: 1,
        hoursPerDay: hours,
        critical: true,
      },
    ]);
    setCustomName('');
  }

  function removeCustomLoad(id: string) {
    setLoads((prev) => prev.filter((item) => item.id !== id));
  }

  const baseCalc = useMemo(
    () =>
      calculateSolarConstructor({
        loads,
        simultaneity,
        autonomyHours,
        phases,
        solarKw,
        season,
        tariffUah,
        preset,
      }),
    [loads, simultaneity, autonomyHours, phases, solarKw, season, tariffUah, preset],
  );

  const matchedEquipment = useMemo(
    () =>
      matchConstructorEquipment({
        products,
        recommendedInverterKw: baseCalc.recommendedInverterKw,
        recommendedBatteryKwh: baseCalc.recommendedBatteryKwh,
        phases,
        solarKw,
      }),
    [products, baseCalc.recommendedInverterKw, baseCalc.recommendedBatteryKwh, phases, solarKw],
  );

  const calc = useMemo(
    () => ({
      ...baseCalc,
      panelsCount: matchedEquipment.panelsCount,
      roofAreaM2: matchedEquipment.roofAreaM2,
    }),
    [baseCalc, matchedEquipment.panelsCount, matchedEquipment.roofAreaM2],
  );

  const estimatedPaybackMonths =
    solarKw > 0 && calc.monthlySavingsUah > 0 && matchedEquipment.estimatedEquipmentUsd > 0 && usdUahRate
      ? Math.max(1, Math.round((matchedEquipment.estimatedEquipmentUsd * usdUahRate) / calc.monthlySavingsUah))
      : null;

  function handleSendConfigToEngineer() {
    const activeSummary = loads
      .filter((l) => l.qty > 0)
      .map((l) => `${tr(l.nameUk, l.nameRu)} ×${l.qty} (${l.watts} Вт, ${l.hoursPerDay} ${tr('год', 'ч')})`)
      .join('; ');
    const notes = [
      `${tr('Об’єкт', 'Объект')}: ${tr(PRESET_CONFIGS[preset].uk, PRESET_CONFIGS[preset].ru)} (${phases} ${tr('ф', 'ф')})`,
      `${tr('Навантаження', 'Нагрузка')}: ${calc.workingKw} кВт (${tr('пік', 'пик')} ${calc.peakSurgeKw} кВт), ${calc.dailyConsumptionKwh} кВт·год/добу`,
      `${tr('Рекомендовано', 'Рекомендовано')}: ${tr('інвертор', 'инвертор')} ${calc.recommendedInverterKw} кВт, АКБ ${calc.recommendedBatteryKwh} кВт·год (${autonomyHours} год), СЕС ${solarKw} кВт (${calc.panelsCount} × ${matchedEquipment.panelWatts} Вт)`,
      estimatedPaybackMonths
        ? `${tr('Окупність обладнання', 'Окупаемость оборудования')}: ~${estimatedPaybackMonths} ${tr('міс.', 'мес.')}`
        : '',
      `${tr('Прилади', 'Приборы')}: ${activeSummary}`,
    ]
      .filter(Boolean)
      .join('\n');

    onOpenLeadModal(
      tr(
        `Конструктор кабінету: ${calc.recommendedInverterKw} кВт + АКБ ${calc.recommendedBatteryKwh} кВт·год`,
        `Конструктор кабинета: ${calc.recommendedInverterKw} кВт + АКБ ${calc.recommendedBatteryKwh} кВт·ч`,
      ),
      matchedEquipment.estimatedEquipmentUsd || undefined,
      notes,
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Scenario Presets + Parameters */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <SmartImage
              src={PRESET_CONFIGS[preset].img}
              alt={tr(PRESET_CONFIGS[preset].uk, PRESET_CONFIGS[preset].ru)}
              className="w-16 h-14 rounded-xl object-cover border border-slate-200 shrink-0 hidden sm:block"
            />
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1769aa]" />
                {tr('Персональний конструктор СЕС та резервного живлення', 'Персональный конструктор СЭС и резервного питания')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr(
                  'Оберіть тип об’єкта, налаштуйте прилади та час автономності — система підбере інвертор, АКБ і покаже добовий баланс.',
                  'Выберите тип объекта, настройте приборы и время автономности — система подберёт инвертор, АКБ и покажет суточный баланс.',
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PRESET_CONFIGS) as ObjectPresetId[]).map((id) => {
              const active = preset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0d1f33] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tr(PRESET_CONFIGS[id].uk, PRESET_CONFIGS[id].ru)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders & Network Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#0d1f33]">
              <span>{tr('Автономність без світла', 'Автономность без света')}</span>
              <span className="font-mono text-[#1769aa]">{autonomyHours} {tr('год', 'ч')}</span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={autonomyHours}
              onChange={(e) => setAutonomyHours(Number(e.target.value))}
              className="w-full accent-[#1769aa] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>2 {tr('год', 'ч')}</span>
              <span>12 {tr('год', 'ч')}</span>
              <span>24 {tr('год', 'ч')}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#0d1f33]">
              <span>{tr('Сонячне поле', 'Солнечное поле')}</span>
              <span className="font-mono text-amber-600">{solarKw} кВт</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={solarKw}
              onChange={(e) => setSolarKw(Number(e.target.value))}
              className="w-full accent-[#f59e0b] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 ({tr('без панелей', 'без панелей')})</span>
              <span>30 кВт</span>
              <span>60 кВт</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#0d1f33]">
              <span>{tr('Одночасність приладів', 'Одновременность приборов')}</span>
              <span className="font-mono text-[#169374]">{Math.round(simultaneity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={simultaneity}
              onChange={(e) => setSimultaneity(Number(e.target.value))}
              className="w-full accent-[#169374] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>35% ({tr('ощадно', 'экономно')})</span>
              <span>65%</span>
              <span>100% ({tr('усе разом', 'всё сразу')})</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#0d1f33]">
              <span>{tr('Мережа і сезон', 'Сеть и сезон')}</span>
              <div className="inline-flex rounded-md border border-slate-300 bg-white overflow-hidden">
                {([1, 3] as const).map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setPhases(ph)}
                    className={`px-2 py-0.5 text-[10px] font-extrabold cursor-pointer ${
                      phases === ph ? 'bg-[#0d1f33] text-white' : 'text-slate-600'
                    }`}
                  >
                    {ph}Ф
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['summer', tr('Літо', 'Лето')],
                  ['spring_autumn', tr('Весна/Осінь', 'Весна/Осень')],
                  ['winter', tr('Зима', 'Зима')],
                ] as const
              ).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`px-1.5 py-1 rounded text-[10px] font-bold truncate cursor-pointer ${
                    season === s ? 'bg-[#1769aa] text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{tr('Тариф:', 'Тариф:')}</span>
              <input
                type="number"
                step="0.1"
                min="1"
                max="20"
                value={tariffUah}
                onChange={(e) => setTariffUah(Math.max(1, Number(e.target.value) || 4.32))}
                className="w-16 text-right font-mono font-bold text-[#0d1f33] bg-white border border-slate-200 rounded px-1.5 py-0.5"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Main Split: Appliances Left, Live Telemetry & Equipment Right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        {/* Appliances & Loads Builder */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#0d1f33]">
                {tr('Список приладів і навантажень', 'Список приборов и нагрузок')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {tr('Увімкніть потрібну техніку та вкажіть годин на добу для точного розрахунку ємності АКБ.', 'Включите нужную технику и укажите часов в сутки для точного расчёта ёмкости АКБ.')}
              </p>
            </div>
            <Badge variant="info">
              {calc.activeCount} {tr('активних', 'активных')}
            </Badge>
          </div>

          <div className="space-y-2 max-h-[470px] overflow-y-auto pr-1">
            {loads.map((item) => {
              const active = item.qty > 0;
              const isCustom = item.id.startsWith('custom-');
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-colors flex flex-wrap items-center justify-between gap-2.5 ${
                    active ? 'border-[#1769aa]/40 bg-sky-50/40' : 'border-slate-200 bg-white opacity-80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0d1f33] truncate">
                        {tr(item.nameUk, item.nameRu)}
                      </span>
                      {item.critical && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {tr('ДБЖ', 'ИБП')}
                        </span>
                      )}
                      {item.surgeMult >= 2 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {tr('пуск', 'пуск')} ×{item.surgeMult}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.watts} Вт
                      {active ? ` · ${(Math.round(((item.watts * item.qty * item.hoursPerDay) / 1000) * 10) / 10)} кВт·год/добу` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {active && (
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="number"
                          min={0.1}
                          max={24}
                          step={0.5}
                          value={item.hoursPerDay}
                          onChange={(e) => updateLoadHours(item.id, Number(e.target.value) || 1)}
                          className="w-12 text-center font-mono font-bold border border-slate-300 rounded px-1 py-0.5 bg-white text-[#0d1f33]"
                        />
                        <span>{tr('г/д', 'ч/д')}</span>
                      </label>
                    )}

                    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateLoadQty(item.id, -1)}
                        className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        −
                      </button>
                      <span className="px-2 text-xs font-mono font-extrabold text-[#0d1f33] min-w-[24px] text-center">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateLoadQty(item.id, 1)}
                        className="px-2 py-1 text-xs font-bold text-[#1769aa] hover:bg-sky-50 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => removeCustomLoad(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        title={tr('Видалити', 'Удалить')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add custom appliance */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-[1fr_84px_76px_auto] gap-2 items-center">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={tr('Свій прилад (напр. сервер / фрезер)', 'Свой прибор (напр. сервер / фрезер)')}
            />
            <Input
              type="number"
              min={10}
              max={50000}
              value={customWatts}
              onChange={(e) => setCustomWatts(e.target.value)}
              placeholder="Вт"
              className="font-mono"
            />
            <Input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              placeholder={tr('Год', 'Час')}
              className="font-mono"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomLoad}>
              <Plus className="w-3.5 h-3.5" />
              {tr('Додати', 'Добавить')}
            </Button>
          </div>
        </Card>

        {/* Right: Live Results + 24h Chart + Catalog Match */}
        <div className="space-y-4">
          <Card className="p-5 bg-[#0d1f33] text-white border-0 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                {tr('Рекомендована конфігурація', 'Рекомендованная конфигурация')}
              </span>
              <Badge variant="warning">{phases} {tr('фази', 'фазы')}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-[11px] text-slate-300 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-[#f59e0b]" />
                  {tr('Інвертор', 'Инвертор')}
                </div>
                <div className="text-xl font-extrabold font-mono mt-1">{calc.recommendedInverterKw} кВт</div>
                <div className="text-[10px] text-slate-300">
                  {tr('робоче:', 'рабочее:')} {calc.workingKw} кВт · {tr('пік:', 'пик:')} {calc.peakSurgeKw} кВт
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-[11px] text-slate-300 flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  {tr('АКБ LiFePO4', 'АКБ LiFePO4')}
                </div>
                <div className="text-xl font-extrabold font-mono mt-1">{calc.recommendedBatteryKwh} кВт·год</div>
                <div className="text-[10px] text-slate-300">
                  {tr('на', 'на')} {autonomyHours} {tr('год без світла', 'ч без света')} (~{calc.neededAutonomyKwh} кВт·год)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-[11px] text-slate-300 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  {tr('Сонячне поле', 'Солнечное поле')}
                </div>
                <div className="text-xl font-extrabold font-mono mt-1">
                  {solarKw > 0 ? `${solarKw} кВт` : tr('Без СЕС', 'Без СЭС')}
                </div>
                <div className="text-[10px] text-slate-300">
                  {solarKw > 0
                    ? `${calc.panelsCount} × ${matchedEquipment.panelWatts} Вт (~${calc.roofAreaM2} м²)`
                    : tr('режим резерву ДБЖ', 'режим резерва ИБП')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-[11px] text-slate-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-sky-300" />
                  {tr('Добовий баланс', 'Суточный баланс')}
                </div>
                <div className="text-xl font-extrabold font-mono mt-1">{calc.coveragePct}%</div>
                <div className="text-[10px] text-slate-300">
                  {tr('спожив.', 'потр.')} {calc.dailyConsumptionKwh} / {tr('ген.', 'ген.')} {calc.dailySolarGenKwh} кВт·год
                </div>
              </div>
            </div>

            {/* 24h Hourly Generation vs Load Bars */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-2">
                <span>{tr('Симуляція доби 00:00–23:00 (сонце vs навантаження)', 'Симуляция суток 00:00–23:00 (солнце vs нагрузка)')}</span>
                {solarKw > 0 && (
                  <span className="font-mono font-bold text-emerald-300">
                    ~{calc.monthlySavingsUah.toLocaleString('uk-UA')} {tr('грн/міс', 'грн/мес')}
                    {estimatedPaybackMonths
                      ? ` · ~${estimatedPaybackMonths} ${tr('міс.', 'мес.')}`
                      : ''}
                  </span>
                )}
              </div>
              <div className="h-20 flex items-end gap-1">
                {calc.hourlySim.map((h) => {
                  const maxVal = Math.max(2, ...calc.hourlySim.map((x) => Math.max(x.pvKw, x.loadKw)));
                  const pvH = Math.round((h.pvKw / maxVal) * 100);
                  const loadH = Math.round((h.loadKw / maxVal) * 100);
                  return (
                    <div
                      key={h.hour}
                      className="flex-1 h-full flex items-end justify-center gap-[1px]"
                      title={`${String(h.hour).padStart(2, '0')}:00 · PV ${h.pvKw} кВт / Load ${h.loadKw} кВт`}
                    >
                      <div
                        className="w-1/2 rounded-t bg-amber-400/90 transition-all"
                        style={{ height: `${Math.max(pvH, solarKw > 0 ? 2 : 0)}%` }}
                      />
                      <div
                        className="w-1/2 rounded-t bg-sky-400/80 transition-all"
                        style={{ height: `${Math.max(loadH, 4)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>00:00</span>
                <span>06:00</span>
                <span className="text-amber-300">12:00 (PV)</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          </Card>

          {/* Matching Catalog Equipment */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#0d1f33]">
                {tr('Підбір зі складу під ваш розрахунок', 'Подбор со склада под ваш расчёт')}
              </h3>
              {matchedEquipment.estimatedEquipmentUsd > 0 && (
                <span className="font-mono text-xs font-extrabold text-[#169374]">
                  ≈ {formatUahFromUsd(matchedEquipment.estimatedEquipmentUsd, usdUahRate)}
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              {[
                matchedEquipment.inverter && {
                  role: tr('Інвертор', 'Инвертор'),
                  product: matchedEquipment.inverter,
                  qtyLabel: '× 1',
                },
                matchedEquipment.battery && {
                  role: 'LiFePO4 АКБ',
                  product: matchedEquipment.battery,
                  qtyLabel: `× ${matchedEquipment.batteryUnits}`,
                },
                matchedEquipment.panel &&
                  calc.panelsCount > 0 && {
                    role: tr('Сонячні панелі', 'Солнечные панели'),
                    product: matchedEquipment.panel,
                    qtyLabel: `× ${calc.panelsCount}`,
                  },
              ]
                .filter((x): x is { role: string; product: Product; qtyLabel: string } => Boolean(x))
                .map(({ role, product, qtyLabel }) => {
                  const isAdded = addedProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SmartImage
                          src={product.img}
                          alt={product.title}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-50 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-[#1769aa] uppercase">
                            {role} <span className="font-mono text-slate-500">{qtyLabel}</span>
                          </div>
                          <div className="font-bold text-[#0d1f33] truncate">{product.title}</div>
                          <div className="text-[11px] font-mono text-slate-600">
                            {formatUahFromUsd(product.price, usdUahRate)} / шт
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isAdded ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          onAddToCart(product);
                          setAddedProductId(product.id);
                          window.setTimeout(() => setAddedProductId(null), 1500);
                        }}
                        className="shrink-0"
                      >
                        {isAdded ? <Check className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                        {isAdded ? tr('У кошику', 'В корзине') : tr('У кошик', 'В корзину')}
                      </Button>
                    </div>
                  );
                })}
            </div>

            <Button type="button" variant="primary" onClick={handleSendConfigToEngineer} className="w-full">
              <Sparkles className="w-4 h-4 text-[#f59e0b]" />
              {tr('Надіслати цю конфігурацію інженеру на перевірку', 'Отправить эту конфигурацию инженеру на проверку')}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
