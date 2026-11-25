export type SystemNodeId = 'panels' | 'inverter' | 'battery' | 'loads' | 'grid';

export type SystemFlowMode = 'day_solar' | 'evening_battery' | 'blackout' | 'night_tariff';

export interface SystemNodeInfo {
  id: SystemNodeId;
  order: string;
  accentHex: string;
  titleUk: string;
  titleRu: string;
  shortUk: string;
  shortRu: string;
  connectionPathUk: string;
  connectionPathRu: string;
  howConnectsUk: string;
  howConnectsRu: string;
  whyNeededUk: string;
  whyNeededRu: string;
  whatGivesUk: string;
  whatGivesRu: string;
  specHighlightUk: string;
  specHighlightRu: string;
}

export interface SystemModeInfo {
  id: SystemFlowMode;
  labelUk: string;
  labelRu: string;
  summaryUk: string;
  summaryRu: string;
  flows: {
    pvToInv: number; // 0 = off, >0 forward speed
    invToBat: number; // >0 charge battery, <0 discharge battery to inverter
    invToLoads: number; // >0 power house/business loads
    invToGrid: number; // >0 export to grid, <0 import from grid
  };
  gridOnline: boolean;
}

export const SYSTEM_NODES: SystemNodeInfo[] = [
  {
    id: 'panels',
    order: '01',
    accentHex: '#f59e0b',
    titleUk: 'Сонячні панелі',
    titleRu: 'Солнечные панели',
    shortUk: 'Дах / наземний стіл',
    shortRu: 'Крыша / наземный стол',
    connectionPathUk: 'Дах → Кабель DC 6 мм² (MC4) → Захист ПЗІП DC → MPPT-вхід інвертора',
    connectionPathRu: 'Крыша → Кабель DC 6 мм² (MC4) → Защита УЗИП DC → MPPT-вход инвертора',
    howConnectsUk:
      'Фотомодулі з’єднуються послідовно у стрінги через герметичні конектори MC4 та підводяться солярним кабелем 6 мм² через DC-автомат і ПЗІП прямо до MPPT-трекерів інвертора.',
    howConnectsRu:
      'Фотомодули соединяются последовательно в стринги через герметичные коннекторы MC4 и подводятся солярным кабелем 6 мм² через DC-автомат и УЗИП прямо к MPPT-трекерам инвертора.',
    whyNeededUk:
      'Перетворюють сонячне випромінювання на постійний струм (DC) високої напруги навіть у похмурі дні завдяки технологіям N-Type та Bifacial.',
    whyNeededRu:
      'Преобразуют солнечное излучение в постоянный ток (DC) высокого напряжения даже в пасмурные дни благодаря технологиям N-Type и Bifacial.',
    whatGivesUk:
      'Власну безкоштовну генерацію ~1 230 кВт·год на рік з кожного 1 кВт панелей в умовах Одеси та зменшення рахунків на 60–90%.',
    whatGivesRu:
      'Собственную бесплатную генерацию ~1 230 кВт·ч в год с каждого 1 кВт панелей в условиях Одессы и снижение счетов на 60–90%.',
    specHighlightUk: '1 230 кВт·год/кВт·рік · Гарантія 25–30 р.',
    specHighlightRu: '1 230 кВт·ч/кВт·год · Гарантия 25–30 лет',
  },
  {
    id: 'inverter',
    order: '02',
    accentHex: '#38bdf8',
    titleUk: 'Гібридний інвертор',
    titleRu: 'Гибридный инвертор',
    shortUk: 'Центр керування енергією',
    shortRu: 'Центр управления энергией',
    connectionPathUk: 'Вхід PV (DC) + Порт АКБ (48V/HV) + Вхід мережі AC → Вихід Backup / Load 230/400В',
    connectionPathRu: 'Вход PV (DC) + Порт АКБ (48V/HV) + Вход сети AC → Выход Backup / Load 230/400В',
    howConnectsUk:
      'Монтується у техприміщенні або гаражі між ввідним щитом і споживачами. Одночасно приймає лінії від сонячних панелей (PV), акумулятора (DC + BMS CAN) та міської мережі AC.',
    howConnectsRu:
      'Монтируется в техпомещении или гараже между вводным щитом и потребителями. Одновременно принимает линии от солнечных панелей (PV), аккумулятора (DC + BMS CAN) и городской сети AC.',
    whyNeededUk:
      'Інтелектуально змішує потоки енергії в реальному часі: спрямовує сонце на споживання, заряджає батарею, перетворює DC у чисту синусоїду 230/400 В та миттєво ізолює мережу під час аварій.',
    whyNeededRu:
      'Интеллектуально смешивает потоки энергии в реальном времени: направляет солнце на нагрузку, заряжает батарею, преобразует DC в чистую синусоиду 230/400 В и мгновенно изолирует сеть при авариях.',
    whatGivesUk:
      'Безшовне перемикання на резерв за <10 мс (техніка й роутер не вимикаються), дистанційний Wi-Fi моніторинг та 100% захист від перепадів напруги.',
    whatGivesRu:
      'Бесшовное переключение на резерв за <10 мс (техника и роутер не перезагружаются), удалённый Wi-Fi мониторинг и 100% защита от скачков напряжения.',
    specHighlightUk: 'Перемикання <10 мс · Wi-Fi моніторинг',
    specHighlightRu: 'Переключение <10 мс · Wi-Fi мониторинг',
  },
  {
    id: 'battery',
    order: '03',
    accentHex: '#10b981',
    titleUk: 'Акумулятор LiFePO4',
    titleRu: 'Аккумулятор LiFePO4',
    shortUk: 'Модульне сховище 5–60 кВт·год',
    shortRu: 'Модульное хранилище 5–60 кВт·ч',
    connectionPathUk: 'АКБ LiFePO4 → Силові шини DC + Кабель зв’язку BMS (CAN/RS485) → Інвертор',
    connectionPathRu: 'АКБ LiFePO4 → Силовые шины DC + Кабель связи BMS (CAN/RS485) → Инвертор',
    howConnectsUk:
      'Підключається до батарейного порту інвертора товстими мідними кабелями з DC-запобіжником (125–200 А) та інформаційним кабелем CAN/RS485 для синхронізації з контролером BMS.',
    howConnectsRu:
      'Подключается к батарейному порту инвертора толстыми медными кабелями с DC-предохранителем (125–200 А) и кабелем связи CAN/RS485 для синхронизации с контроллером BMS.',
    whyNeededUk:
      'Накопичує надлишок сонячної енергії вдень або дешеву електроенергію вночі, щоб живити об’єкт у вечірній пік чи під час тривалих відключень світла.',
    whyNeededRu:
      'Накапливает избыток солнечной энергии днём или дешёвую электроэнергию ночью, чтобы питать объект в вечерний пик или во время длительных отключений.',
    whatGivesUk:
      '6 000+ циклів ресурсу (12–15 років служби), повну пожежну безпеку без шкідливих випарів, швидкий заряд за 1,5–2 год та автономність до 24+ годин.',
    whatGivesRu:
      '6 000+ циклов ресурса (12–15 лет службы), полную пожарную безопасность без испарений, быстрый заряд за 1,5–2 ч и автономность до 24+ часов.',
    specHighlightUk: '6 000+ циклів · Ресурс 12–15 років',
    specHighlightRu: '6 000+ циклов · Ресурс 12–15 лет',
  },
  {
    id: 'loads',
    order: '04',
    accentHex: '#60a5fa',
    titleUk: 'Електрощит і споживачі',
    titleRu: 'Электрощит и потребители',
    shortUk: 'Оселя, котел, сервери, бізнес',
    shortRu: 'Дом, котёл, серверы, бизнес',
    connectionPathUk: 'Вихід інвертора (Backup / Load) → Щит АВР і автомати AC → Розетки, котел, кондиціонери',
    connectionPathRu: 'Выход инвертора (Backup / Load) → Щит АВР и автоматы AC → Розетки, котёл, кондиционеры',
    howConnectsUk:
      'Вихід інвертора Backup/Load заводиться у розподільчий щиток через реле контролю напруги, УЗО та байпас-перемикач (АВР), розділяючи критичні та силові групи споживачів.',
    howConnectsRu:
      'Выход инвертора Backup/Load заводится в распределительный щиток через реле контроля напряжения, УЗО и байпас-переключатель (АВР), разделяя критические и силовые группы.',
    whyNeededUk:
      'Гарантує безперервну подачу стабільного струму 230 В (50 Гц) до опалення, холодильників, насосів, освітлення, серверів та обладнання навіть без зовнішньої мережі.',
    whyNeededRu:
      'Гарантирует непрерывную подачу стабильного тока 230 В (50 Гц) к отоплению, холодильникам, насосам, освещению, серверам и оборудованию даже без внешней сети.',
    whatGivesUk:
      'Звичний комфорт 24/7 без шуму генератора, без витрат на пальне та без ризику виходу з ладу дорогої електроніки через стрибки напруги.',
    whatGivesRu:
      'Привычный комфорт 24/7 без шума генератора, без затрат на топливо и без риска поломки дорогой электроники из-за скачков напряжения.',
    specHighlightUk: 'Чиста синусоїда 230/400 В · Захист ПЗІП AC',
    specHighlightRu: 'Чистая синусоида 230/400 В · Защита УЗИП AC',
  },
  {
    id: 'grid',
    order: '05',
    accentHex: '#818cf8',
    titleUk: 'Міська мережа і лічильник',
    titleRu: 'Городская сеть и счётчик',
    shortUk: 'Підтримка та Net Billing',
    shortRu: 'Поддержка и Net Billing',
    connectionPathUk: 'Лінія РЕМ (220/380 В) → Двонаправлений лічильник (CT-трансформатор) → Порт Grid інвертора',
    connectionPathRu: 'Линия РЭС (220/380 В) → Двунаправленный счётчик (CT-трансформатор) → Порт Grid инвертора',
    howConnectsUk:
      'Міська лінія підключається до порту Grid інвертора через ввідний автомат. На ввідний кабель встановлюється датчик струму (CT) або Smart Meter для точного контролю перетоків.',
    howConnectsRu:
      'Городская линия подключается к порту Grid инвертора через вводной автомат. На вводной кабель ставится датчик тока (CT) или Smart Meter для точного контроля перетоков.',
    whyNeededUk:
      'Дозволяє системі брати додаткову потужність із мережі при пікових навантаженнях, заряджати АКБ за дешевим нічним тарифом або продавати надлишки вдень за Net Billing.',
    whyNeededRu:
      'Позволяет системе брать дополнительную мощность из сети при пиках, заряжать АКБ по дешёвому ночному тарифу или продавать излишки днём по Net Billing.',
    whatGivesUk:
      'Максимальну економію на платіжках без повної відмови від мережі та додатковий дохід або взаємозалік за експортовану вдень електроенергію.',
    whatGivesRu:
      'Максимальную экономию на платежах без полного отказа от сети, а также доход или взаимозачёт за экспортированную днём электроэнергию.',
    specHighlightUk: 'Net Billing · Заряд за нічним тарифом 2.16 ₴',
    specHighlightRu: 'Net Billing · Заряд по ночному тарифу 2.16 ₴',
  },
];

export const SYSTEM_MODES: SystemModeInfo[] = [
  {
    id: 'day_solar',
    labelUk: 'Сонячний день',
    labelRu: 'Солнечный день',
    summaryUk: 'Сонце живить будинок напряму, заряджає АКБ до 100%, а надлишок іде в мережу (Net Billing).',
    summaryRu: 'Солнце питает дом напрямую, заряжает АКБ до 100%, а излишек уходит в сеть (Net Billing).',
    flows: { pvToInv: 1.3, invToBat: 1.0, invToLoads: 1.1, invToGrid: 0.75 },
    gridOnline: true,
  },
  {
    id: 'evening_battery',
    labelUk: 'Вечірній пік',
    labelRu: 'Вечерний пик',
    summaryUk: 'Сонця вже немає — будинок живиться накопиченою безкоштовною енергією з АКБ, лічильник стоїть.',
    summaryRu: 'Солнца уже нет — дом питается накопленной бесплатной энергией из АКБ, счётчик стоит.',
    flows: { pvToInv: 0, invToBat: -1.1, invToLoads: 1.1, invToGrid: 0 },
    gridOnline: true,
  },
  {
    id: 'blackout',
    labelUk: 'Блекаут (аварія)',
    labelRu: 'Блекаут (авария)',
    summaryUk: 'Мережа знеструмлена. Інвертор за <10 мс ізолює лінію РЕМ і безперервно живить об’єкт від АКБ та сонця.',
    summaryRu: 'Сеть обесточена. Инвертор за <10 мс изолирует линию РЭС и непрерывно питает объект от АКБ и солнца.',
    flows: { pvToInv: 0.7, invToBat: -1.0, invToLoads: 1.0, invToGrid: 0 },
    gridOnline: false,
  },
  {
    id: 'night_tariff',
    labelUk: 'Нічний тариф',
    labelRu: 'Ночной тариф',
    summaryUk: 'Коли взимку мало сонця, інвертор заряджає АКБ вночі по 2.16 ₴/кВт·год для денної економії або резерву.',
    summaryRu: 'Когда зимой мало солнца, инвертор заряжает АКБ ночью по 2.16 ₴/кВт·ч для дневной экономии или резерва.',
    flows: { pvToInv: 0, invToBat: 1.0, invToLoads: 0.65, invToGrid: -1.1 },
    gridOnline: true,
  },
];

export interface CelestialCycleSample {
  phase: number;
  clockLabel: string;
  suggestedMode: Exclude<SystemFlowMode, 'blackout'>;
  sunElevation: number;
  sunPos: [number, number, number];
  moonPos: [number, number, number];
  lightPos: [number, number, number];
  skyZenithHex: number;
  skyHorizonHex: number;
  sunHex: number;
  sunGlowHex: number;
  sunOpacity: number;
  sunGlowStrength: number;
  moonOpacity: number;
  starOpacity: number;
  keyHex: number;
  keyIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimHex: number;
  rimIntensity: number;
  envIntensity: number;
  photonSpeed: number;
  photonOpacity: number;
  panelEmissive: number;
  windowGlow: number;
  porchGlow: number;
  streetLampGlow: number;
}

export const MODE_TARGET_PHASE: Record<SystemFlowMode, number> = {
  day_solar: 0.24,       // ~11:45 bright midday sun
  evening_battery: 0.50, // ~18:00 golden sunset / twilight
  blackout: 0.57,        // ~19:40 evening grid outage contrast
  night_tariff: 0.76,    // ~00:15 midnight blue sky & moon
};

interface AtmosphereKeyframe {
  phase: number;
  skyZenithHex: number;
  skyHorizonHex: number;
  sunHex: number;
  sunGlowHex: number;
  keyHex: number;
  keyIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimHex: number;
  rimIntensity: number;
  envIntensity: number;
}

const ATMOSPHERE_KEYFRAMES: AtmosphereKeyframe[] = [
  {
    phase: 0.0, // 06:00 Dawn
    skyZenithHex: 0x1b3a6d,
    skyHorizonHex: 0xd97a54,
    sunHex: 0xfb923c,
    sunGlowHex: 0xf97316,
    keyHex: 0xfdba74,
    keyIntensity: 1.55,
    hemiSkyHex: 0xfed7aa,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.76,
    rimHex: 0x60a5fa,
    rimIntensity: 0.85,
    envIntensity: 0.72,
  },
  {
    phase: 0.14, // 09:20 Bright Morning
    skyZenithHex: 0x154c8a,
    skyHorizonHex: 0x5ca4d6,
    sunHex: 0xfde047,
    sunGlowHex: 0xfbbf24,
    keyHex: 0xfff5d6,
    keyIntensity: 2.65,
    hemiSkyHex: 0xbae6fd,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 1.05,
    rimHex: 0x38bdf8,
    rimIntensity: 0.75,
    envIntensity: 0.98,
  },
  {
    phase: 0.26, // 12:15 Solar Noon
    skyZenithHex: 0x1055a1,
    skyHorizonHex: 0x68b5e8,
    sunHex: 0xfef08a,
    sunGlowHex: 0xfde047,
    keyHex: 0xfffbeb,
    keyIntensity: 2.95,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x263549,
    hemiIntensity: 1.15,
    rimHex: 0x38bdf8,
    rimIntensity: 0.7,
    envIntensity: 1.05,
  },
  {
    phase: 0.42, // 16:05 Golden Afternoon
    skyZenithHex: 0x1b457d,
    skyHorizonHex: 0xd99b52,
    sunHex: 0xfbbf24,
    sunGlowHex: 0xf59e0b,
    keyHex: 0xffe4b5,
    keyIntensity: 2.15,
    hemiSkyHex: 0xfde68a,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.9,
    rimHex: 0x38bdf8,
    rimIntensity: 0.8,
    envIntensity: 0.84,
  },
  {
    phase: 0.5, // 18:00 Sunset
    skyZenithHex: 0x161f47,
    skyHorizonHex: 0xcf5634,
    sunHex: 0xf97316,
    sunGlowHex: 0xea580c,
    keyHex: 0xff9a62,
    keyIntensity: 1.35,
    hemiSkyHex: 0xfb923c,
    hemiGroundHex: 0x0f172a,
    hemiIntensity: 0.68,
    rimHex: 0x6366f1,
    rimIntensity: 0.96,
    envIntensity: 0.52,
  },
  {
    phase: 0.6, // 20:24 Blue Hour Dusk
    skyZenithHex: 0x09132e,
    skyHorizonHex: 0x172b59,
    sunHex: 0xea580c,
    sunGlowHex: 0x3b82f6,
    keyHex: 0x60a5fa,
    keyIntensity: 0.85,
    hemiSkyHex: 0x2563eb,
    hemiGroundHex: 0x040914,
    hemiIntensity: 0.52,
    rimHex: 0x3b82f6,
    rimIntensity: 1.05,
    envIntensity: 0.34,
  },
  {
    phase: 0.75, // 00:00 Midnight Deep Blue Night
    skyZenithHex: 0x030816,
    skyHorizonHex: 0x0a1936,
    sunHex: 0xf97316,
    sunGlowHex: 0x1d4ed8,
    keyHex: 0x93c5fd,
    keyIntensity: 0.95,
    hemiSkyHex: 0x1d4ed8,
    hemiGroundHex: 0x020612,
    hemiIntensity: 0.52,
    rimHex: 0x60a5fa,
    rimIntensity: 1.15,
    envIntensity: 0.28,
  },
  {
    phase: 0.9, // 03:36 Pre-Dawn Dark Blue
    skyZenithHex: 0x050d24,
    skyHorizonHex: 0x12264d,
    sunHex: 0xfb923c,
    sunGlowHex: 0x3b82f6,
    keyHex: 0x93c5fd,
    keyIntensity: 0.85,
    hemiSkyHex: 0x2563eb,
    hemiGroundHex: 0x040914,
    hemiIntensity: 0.5,
    rimHex: 0x3b82f6,
    rimIntensity: 1.0,
    envIntensity: 0.34,
  },
  {
    phase: 1.0, // 06:00 Dawn wrap
    skyZenithHex: 0x1b3a6d,
    skyHorizonHex: 0xd97a54,
    sunHex: 0xfb923c,
    sunGlowHex: 0xf97316,
    keyHex: 0xfdba74,
    keyIntensity: 1.55,
    hemiSkyHex: 0xfed7aa,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.76,
    rimHex: 0x60a5fa,
    rimIntensity: 0.85,
    envIntensity: 0.72,
  },
];

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHex(hexA: number, hexB: number, t: number): number {
  const ar = (hexA >> 16) & 0xff;
  const ag = (hexA >> 8) & 0xff;
  const ab = hexA & 0xff;
  const br = (hexB >> 16) & 0xff;
  const bg = (hexB >> 8) & 0xff;
  const bb = hexB & 0xff;
  const r = Math.round(lerpNumber(ar, br, t)) & 0xff;
  const g = Math.round(lerpNumber(ag, bg, t)) & 0xff;
  const b = Math.round(lerpNumber(ab, bb, t)) & 0xff;
  return (r << 16) | (g << 8) | b;
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function normalizeCyclePhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

export function formatCycleClock(phase: number): string {
  const norm = normalizeCyclePhase(phase);
  const totalMinutes = Math.round(((norm * 24 + 6) % 24) * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function sampleSolarCycleState(
  rawPhase: number,
  isBlackout = false,
): CelestialCycleSample {
  const phase = normalizeCyclePhase(rawPhase);
  const sunAngle = phase * Math.PI * 2;
  const sunElevation = Math.sin(sunAngle); // +1 noon, 0 sunrise/sunset, -1 midnight

  const sunX = -Math.cos(sunAngle) * 6.8;
  const sunY = sunElevation * 5.2 + 0.65;
  const sunZ = -3.8 + sunElevation * 0.55;

  const moonAngle = sunAngle + Math.PI;
  const moonElevation = Math.sin(moonAngle);
  const moonX = -Math.cos(moonAngle) * 6.4;
  const moonY = moonElevation * 4.8 + 0.55;
  const moonZ = -3.9 + moonElevation * 0.4;

  // Locate surrounding keyframes
  let prevKf = ATMOSPHERE_KEYFRAMES[0];
  let nextKf = ATMOSPHERE_KEYFRAMES[ATMOSPHERE_KEYFRAMES.length - 1];
  for (let i = 0; i < ATMOSPHERE_KEYFRAMES.length - 1; i++) {
    if (phase >= ATMOSPHERE_KEYFRAMES[i].phase && phase <= ATMOSPHERE_KEYFRAMES[i + 1].phase) {
      prevKf = ATMOSPHERE_KEYFRAMES[i];
      nextKf = ATMOSPHERE_KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(nextKf.phase - prevKf.phase, 0.0001);
  const localT = clamp01((phase - prevKf.phase) / span);
  const smoothT = localT * localT * (3 - 2 * localT);

  let skyZenithHex = lerpHex(prevKf.skyZenithHex, nextKf.skyZenithHex, smoothT);
  let skyHorizonHex = lerpHex(prevKf.skyHorizonHex, nextKf.skyHorizonHex, smoothT);
  const sunHex = lerpHex(prevKf.sunHex, nextKf.sunHex, smoothT);
  const sunGlowHex = lerpHex(prevKf.sunGlowHex, nextKf.sunGlowHex, smoothT);
  let keyHex = lerpHex(prevKf.keyHex, nextKf.keyHex, smoothT);
  let keyIntensity = lerpNumber(prevKf.keyIntensity, nextKf.keyIntensity, smoothT);
  let hemiSkyHex = lerpHex(prevKf.hemiSkyHex, nextKf.hemiSkyHex, smoothT);
  let hemiGroundHex = lerpHex(prevKf.hemiGroundHex, nextKf.hemiGroundHex, smoothT);
  let hemiIntensity = lerpNumber(prevKf.hemiIntensity, nextKf.hemiIntensity, smoothT);
  let rimHex = lerpHex(prevKf.rimHex, nextKf.rimHex, smoothT);
  let rimIntensity = lerpNumber(prevKf.rimIntensity, nextKf.rimIntensity, smoothT);
  let envIntensity = lerpNumber(prevKf.envIntensity, nextKf.envIntensity, smoothT);

  const sunOpacity = smoothstep01(-0.14, 0.14, sunElevation);
  const sunGlowStrength = smoothstep01(-0.22, 0.35, sunElevation) * 0.65;
  const moonOpacity = smoothstep01(-0.08, 0.22, moonElevation);
  const starOpacity = smoothstep01(0.18, -0.25, sunElevation) * 0.95;

  const dayFactor = smoothstep01(0.02, 0.45, sunElevation);
  const nightFactor = smoothstep01(0.18, -0.18, sunElevation);

  let photonSpeed = dayFactor > 0.05 ? 0.35 + dayFactor * 0.42 : 0;
  let photonOpacity = dayFactor * 0.9;
  let panelEmissive = dayFactor * 0.24;
  let windowGlow = 0.22 + nightFactor * 1.25;
  let porchGlow = 0.04 + nightFactor * 1.5;
  let streetLampGlow = nightFactor * 1.55;

  // Key directional light follows the sun during daytime and hands off smoothly to moon arc at night
  const useMoonKey = sunElevation < -0.05;
  const activeCelestialX = useMoonKey ? moonX : sunX;
  const activeCelestialY = useMoonKey ? Math.max(moonY, 2.4) : Math.max(sunY, 2.2);
  const activeCelestialZ = useMoonKey ? 4.8 : 4.2 - sunElevation * 1.4;
  const lightPos: [number, number, number] = [
    activeCelestialX * 1.35,
    activeCelestialY * 1.45 + 1.5,
    activeCelestialZ,
  ];

  // Mode mapping along the 24h cycle:
  // 06:00-17:00 (0.00-0.46) -> day_solar
  // 17:00-20:50 (0.46-0.62) -> evening_battery
  // 20:50-05:00 (0.62-0.96) -> night_tariff
  // 05:00-06:00 (0.96-1.00) -> day_solar (dawn)
  let suggestedMode: Exclude<SystemFlowMode, 'blackout'> = 'day_solar';
  if (phase >= 0.46 && phase < 0.62) {
    suggestedMode = 'evening_battery';
  } else if (phase >= 0.62 && phase < 0.96) {
    suggestedMode = 'night_tariff';
  }

  if (isBlackout) {
    skyZenithHex = 0x050a14;
    skyHorizonHex = 0x101c2e;
    keyHex = 0x94a3b8;
    keyIntensity = 0.82;
    hemiSkyHex = 0x334155;
    hemiGroundHex = 0x020617;
    hemiIntensity = 0.48;
    rimHex = 0xef4444;
    rimIntensity = 0.72;
    envIntensity = 0.34;
    photonSpeed = 0.28;
    photonOpacity = 0.32;
    panelEmissive = 0.08;
    windowGlow = 1.75;
    porchGlow = 1.95;
    streetLampGlow = 0.0; // Utility grid offline
  }

  return {
    phase,
    clockLabel: formatCycleClock(phase),
    suggestedMode,
    sunElevation,
    sunPos: [sunX, sunY, sunZ],
    moonPos: [moonX, moonY, moonZ],
    lightPos,
    skyZenithHex,
    skyHorizonHex,
    sunHex,
    sunGlowHex,
    sunOpacity: isBlackout ? 0.14 : sunOpacity,
    sunGlowStrength: isBlackout ? 0.08 : sunGlowStrength,
    moonOpacity: isBlackout ? 0.22 : moonOpacity,
    starOpacity: isBlackout ? 0.35 : starOpacity,
    keyHex,
    keyIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    rimHex,
    rimIntensity,
    envIntensity,
    photonSpeed,
    photonOpacity,
    panelEmissive,
    windowGlow,
    porchGlow,
    streetLampGlow,
  };
}

