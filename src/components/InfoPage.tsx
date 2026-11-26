import { useState } from 'react';
import { ArrowLeft, Banknote, ChevronDown, FileText, HelpCircle, PackageCheck, Phone, ShieldCheck, Truck, Wrench } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { tr } from '../lib/i18n.ts';
import { VideoBackground } from './VideoBackground.tsx';

interface InfoPageProps {
  type: 'payment-delivery' | 'offer' | 'privacy' | 'terms';
  usdUahRate: number | null;
  onBackHome: () => void;
}

export type FaqTopic = 'all' | 'installation' | 'maintenance' | 'ordering';
export type FaqItemTopic = Exclude<FaqTopic, 'all'>;

export interface InfoFaqItem {
  id: string;
  topic: FaqItemTopic;
  questionUk: string;
  questionRu: string;
  answerUk: string;
  answerRu: string;
}

export interface FaqCategoryMeta {
  id: FaqTopic;
  labelUk: string;
  labelRu: string;
}

export const FAQ_CATEGORIES: FaqCategoryMeta[] = [
  { id: 'all', labelUk: 'Усі', labelRu: 'Все' },
  { id: 'installation', labelUk: 'Монтаж', labelRu: 'Монтаж' },
  { id: 'maintenance', labelUk: 'Обслуговування', labelRu: 'Обслуживание' },
  { id: 'ordering', labelUk: 'Замовлення', labelRu: 'Заказ' },
];

export const SOLAR_MAINTENANCE_FAQ: InfoFaqItem[] = [
  {
    id: 'install-timeline',
    topic: 'installation',
    questionUk: 'Скільки триває монтаж СЕС або системи резервного живлення та як підготувати об’єкт?',
    questionRu: 'Сколько длится монтаж СЭС или системы резервного питания и как подготовить объект?',
    answerUk: 'Підключення гібридного інвертора з акумулятором LiFePO4 займає 1–2 робочі дні, а повноцінної сонячної електростанції з покрівельним кріпленням — 2–5 днів. Перед приїздом бригади достатньо забезпечити доступ до головного електрощита, вільне сухе місце для інвертора/АКБ та вільний прохід на дах або фасад.',
    answerRu: 'Подключение гибридного инвертора с аккумулятором LiFePO4 занимает 1–2 рабочих дня, а полноценной солнечной электростанции с кровельным креплением — 2–5 дней. Перед приездом бригады достаточно обеспечить доступ к главному электрощиту, свободное сухое место для инвертора/АКБ и свободный проход на крышу или фасад.',
  },
  {
    id: 'install-requirements',
    topic: 'installation',
    questionUk: 'Де безпечно встановлювати інвертор та LiFePO4 акумулятори в будинку чи квартирі?',
    questionRu: 'Где безопасно устанавливать инвертор и LiFePO4 аккумуляторы в доме или квартире?',
    answerUk: 'Обирайте сухе вентильоване приміщення без прямих сонячних променів і вологи (коридор, комора, гараж або техкімната) з оптимальною температурою +5…+35 °C. Між інвертором, стінами та стелею залишають технологічні зазори від 20–30 см для охолодження, а поруч обов’язково монтують щит захисту DC/AC і контур заземлення.',
    answerRu: 'Выбирайте сухое вентилируемое помещение без прямых солнечных лучей и влаги (коридор, кладовая, гараж или техкомната) с оптимальной температурой +5…+35 °C. Между инвертором, стенами и потолком оставляют технологические зазоры от 20–30 см для охлаждения, а рядом обязательно монтируют щит защиты DC/AC и контур заземления.',
  },
  {
    id: 'install-outage-safety',
    topic: 'installation',
    questionUk: 'Як система працює під час відключень світла та чи захищена від грози й перепадів напруги?',
    questionRu: 'Как система работает при отключениях электричества и защищена ли от грозы и перепадов напряжения?',
    answerUk: 'При зникненні міської мережі гібридний інвертор автоматично переводить критичні лінії на АКБ менш ніж за 10 мс і блокує подачу напруги у зовнішню лінію (Anti-Islanding). Для захисту обладнання під час монтажу встановлюються обмежувачі імпульсних перенапруг (ОПН / УЗІП) по стороні сонячних стрінгів DC та мережі AC.',
    answerRu: 'При пропадании городской сети гибридный инвертор автоматически переводит критические линии на АКБ менее чем за 10 мс и блокирует подачу напряжения во внешнюю линию (Anti-Islanding). Для защиты оборудования при монтаже устанавливаются ограничители импульсных перенапряжений (УЗИП) по стороне солнечных стрингов DC и сети AC.',
  },
  {
    id: 'maintenance-panels',
    topic: 'maintenance',
    questionUk: 'Як часто потрібно мити сонячні панелі та що робити зі снігом узимку?',
    questionRu: 'Как часто нужно мыть солнечные панели и что делать со снегом зимой?',
    answerUk: 'При куті нахилу від 15° основний пил змивається дощем, але за наявності пилу, пилку чи пташиного посліду рекомендується мити модулі 1–2 рази на рік (навесні та наприкінці літа) м’якою водою вранці або ввечері без абразивних щіток і мийок високого тиску. Сніг зазвичай сходить самостійно під час прогріву скла; збивати кригу жорсткими скребками заборонено, щоб не пошкодити антивідблискове покриття.',
    answerRu: 'При угле наклона от 15° основная пыль смывается дождём, но при скоплении пыли, пыльцы или птичьего помёта рекомендуется мыть модули 1–2 раза в год (весной и в конце лета) мягкой водой утром или вечером без абразивных щёток и моек высокого давления. Снег обычно сходит самостоятельно при прогреве стекла; сбивать наледь жёсткими скребками запрещено во избежание повреждения антибликового покрытия.',
  },
  {
    id: 'maintenance-service',
    topic: 'maintenance',
    questionUk: 'Яке регламентне обслуговування потрібне інвертору, кабелям і батареям?',
    questionRu: 'Какое регламентное обслуживание требуется инвертору, кабелям и батареям?',
    answerUk: 'LiFePO4 акумулятори не потребують доливання чи ручного балансування, проте раз на 6 місяців варто очищувати вентиляційні решітки та радіатор інвертора від пилу. Щороку перед піковим сезоном інженери перевіряють затяжку клем DC/AC, стан конекторів MC4, опір ізоляції, спрацювання захисних автоматів та проводять тепловізійний контроль контактів.',
    answerRu: 'LiFePO4 аккумуляторы не требуют доливки или ручной балансировки, однако раз в 6 месяцев стоит очищать вентиляционные решётки и радиатор инвертора от пыли. Ежегодно перед пиковым сезоном инженеры проверяют затяжку клемм DC/AC, состояние коннекторов MC4, сопротивление изоляции, срабатывание защитных автоматов и проводят тепловизионный контроль контактов.',
  },
  {
    id: 'maintenance-monitoring-warranty',
    topic: 'maintenance',
    questionUk: 'Чи потрібно оновлювати прошивку інвертора та що впливає на збереження гарантії?',
    questionRu: 'Нужно ли обновлять прошивку инвертора и что влияет на сохранение гарантии?',
    answerUk: 'Через мобільний застосунок моніторингу (Solarman, SolaX Cloud, SolisCloud) ви бачите генерацію, заряд АКБ та можливі коди попереджень у реальному часі. Оновлення прошивки та будь-які зміни в електросхемі має виконувати авторизований інженер; дотримання правил підключення, робочих температур і наявність сертифікованого захисту зберігають офіційну гарантію виробника 5–12 років на інвертори та до 10 років на АКБ.',
    answerRu: 'Через мобильное приложение мониторинга (Solarman, SolaX Cloud, SolisCloud) вы видите генерацию, заряд АКБ и возможные коды предупреждений в реальном времени. Обновление прошивки и любые изменения в электросхеме должен выполнять авторизованный инженер; соблюдение правил подключения, рабочих температур и наличие сертифицированной защиты сохраняют официальную гарантию производителя 5–12 лет на инверторы и до 10 лет на АКБ.',
  },
  {
    id: 'ordering-confirmation',
    topic: 'ordering',
    questionUk: 'Як відбувається підтвердження замовлення та фіксація ціни у гривнях?',
    questionRu: 'Как происходит подтверждение заказа и фиксация цены в гривнах?',
    answerUk: 'Після оформлення кошика або заявки менеджер зв’язується з вами, перевіряє наявність позицій на складі в Одесі та розраховує фінальну суму в гривнях за актуальним комерційним курсом компанії на день підтвердження. Оплата здійснюється лише після узгодження складу замовлення та рахунку чи способу оплати.',
    answerRu: 'После оформления корзины или заявки менеджер связывается с вами, проверяет наличие позиций на складе в Одессе и рассчитывает итоговую сумму в гривнах по актуальному коммерческому курсу компании на день подтверждения. Оплата производится только после согласования состава заказа и счёта или способа оплаты.',
  },
  {
    id: 'ordering-delivery-packaging',
    topic: 'ordering',
    questionUk: 'Як доставляються сонячні панелі та важкі LiFePO4 акумулятори по Україні?',
    questionRu: 'Как доставляются солнечные панели и тяжёлые LiFePO4 аккумуляторы по Украине?',
    answerUk: 'Обладнання можна забрати самовивозом зі складу в Одесі або замовити відправлення перевізником по Україні в посиленому пакуванні / на палеті зі страхуванням повної вартості. Перед підтвердженням відправлення менеджер узгоджує орієнтовну дату доставки й тариф перевізника.',
    answerRu: 'Оборудование можно забрать самовывозом со склада в Одессе или заказать отправку перевозчиком по Украине в усиленной упаковке / на паллете со страхованием полной стоимости. Перед подтверждением отправки менеджер согласует ориентировочную дату доставки и тариф перевозчика.',
  },
  {
    id: 'ordering-compatibility',
    topic: 'ordering',
    questionUk: 'Чи перевіряєте ви сумісність інвертора, АКБ та захисної автоматики перед відправкою?',
    questionRu: 'Проверяете ли вы совместимость инвертора, АКБ и защитной автоматики перед отправкой?',
    answerUk: 'Так, перед відвантаженням інженер звіряє напругу АКБ (48 В або високовольтні HV-блоки), протокол зв’язку BMS, пускові струми та переріз кабелю й номінали DC/AC автоматів під обраний інвертор, щоб комплект безпроблемно запустився на об’єкті.',
    answerRu: 'Да, перед отгрузкой инженер сверяет напряжение АКБ (48 В или высоковольтные HV-блоки), протокол связи BMS, пусковые токи, сечение кабеля и номиналы DC/AC автоматов под выбранный инвертор, чтобы комплект беспроблемно запустился на объекте.',
  },
];

export function filterFaqByTopic(items: InfoFaqItem[], topic: FaqTopic): InfoFaqItem[] {
  if (topic === 'all') return items;
  return items.filter((item) => item.topic === topic);
}

const cardClass = 'ec-glass-card rounded-2xl p-4 sm:p-6 lg:p-7 text-[#07213e]';

export function FAQ({ initialTopic = 'all' }: { initialTopic?: FaqTopic } = {}) {
  const [topicFilter, setTopicFilter] = useState<FaqTopic>(initialTopic);
  const initialVisible = filterFaqByTopic(SOLAR_MAINTENANCE_FAQ, initialTopic);
  const [openId, setOpenId] = useState<string | null>(initialVisible[0]?.id ?? null);

  const visibleItems = filterFaqByTopic(SOLAR_MAINTENANCE_FAQ, topicFilter);

  const handleTopicChange = (nextTopic: FaqTopic) => {
    setTopicFilter(nextTopic);
    const nextVisible = filterFaqByTopic(SOLAR_MAINTENANCE_FAQ, nextTopic);
    if (!nextVisible.some((item) => item.id === openId)) {
      setOpenId(nextVisible[0]?.id ?? null);
    }
  };

  const topicBadgeMeta: Record<FaqItemTopic, { labelUk: string; labelRu: string; badgeClass: string }> = {
    installation: {
      labelUk: 'Монтаж',
      labelRu: 'Монтаж',
      badgeClass: 'bg-sky-100/90 text-[#0b66b2]',
    },
    maintenance: {
      labelUk: 'Сервіс',
      labelRu: 'Сервис',
      badgeClass: 'bg-emerald-100/90 text-[#0f766e]',
    },
    ordering: {
      labelUk: 'Замовлення',
      labelRu: 'Заказ',
      badgeClass: 'bg-amber-100/90 text-amber-800',
    },
  };

  return (
    <section
      id="info-faq"
      aria-labelledby="info-faq-heading"
      className={cardClass}
    >
      <div className="flex flex-col gap-4 border-b border-sky-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0b66b2]">
            <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tr('Монтаж, сервіс та замовлення · FAQ', 'Монтаж, сервис и заказ · FAQ')}</span>
          </div>
          <h2 id="info-faq-heading" className="text-lg sm:text-xl font-extrabold text-[#07213e]">
            {tr('Часті питання про монтаж, обслуговування та замовлення', 'Частые вопросы о монтаже, обслуживании и заказе')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#1c3d5e]">
            {tr(
              'Оберіть тему для швидкого пошуку відповіді щодо підготовки до монтажу, догляду за СЕС або оформлення та доставки.',
              'Выберите тему для быстрого поиска ответа о подготовке к монтажу, уходе за СЭС или оформлении и доставке.',
            )}
          </p>
        </div>

        <div
          role="group"
          aria-label={tr('Фільтр питань FAQ за темою', 'Фильтр вопросов FAQ по теме')}
          className="inline-flex flex-wrap gap-1.5 rounded-xl bg-sky-50/90 p-1 border border-sky-200/80 self-start sm:self-auto"
        >
          {FAQ_CATEGORIES.map((tab) => {
            const active = topicFilter === tab.id;
            const count = filterFaqByTopic(SOLAR_MAINTENANCE_FAQ, tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleTopicChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b66b2] ${
                  active
                    ? 'bg-[#0b66b2] text-white shadow-xs'
                    : 'text-[#1c3d5e] hover:bg-white/80 hover:text-[#07213e]'
                }`}
              >
                <span>{tr(tab.labelUk, tab.labelRu)}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-sky-100 text-[#07213e]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 divide-y divide-sky-200/75 rounded-xl border border-sky-200/75 bg-white/60 overflow-hidden">
        {visibleItems.map((item, idx) => {
          const isOpen = openId === item.id;
          const triggerId = `info-faq-trigger-${item.id}`;
          const panelId = `info-faq-panel-${item.id}`;
          const badge = topicBadgeMeta[item.topic];

          return (
            <div
              key={item.id}
              className={isOpen ? 'bg-gradient-to-r from-[#e6f3ff]/80 to-[#fff9ec]/70' : 'bg-transparent'}
            >
              <h3 className="m-0">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-white/75 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0b66b2]"
                >
                  <span className="flex items-start sm:items-center gap-3 min-w-0">
                    <span
                      className={`mt-0.5 sm:mt-0 shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-extrabold ${
                        isOpen
                          ? 'bg-[#0b66b2] text-white'
                          : 'bg-sky-100 text-[#07213e]'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide align-middle ${badge.badgeClass}`}>
                        {tr(badge.labelUk, badge.labelRu)}
                      </span>
                      <span className="text-sm sm:text-[15px] font-bold text-[#07213e] leading-snug align-middle">
                        {tr(item.questionUk, item.questionRu)}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#0b66b2]' : 'text-[#1c3d5e]'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="px-4 pb-4 sm:px-5 sm:pb-4 pl-12 sm:pl-14 text-sm leading-6 text-[#1c3d5e]"
                >
                  {tr(item.answerUk, item.answerRu)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-200/80 bg-sky-50/75 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#1c3d5e]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden="true" />
          <span>
            {tr(
              'Потрібен виїзд інженера на об’єкт або сервісна діагностика? Звертайтесь на нашу лінію підтримки.',
              'Нужен выезд инженера на объект или сервисная диагностика? Обращайтесь на нашу линию поддержки.',
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`tel:${COMPANY_INFO.phone1.replace(/[^+\d]/g, '')}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b66b2] px-3 py-2 text-xs font-bold text-white hover:bg-[#08508e] transition-colors"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{COMPANY_INFO.phone1}</span>
          </a>
          <a
            href={`mailto:${COMPANY_INFO.email}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-[#07213e] hover:bg-sky-50 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[#0b66b2]" aria-hidden="true" />
            <span>{tr('Написати інженеру', 'Написать инженеру')}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function InfoPage({ type, usdUahRate, onBackHome }: InfoPageProps) {
  const isOffer = type === 'offer';
  const isPrivacy = type === 'privacy';
  const isTerms = type === 'terms';

  const pageTitle = isOffer
    ? tr('Публічна оферта')
    : isPrivacy
      ? tr('Політика конфіденційності', 'Политика конфиденциальности')
      : isTerms
        ? tr('Умови використання сервісу', 'Условия использования сервиса')
        : tr('Оплата і доставка');

  const pageSubtitle = isOffer
    ? tr(
        'Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.',
        'Проект условий дистанционного заказа оборудования и услуг Energo Comfort.',
      )
    : isPrivacy
      ? tr(
          'Як Energo Comfort збирає, використовує та захищає персональні дані клієнтів і відвідувачів сайту.',
          'Как Energo Comfort собирает, использует и защищает персональные данные клиентов и посетителей сайта.',
        )
      : isTerms
        ? tr(
            'Правила користування сайтом, онлайн-калькуляторами, каталогом обладнання та оформлення замовлень Energo Comfort.',
            'Правила пользования сайтом, онлайн-калькуляторами, каталогом оборудования и оформления заказов Energo Comfort.',
          )
        : tr(
            'Узгоджуємо спосіб оплати й доставку з вами після підтвердження складу та наявності замовлення.',
            'Согласуем способ оплаты и доставки после подтверждения состава и наличия заказа.',
          );

  return (
    <div>
      <section className="ec-banner text-[#07213e] break-words hyphens-none">
        <div className="ec-container">
          <h1 className="mb-2 text-[clamp(1.25rem,4.8vw,1.875rem)] font-extrabold text-[#07213e] leading-tight">
            {pageTitle}
          </h1>
          <p className="max-w-2xl text-sm font-medium text-[#1c3d5e]">
            {pageSubtitle}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="daylight" start={26} end={38} brightness={0.56} />
        <div className="relative ec-container space-y-6 break-words hyphens-none">
          {isPrivacy ? (
            <>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('1. Загальні положення та володілець даних', '1. Общие положения и владелец данных')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(
                    `Ця Політика конфіденційності визначає порядок обробки та захисту персональних даних користувачів сайту ${COMPANY_INFO.domain} відповідно до Закону України «Про захист персональних даних». Контакти з питань конфіденційності: ${COMPANY_INFO.address}, тел. ${COMPANY_INFO.phone1}, електронна пошта`,
                    `Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сайта ${COMPANY_INFO.domain} согласно Закону Украины «О защите персональных данных». Контакты по вопросам конфиденциальности: ${COMPANY_INFO.address}, тел. ${COMPANY_INFO.phone1}, электронная почта`,
                  )}{' '}
                  <a className="text-[#0b66b2] underline" href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>.
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('2. Які дані ми збираємо', '2. Какие данные мы собираем')}</h2>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr('Контактні дані, які ви добровільно передаєте у формах заявки, кошику або при реєстрації кабінету: ім’я, номер телефону, e-mail, місто доставки та обраний канал зв’язку.', 'Контактные данные, которые вы добровольно передаёте в формах заявки, корзине или при регистрации кабинета: имя, номер телефона, e-mail, город доставки и выбранный канал связи.')}</li>
                  <li>{tr('Параметри прорахунку СЕС або систем резервного живлення (споживання у кВт·год, навантаження, склад кошика та список бажань).', 'Параметры расчёта СЭС или систем резервного питания (потребление в кВт·ч, нагрузка, состав корзины и список желаний).')}</li>
                  <li>{tr('Технічні дані браузера (cookies, локальне сховище для кошика, обраної мови інтерфейсу та базової аналітики відвідувань).', 'Технические данные браузера (cookies, локальное хранилище для корзины, выбранного языка интерфейса и базовой аналитики посещений).')}</li>
                </ul>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('3. Мета обробки та передача третім особам', '3. Цель обработки и передача третьим лицам')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(
                    'Дані використовуються виключно для підготовки інженерного кошторису, підтвердження замовлень, гарантійного супроводу, організації доставки перевізниками по Україні та зв’язку з вами. Ми не продаємо та не передаємо персональні дані стороннім рекламним брокерам; доступ обмежений уповноваженим співробітникам сервісу та логістичним партнерам у межах виконання вашого замовлення.',
                    'Данные используются исключительно для подготовки инженерной сметы, подтверждения заказов, гарантийного сопровождения, организации доставки перевозчиками по Украине и связи с вами. Мы не продаём и не передаём персональные данные сторонним рекламным брокерам; доступ ограничен уполномоченными сотрудниками сервиса и логистическими партнёрами в пределах выполнения вашего заказа.',
                  )}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('4. Зберігання даних і права користувача', '4. Хранение данных и права пользователя')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(
                    `Персональні дані зберігаються протягом строку, необхідного для обробки звернення, виконання гарантійних зобов’язань та дотримання вимог законодавства. Ви маєте право запросити доступ, виправлення або видалення своїх персональних даних, звернувшись на ${COMPANY_INFO.email} або за телефоном ${COMPANY_INFO.phone1}.`,
                    `Персональные данные хранятся в течение срока, необходимого для обработки обращения, выполнения гарантийных обязательств и соблюдения требований законодательства. Вы вправе запросить доступ, исправление или удаление своих персональных данных, обратившись на ${COMPANY_INFO.email} или по телефону ${COMPANY_INFO.phone1}.`,
                  )}
                </p>
              </article>
            </>
          ) : isTerms ? (
            <>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('1. Прийняття умов та призначення сайту', '1. Принятие условий и назначение сайта')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(
                    `Користуючись сайтом ${COMPANY_INFO.domain}, ви погоджуєтеся з цими Умовами використання. Матеріали каталогу, технічні описи та онлайн-калькулятори призначені для попереднього підбору обладнання СЕС, інверторів та систем резервного живлення.`,
                    `Пользуясь сайтом ${COMPANY_INFO.domain}, вы соглашаетесь с настоящими Условиями использования. Материалы каталога, технические описания и онлайн-калькуляторы предназначены для предварительного подбора оборудования СЭС, инверторов и систем резервного питания.`,
                  )}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('2. Ціни, наявність та онлайн-калькулятори', '2. Цены, наличие и онлайн-калькуляторы')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(
                    `Розрахунки окупності, автономності та вартості в гривнях за курсом (${usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : tr('завантажується', 'загружается')}) носять орієнтовний характер. Остаточна комплектація, наявність на складі в Одесі та вартість фіксуються менеджером під час підтвердження замовлення.`,
                    `Расчёты окупаемости, автономности и стоимости в гривнах по курсу (${usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : tr('загружается', 'загружается')}) носят ориентировочный характер. Окончательная комплектация, наличие на складе в Одессе и стоимость фиксируются менеджером при подтверждении заказа.`,
                  )}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('3. Безпека монтажу та інтелектуальна власність', '3. Безопасность монтажа и интеллектуальная собственность')}</h2>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr('Підключення інверторів (220/380 В), акумуляторів LiFePO4 та фотомодулів повинно виконуватися кваліфікованим персоналом із дотриманням ПУЕ, нормативів DC/AC захисту та інструкцій виробника.', 'Подключение инверторов (220/380 В), аккумуляторов LiFePO4 и фотомодулей должно выполняться квалифицированным персоналом с соблюдением ПУЭ, нормативов DC/AC защиты и инструкций производителя.')}</li>
                  <li>{tr('Усі текстові описи, графічні матеріали, 3D-схеми та програмні модулі сайту належать Energo Comfort або правовласникам відповідних брендів та захищені законом.', 'Все текстовые описания, графические материалы, 3D-схемы и программные модули сайта принадлежат Energo Comfort или правообладателям соответствующих брендов и защищены законом.')}</li>
                </ul>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('4. Пов’язані документи та зворотний зв’язок', '4. Связанные документы и обратная связь')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr('Умови оплати, доставки, гарантійного обслуговування та повернення деталізуються на сторінках «Оплата і доставка» та «Публічна оферта». Спори вирішуються шляхом переговорів або відповідно до чинного законодавства України.', 'Условия оплаты, доставки, гарантийного обслуживания и возврата детализируются на страницах «Оплата и доставка» и «Публичная оферта». Споры решаются путём переговоров либо в соответствии с действующим законодательством Украины.')}
                </p>
              </article>
              <div className="flex flex-wrap gap-3">
                <a href="/privacy-policy" className="ec-glass-plate inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#0b66b2] hover:bg-white/90 hover:text-[#07213e] transition-colors"><FileText className="h-4 w-4" />{tr('Політика конфіденційності', 'Политика конфиденциальности')}</a>
                <a href="/public-offer" className="ec-glass-plate inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#0b66b2] hover:bg-white/90 hover:text-[#07213e] transition-colors"><FileText className="h-4 w-4" />{tr('Публічна оферта', 'Публичная оферта')}</a>
              </div>
            </>
          ) : isOffer ? (
            <>
              <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <strong>{tr('Чернетка для погодження.', 'Черновик для согласования.')}</strong> {tr('До публікації оферти як обов’язкового договору продавцю потрібно додати повне зареєстроване найменування, код ЄДРПОУ або РНОКПП, реєстраційну адресу, платіжні реквізити та перевірити остаточні умови зі своїм юристом. Наразі доступні лише бренд, адреса та контакти з сайту.', 'Перед публикацией оферты как обязательного договора продавцу нужно добавить полное зарегистрированное наименование, код ЕГРПОУ или РНОКПП, регистрационный адрес, платёжные реквизиты и проверить окончательные условия с юристом. Сейчас доступны только бренд, адрес и контакты с сайта.')}
              </div>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('1. Продавець і предмет пропозиції', '1. Продавец и предмет предложения')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(`Energo Comfort (далі — Продавець), адреса для зв’язку: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, електронна пошта`, `Energo Comfort (далее — Продавец), адрес для связи: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, электронная почта`)}{' '}
                  <a className="text-[#0b66b2] underline" href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>,
                  {tr(`пропонує замовити обладнання, готові системи та послуги, описані на сайті ${COMPANY_INFO.domain}. Повні реєстраційні дані Продавця мають бути зазначені тут до набрання офертою чинності.`, `предлагает заказать оборудование, готовые системы и услуги, описанные на сайте ${COMPANY_INFO.domain}. Полные регистрационные данные Продавца должны быть указаны здесь до вступления оферты в силу.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('2. Замовлення і підтвердження', '2. Заказ и подтверждение')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr('Покупець надсилає замовлення через кошик або звертається за консультацією. Надсилання форми на сайті є запитом на оформлення, а не підтвердженням наявності чи остаточної вартості. Продавець зв’язується з Покупцем, уточнює товар, кількість, адресу, строки та погоджує остаточні умови. Замовлення вважається погодженим після підтвердження Продавцем і згоди Покупця з узгодженими умовами.', 'Покупатель отправляет заказ через корзину или запрашивает консультацию. Отправка формы на сайте является запросом на оформление, но не подтверждает наличие или окончательную стоимость. Продавец связывается с Покупателем, уточняет товар, количество, адрес, сроки и согласует окончательные условия. Заказ считается согласованным после подтверждения Продавцом и согласия Покупателя с условиями.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('3. Ціна та оплата', '3. Цена и оплата')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr('Ціни в каталозі показуються у гривнях як розрахунок від ціни в доларах США за комерційним курсом компанії. Поточний курс на сайті:', 'Цены в каталоге показываются в гривнах и рассчитываются от цены в долларах США по коммерческому курсу компании. Текущий курс на сайте:')} <strong>{usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : tr('завантажується', 'загружается')}</strong>. {tr('Розрахована ціна є інформаційною; суму до оплати в гривнях і доступний спосіб оплати Продавець повідомляє під час підтвердження замовлення. Оплата здійснюється лише після погодження рахунку або іншого платіжного способу.', 'Расчётная цена носит информационный характер. Сумму к оплате в гривнах и доступный способ оплаты Продавец сообщает при подтверждении заказа. Оплата производится после согласования счёта или другого способа оплаты.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('4. Передача товару, гарантія і повернення', '4. Передача товара, гарантия и возврат')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(`Спосіб, строк і вартість доставки або самовивозу погоджуються окремо до оплати. Гарантійні умови на обладнання залежать від виробника та зазначаються в документах на товар. Права споживача на обмін, повернення та відмову від дистанційного договору визначаються законодавством України; окремі види товарів можуть мати передбачені законом винятки. Для звернення щодо замовлення: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`, `Способ, срок и стоимость доставки или самовывоза согласуются отдельно до оплаты. Гарантийные условия зависят от производителя и указаны в документах на товар. Права потребителя на обмен, возврат и отказ от дистанционного договора определяются законодательством Украины; для отдельных товаров законом предусмотрены исключения. По вопросам заказа: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('5. Дані продавця', '5. Данные продавца')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">Energo Comfort · {COMPANY_INFO.address} · {COMPANY_INFO.phone1} · {COMPANY_INFO.email}</p>
                <p className="mt-2 text-sm leading-7 text-red-700">{tr('Повне найменування/ПІБ ФОП, ЄДРПОУ/РНОКПП, адреса державної реєстрації та платіжні реквізити: не надані — необхідно заповнити перед публікацією оферти.', 'Полное наименование / ФИО ФЛП, ЕГРПОУ / РНОКПП, адрес регистрации и платёжные реквизиты не предоставлены — заполните их перед публикацией оферты.')}</p>
              </article>
            </>
          ) : (
            <>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><Banknote className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Оплата', 'Оплата')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr('Замовте товар у кошику або залиште заявку на розрахунок.', 'Закажите товар в корзине или отправьте заявку на расчёт.')}</li>
                  <li>{tr('Менеджер перевірить наявність, склад комплекту та фінальну суму у гривнях за актуальним комерційним курсом.', 'Менеджер проверит наличие, состав комплекта и итоговую сумму в гривнах по актуальному коммерческому курсу.')}</li>
                  <li>{tr('Після погодження вам нададуть актуальні варіанти оплати та, за потреби, рахунок. Не сплачуйте до отримання підтвердження замовлення.', 'После согласования вам сообщат доступные способы оплаты и при необходимости выставят счёт. Не оплачивайте заказ до подтверждения.')}</li>
                </ul>
                <p className="mt-4 rounded-xl bg-sky-50/85 border border-sky-100 p-3 text-xs leading-5 text-[#1c3d5e]">
                  {tr('Орієнтовний перерахунок каталогу:', 'Ориентировочный пересчёт каталога:')} {usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('ru-RU')} грн` : tr('комерційний курс завантажується', 'коммерческий курс загружается')}.
                  {usdUahRate && <> {tr('Наприклад,', 'Например,')} $100 ≈ {formatUahFromUsd(100, usdUahRate)}.</>}
                  {' '}{tr('Остаточна сума до оплати вказується в погодженому замовленні.', 'Окончательная сумма к оплате указывается в согласованном заказе.')}
                </p>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><Truck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Доставка', 'Доставка')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr(`Самовивіз з офісу/складу в Одесі: ${COMPANY_INFO.address} — за попереднім погодженням.`, `Самовывоз из офиса/склада в Одессе: ${COMPANY_INFO.address} — по предварительному согласованию.`)}</li>
                  <li>{tr('Доставка по Україні перевізником погоджується з менеджером з урахуванням габаритів, ваги та умов перевізника.', 'Доставка по Украине перевозчиком согласуется с менеджером с учётом габаритов, веса и условий перевозчика.')}</li>
                  <li>{tr('Вартість перевезення та орієнтовна дата відправлення повідомляються перед підтвердженням.', 'Стоимость доставки и примерную дату отправки сообщат до подтверждения заказа.')}</li>
                  <li>{tr('Під час отримання перевірте цілісність упаковки та комплектацію разом із перевізником.', 'При получении проверьте упаковку и комплектность вместе с перевозчиком.')}</li>
                </ul>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><PackageCheck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Підтвердження замовлення', 'Подтверждение заказа')}</h2></div>
                <p className="text-sm leading-7 text-[#1c3d5e]">{tr(`Після відправлення заявки менеджер зв’яжеться з вами за вказаним телефоном і підтвердить склад, наявність, суму, оплату та доставку. Запитання: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`, `После отправки заявки менеджер свяжется с вами по указанному телефону и подтвердит состав, наличие, сумму, оплату и доставку. Вопросы: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`)}</p>
              </article>
              <FAQ />
              <a href="/public-offer" className="ec-glass-plate inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#0b66b2] hover:bg-white/90 hover:text-[#07213e] transition-colors"><FileText className="h-4 w-4" />{tr('Переглянути проєкт публічної оферти', 'Посмотреть проект публичной оферты')}</a>
            </>
          )}
          <div>
            <button type="button" onClick={onBackHome} className="ec-glass-plate inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-[#07213e] hover:bg-white/95 cursor-pointer">
              <ArrowLeft className="h-4 w-4" />{tr('На головну', 'На главную')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
