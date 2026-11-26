import type { Product, ProjectCase, ServiceItem } from '../types.ts';

export const COMPANY_INFO = {
  name: 'Energo Comfort',
  domain: 'energocomfort.shop',
  address: 'Україна, м. Одеса, вул. Європейська 93',
  schedule: 'Пн–Сб, 09:00–18:00',
  phone1: '+38 (050) 777-71-72',
  phone1Href: 'tel:+380507777172',
  phone2: '+38 (098) 152-32-61',
  phone2Href: 'tel:+380981523261',
  email: 'koen.od.develop@gmail.com',
  facebookUrl: 'https://www.facebook.com/energocomfort.shop',
};

export const BRAND_PARTNERS = [
  { name: 'Deye', logo: '/assets/energocomfort/brand_deye.png', sizeClass: 'max-h-9 w-auto max-w-[110px]' },
  { name: 'SolaX Power', logo: '/assets/energocomfort/brand_solax.png', sizeClass: 'max-h-7 w-auto max-w-[112px]' },
  { name: 'MUST', logo: '/assets/brands/brand_must.png', sizeClass: 'max-h-9 w-auto max-w-[112px]' },
  { name: 'Jinko Solar', logo: '/assets/energocomfort/brand_jinko.svg', sizeClass: 'max-h-7 w-auto max-w-[112px]' },
  { name: 'Dyness', logo: '/assets/energocomfort/brand_dyness.svg', sizeClass: 'max-h-6 w-auto max-w-[114px]' },
  { name: 'Solis', logo: '/assets/energocomfort/brand_solis.png', sizeClass: 'max-h-8 w-auto max-w-[112px]' },
  { name: 'BYD Energy Storage', logo: '/assets/brands/brand_byd.png', sizeClass: 'max-h-9 w-auto max-w-[118px]' },
  { name: 'FelicityESS', logo: '/assets/brands/brand_felicity.png', sizeClass: 'max-h-8 w-auto max-w-[118px]' },
  { name: 'Huawei', logo: '/assets/energocomfort/brand_huawei.png', sizeClass: 'max-h-7 w-auto max-w-[116px]' },
  { name: 'Livoltek', logo: '/assets/brands/brand_livoltek.png', sizeClass: 'max-h-8 w-auto max-w-[114px]' },
  { name: 'JA Solar', logo: '/assets/brands/brand_ja_solar.png', sizeClass: 'max-h-8 w-auto max-w-[116px]' },
  { name: 'TW Solar', logo: '/assets/brands/brand_tw_solar.png', sizeClass: 'max-h-8 w-auto max-w-[116px]' },
];

export const PROJECTS: ProjectCase[] = [
  {
    id: 'sto',
    seg: 'b2b',
    tag: 'B2B · Одеса',
    title: 'СТО для вантажного транспорту',
    img: '/assets/energocomfort/sto_110kw.jpg',
    task: 'Забезпечити безперебійну роботу енергоємного обладнання (підйомників, компресорів) в умовах лімітів потужності мережі.',
    solution: 'Змонтовано сонячне поле 110 кВт, встановлено трифазний гібридний інвертор 80 кВт та блок акумуляторів ємністю 160 кВт·год.',
    specs: 'PV 110 кВт · Гібрид 80 кВт · АКБ 160 кВт·год',
    result: 'Денне заміщення власного споживання та тривала автономність сервісу навіть під час тривалих відключень.',
  },
  {
    id: 'factory',
    seg: 'b2b',
    tag: 'B2B · Одеська обл.',
    title: 'Завод з виробництва тротуарної плитки',
    img: '/assets/energocomfort/factory_110kw.png',
    task: 'Зменшити навантаження на електромережу та оптимізувати денні витрати промислового виробництва.',
    solution: 'Промислове покрівельне сонячне поле потужністю 110 кВт із мережевою та гібридною архітектурою 380 В.',
    specs: 'PV 110 кВт · Промислова СЕС · 380 В',
    result: 'Стабільна генерація для виробничої лінії у робочу зміну та швидка окупність обладнання.',
  },
  {
    id: 'school',
    seg: 'b2b',
    tag: 'B2B · Заклад освіти',
    title: 'Навчальний заклад',
    img: '/assets/energocomfort/school_55kw.png',
    task: 'Забезпечити безперервний навчальний процес освітленням та живленням систем безпеки і серверів.',
    solution: 'Монтаж 55 кВт сонячних панелей та балансування критичного навантаження на 3-фазній мережі.',
    specs: 'PV 55 кВт · 3 фази · Проєкт під ключ',
    result: 'Безперебійна робота навчального комплексу під час графіків відключень.',
  },
  {
    id: 'hotel',
    seg: 'b2b',
    tag: 'B2B · Узбережжя',
    title: 'Готельний комплекс',
    img: '/assets/energocomfort/hotel_35kw.png',
    task: 'Провести аудит споживання та організувати автоматичне резервування інженерних систем готелю.',
    solution: 'Сонячне поле 35 кВт, високовольтний гібридний інвертор Deye 30 кВт та блок АКБ 30 кВт·год.',
    specs: 'PV 35 кВт · Deye 30 кВт · АКБ 30 кВт·год',
    result: 'Миттєве перемикання без зупинки сервісу, ліфтів, насосів та систем кондиціонування для гостей.',
  },
  {
    id: 'recreation',
    seg: 'b2b',
    tag: 'B2B · Одеська обл.',
    title: 'База відпочинку',
    img: '/assets/energocomfort/recreation_36kw.jpg',
    task: 'Забезпечити безперебійне енергопостачання та оптимізувати витрати у піковий курортний сезон.',
    solution: 'Встановлено 60 сонячних панелей (36 кВт), трифазний інвертор Deye 30 кВт та акумуляторний блок 30,6 кВт·год.',
    specs: 'PV 36 кВт · Deye 30 кВт · АКБ 30,6 кВт·год',
    result: 'Повна автономність ключової інфраструктури комплексу та зниження рахунків за електроенергію.',
  },
  {
    id: 'office',
    seg: 'b2b',
    tag: 'B2B · Центр Одеси',
    title: 'Офісний центр',
    img: '/assets/energocomfort/office_16kw.png',
    task: 'Живлення робочих місць, серверної групи, зв’язку та клімат-контролю без простоїв.',
    solution: 'СЕС 16 кВт, гібридний інвертор 12 кВт та запас енергії в АКБ LiFePO4 20 кВт·год.',
    specs: 'PV 16 кВт · Інвертор 12 кВт · АКБ 20 кВт·год',
    result: 'Команда працює у штатному режимі за будь-яких мережевих обмежень.',
  },
  {
    id: 'houseSolar',
    seg: 'b2c',
    tag: 'B2C · Одеський р-н',
    title: 'Приватний будинок із СЕС',
    img: '/assets/energocomfort/house_6kw.png',
    task: 'Власна денна генерація та надійний нічний резерв для родини.',
    solution: 'Сонячне поле 6 кВт, гібридний інвертор 10 кВт і акумуляторна система 15 кВт·год.',
    specs: 'PV 6 кВт · Інвертор 10 кВт · АКБ 15 кВт·год',
    result: 'Стабільне живлення будинку незалежно від зовнішньої мережі та економія на тарифі.',
  },
  {
    id: 'houseBackup',
    seg: 'b2c',
    tag: 'B2C · Одеса',
    title: 'Резервне живлення квартири та дому',
    img: '/assets/energocomfort/backup_deye_8kw.jpg',
    task: 'Тихий автопідхват опалення, освітлення та побутової техніки без втрати простору в кімнатах.',
    solution: 'Однофазний гібридний інвертор Deye 6–8 кВт та компактний LiFePO4 блок Deye 12 кВт·год із захистом AC/DC.',
    specs: 'Без СЕС · Deye 6–8 кВт (1ф) · АКБ 12 кВт·год',
    result: 'Повністю автоматизована тиха система резервного живлення з можливістю подальшого підключення панелей.',
  },
];

export const MONTAGE_SERVICES: ServiceItem[] = [
  {
    id: 'hybrid-ses',
    category: 'montage',
    kicker: 'Монтаж під ключ · B2C / B2B',
    title: 'Гібридні сонячні електростанції',
    image: '/assets/energocomfort/house_6kw.png',
    imageAlt: 'Сонячні панелі на даху приватного будинку',
    priceLabel: 'Індивідуальний кошторис · 2–5 днів',
    summary: 'Поєднують генерацію від сонця, накопичення енергії в LiFePO4 АКБ та інтелектуальну роботу з мережею.',
    bullets: [
      'Проєктування та 3D-розкладка сонячного поля на даху чи наземних конструкціях',
      'Монтаж AC/DC захисту, грозозахисту та перемикання навантаження до 10 мс',
      'Пусконалагодження інверторів Deye, SolaX, Solis і підключення хмарного моніторингу',
    ],
  },
  {
    id: 'grid-ses',
    category: 'montage',
    kicker: 'Економія та генерація · B2B / B2C',
    title: 'Мережеві сонячні електростанції',
    image: '/assets/energocomfort/sto_110kw.jpg',
    imageAlt: 'Промислова мережева СЕС на даху сервісного центру',
    priceLabel: 'Для власного споживання та продажу',
    summary: 'Максимальне заміщення денного споживання електроенергії для підприємств, СТО, готелів та приватних домогосподарств.',
    bullets: [
      'Підбір мережевих інверторів Deye, Huawei, Solis, SolaX від 5 до 150 кВт',
      'Налаштування обмеження перетоків (Zero Export) або підключення «активного споживача»',
      'Офіційна гарантія на виконані електромонтажні роботи та обладнання',
    ],
  },
  {
    id: 'backup-power',
    category: 'montage',
    kicker: 'Автономність без панелей · Одеса',
    title: 'Системи резервного живлення',
    image: '/assets/energocomfort/backup_deye_8kw.jpg',
    imageAlt: 'Інвертор резервного живлення у приватному будинку',
    priceLabel: 'Від $500 за 1 кВт (робота + захист)',
    summary: 'Рішення для квартир, приватних будинків і бізнесу, де критично пережити планові й аварійні блекаути без шуму генератора.',
    bullets: [
      'Виділення критичної групи споживачів у щиті (котел, холодильник, насоси, інтернет)',
      'Компактний безпечний монтаж у кладовій, коридорі або техприміщенні',
      'Можливість додати сонячні панелі у будь-який момент без заміни інвертора',
    ],
  },
  {
    id: 'energy-storage',
    category: 'montage',
    kicker: 'Промислові та домашні СНЕ',
    title: 'Системи накопичення електроенергії (СНЕ)',
    image: '/assets/energocomfort/kit_battery_30kwh_real.jpg',
    imageAlt: 'Акумуляторна система накопичення електроенергії',
    priceLabel: 'Вартість договірна · LV / HV',
    summary: 'Високовольтні та 48-вольтові LiFePO4 масиви для тривалої автономної роботи та згладжування пікових навантажень.',
    bullets: [
      'Стійкові та модульні батареї Deye BOS-G, Dyness Stack100, SolaX Triple Power, BYD',
      'Налаштування BMS, балансування комірок і оптимальних профілів заряду/розряду',
      'Регламентне технічне обслуговування та масштабування ємності',
    ],
  },
];

export const EXTRA_SERVICES: ServiceItem[] = [
  {
    id: 'energy-audit',
    category: 'extra',
    kicker: 'Передпроєктне обстеження',
    title: 'Аудит споживання електроенергії',
    image: '/assets/energocomfort/office_16kw.png',
    imageAlt: 'Сонячна система на даху офісного об’єкта для енергоаудиту',
    priceLabel: 'За тарифом за м² / об’єкт',
    summary: 'Детальний інструментальний аналіз реального споживання, пускових струмів та фазного навантаження об’єкта.',
    bullets: [
      'Виявлення неефективних витрат та перекосу фаз у мережі об’єкта',
      'Розрахунок реальних пускових струмів насосів, компресорів і холодильних установок',
      'Оцінка потенціалу сонячної генерації та прогноз терміну окупності',
    ],
  },
  {
    id: 'ses-design',
    category: 'extra',
    kicker: 'Інженерна документація',
    title: 'Проєктування СЕС',
    image: '/assets/energocomfort/factory_110kw.png',
    imageAlt: 'Сонячна електростанція промислового об’єкта',
    priceLabel: 'Індивідуальний технічний проєкт',
    summary: 'Розробка однолінійних схем, специфікацій кабельно-провідникової продукції, заземлення та кріплень.',
    bullets: [
      'Оптимальне компонування MPPT-стрінгів і перерізів кабелю без втрат ККД',
      'Підбір апаратів захисту DC/AC, ОПН та трипозиційних перемикачів навантаження',
      'Повний пакет креслень для безпечного монтажу та погодження з мережами',
    ],
  },
  {
    id: 'ses-maintenance',
    category: 'extra',
    kicker: 'Регламентний сервіс',
    title: 'Обслуговування СЕС',
    image: '/assets/energocomfort/hotel_35kw.png',
    imageAlt: 'Сонячна електростанція готельного комплексу',
    priceLabel: 'Разовий виїзд або сервісний договір',
    summary: 'Планове та аварійне обслуговування сонячних станцій, тепловізійний контроль і оновлення прошивок інверторів.',
    bullets: [
      'Діагностика стрінгів, протяжка контактів і перевірка ізоляції DC/AC',
      'Віддалений моніторинг генерації та перевірка стану BMS акумуляторів',
      'Оперативна заміна зношених або пошкоджених захисних компонентів',
    ],
  },
  {
    id: 'green-tariff',
    category: 'extra',
    kicker: 'Юридичний та технічний супровід',
    title: 'Оформлення «зеленого тарифу» / активного споживача',
    image: '/assets/energocomfort/recreation_36kw.jpg',
    imageAlt: 'Сонячні панелі на даху бази відпочинку',
    priceLabel: 'Повний супровід документів',
    summary: 'Підготовка технічних умов, проєкту двонаправленого лічильника та повного пакета документів для мережі.',
    bullets: [
      'Консультації щодо оптимальної моделі: «Зелений тариф» або «Активний споживач»',
      'Підготовка комплекту документів для обленерго без черг та повернень',
      'Налаштування лічильника Smart Meter та запуск компенсації споживання',
    ],
  },
];

const PROJECTS_RU: Record<string, Partial<ProjectCase>> = {
  sto: { tagRu: 'B2B · Одесса', titleRu: 'СТО для грузового транспорта', taskRu: 'Обеспечить бесперебойную работу энергоёмкого оборудования (подъёмников, компрессоров) при ограничениях мощности сети.', solutionRu: 'Установлена солнечная станция 110 кВт, трёхфазный гибридный инвертор 80 кВт и аккумуляторный блок ёмкостью 160 кВт·ч.', specsRu: 'PV 110 кВт · Гибрид 80 кВт · АКБ 160 кВт·ч', resultRu: 'Снижение дневного потребления из сети и длительная автономная работа сервиса даже при продолжительных отключениях.' },
  factory: { tagRu: 'B2B · Одесская обл.', titleRu: 'Завод по производству тротуарной плитки', taskRu: 'Снизить нагрузку на электросеть и оптимизировать дневные расходы промышленного производства.', solutionRu: 'Промышленная солнечная станция на крыше мощностью 110 кВт с сетевой и гибридной архитектурой 380 В.', specsRu: 'PV 110 кВт · Промышленная СЭС · 380 В', resultRu: 'Стабильная генерация для производственной линии в рабочую смену и быстрая окупаемость оборудования.' },
  school: { tagRu: 'B2B · Учебное заведение', titleRu: 'Учебное заведение', taskRu: 'Обеспечить непрерывный учебный процесс, освещение, питание систем безопасности и серверов.', solutionRu: 'Установлены солнечные панели мощностью 55 кВт и сбалансирована критическая нагрузка трёхфазной сети.', specsRu: 'PV 55 кВт · 3 фазы · Проект под ключ', resultRu: 'Учебный комплекс продолжает работать во время отключений электроэнергии.' },
  hotel: { tagRu: 'B2B · Побережье', titleRu: 'Гостиничный комплекс', taskRu: 'Провести аудит потребления и организовать автоматическое резервирование инженерных систем гостиницы.', solutionRu: 'Солнечная станция 35 кВт, высоковольтный гибридный инвертор Deye 30 кВт и аккумуляторный блок 30 кВт·ч.', specsRu: 'PV 35 кВт · Deye 30 кВт · АКБ 30 кВт·ч', resultRu: 'Мгновенное переключение без остановки сервиса, лифтов, насосов и систем кондиционирования.' },
  recreation: { tagRu: 'B2B · Одесская обл.', titleRu: 'База отдыха', taskRu: 'Обеспечить бесперебойное электроснабжение и оптимизировать расходы в пиковый курортный сезон.', solutionRu: 'Установлены 60 солнечных панелей (36 кВт), трёхфазный инвертор Deye 30 кВт и аккумуляторный блок 30,6 кВт·ч.', specsRu: 'PV 36 кВт · Deye 30 кВт · АКБ 30,6 кВт·ч', resultRu: 'Автономная работа ключевой инфраструктуры комплекса и снижение счетов за электроэнергию.' },
  office: { tagRu: 'B2B · Центр Одессы', titleRu: 'Офисный центр', taskRu: 'Обеспечить работу офисов, серверной, связи и климат-контроля без простоев.', solutionRu: 'СЭС 16 кВт, гибридный инвертор 12 кВт и аккумулятор LiFePO4 ёмкостью 20 кВт·ч.', specsRu: 'PV 16 кВт · Инвертор 12 кВт · АКБ 20 кВт·ч', resultRu: 'Команда работает в штатном режиме при ограничениях внешней сети.' },
  houseSolar: { tagRu: 'B2C · Одесский р-н', titleRu: 'Частный дом с СЭС', taskRu: 'Собственная дневная генерация и надёжный ночной резерв для семьи.', solutionRu: 'Солнечная станция 6 кВт, гибридный инвертор 10 кВт и аккумуляторная система 15 кВт·ч.', specsRu: 'PV 6 кВт · Инвертор 10 кВт · АКБ 15 кВт·ч', resultRu: 'Стабильное питание дома независимо от внешней сети и экономия на тарифе.' },
  houseBackup: { tagRu: 'B2C · Одесса', titleRu: 'Резервное питание квартиры и дома', taskRu: 'Тихое автоматическое резервирование отопления, освещения и бытовой техники без потери полезного пространства.', solutionRu: 'Однофазный гибридный инвертор Deye 6–8 кВт и компактный LiFePO4 блок Deye 12 кВт·ч с защитой AC/DC.', specsRu: 'Без СЭС · Deye 6–8 кВт (1 фаза) · АКБ 12 кВт·ч', resultRu: 'Полностью автоматическая бесшумная система с возможностью позже подключить солнечные панели.' },
};
PROJECTS.forEach((project) => Object.assign(project, PROJECTS_RU[project.id]));

const SERVICES_RU: Record<string, Partial<ServiceItem>> = {
  'hybrid-ses': { kickerRu: 'Монтаж под ключ · B2C / B2B', titleRu: 'Гибридные солнечные электростанции', priceLabelRu: 'Индивидуальная смета · 2–5 дней', summaryRu: 'Сочетают генерацию от солнца, накопление энергии в LiFePO4 аккумуляторах и интеллектуальную работу с сетью.', bulletsRu: ['Проектирование и 3D-раскладка солнечных панелей на крыше или наземных конструкциях', 'Монтаж защиты AC/DC, грозозащиты и переключения нагрузки до 10 мс', 'Пусконаладка инверторов Deye, SolaX, Solis и подключение облачного мониторинга'] },
  'grid-ses': { kickerRu: 'Экономия и генерация · B2B / B2C', titleRu: 'Сетевые солнечные электростанции', priceLabelRu: 'Для собственного потребления и продажи', summaryRu: 'Максимальное замещение дневного потребления электроэнергии для предприятий, СТО, гостиниц и частных домов.', bulletsRu: ['Подбор сетевых инверторов Deye, Huawei, Solis, SolaX от 5 до 150 кВт', 'Настройка ограничения перетоков (Zero Export) или подключение активного потребителя', 'Официальная гарантия на электромонтажные работы и оборудование'] },
  'backup-power': { kickerRu: 'Автономность без панелей · Одесса', titleRu: 'Системы резервного питания', priceLabelRu: 'От $500 за 1 кВт (работа + защита)', summaryRu: 'Решения для квартир, частных домов и бизнеса, которым важно пережить плановые и аварийные отключения без шума генератора.', bulletsRu: ['Выделение критической группы потребителей в щите: котёл, холодильник, насосы, интернет', 'Компактный безопасный монтаж в кладовой, коридоре или техническом помещении', 'Солнечные панели можно добавить позже без замены инвертора'] },
  'energy-storage': { kickerRu: 'Промышленные и домашние системы накопления', titleRu: 'Системы накопления электроэнергии', priceLabelRu: 'Стоимость договорная · LV / HV', summaryRu: 'Высоковольтные и 48-вольтовые LiFePO4 батареи для длительной автономной работы и сглаживания пиковых нагрузок.', bulletsRu: ['Стоечные и модульные батареи Deye BOS-G, Dyness Stack100, SolaX Triple Power, BYD', 'Настройка BMS, балансировка ячеек и профилей заряда/разряда', 'Плановое техническое обслуживание и увеличение ёмкости'] },
  'energy-audit': { kickerRu: 'Обследование перед проектированием', titleRu: 'Аудит потребления электроэнергии', priceLabelRu: 'По тарифу за м² / объект', summaryRu: 'Инструментальный анализ фактического потребления, пусковых токов и фазной нагрузки объекта.', bulletsRu: ['Выявление неэффективных расходов и перекоса фаз', 'Расчёт пусковых токов насосов, компрессоров и холодильного оборудования', 'Оценка потенциала солнечной генерации и срока окупаемости'] },
  'ses-design': { kickerRu: 'Инженерная документация', titleRu: 'Проектирование СЭС', priceLabelRu: 'Индивидуальный технический проект', summaryRu: 'Подготовка однолинейных схем, спецификаций кабелей, заземления и креплений.', bulletsRu: ['Оптимальная компоновка MPPT-стрингов и сечений кабеля', 'Подбор защиты DC/AC, УЗИП и переключателей нагрузки', 'Комплект чертежей для безопасного монтажа и согласования с сетями'] },
  'ses-maintenance': { kickerRu: 'Регламентное обслуживание', titleRu: 'Обслуживание СЭС', priceLabelRu: 'Разовый выезд или договор на обслуживание', summaryRu: 'Плановое и аварийное обслуживание солнечных станций, тепловизионный контроль и обновление прошивок инверторов.', bulletsRu: ['Диагностика стрингов, проверка контактов и изоляции DC/AC', 'Удалённый мониторинг генерации и состояния аккумуляторов BMS', 'Оперативная замена изношенных или повреждённых защитных компонентов'] },
  'green-tariff': { kickerRu: 'Юридическое и техническое сопровождение', titleRu: 'Оформление «зелёного тарифа» / активного потребителя', priceLabelRu: 'Полное сопровождение документов', summaryRu: 'Подготовка технических условий, проекта двунаправленного счётчика и пакета документов для сетевой компании.', bulletsRu: ['Консультация по выбору модели: «Зелёный тариф» или «Активный потребитель»', 'Подготовка комплекта документов для облэнерго', 'Настройка Smart Meter и запуск компенсации потребления'] },
};
[...MONTAGE_SERVICES, ...EXTRA_SERVICES].forEach((service) => Object.assign(service, SERVICES_RU[service.id]));

export interface FaqItem {
  q: string;
  a: string;
  qRu?: string;
  aRu?: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Як швидко система перемикається при відключенні світла та чи працює газовий котел?',
    a: 'Гібридні інвертори Deye та SolaX перемикаються на акумулятори до 10 мс (режим ДБЖ): двоконтурний газовий котел, холодильник, сигналізація та Wi-Fi роутер не встигають перезавантажитись.',
    qRu: 'Как быстро система переключается при отключении электричества и работает ли газовый котёл?',
    aRu: 'Гибридные инверторы Deye и SolaX переключаются на аккумуляторы до 10 мс (режим ИБП): двухконтурный газовый котёл, холодильник, сигнализация и Wi-Fi роутер не успевают перезагрузиться.',
  },
  {
    q: 'Чи можна купити окремий інвертор, панель чи автомат прямо на сайті?',
    a: 'Так — у розділі «Обладнання» представлено весь каталог із реальними цінами, наявністю та кошиком замовлень. Готові системи «під ключ» додатково проходять інженерну перевірку під ваші фази та дах.',
    qRu: 'Можно ли купить отдельный инвертор, панель или автомат прямо на сайте?',
    aRu: 'Да — в разделе «Оборудование» представлен весь каталог с реальными ценами, наличием и корзиной заказов. Готовые системы «под ключ» дополнительно проходят инженерную проверку под ваши фазы и крышу.',
  },
  {
    q: 'Чи можна спочатку поставити інвертор з АКБ, а сонячні панелі додати пізніше?',
    a: 'Так, гібридні інвертори мають вбудовані MPPT-контролери. Ви можете почати з резервного живлення для квартири чи будинку, а сонячне поле підключити наступним етапом без заміни інвертора.',
    qRu: 'Можно ли сначала установить инвертор с АКБ, а солнечные панели добавить позже?',
    aRu: 'Да, гибридные инверторы оснащены встроенными MPPT-контроллерами. Вы можете начать с резервного питания для квартиры или дома, а солнечное поле подключить следующим этапом без замены инвертора.',
  },
  {
    q: 'Чи допомагаєте ви з оформленням «зеленого тарифу» або статусу активного споживача?',
    a: 'Так, ми надаємо повний технічний та документальний супровід — від аудиту потужності до підключення двонаправленого обліку (Net Billing) в Одесі та області.',
    qRu: 'Помогаете ли вы с оформлением «зелёного тарифа» или статуса активного потребителя?',
    aRu: 'Да, мы обеспечиваем полное техническое и документальное сопровождение — от аудита мощности до подключения двунаправленного учёта (Net Billing) в Одессе и области.',
  },
  {
    q: 'Скільки триває монтаж системи та яка гарантія на обладнання і роботи?',
    a: 'Встановлення системи резервного живлення займає 1–2 дні, а повної гібридної СЕС із панелями на даху — від 2 до 5 днів. Надаємо офіційну гарантію виробника на інвертори та панелі (5–12 років / до 25 років на генерацію), АКБ (до 10 років) і гарантію на електромонтаж в Одесі.',
    qRu: 'Сколько длится монтаж системы и какая гарантия на оборудование и работы?',
    aRu: 'Установка системы резервного питания занимает 1–2 дня, а полной гибридной СЭС с панелями на крыше — от 2 до 5 дней. Предоставляем официальную гарантию производителя на инверторы и панели (5–12 лет / до 25 лет на генерацию), АКБ (до 10 лет) и гарантию на электромонтаж в Одессе.',
  },
  {
    q: 'Чи безпечно ставити акумулятори LiFePO4 у квартирі або будинку та на скільки років їх вистачає?',
    a: 'Літій-залізо-фосфатні (LiFePO4) батареї Deye, Dyness і SolaX не виділяють газів і є пожежобезпечними, тому підходять для коридорів, комор і техприміщень. Ресурс понад 6 000 циклів забезпечує 12–15 років щоденної роботи.',
    qRu: 'Безопасно ли устанавливать аккумуляторы LiFePO4 в квартире или доме и на сколько лет их хватает?',
    aRu: 'Литий-железо-фосфатные (LiFePO4) батареи Deye, Dyness и SolaX не выделяют газов и пожаробезопасны, поэтому подходят для коридоров, кладовых и техпомещений. Ресурс свыше 6 000 циклов обеспечивает 12–15 лет ежедневной работы.',
  },
];

export const READY_TO_USE_KITS: Product[] = [
  {
    id: 'systema-rezervnogo-zhyvlennya-deye-10kw-akb-10kwh-pid-klyuch',
    sku: '8011',
    title: '☀️ Готове рішення Deye 10 кВт / 10.2 кВт*год',
    titleRu: '☀️ Готовое решение Deye 10 кВт / 10.2 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Deye',
    isKit: true,
    price: 4500,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/systema-rezervnogo-zhyvlennya-deye-10kw-akb-10kwh-pid-klyuch.png',
    specs: [
      ['Потужність', '10 кВт'],
      ['Ємність АКБ', '10.2 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '10 кВт'],
      ['Ёмкость АКБ', '10.2 кВт·ч'],
    ],
    description:
      'Готове рішення Deye 10 кВт + 2× АКБ 5.1 кВт·год (10.2 кВт·год) із захисною автоматикою та монтажем під ключ для великих приватних будинків і котеджів.',
    descriptionRu:
      'Готовое решение Deye 10 кВт + 2× АКБ 5.1 кВт·ч (10.2 кВт·ч) с защитной автоматикой и монтажом под ключ для больших частных домов и коттеджей.',
    sourceUrl:
      'https://energocomfort.shop/shop/systema-rezervnogo-zhyvlennya-deye-10kw-akb-10kwh-pid-klyuch',
  },
  {
    id: 'systema-rezervnogo-zhyvlennya-deye-6kw-akb-5kwh-montazh-pid-klyuch',
    sku: '8010',
    title: '☀️ Готове рішення Deye 6 кВт / 5.1 кВт*год',
    titleRu: '☀️ Готовое решение Deye 6 кВт / 5.1 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Deye',
    isKit: true,
    price: 2999,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/systema-rezervnogo-zhyvlennya-deye-6kw-akb-5kwh-montazh-pid-klyuch.png',
    specs: [
      ['Потужність', '6 кВт'],
      ['Ємність АКБ', '5.1 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '6 кВт'],
      ['Ёмкость АКБ', '5.1 кВт·ч'],
    ],
    description:
      'Готове рішення 6 кВт / 5.1 кВт·год (Deye + повний комплект матеріалів + монтаж в Одесі під ключ) для квартири, будинку чи офісу.',
    descriptionRu:
      'Готовое решение 6 кВт / 5.1 кВт·ч (Deye + полный комплект материалов + монтаж в Одессе под ключ) для квартиры, дома или офиса.',
    sourceUrl:
      'https://energocomfort.shop/shop/systema-rezervnogo-zhyvlennya-deye-6kw-akb-5kwh-montazh-pid-klyuch',
  },
  {
    id: 'systema-rezervnogo-zhyvlennya-must-4kw-akb-5kwh-montazh-pid-klyuch',
    sku: '8030',
    title: '☀️ Готове рішення Must 4 кВт / 5.1 кВт*год',
    titleRu: '☀️ Готовое решение Must 4 кВт / 5.1 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Must',
    isKit: true,
    price: 2000,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/systema-rezervnogo-zhyvlennya-must-4kw-akb-5kwh-montazh-pid-klyuch.png',
    specs: [
      ['Потужність', '4 кВт'],
      ['Ємність АКБ', '5.1 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '4 кВт'],
      ['Ёмкость АКБ', '5.1 кВт·ч'],
    ],
    description:
      'Система резервного живлення «Must Comfort» 4 кВт / 5.1 кВт·год (інвертор + LiFePO4 АКБ + монтаж в Одесі під ключ).',
    descriptionRu:
      'Система резервного питания «Must Comfort» 4 кВт / 5.1 кВт·ч (инвертор + LiFePO4 АКБ + монтаж в Одессе под ключ).',
    sourceUrl:
      'https://energocomfort.shop/shop/systema-rezervnogo-zhyvlennya-must-4kw-akb-5kwh-montazh-pid-klyuch',
  },
  {
    id: 'systema-rezervnogo-zhyvlennya-must-6-2kw-akb-5kwh-montazh-pid-klyuch',
    sku: '8654',
    title: '☀️ Готове рішення Must 6.2 кВт + АКБ 5.12 кВт·год',
    titleRu: '☀️ Готовое решение Must 6.2 кВт + АКБ 5.12 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Must',
    isKit: true,
    price: 2600,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/systema-rezervnogo-zhyvlennya-must-6-2kw-akb-5kwh-montazh-pid-klyuch.jpg',
    specs: [
      ['Потужність', '6.2 кВт'],
      ['Ємність АКБ', '5.12 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '6.2 кВт'],
      ['Ёмкость АКБ', '5.12 кВт·ч'],
    ],
    description:
      'Система резервного живлення MUST 6.2 кВт + АКБ 5.12 кВт·год із захистом та професійним монтажем під ключ.',
    descriptionRu:
      'Система резервного питания MUST 6.2 кВт + АКБ 5.12 кВт·ч с защитой и профессиональным монтажом под ключ.',
    sourceUrl:
      'https://energocomfort.shop/shop/systema-rezervnogo-zhyvlennya-must-6-2kw-akb-5kwh-montazh-pid-klyuch',
  },
  {
    id: 'sistema-rezervnogo-zhyvlennya-solax-5kw-akb-5-3kwh-pid-klyuch',
    sku: '8055',
    title: '☀️ Готове рішення SolaX Power 5 кВт + 5.3 кВт*год',
    titleRu: '☀️ Готовое решение SolaX Power 5 кВт + 5.3 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'SolaX',
    isKit: true,
    price: 2499,
    oldPrice: 2999,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/sistema-rezervnogo-zhyvlennya-solax-5kw-akb-5-3kwh-pid-klyuch.png',
    specs: [
      ['Потужність', '5 кВт'],
      ['Ємність АКБ', '5.3 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '5 кВт'],
      ['Ёмкость АКБ', '5.3 кВт·ч'],
    ],
    description:
      'Система резервного живлення SolaX Power 5 кВт + АКБ 5.3 кВт·год з монтажем в Одесі «під ключ».',
    descriptionRu:
      'Система резервного питания SolaX Power 5 кВт + АКБ 5.3 кВт·ч с монтажом в Одессе «под ключ».',
    sourceUrl:
      'https://energocomfort.shop/shop/sistema-rezervnogo-zhyvlennya-solax-5kw-akb-5-3kwh-pid-klyuch',
  },
  {
    id: 'sistema-rezervnogo-zhivlennya-solax-10kw-t-bat-5-3kwh-pid-klyuch',
    sku: '7854',
    title: '☀️ Готове рішення SolaX Premium 10 кВт + 2х АКБ 5.3 кВт·год',
    titleRu: '☀️ Готовое решение SolaX Premium 10 кВт + 2× АКБ 5.3 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'SolaX',
    isKit: true,
    price: 3999,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/sistema-rezervnogo-zhivlennya-solax-10kw-t-bat-5-3kwh-pid-klyuch.png',
    specs: [
      ['Потужність', '10 кВт'],
      ['Ємність АКБ', '10.6 кВт·год'],
    ],
    specsRu: [
      ['Мощность', '10 кВт'],
      ['Ёмкость АКБ', '10.6 кВт·ч'],
    ],
    description:
      'Система резервного живлення SolaX Premium 10 кВт + 2× АКБ 5.3 кВт·год (10.6 кВт·год) з монтажем в Одесі під ключ.',
    descriptionRu:
      'Система резервного питания SolaX Premium 10 кВт + 2× АКБ 5.3 кВт·ч (10.6 кВт·ч) с монтажом в Одессе под ключ.',
    sourceUrl:
      'https://energocomfort.shop/shop/sistema-rezervnogo-zhivlennya-solax-10kw-t-bat-5-3kwh-pid-klyuch',
  },
  {
    id: 'sonyachna-stantsiya-deye-10kw-akb-10kwh-20trina-bifacial-pid-klyuch',
    sku: '8021',
    title: '☀️ Готове рішення СЕС Deye 10 кВт / 10.2 кВт*год + 20x Trina BIFACIAL',
    titleRu: '☀️ Готовое решение СЭС Deye 10 кВт / 10.2 кВт·ч + 20× Trina BIFACIAL',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'sonyachni-elektrostanciyi-pid-klyuch',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Deye',
    isKit: true,
    price: 8500,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/sonyachna-stantsiya-deye-10kw-akb-10kwh-20trina-bifacial-pid-klyuch.png',
    specs: [
      ['Потужність', '10 кВт'],
      ['Ємність АКБ', '10.2 кВт·год'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    specsRu: [
      ['Мощность', '10 кВт'],
      ['Ёмкость АКБ', '10.2 кВт·ч'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    description:
      'Сонячна електростанція Deye 10 кВт / 10.2 кВт·год + 20× Trina Solar Bifacial із кріпленням та монтажем під ключ в Одесі.',
    descriptionRu:
      'Солнечная электростанция Deye 10 кВт / 10.2 кВт·ч + 20× Trina Solar Bifacial с креплениями и монтажом под ключ в Одессе.',
    sourceUrl:
      'https://energocomfort.shop/shop/sonyachna-stantsiya-deye-10kw-akb-10kwh-20trina-bifacial-pid-klyuch',
  },
  {
    id: 'sonyachna-stantsiya-deye-6kw-akb-5kwh-trina-bifacial-pid-klyuch',
    sku: '8020',
    title: '☀️ Готове рішення СЕС Deye 6 кВт / 5.1 кВт*год + 10x Trina BIFACIAL',
    titleRu: '☀️ Готовое решение СЭС Deye 6 кВт / 5.1 кВт·ч + 10× Trina BIFACIAL',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'sonyachni-elektrostanciyi-pid-klyuch',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Deye',
    isKit: true,
    price: 4500,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/sonyachna-stantsiya-deye-6kw-akb-5kwh-trina-bifacial-pid-klyuch.png',
    specs: [
      ['Потужність', '6 кВт'],
      ['Ємність АКБ', '5.1 кВт·год'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    specsRu: [
      ['Мощность', '6 кВт'],
      ['Ёмкость АКБ', '5.1 кВт·ч'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    description:
      'Готове рішення СЕС «Максимальна генерація» Deye 6 кВт / 5.1 кВт·год + 10× Trina Solar Bifacial із монтажем під ключ.',
    descriptionRu:
      'Готовое решение СЭС «Максимальная генерация» Deye 6 кВт / 5.1 кВт·ч + 10× Trina Solar Bifacial с монтажом под ключ.',
    sourceUrl:
      'https://energocomfort.shop/shop/sonyachna-stantsiya-deye-6kw-akb-5kwh-trina-bifacial-pid-klyuch',
  },
  {
    id: 'ses-solax-10kw-2x-t-bat-10-6kwh-20x-trina-bifacial',
    sku: '8213',
    title: '☀️ Готове рішення СЕС SolaX Power 10 кВт / 10.6 кВт*год + 20x Trina BIFACIAL',
    titleRu: '☀️ Готовое решение СЭС SolaX Power 10 кВт / 10.6 кВт·ч + 20× Trina BIFACIAL',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'sonyachni-elektrostanciyi-pid-klyuch',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'SolaX',
    isKit: true,
    price: 9000,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/ses-solax-10kw-2x-t-bat-10-6kwh-20x-trina-bifacial.png',
    specs: [
      ['Потужність', '10 кВт'],
      ['Ємність АКБ', '10.6 кВт·год'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    specsRu: [
      ['Мощность', '10 кВт'],
      ['Ёмкость АКБ', '10.6 кВт·ч'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    description:
      'Готове рішення СЕС «Повна енергонезалежність» SolaX Power 10 кВт / 10.6 кВт·год + 20× Trina Bifacial із монтажем під ключ.',
    descriptionRu:
      'Готовое решение СЭС «Полная энергонезависимость» SolaX Power 10 кВт / 10.6 кВт·ч + 20× Trina Bifacial с монтажом под ключ.',
    sourceUrl:
      'https://energocomfort.shop/shop/ses-solax-10kw-2x-t-bat-10-6kwh-20x-trina-bifacial',
  },
  {
    id: 'ses-solax-5kw-t-bat-5-3kwh-trina-bifacial',
    sku: '8831',
    title: '☀️ Готове рішення СЕС SolaX Power 5 кВт / 5.3 кВт*год + 10x Trina BIFACIAL',
    titleRu: '☀️ Готовое решение СЭС SolaX Power 5 кВт / 5.3 кВт·ч + 10× Trina BIFACIAL',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'sonyachni-elektrostanciyi-pid-klyuch',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'SolaX',
    isKit: true,
    price: 4500,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'в наявності',
    statusLabelRu: 'в наличии',
    img: '/assets/products/ses-solax-5kw-t-bat-5-3kwh-trina-bifacial.png',
    specs: [
      ['Потужність', '5 кВт'],
      ['Ємність АКБ', '5.3 кВт·год'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    specsRu: [
      ['Мощность', '5 кВт'],
      ['Ёмкость АКБ', '5.3 кВт·ч'],
      ['Тип модуля', 'Bifacial N-Type'],
    ],
    description:
      'Готове рішення СЕС «Інтелектуальна автономія» SolaX Power 5 кВт / 5.3 кВт·год + 10× Trina Bifacial із монтажем під ключ.',
    descriptionRu:
      'Готовое решение СЭС «Интеллектуальная автономия» SolaX Power 5 кВт / 5.3 кВт·ч + 10× Trina Bifacial с монтажом под ключ.',
    sourceUrl:
      'https://energocomfort.shop/shop/ses-solax-5kw-t-bat-5-3kwh-trina-bifacial',
  },
  {
    id: 'komplekt-rezervnoho-zhyvlennya-deye-8kw-akb-16kwh',
    sku: '8389',
    title: '☀️ Готове рішення Deye 8 кВт / 16 кВт*год',
    titleRu: '☀️ Готовое решение Deye 8 кВт / 16 кВт·ч',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'Deye',
    isKit: true,
    price: 3999,
    oldPrice: 0,
    inStock: true,
    statusLabel: 'очікується',
    statusLabelRu: 'ожидается',
    img: '/assets/products/komplekt-rezervnoho-zhyvlennya-deye-8kw-akb-16kwh.jpg',
    specs: [
      ['Потужність', '8 кВт'],
      ['Ємність АКБ', '16 кВт·год'],
      ['Технологія', 'LiFePO4'],
    ],
    specsRu: [
      ['Мощность', '8 кВт'],
      ['Ёмкость АКБ', '16 кВт·ч'],
      ['Технология', 'LiFePO4'],
    ],
    description:
      'Готове рішення для енергонезалежності «ПІД КЛЮЧ» — комплект резервного живлення Deye 8 кВт + LiFePO4 АКБ 16 кВт·год.',
    descriptionRu:
      'Готовое решение для энергонезависимости «ПОД КЛЮЧ» — комплект резервного питания Deye 8 кВт + LiFePO4 АКБ 16 кВт·ч.',
    sourceUrl:
      'https://energocomfort.shop/shop/komplekt-rezervnoho-zhyvlennya-deye-8kw-akb-16kwh',
  },
  {
    id: 'vysokovoltna-sistema-solax-x3-ies-p15b15',
    sku: '9988',
    title: 'Гібридна система накопичення енергії SolaX Power X3-IES-P15B15 (15 кВт / 15 кВт*год, High Voltage)',
    titleRu: 'Гибридная система накопления энергии SolaX Power X3-IES-P15B15 (15 кВт / 15 кВт·ч, High Voltage)',
    cat: 'kits',
    rawCats: [
      'gotovi-rishennya-dlya-energonezalezhnosti',
      'rezervne-zhivlennya-dlya-domu-ta-kvartiri',
      'gotovi-rishennya-ses-pid-klyuch',
    ],
    brand: 'SolaX',
    isKit: true,
    price: 10120,
    oldPrice: 0,
    inStock: false,
    statusLabel: 'немає в наявності',
    statusLabelRu: 'нет в наличии',
    img: '/assets/products/vysokovoltna-sistema-solax-x3-ies-p15b15.png',
    specs: [
      ['Потужність', '15 кВт'],
      ['Ємність АКБ', '15 кВт·год'],
      ['Тип системи', 'Високовольтна (HV)'],
    ],
    specsRu: [
      ['Мощность', '15 кВт'],
      ['Ёмкость АКБ', '15 кВт·ч'],
      ['Тип системы', 'Высоковольтная (HV)'],
    ],
    description:
      'SolaX Power X3-IES-P15B15 — високовольтне (High Voltage) рішення преміум-класу формату «All-in-One» потужністю 15 кВт із накопичувачем 15 кВт·год.',
    descriptionRu:
      'SolaX Power X3-IES-P15B15 — высоковольтное (High Voltage) решение премиум-класса формата «All-in-One» мощностью 15 кВт с накопителем 15 кВт·ч.',
    sourceUrl:
      'https://energocomfort.shop/shop/vysokovoltna-sistema-solax-x3-ies-p15b15',
  },
];

