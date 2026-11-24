import { useMemo, useState } from 'react';
import {
  BatteryCharging,
  CheckCircle2,
  Compass,
  Cpu,
  HelpCircle,
  Sparkles,
  Sun,
  XCircle,
} from 'lucide-react';
import type { Product } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';

interface TechGuideTabProps {
  products?: Product[];
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, notes?: string) => void;
}

type GuideSection = 'panels' | 'batteries' | 'inverters';
type RoofScenario = 'pitched_south' | 'flat_light' | 'east_west' | 'shade_hot';

const PANEL_TECHS = [
  {
    id: 'perc',
    name: 'P-type Mono PERC',
    efficiency: '20.5 – 21.4%',
    degradation: '~0.55% / рік · -0.35%/°C',
    degradationRu: '~0.55% / год · -0.35%/°C',
    priceLevelUk: 'Базова ціна',
    priceLevelRu: 'Базовая цена',
    bestForUk: 'Класичні південні дахи за обмеженого бюджету, коли площа даху не лімітована.',
    bestForRu: 'Классические южные крыши при ограниченном бюджете, когда площадь крыши не лимитирована.',
    prosUk: ['Найнижча вартість за Вт', 'Перевірена роками технологія'],
    prosRu: ['Самая низкая цена за Вт', 'Проверенная годами технология'],
    badge: 'default' as const,
  },
  {
    id: 'topcon',
    name: 'N-type TOPCon',
    efficiency: '22.3 – 23.2%',
    degradation: '~0.40% / рік · -0.29%/°C',
    degradationRu: '~0.40% / год · -0.29%/°C',
    priceLevelUk: 'Оптимум ціна / кВт',
    priceLevelRu: 'Оптимум цена / кВт',
    bestForUk: 'Сучасний стандарт 2025–2026: краще працює у похмуру погоду, спеку та має на 8–10% більшу генерацію з того ж даху.',
    bestForRu: 'Современный стандарт 2025–2026: лучше работает в пасмурную погоду, жару и даёт на 8–10% больше генерации с той же крыши.',
    prosUk: ['Немає ефекту LID деградації', 'Більше кВт на обмеженій площі даху'],
    prosRu: ['Нет эффекта LID деградации', 'Больше кВт на ограниченной площади крыши'],
    badge: 'info' as const,
  },
  {
    id: 'bifacial',
    name: 'Bifacial (Двосторонні)',
    efficiency: '22.5% + до 25% тил',
    degradation: '~0.40% / рік · Dual Glass',
    degradationRu: '~0.40% / год · Dual Glass',
    priceLevelUk: 'Середня / Оптимум',
    priceLevelRu: 'Средняя / Оптимум',
    bestForUk: 'Наземні станції, плоскі дахи, навіси та альтанки — тильна сторона збирає відбите світло.',
    bestForRu: 'Наземные станции, плоские крыши, навесы и террасы — тыльная сторона собирает отражённый свет.',
    prosUk: ['+10…25% генерації від світлої поверхні', 'Подвійне загартоване скло (30 років ресурсу)'],
    prosRu: ['+10…25% генерации от светлой поверхности', 'Двойное закалённое стекло (30 лет ресурса)'],
    badge: 'success' as const,
  },
  {
    id: 'hjt',
    name: 'N-type HJT',
    efficiency: '23.0 – 24.1%',
    degradation: '~0.30% / рік · -0.24%/°C',
    degradationRu: '~0.30% / год · -0.24%/°C',
    priceLevelUk: 'Преміум сегмент',
    priceLevelRu: 'Премиум сегмент',
    bestForUk: 'Південні регіони з високою спекою (+35°C+), малі дахи, де треба максимум Вт з кожного м².',
    bestForRu: 'Южные регионы с сильной жарой (+35°C+), малые крыши, где нужен максимум Вт с каждого м².',
    prosUk: ['Мінімальні втрати при нагріві влітку', 'Максимальний ККД у похмурий день'],
    prosRu: ['Минимальные потери при нагреве летом', 'Максимальный КПД в пасмурный день'],
    badge: 'warning' as const,
  },
];

const ROOF_ADVISOR: Record<
  RoofScenario,
  {
    labelUk: string;
    labelRu: string;
    pickName: string;
    gainUk: string;
    gainRu: string;
    reasonUk: string;
    reasonRu: string;
  }
> = {
  pitched_south: {
    labelUk: 'Скатний темний дах (метал / бітум)',
    labelRu: 'Скатная тёмная крыша (металл / битум)',
    pickName: 'N-type TOPCon (585–610 Вт)',
    gainUk: '+8–11% виробітку проти PERC',
    gainRu: '+8–11% выработки против PERC',
    reasonUk: 'На темній покрівлі тильна сторона закрита, тому переплачувати за Bifacial немає сенсу. TOPCon дає найкращу окупність і не гріється як PERC.',
    reasonRu: 'На тёмной кровле тыльная сторона закрыта, поэтому переплачивать за Bifacial нет смысла. TOPCon даёт лучшую окупаемость и греется меньше PERC.',
  },
  flat_light: {
    labelUk: 'Плоский дах / Навіс / Земля',
    labelRu: 'Плоская крыша / Навес / Земля',
    pickName: 'N-type TOPCon Bifacial (Dual Glass)',
    gainUk: '+15–22% за рахунок тильного боку',
    gainRu: '+15–22% за счёт тыльной стороны',
    reasonUk: 'Відбитий від світлої мембрани, бетону чи гравію світловий потік безкоштовно додає 15–22% потужності, а подвійне скло витримує сніг і вітер.',
    reasonRu: 'Отражённый от светлой мембраны, бетона или гравия поток бесплатно добавляет 15–22% мощности, а двойное стекло держит снег и ветер.',
  },
  east_west: {
    labelUk: 'Схил Схід–Захід (без чистого півдня)',
    labelRu: 'Скат Восток–Запад (без чистого юга)',
    pickName: 'N-type TOPCon (2 окремих MPPT стрінги)',
    gainUk: 'Рівна генерація з 07:00 до 19:00',
    gainRu: 'Ровная генерация с 07:00 до 19:00',
    reasonUk: 'N-type краще стартує на світанку і за косими променями сонця. Обов’язково розбити Схід і Захід на різні MPPT входи інвертора.',
    reasonRu: 'N-type лучше стартует на рассвете и при косых лучах солнца. Обязательно разбить Восток и Запад на разные MPPT входы инвертора.',
  },
  shade_hot: {
    labelUk: 'Спека / Обмежена площа / Димка',
    labelRu: 'Жара / Малая площадь / Дымка',
    pickName: 'N-type HJT або TOPCon Half-Cell',
    gainUk: 'На 4–7% вищий виробіток у липні',
    gainRu: 'На 4–7% выше выработка в июле',
    reasonUk: 'У спеку поверхня панелі нагрівається до +65°C. Низький температурний коефіцієнт (-0.24%/°C) і технологія Half-Cell зберігають потужність.',
    reasonRu: 'В жару поверхность панели греется до +65°C. Низкий температурный коэффициент (-0.24%/°C) и технология Half-Cell берегут мощность.',
  },
};

export function TechGuideTab({ products = [], onOpenLeadModal }: TechGuideTabProps) {
  const [section, setSection] = useState<GuideSection>('panels');
  const [roofScenario, setRoofScenario] = useState<RoofScenario>('pitched_south');

  const samplePanelImg = products.find((p) => p.cat === 'panels' && p.img)?.img || '/assets/energocomfort/house_6kw.png';
  const sampleBatteryImg =
    products.find((p) => p.cat === 'batteries' && p.img)?.img || '/assets/energocomfort/kit_battery_30kwh_real.jpg';
  const sampleInverterImg =
    products.find((p) => p.cat === 'inverters' && p.img)?.img || '/assets/energocomfort/backup_deye_8kw.jpg';

  // Battery lifecycle simulator
  const [cyclesPerYear, setCyclesPerYear] = useState(220);
  const [usableKwhNeeded, setUsableKwhNeeded] = useState(10);

  // Inverter quick quiz
  const [needsBackup, setNeedsBackup] = useState(true);
  const [hasPanels, setHasPanels] = useState(true);
  const [wantsExport, setWantsExport] = useState(false);

  const batterySim = useMemo(() => {
    // LiFePO4: 6000 cycles, 90% DoD, ~$210/kWh installed nominal
    const lfpNominalKwh = usableKwhNeeded / 0.9;
    const lfpCostUsd = Math.round(lfpNominalKwh * 215);
    const lfpYears = Math.min(18, Math.round((6000 / cyclesPerYear) * 10) / 10);
    const lfpCostPerKwhCents = Math.round((lfpCostUsd / (usableKwhNeeded * 6000)) * 100);

    // AGM/Gel: 450 cycles at 50% DoD, ~$155/kWh nominal
    const agmNominalKwh = usableKwhNeeded / 0.5;
    const agmCostUsd = Math.round(agmNominalKwh * 155);
    const agmYears = Math.round((450 / cyclesPerYear) * 10) / 10;
    const agmReplacements10y = Math.max(1, Math.ceil(10 / Math.max(0.5, agmYears)));
    const agmTotal10yUsd = agmCostUsd * agmReplacements10y;
    const agmCostPerKwhCents = Math.round((agmCostUsd / (usableKwhNeeded * 450)) * 100);

    return {
      lfpCostUsd,
      lfpYears,
      lfpCostPerKwhCents,
      agmCostUsd,
      agmYears,
      agmReplacements10y,
      agmTotal10yUsd,
      agmCostPerKwhCents,
    };
  }, [cyclesPerYear, usableKwhNeeded]);

  const recommendedInverter = useMemo(() => {
    if (!needsBackup && hasPanels) {
      return {
        typeUk: 'Мережевий інвертор (On-grid)',
        typeRu: 'Сетевой инвертор (On-grid)',
        descUk: 'Максимально швидко окупається вдень на підприємствах або для Зеленого тарифу, але вимикається під час блекауту.',
        descRu: 'Максимально быстро окупается днём на предприятиях или для Зелёного тарифа, но выключается во время блэкаута.',
      };
    }
    if (needsBackup && !hasPanels && !wantsExport) {
      return {
        typeUk: 'Гібридний або ДБЖ-інвертор (з запасом під панелі)',
        typeRu: 'Гибридный или ИБП-инвертор (с запасом под панели)',
        descUk: 'Зараз працює від мережі + АКБ як тихий безперебійник (<10 мс), а в майбутньому до нього можна додати панелі без заміни обладнання.',
        descRu: 'Сейчас работает от сети + АКБ как тихий бесперебойник (<10 мс), а в будущем к нему можно добавить панели без замены оборудования.',
      };
    }
    return {
      typeUk: 'Гібридний інвертор (Hybrid)',
      typeRu: 'Гибридный инвертор (Hybrid)',
      descUk: 'Універсальне рішення: резерв <10 мс, сонячні панелі, підмішування навантаження і за потреби експорт надлишків за Net Billing.',
      descRu: 'Универсальное решение: резерв <10 мс, солнечные панели, подмешивание нагрузки и при желании экспорт излишков по Net Billing.',
    };
  }, [needsBackup, hasPanels, wantsExport]);

  const roofPick = ROOF_ADVISOR[roofScenario];

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['panels', Sun, tr('Типи сонячних панелей', 'Типы солнечных панелей')],
            ['batteries', BatteryCharging, tr('Акумулятори (LiFePO4 vs Gel)', 'Аккумуляторы (LiFePO4 vs Gel)')],
            ['inverters', Cpu, tr('Види інверторів', 'Виды инверторов')],
          ] as const
        ).map(([id, Icon, label]) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0d1f33] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#f59e0b]' : 'text-[#1769aa]'}`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* 1. SOLAR PANELS */}
      {section === 'panels' && (
        <div className="space-y-5">
          {/* Interactive Roof Advisor */}
          <Card className="p-5 bg-[#0d1f33] text-white border-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#f59e0b]" />
                <h2 className="text-sm font-extrabold">
                  {tr('Інтерактивний підбір типу панелі під ваш дах', 'Интерактивный подбор типа панели под вашу крышу')}
                </h2>
              </div>
              <Badge variant="warning">{tr('Експертна підказка', 'Экспертная подсказка')}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(Object.keys(ROOF_ADVISOR) as RoofScenario[]).map((key) => {
                const active = roofScenario === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRoofScenario(key)}
                    className={`p-3 rounded-xl text-left text-xs font-bold border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#f59e0b] text-[#0d1f33] border-[#f59e0b]'
                        : 'bg-white/10 text-slate-200 border-white/15 hover:bg-white/15'
                    }`}
                  >
                    {tr(ROOF_ADVISOR[key].labelUk, ROOF_ADVISOR[key].labelRu)}
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-white/10 border border-white/15 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 max-w-2xl">
                <SmartImage
                  src={samplePanelImg}
                  alt={roofPick.pickName}
                  className="w-20 h-16 rounded-lg object-cover border border-white/20 bg-white shrink-0 hidden sm:block"
                />
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-sky-300 uppercase">
                    {tr('Оптимальна технологія для вашого даху:', 'Оптимальная технология для вашей крыши:')}
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {roofPick.pickName}{' '}
                    <span className="text-xs font-bold text-emerald-300 ml-1">
                      ({tr(roofPick.gainUk, roofPick.gainRu)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{tr(roofPick.reasonUk, roofPick.reasonRu)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={() =>
                  onOpenLeadModal(
                    tr(`Підбір панелей: ${roofPick.pickName}`, `Подбор панелей: ${roofPick.pickName}`),
                    undefined,
                    `${tr('Сценарій даху', 'Сценарий крыши')}: ${tr(roofPick.labelUk, roofPick.labelRu)}`,
                  )
                }
                className="bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] border-0 font-bold shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {tr('Підібрати панелі', 'Подобрать панели')}
              </Button>
            </div>
          </Card>

          {/* 4 Panel Technologies Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PANEL_TECHS.map((tech) => (
              <Card key={tech.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0d1f33]">{tech.name}</h3>
                    <div className="text-[11px] font-mono text-[#1769aa] font-bold mt-0.5">
                      {tr('ККД:', 'КПД:')} {tech.efficiency}
                    </div>
                  </div>
                  <Badge variant={tech.badge}>{tr(tech.priceLevelUk, tech.priceLevelRu)}</Badge>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  {tr(tech.degradation, tech.degradationRu)}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{tr(tech.bestForUk, tech.bestForRu)}</p>

                <div className="space-y-1 pt-1 border-t border-slate-100">
                  {(tr('uk', 'ru') === 'uk' ? tech.prosUk : tech.prosRu).map((pro, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-[#0d1f33]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#169374] shrink-0" />
                      <span>{pro}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 2. BATTERIES */}
      {section === 'batteries' && (
        <div className="space-y-5">
          {/* Interactive Battery Lifecycle Calculator */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <SmartImage
                  src={sampleBatteryImg}
                  alt="LiFePO4 АКБ"
                  className="w-16 h-14 rounded-xl object-cover border border-slate-200 bg-white shrink-0 hidden sm:block"
                />
                <div>
                  <h2 className="text-base font-extrabold text-[#0d1f33]">
                    {tr('Калькулятор реальної вартості циклу АКБ (10 років)', 'Калькулятор реальной стоимости цикла АКБ (10 лет)')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {tr(
                      'Чому дешеві свинцеві Gel/AGM батареї виявляються у 3–4 рази дорожчими за LiFePO4 на дистанції.',
                      'Почему дешёвые свинцовые Gel/AGM батареи оказываются в 3–4 раза дороже LiFePO4 на дистанции.',
                    )}
                  </p>
                </div>
              </div>
              <Badge variant="success">LiFePO4 6000+ {tr('циклів', 'циклов')}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#0d1f33]">
                  <span>{tr('Циклів розряду на рік', 'Циклов разряда в год')}</span>
                  <span className="font-mono text-[#1769aa]">{cyclesPerYear}</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={365}
                  step={15}
                  value={cyclesPerYear}
                  onChange={(e) => setCyclesPerYear(Number(e.target.value))}
                  className="w-full accent-[#1769aa] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>50 ({tr('рідкі блекаути', 'редкие блэкауты')})</span>
                  <span>365 ({tr('щоденна робота з СЕС', 'ежедневная работа с СЭС')})</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#0d1f33]">
                  <span>{tr('Корисна ємність на кожен цикл', 'Полезная ёмкость на каждый цикл')}</span>
                  <span className="font-mono text-[#169374]">{usableKwhNeeded} кВт·год</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={2.5}
                  value={usableKwhNeeded}
                  onChange={(e) => setUsableKwhNeeded(Number(e.target.value))}
                  className="w-full accent-[#169374] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>5 кВт·год</span>
                  <span>15 кВт·год</span>
                  <span>30 кВт·год</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-[#169374] bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#0d1f33]">LiFePO4 (Літій-залізо-фосфат)</span>
                  <Badge variant="success">{tr('Вибір №1', 'Выбор №1')}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('Витрати за 10 років', 'Затраты за 10 лет')}</div>
                    <div className="font-mono font-extrabold text-[#0d1f33] text-sm">
                      ~${batterySim.lfpCostUsd.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('Строк служби', 'Срок службы')}</div>
                    <div className="font-mono font-extrabold text-[#169374] text-sm">
                      {batterySim.lfpYears} {tr('років', 'лет')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('Ціна 1 кВт·год циклу', 'Цена 1 кВт·ч цикла')}</div>
                    <div className="font-mono font-extrabold text-[#0d1f33] text-sm">
                      ${(batterySim.lfpCostPerKwhCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-900">
                  {tr(
                    'Глибина розряду до 90% DoD, швидкий заряд за 1–2 год (струмом 0.5C–1C), повна пожежобезпечність.',
                    'Глубина разряда до 90% DoD, быстрый заряд за 1–2 ч (током 0.5C–1C), полная пожаробезопасность.',
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-700">AGM / Gel ({tr('свинцево-кислотні', 'свинцово-кислотные')})</span>
                  <Badge variant="danger">{tr('Швидко зношуються', 'Быстро изнашиваются')}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('Витрати за 10 років', 'Затраты за 10 лет')}</div>
                    <div className="font-mono font-extrabold text-red-700 text-sm">
                      ~${batterySim.agmTotal10yUsd.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('1 комплект служить', '1 комплект служит')}</div>
                    <div className="font-mono font-extrabold text-slate-700 text-sm">
                      {batterySim.agmYears} {tr('р.', 'г.')} ({batterySim.agmReplacements10y}×)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">{tr('Ціна 1 кВт·год циклу', 'Цена 1 кВт·ч цикла')}</div>
                    <div className="font-mono font-extrabold text-red-700 text-sm">
                      ${(batterySim.agmCostPerKwhCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600">
                  {tr(
                    'Можна розряджати лише на 50%, заряд триває 8–10 годин (не встигає між відключеннями), вага в 3 рази більша.',
                    'Можно разряжать лишь на 50%, заряд длится 8–10 часов (не успевает между отключениями), вес в 3 раза больше.',
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* LV 48V vs HV comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0d1f33]">LiFePO4 48V (LV · Low Voltage)</h3>
                <Badge variant="info">5 – 30 кВт·год</Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {tr(
                  'Найпопулярніший формат для квартир і будинків (Deye, Pylontech, Dyness). Безпечна напруга 51.2В, легко додавати паралельні модулі по 5 кВт·год у будь-який момент.',
                  'Самый популярный формат для квартир и домов (Deye, Pylontech, Dyness). Безопасное напряжение 51.2В, легко добавлять параллельные модули по 5 кВт·ч в любой момент.',
                )}
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0d1f33]">LiFePO4 HV (High Voltage 200–600V)</h3>
                <Badge variant="warning">15 – 200+ кВт·год</Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {tr(
                  'Високовольтні стійки для 3-фазних будинків 15+ кВт і бізнесу. Вищий ККД перетворення (на 3–5%), тонші кабелі та менший нагрів інвертора.',
                  'Высоковольтные стойки для 3-фазных домов 15+ кВт и бизнеса. Выше КПД преобразования (на 3–5%), тоньше кабели и меньше нагрев инвертора.',
                )}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* 3. INVERTERS */}
      {section === 'inverters' && (
        <div className="space-y-5">
          {/* Quick 3-toggle picker */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#1769aa]" />
              <h2 className="text-base font-extrabold text-[#0d1f33]">
                {tr('Швидкий підбір типу інвертора під ваші задачі', 'Быстрый подбор типа инвертора под ваши задачи')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  val: needsBackup,
                  set: setNeedsBackup,
                  uk: 'Потрібен резерв при блекауті',
                  ru: 'Нужен резерв при блэкауте',
                },
                {
                  val: hasPanels,
                  set: setHasPanels,
                  uk: 'Плануєте сонячні панелі',
                  ru: 'Планируете солнечные панели',
                },
                {
                  val: wantsExport,
                  set: setWantsExport,
                  uk: 'Продаж надлишків / Зелений тариф',
                  ru: 'Продажа излишков / Зелёный тариф',
                },
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => q.set(!q.val)}
                  className={`p-3.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    q.val
                      ? 'border-[#169374] bg-emerald-50/70 text-[#0d1f33]'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span>{tr(q.uk, q.ru)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      q.val ? 'bg-[#169374] text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {q.val ? tr('ТАК', 'ДА') : tr('НІ', 'НЕТ')}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#0d1f33] text-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 max-w-2xl">
                <SmartImage
                  src={sampleInverterImg}
                  alt={tr(recommendedInverter.typeUk, recommendedInverter.typeRu)}
                  className="w-18 h-16 rounded-lg object-cover border border-white/20 bg-white shrink-0 hidden sm:block"
                />
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-amber-300 uppercase">
                    {tr('Рекомендований клас:', 'Рекомендованный класс:')}
                  </div>
                  <div className="text-base font-extrabold">{tr(recommendedInverter.typeUk, recommendedInverter.typeRu)}</div>
                  <p className="text-xs text-slate-300">{tr(recommendedInverter.descUk, recommendedInverter.descRu)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={() =>
                  onOpenLeadModal(
                    tr(`Консультація по інвертору: ${recommendedInverter.typeUk}`, `Консультация по инвертору: ${recommendedInverter.typeRu}`),
                  )
                }
                className="bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] border-0 font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {tr('Підібрати модель', 'Подобрать модель')}
              </Button>
            </div>
          </Card>

          {/* Matrix Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[#0d1f33]">
                  <tr>
                    <th className="p-3.5 font-extrabold">{tr('Функція / Параметр', 'Функция / Параметр')}</th>
                    <th className="p-3.5 font-extrabold text-[#1769aa]">{tr('Гібридний (Hybrid)', 'Гибридный (Hybrid)')}</th>
                    <th className="p-3.5 font-extrabold">{tr('Автономний (Off-grid)', 'Автономный (Off-grid)')}</th>
                    <th className="p-3.5 font-extrabold">{tr('Мережевий (On-grid)', 'Сетевой (On-grid)')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    {
                      featUk: 'Робота під час блекауту від АКБ',
                      featRu: 'Работа во время блэкаута от АКБ',
                      hyb: true,
                      off: true,
                      on: false,
                    },
                    {
                      featUk: 'Підмішування сонця до мережі без розряду АКБ',
                      featRu: 'Подмешивание солнца к сети без разряда АКБ',
                      hyb: true,
                      off: false,
                      on: true,
                    },
                    {
                      featUk: 'Безшовне перемикання ДБЖ < 10 мс',
                      featRu: 'Бесшовное переключение ИБП < 10 мс',
                      hyb: true,
                      off: false,
                      on: false,
                    },
                    {
                      featUk: 'Підключення до Зеленого тарифу / Net Billing',
                      featRu: 'Подключение к Зелёному тарифу / Net Billing',
                      hyb: true,
                      off: false,
                      on: true,
                    },
                    {
                      featUk: 'Керування генератором по сухому контакту',
                      featRu: 'Управление генератором по сухому контакту',
                      hyb: true,
                      off: true,
                      on: false,
                    },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="p-3.5 font-semibold text-[#0d1f33]">{tr(row.featUk, row.featRu)}</td>
                      {[row.hyb, row.off, row.on].map((ok, cIdx) => (
                        <td key={cIdx} className="p-3.5">
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-[#169374] font-bold">
                              <CheckCircle2 className="w-4 h-4" /> {tr('Так', 'Да')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <XCircle className="w-4 h-4" /> {tr('Ні', 'Нет')}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
