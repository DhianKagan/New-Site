import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Flame,
  Home,
  Building2,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';
import { tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';

interface SystemSchemesTabProps {
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, notes?: string) => void;
}

type SchemeId = 'apartment_ups' | 'home_hybrid' | 'offgrid_gen' | 'business_380v';
type OperatingMode = 'solar_day' | 'evening' | 'blackout' | 'generator';
type NodeId = 'panels' | 'dc_protection' | 'inverter' | 'battery' | 'grid_gen' | 'ac_panel';

interface SchemeConfig {
  id: SchemeId;
  img: string;
  titleUk: string;
  titleRu: string;
  subtitleUk: string;
  subtitleRu: string;
  badgeUk: string;
  badgeRu: string;
  hasPanels: boolean;
  hasGenerator: boolean;
  phasesLabel: string;
  switchTime: string;
  summaryUk: string;
  summaryRu: string;
}

const SCHEMES: SchemeConfig[] = [
  {
    id: 'apartment_ups',
    img: '/assets/energocomfort/backup_deye_8kw.jpg',
    titleUk: 'Квартира / Офіс (ДБЖ)',
    titleRu: 'Квартира / Офис (ИБП)',
    subtitleUk: 'Тихий резерв без панелей на 4–12 годин',
    subtitleRu: 'Тихий резерв без панелей на 4–12 часов',
    badgeUk: '1 фаза · 3–6 кВт',
    badgeRu: '1 фаза · 3–6 кВт',
    hasPanels: false,
    hasGenerator: false,
    phasesLabel: '220В (1Ф)',
    switchTime: '< 10 мс (UPS)',
    summaryUk: 'Інвертор заряджає LiFePO4 від мережі, коли є світло, та миттєво підхоплює квартиру при відключенні.',
    summaryRu: 'Инвертор заряжает LiFePO4 от сети, когда есть свет, и мгновенно подхватывает квартиру при отключении.',
  },
  {
    id: 'home_hybrid',
    img: '/assets/energocomfort/house_6kw.png',
    titleUk: 'Гібридна СЕС для будинку',
    titleRu: 'Гибридная СЭС для дома',
    subtitleUk: 'Сонце + АКБ + підмішування вдень',
    subtitleRu: 'Солнце + АКБ + подмешивание днём',
    badgeUk: 'Хіт вибору · 5–15 кВт',
    badgeRu: 'Хит выбора · 5–15 кВт',
    hasPanels: true,
    hasGenerator: false,
    phasesLabel: '220В або 380В',
    switchTime: '< 10 мс (UPS)',
    summaryUk: 'Оптимальна схема для приватного будинку: вдень споживання покриває сонце, надлишок заряджає АКБ, ввечері працює батарея.',
    summaryRu: 'Оптимальная схема для частного дома: днём потребление покрывает солнце, излишек заряжает АКБ, вечером работает батарея.',
  },
  {
    id: 'offgrid_gen',
    img: '/assets/energocomfort/recreation_36kw.jpg',
    titleUk: 'Автономія + Генератор (АВР)',
    titleRu: 'Автономия + Генератор (АВР)',
    subtitleUk: 'Для тривалих зимових блекаутів',
    subtitleRu: 'Для длительных зимних блэкаутов',
    badgeUk: '100% резерв · 8–20 кВт',
    badgeRu: '100% резерв · 8–20 кВт',
    hasPanels: true,
    hasGenerator: true,
    phasesLabel: '380В (3Ф) + Ген',
    switchTime: '< 10 мс + автозапуск',
    summaryUk: 'Коли АКБ розряджається до 20% без сонця, інвертор подає сухий контакт на автозапуск генератора та швидко заряджає батарею.',
    summaryRu: 'Когда АКБ разряжается до 20% без солнца, инвертор подаёт сухой контакт на автозапуск генератора и быстро заряжает батарею.',
  },
  {
    id: 'business_380v',
    img: '/assets/energocomfort/sto_110kw.jpg',
    titleUk: 'Бізнес / Виробництво 380В',
    titleRu: 'Бизнес / Производство 380В',
    subtitleUk: 'Зріз піків, 3 фази та високовольтні АКБ',
    subtitleRu: 'Срез пиков, 3 фазы и высоковольтные АКБ',
    badgeUk: 'Комерція · 20–100 кВт',
    badgeRu: 'Коммерция · 20–100 кВт',
    hasPanels: true,
    hasGenerator: true,
    phasesLabel: '380В (HV система)',
    switchTime: '< 10 мс (безперебійно)',
    summaryUk: 'Високовольтні LiFePO4 стійки (200–600В) мінімізують втрати на струмах, знижують рахунки за денним тарифом та захищають обладнання.',
    summaryRu: 'Высоковольтные LiFePO4 стойки (200–600В) минимизируют потери на токах, снижают счета по дневному тарифу и защищают оборудование.',
  },
];

const MODES: { id: OperatingMode; uk: string; ru: string; descUk: string; descRu: string }[] = [
  {
    id: 'solar_day',
    uk: 'Сонячний день',
    ru: 'Солнечный день',
    descUk: 'Сонце живить будинок напряму (70–100%) і заряджає АКБ. Мережа у режимі підмішування або очікування.',
    descRu: 'Солнце питает дом напрямую (70–100%) и заряжает АКБ. Сеть в режиме подмешивания или ожидания.',
  },
  {
    id: 'evening',
    uk: 'Вечірній пік',
    ru: 'Вечерний пик',
    descUk: 'Генерація мінімальна. Навантаження живиться від накопиченої енергії АКБ, а при піках (чайник + бойлер) допомагає мережа.',
    descRu: 'Генерация минимальна. Нагрузка питается от накопленной энергии АКБ, а при пиках (чайник + бойлер) помогает сеть.',
  },
  {
    id: 'blackout',
    uk: 'Блекаут (без мережі)',
    ru: 'Блэкаут (без сети)',
    descUk: 'Мережа зникла. Інвертор за <10 мс переходить на АКБ + сонце. Критичні лінії працюють безперебійно, надпотужні відсікає щит.',
    descRu: 'Сеть пропала. Инвертор за <10 мс переходит на АКБ + солнце. Критические линии работают бесперебойно, сверхмощные отсекает щит.',
  },
  {
    id: 'generator',
    uk: 'Запуск генератора',
    ru: 'Запуск генератора',
    descUk: 'АКБ досягли 20% у похмуру погоду. Сухий контакт запускає генератор: за 2–3 год він заряджає АКБ і переходить у тишу.',
    descRu: 'АКБ достигли 20% в пасмурную погоду. Сухой контакт запускает генератор: за 2–3 ч он заряжает АКБ и уходит в тишину.',
  },
];

interface NodeDetail {
  id: NodeId;
  titleUk: string;
  titleRu: string;
  roleUk: string;
  roleRu: string;
  protectionsUk: string[];
  protectionsRu: string[];
  mistakesUk: string;
  mistakesRu: string;
}

const NODE_DETAILS: Record<NodeId, NodeDetail> = {
  panels: {
    id: 'panels',
    titleUk: 'Сонячні панелі (DC стрінги)',
    titleRu: 'Солнечные панели (DC стринги)',
    roleUk: 'Перетворюють сонячне світло на постійний струм високої напруги (150–800В DC) та подають його на MPPT-трекери інвертора.',
    roleRu: 'Преобразуют солнечный свет в постоянный ток высокого напряжения (150–800В DC) и подают его на MPPT-трекеры инвертора.',
    protectionsUk: [
      'Сонячний кабель PV 6 мм² з подвійною ізоляцією (стійкий до УФ)',
      'Конектори MC4 одного стандарту, обтиснуті професійним кримпером',
      'Обов’язкове заземлення алюмінієвої рами та профілю 10–16 мм²',
    ],
    protectionsRu: [
      'Солнечный кабель PV 6 мм² с двойной изоляцией (стойкий к УФ)',
      'Коннекторы MC4 одного стандарта, обжатые профессиональным кримпером',
      'Обязательное заземление алюминиевой рамы и профиля 10–16 мм²',
    ],
    mistakesUk: 'Перевищення максимальної напруги MPPT взимку (Voc зростає на морозі на 12–15%) або об’єднання панелей різних схилів в один стрінг.',
    mistakesRu: 'Превышение максимального напряжения MPPT зимой (Voc растёт на морозе на 12–15%) или объединение панелей разных скатов в один стринг.',
  },
  dc_protection: {
    id: 'dc_protection',
    titleUk: 'Щит DC захисту та УЗІП',
    titleRu: 'Щит DC защиты и УЗИП',
    roleUk: 'Захищає дорогий інвертор від грозових перенапруг, коротких замикань і дозволяє безпечно знеструмити стрінги для обслуговування.',
    roleRu: 'Защищает дорогой инвертор от грозовых перенапряжений, коротких замыканий и позволяет безопасно обесточить стринги для обслуживания.',
    protectionsUk: [
      'DC розрядник перенапруг (УЗІП Type II 600–1000V DC)',
      'Тримачі плавких DC запобіжників (15–20А на кожен стрінг)',
      'Спеціальний DC-вимикач навантаження з дугогасінням (не AC-автомат!)',
    ],
    protectionsRu: [
      'DC разрядник перенапряжений (УЗИП Type II 600–1000V DC)',
      'Держатели плавких DC предохранителей (15–20А на каждый стринг)',
      'Специальный DC-выключатель нагрузки с дугогашением (не AC-автомат!)',
    ],
    mistakesUk: 'Використання звичайних AC-автоматів на постійному струмі — вони не гасять дугу 400В DC і можуть спалахнути в щиті.',
    mistakesRu: 'Использование обычных AC-автоматов на постоянном токе — они не гасят дугу 400В DC и могут загореться в щите.',
  },
  inverter: {
    id: 'inverter',
    titleUk: 'Інвертор (серце системи)',
    titleRu: 'Инвертор (сердце системы)',
    roleUk: 'Синхронізує 3 джерела енергії (сонце, АКБ, мережу), керує зарядом за протоколом BMS і видає чисту синусоїду 220/380В.',
    roleRu: 'Синхронизирует 3 источника энергии (солнце, АКБ, сеть), управляет зарядом по протоколу BMS и выдаёт чистую синусоїду 220/380В.',
    protectionsUk: [
      'Чиста синусоїда (безпечно для газових котлів, насосів, компресорів)',
      'Перемикання на резерв < 10 мс — роутери та ПК не перезавантажуються',
      'Шина комунікації CAN / RS485 з BMS акумулятора для точного контролю',
    ],
    protectionsRu: [
      'Чистая синусоида (безопасно для газовых котлов, насосов, компрессоров)',
      'Переключение на резерв < 10 мс — роутеры и ПК не перезагружаются',
      'Шина коммуникации CAN / RS485 с BMS аккумулятора для точного контроля',
    ],
    mistakesUk: 'Монтаж у тісній шафі без вентиляції (перегрів знижує потужність на 30%) або відсутність зазору 30–50 см навколо радіатора.',
    mistakesRu: 'Монтаж в тесном шкафу без вентиляции (перегрев снижает мощность на 30%) или отсутствие зазора 30–50 см вокруг радиатора.',
  },
  battery: {
    id: 'battery',
    titleUk: 'Акумуляторний блок LiFePO4 + BMS',
    titleRu: 'Аккумуляторный блок LiFePO4 + BMS',
    roleUk: 'Накопичує енергію з мінімальними втратами та витримує 6000+ циклів заряду/розряду без ефекту пам’яті та ризику займання.',
    roleRu: 'Накапливает энергию с минимальными потерями и выдерживает 6000+ циклов заряда/разряда без эффекта памяти и риска возгорания.',
    protectionsUk: [
      'Мідний силовий кабель 35–50 мм² однакової довжини на "+" і "−"',
      'DC автомат / плавка вставка 125–200А між АКБ та інвертором',
      'Розумна плата BMS (контроль температури та балансування кожної комірки)',
    ],
    protectionsRu: [
      'Медный силовой кабель 35–50 мм² одинаковой длины на «+» и «−»',
      'DC автомат / плавкая вставка 125–200А между АКБ и инвертором',
      'Умная плата BMS (контроль температуры и балансировка каждой ячейки)',
    ],
    mistakesUk: 'Підключення тонким кабелем (втрати й нагрів клем) або заряджання літієвої АКБ при мінусовій температурі без підігріву.',
    mistakesRu: 'Подключение тонким кабелем (потери и нагрев клемм) или зарядка литиевой АКБ при минусовой температуре без подогрева.',
  },
  grid_gen: {
    id: 'grid_gen',
    titleUk: 'Ввід мережі / Генератора + Реле напруги',
    titleRu: 'Ввод сети / Генератора + Реле напряжения',
    roleUk: 'Подає зовнішнє живлення на вхід GRID/GEN інвертора, заряджає батареї та дозволяє підмішування при пікових навантаженнях.',
    roleRu: 'Подаёт внешнее питание на вход GRID/GEN инвертора, заряжает батареи и позволяет подмешивание при пиковых нагрузках.',
    protectionsUk: [
      'Реле контролю напруги (захист від 380В при обриві нуля в мережі)',
      'Трансформатори струму (CT-датчики) для блокування експорту в мережу',
      'Перекидний рубильник I-0-II (Байпас) на випадок сервісу інвертора',
    ],
    protectionsRu: [
      'Реле контроля напряжения (защита от 380В при обрыве нуля в сети)',
      'Трансформаторы тока (CT-датчики) для блокировки экспорта в сеть',
      'Перекидной рубильник I-0-II (Байпас) на случай сервиса инвертора',
    ],
    mistakesUk: 'Підключення дешевого генератора з плаваючою частотою напряму до чутливого гібрида (часто потрібен інверторний генератор або окрема зарядка).',
    mistakesRu: 'Подключение дешёвого генератора с плавающей частотой напрямую к чувствительному гибриду (часто нужен инверторный генератор или отдельная зарядка).',
  },
  ac_panel: {
    id: 'ac_panel',
    titleUk: 'Щит споживачів: Критичні vs Потужні',
    titleRu: 'Щит потребителей: Критические vs Мощные',
    roleUk: 'Розділяє навантаження: освітлення, котел, холодильник і Wi-Fi йдуть через резервний вихід LOAD/BACKUP, а сауна чи електрокотел залишаються на вході.',
    roleRu: 'Разделяет нагрузку: освещение, котёл, холодильник и Wi-Fi идут через резервный выход LOAD/BACKUP, а сауна или электрокотёл остаются на входе.',
    protectionsUk: [
      'Чітке розділення ліній "Резерв (BACKUP)" і "Тільки від мережі (NON-BACKUP)"',
      'Дифавтомати / УЗО Тип А (30 мА) на вологі зони та розетки',
      'Нульова шина резерву ізольована від вхідного нуля мережі (за вимогою інвертора)',
    ],
    protectionsRu: [
      'Чёткое разделение линий «Резерв (BACKUP)» и «Только от сети (NON-BACKUP)»',
      'Дифавтоматы / УЗО Тип А (30 мА) на влажные зоны и розетки',
      'Нулевая шина резерва изолирована от входного нуля сети (по требованию инвертора)',
    ],
    mistakesUk: 'Помилкове об’єднання нулів (N-IN і N-OUT) після інвертора — це миттєво вибиває УЗО та може пошкодити вихідний каскад.',
    mistakesRu: 'Ошибочное объединение нулей (N-IN и N-OUT) после инвертора — это мгновенно выбивает УЗО и может повредить выходной каскад.',
  },
};

export function SystemSchemesTab({ onOpenLeadModal }: SystemSchemesTabProps) {
  const [schemeId, setSchemeId] = useState<SchemeId>('home_hybrid');
  const [mode, setMode] = useState<OperatingMode>('solar_day');
  const [selectedNode, setSelectedNode] = useState<NodeId>('inverter');

  const scheme = SCHEMES.find((s) => s.id === schemeId) || SCHEMES[1];
  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];
  const nodeDetail = NODE_DETAILS[selectedNode];

  const panelsActive = scheme.hasPanels && (mode === 'solar_day' || mode === 'blackout');
  const batteryDischarging = mode === 'evening' || mode === 'blackout';
  const batteryCharging = mode === 'solar_day' || mode === 'generator';
  const gridOnline = mode === 'solar_day' || mode === 'evening';
  const genOnline = scheme.hasGenerator && mode === 'generator';

  function handleSchemeConsult() {
    const notes = [
      `${tr('Обрана схема', 'Выбранная схема')}: ${tr(scheme.titleUk, scheme.titleRu)} (${scheme.phasesLabel})`,
      `${tr('Цікавить вузол / режим', 'Интересует узел / режим')}: ${tr(nodeDetail.titleUk, nodeDetail.titleRu)} · ${tr(currentMode.uk, currentMode.ru)}`,
    ].join('\n');

    onOpenLeadModal(
      tr(`Консультація по схемі: ${scheme.titleUk}`, `Консультация по схеме: ${scheme.titleRu}`),
      undefined,
      notes,
    );
  }

  return (
    <div className="space-y-6">
      {/* Architecture Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SCHEMES.map((item) => {
          const active = item.id === schemeId;
          const Icon =
            item.id === 'apartment_ups'
              ? Home
              : item.id === 'home_hybrid'
                ? Sun
                : item.id === 'offgrid_gen'
                  ? Flame
                  : Building2;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSchemeId(item.id);
                if (!item.hasPanels && (selectedNode === 'panels' || selectedNode === 'dc_protection')) {
                  setSelectedNode('inverter');
                }
                if (!item.hasPanels && mode === 'solar_day') {
                  setMode('evening');
                }
                if (!item.hasGenerator && mode === 'generator') {
                  setMode('blackout');
                }
              }}
              className={`text-left rounded-xl border transition-all cursor-pointer overflow-hidden flex flex-col ${
                active
                  ? 'bg-[#0d1f33] text-white border-[#0d1f33] shadow-sm'
                  : 'bg-white text-[#0d1f33] border-slate-200 hover:border-[#1769aa]/50'
              }`}
            >
              <div className="relative h-24 w-full overflow-hidden bg-slate-900">
                <SmartImage
                  src={item.img}
                  alt={tr(item.titleUk, item.titleRu)}
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1f33]/80 via-transparent to-transparent" />
                <span
                  className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center ${
                    active ? 'bg-[#f59e0b] text-[#0d1f33]' : 'bg-white/90 text-[#1769aa]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span
                  className={`absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    active ? 'bg-[#f59e0b] text-[#0d1f33]' : 'bg-white/90 text-[#0d1f33]'
                  }`}
                >
                  {tr(item.badgeUk, item.badgeRu)}
                </span>
              </div>
              <div className="p-3.5">
                <div className="text-xs font-extrabold">{tr(item.titleUk, item.titleRu)}</div>
                <div className={`text-[11px] mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  {tr(item.subtitleUk, item.subtitleRu)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mode Switcher + Interactive Topology */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#0d1f33]">
              {tr('Інтерактивна схема роботи: ', 'Интерактивная схема работы: ')}
              {tr(scheme.titleUk, scheme.titleRu)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{tr(scheme.summaryUk, scheme.summaryRu)}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MODES.filter((m) => (m.id !== 'generator' || scheme.hasGenerator) && (m.id !== 'solar_day' || scheme.hasPanels)).map(
              (m) => {
                const active = m.id === mode;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? m.id === 'blackout'
                          ? 'bg-amber-500 text-[#0d1f33]'
                          : 'bg-[#1769aa] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tr(m.uk, m.ru)}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Mode Explanation Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            mode === 'blackout'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-sky-50/70 border-sky-200 text-[#0d1f33]'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Zap className={`w-4 h-4 shrink-0 ${mode === 'blackout' ? 'text-amber-600' : 'text-[#1769aa]'}`} />
            <span>{tr(currentMode.descUk, currentMode.descRu)}</span>
          </div>
          <span className="font-mono text-[11px] font-bold bg-white/80 px-2.5 py-1 rounded-md border border-slate-200/80">
            {scheme.phasesLabel} · {scheme.switchTime}
          </span>
        </div>

        {/* Interactive Node Diagram */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            {tr(
              'Натисніть на будь-який блок схеми, щоб побачити вимоги захисту і типові помилки монтажу',
              'Нажмите на любой блок схемы, чтобы увидеть требования защиты и типовые ошибки монтажа',
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Column 1: Energy Inputs */}
            <div className="space-y-3 flex flex-col justify-between">
              {scheme.hasPanels ? (
                <button
                  type="button"
                  onClick={() => setSelectedNode('panels')}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedNode === 'panels'
                      ? 'border-[#f59e0b] bg-amber-50 shadow-sm'
                      : panelsActive
                        ? 'border-amber-300 bg-white'
                        : 'border-slate-200 bg-white/70 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d1f33]">
                      <Sun className={`w-4 h-4 ${panelsActive ? 'text-amber-500' : 'text-slate-400'}`} />
                      {tr('Сонячні панелі DC', 'Солнечные панели DC')}
                    </span>
                    <Badge variant={panelsActive ? 'warning' : 'default'}>
                      {panelsActive ? tr('Генерують', 'Генерируют') : tr('Ніч / Очікування', 'Ночь / Ожидание')}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {tr('Постійний струм → DC кабель 6 мм²', 'Постоянный ток → DC кабель 6 мм²')}
                  </div>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-white/50 text-xs text-slate-400">
                  {tr('Без сонячних панелей (режим ДБЖ від мережі)', 'Без солнечных панелей (режим ИБП от сети)')}
                </div>
              )}

              {scheme.hasPanels && (
                <button
                  type="button"
                  onClick={() => setSelectedNode('dc_protection')}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedNode === 'dc_protection'
                      ? 'border-[#1769aa] bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d1f33]">
                      <ShieldCheck className="w-4 h-4 text-[#1769aa]" />
                      {tr('Щит DC захисту (УЗІП)', 'Щит DC защиты (УЗИП)')}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">1000V DC</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {tr('Плавкі запобіжники + грозозахист', 'Плавкие предохранители + грозозащита')}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedNode('grid_gen')}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedNode === 'grid_gen'
                    ? 'border-[#1769aa] bg-sky-50 shadow-sm'
                    : gridOnline || genOnline
                      ? 'border-emerald-300 bg-white'
                      : 'border-red-200 bg-red-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d1f33]">
                    <Zap className={`w-4 h-4 ${gridOnline || genOnline ? 'text-emerald-600' : 'text-red-500'}`} />
                    {scheme.hasGenerator
                      ? tr('Мережа + Генератор (АВР)', 'Сеть + Генератор (АВР)')
                      : tr('Зовнішня мережа + Реле', 'Внешняя сеть + Реле')}
                  </span>
                  <Badge variant={genOnline ? 'warning' : gridOnline ? 'success' : 'danger'}>
                    {genOnline
                      ? tr('Ген. ON', 'Ген. ON')
                      : gridOnline
                        ? tr('Є 220/380В', 'Есть 220/380В')
                        : tr('Блекаут 0В', 'Блэкаут 0В')}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {tr('Реле напруги + рубильник Байпас I-0-II', 'Реле напряжения + рубильник Байпас I-0-II')}
                </div>
              </button>
            </div>

            {/* Column 2: Inverter + Battery */}
            <div className="space-y-3 flex flex-col justify-center">
              <button
                type="button"
                onClick={() => setSelectedNode('inverter')}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedNode === 'inverter'
                    ? 'border-[#0d1f33] bg-[#0d1f33] text-white shadow-md'
                    : 'border-[#0d1f33]/30 bg-white text-[#0d1f33] hover:border-[#0d1f33]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold">
                    <Cpu className={`w-4 h-4 ${selectedNode === 'inverter' ? 'text-[#f59e0b]' : 'text-[#1769aa]'}`} />
                    {tr('Інвертор', 'Инвертор')}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      selectedNode === 'inverter' ? 'bg-white/15 text-sky-200' : 'bg-sky-50 text-[#1769aa]'
                    }`}
                  >
                    MPPT + UPS
                  </span>
                </div>
                <div className={`text-[11px] mt-1.5 ${selectedNode === 'inverter' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {tr(
                    'Керує потоками енергії в реальному часі, тримає чисту синусоїду.',
                    'Управляет потоками энергии в реальном времени, держит чистую синусоиду.',
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    {scheme.switchTime}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700">CAN / RS485</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNode('battery')}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedNode === 'battery'
                    ? 'border-[#169374] bg-emerald-50 shadow-sm'
                    : 'border-emerald-200 bg-white hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d1f33]">
                    <BatteryCharging className="w-4 h-4 text-[#169374]" />
                    {tr('АКБ LiFePO4 + BMS', 'АКБ LiFePO4 + BMS')}
                  </span>
                  <Badge variant={batteryCharging ? 'success' : batteryDischarging ? 'warning' : 'info'}>
                    {batteryCharging
                      ? tr('Заряд ↑', 'Заряд ↑')
                      : batteryDischarging
                        ? tr('Живить дім ↓', 'Питает дом ↓')
                        : tr('Буфер 100%', 'Буфер 100%')}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {tr('6000+ циклів · Автомат 125–200А DC', '6000+ циклов · Автомат 125–200А DC')}
                </div>
              </button>
            </div>

            {/* Column 3: AC Loads Split */}
            <div className="flex flex-col justify-center">
              <button
                type="button"
                onClick={() => setSelectedNode('ac_panel')}
                className={`w-full h-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedNode === 'ac_panel'
                    ? 'border-[#1769aa] bg-sky-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-[#1769aa]/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#0d1f33]">
                      {tr('Щит споживачів AC', 'Щит потребителей AC')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#1769aa]" />
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-[11px] font-extrabold text-emerald-900 flex items-center justify-between">
                      <span>{tr('Критичні групи (BACKUP)', 'Критические группы (BACKUP)')}</span>
                      <span className="text-[10px] font-mono">ON 24/7</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      {tr('Котел, холодильник, Wi-Fi, світло, насос води, ворота', 'Котёл, холодильник, Wi-Fi, свет, насос воды, ворота')}
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border ${
                      mode === 'blackout'
                        ? 'bg-slate-100 border-slate-200 opacity-60'
                        : 'bg-sky-50/70 border-sky-200'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold text-[#0d1f33] flex items-center justify-between">
                      <span>{tr('Потужні групи (GRID)', 'Мощные группы (GRID)')}</span>
                      <span className="text-[10px] font-mono">
                        {mode === 'blackout' ? tr('ВІДКЛ', 'ОТКЛ') : tr('АКТИВНО', 'АКТИВНО')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {tr('Електросауна, котел опалення, тепла підлога, зарядка авто', 'Электросауна, котёл отопления, тёплый пол, зарядка авто')}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-[#1769aa] mt-3">
                  {tr('Деталі захисту щита →', 'Детали защиты щита →')}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Node Engineering Details */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#0d1f33]">{tr(nodeDetail.titleUk, nodeDetail.titleRu)}</h3>
              <Badge variant="info">{tr('Інженерний розбір', 'Инженерный разбор')}</Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{tr(nodeDetail.roleUk, nodeDetail.roleRu)}</p>
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-[#0d1f33] uppercase">
                {tr('Обов’язкові елементи безпеки:', 'Обязательные элементы безопасности:')}
              </div>
              {(tr('uk', 'ru') === 'uk' ? nodeDetail.protectionsUk : nodeDetail.protectionsRu).map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#169374] shrink-0 mt-0.5" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{tr('Типова помилка, якої ми уникаємо', 'Типовая ошибка, которой мы избегаем')}</span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">{tr(nodeDetail.mistakesUk, nodeDetail.mistakesRu)}</p>
            <Button type="button" variant="primary" size="sm" onClick={handleSchemeConsult} className="w-full">
              <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
              {tr('Прорахувати цю схему для мого об’єкта', 'Просчитать эту схему для моего объекта')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
