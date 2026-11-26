import { ArrowRight, Award, CheckCircle2, FileCheck2, ShieldCheck, Wrench } from 'lucide-react';
import { BRAND_PARTNERS } from '../data/siteContent.ts';
import { tr } from '../lib/i18n.ts';
import { SmartImage } from './SmartImage.tsx';

interface OurTeamSectionProps {
  onOpenLeadModal: (
    topic: string,
    estimatedTotalUsd?: number,
    placement?: 'hero' | 'sticky' | 'section' | 'footer',
    initialNotes?: string,
  ) => void;
  onNavigateProjects: () => void;
}

const TEAM_UNITS = [
  {
    number: '01',
    titleUk: 'Інженерний відділ та енергоаудит',
    titleRu: 'Инженерный отдел и энергоаудит',
    roleUk: 'Проєктування СЕС · Розрахунки · 3D-моделювання',
    roleRu: 'Проектирование СЭС · Расчёты · 3D-моделирование',
    descUk:
      'Вимірювання реального споживання та пускових струмів насосів, компресорів і холодильного обладнання, проєктування однолінійних схем, підбір перерізів кабелю та оптимізація MPPT-стрінгів без втрат ККД.',
    descRu:
      'Замеры реального потребления и пусковых токов насосов, компрессоров и холодильного оборудования, разработка однолинейных схем, подбор сечений кабеля и оптимизация MPPT-стрингов без потерь КПД.',
  },
  {
    number: '02',
    titleUk: 'Сертифіковані електромонтажні бригади',
    titleRu: 'Сертифицированные электромонтажные бригады',
    roleUk: 'Допуск 220/380 В · Стандарти ПУЕ · Покрівельні роботи',
    roleRu: 'Допуск 220/380 В · Нормы ПУЭ · Кровельные работы',
    descUk:
      'Монтаж сонячних панелей на скатних і плоских дахах із дотриманням гідроізоляції, наземних конструкціях, а також безпечне встановлення інверторів і LiFePO4 АКБ із захистом DC/AC та ОПН (УЗІП).',
    descRu:
      'Монтаж солнечных панелей на скатных и плоских кровлях с сохранением гидроизоляции, на наземных конструкциях, а также безопасная установка инверторов и LiFePO4 АКБ с защитой DC/AC и УЗИП.',
  },
  {
    number: '03',
    titleUk: 'Інженери пусконалагодження та сервісу',
    titleRu: 'Инженеры пусконаладки и сервиса',
    roleUk: 'Deye · SolaX · Solis · Huawei · BMS LiFePO4',
    roleRu: 'Deye · SolaX · Solis · Huawei · BMS LiFePO4',
    descUk:
      'Точне налаштування режимів генерації й обмеження перетоків (Zero Export / Smart Meter), балансування комірок BMS, підключення хмарного моніторингу (Solarman, SolaX Cloud, SolisCloud), тепловізійний контроль і планове ТО.',
    descRu:
      'Точная настройка режимов генерации и ограничения перетоков (Zero Export / Smart Meter), балансировка ячеек BMS, подключение облачного мониторинга (Solarman, SolaX Cloud, SolisCloud), тепловизионный контроль и плановое ТО.',
  },
  {
    number: '04',
    titleUk: 'Супровід документів та тарифних моделей',
    titleRu: 'Сопровождение документов и тарифных моделей',
    roleUk: '«Зелений тариф» · Активний споживач · Обленерго',
    roleRu: '«Зелёный тариф» · Активный потребитель · Облэнерго',
    descUk:
      'Підготовка технічних умов, проєкту двонаправленого обліку (Net Billing) та повного пакета документів для підключення «зеленого тарифу» або статусу «активного споживача» в Одесі й області.',
    descRu:
      'Подготовка технических условий, проекта двунаправленного учёта (Net Billing) и полного пакета документов для подключения «зелёного тарифа» или статуса «активного потребителя» в Одессе и области.',
  },
] as const;

const CERTIFICATIONS = [
  {
    Icon: Award,
    titleUk: 'Авторизована інтеграція світових брендів',
    titleRu: 'Авторизованная интеграция мировых брендов',
    descUk:
      'Сертифіковане постачання, пусконалагодження та гарантійне супроводження обладнання Deye, SolaX Power, Solis, Huawei, Dyness, Jinko Solar і Livoltek.',
    descRu:
      'Сертифицированная поставка, пусконаладка и гарантийное сопровождение оборудования Deye, SolaX Power, Solis, Huawei, Dyness, Jinko Solar и Livoltek.',
  },
  {
    Icon: ShieldCheck,
    titleUk: 'Електробезпека, ПУЕ та Anti-Islanding захист',
    titleRu: 'Электробезопасность, ПУЭ и Anti-Islanding защита',
    descUk:
      'Обов’язкове заземлення, блискавкозахист DC/AC, автоматичне блокування подачі напруги в знеструмлену мережу та миттєве перемикання на АКБ до 10 мс.',
    descRu:
      'Обязательное заземление, молниезащита DC/AC, автоматическая блокировка подачи напряжения в обесточенную сеть и мгновенное переключение на АКБ до 10 мс.',
  },
  {
    Icon: FileCheck2,
    titleUk: 'Подвійна гарантія на роботи й обладнання',
    titleRu: 'Двойная гарантия на работы и оборудование',
    descUk:
      'Офіційна гарантія на монтажні роботи від 2 років, на інвертори та СНЕ 5–12 років, на LiFePO4 АКБ до 10 років (понад 6 000 циклів) та на панелі до 25 років.',
    descRu:
      'Официальная гарантия на монтажные работы от 2 лет, на инверторы и СНЭ 5–12 лет, на LiFePO4 АКБ до 10 лет (свыше 6 000 циклов) и на панели до 25 лет.',
  },
] as const;

const TEAM_PARTNER_LOGOS = BRAND_PARTNERS.filter((b) =>
  ['Deye', 'SolaX Power', 'Solis', 'Jinko Solar'].includes(b.name),
);

export function OurTeamSection({ onOpenLeadModal, onNavigateProjects }: OurTeamSectionProps) {
  return (
    <section
      id="our-team"
      aria-labelledby="our-team-heading"
      className="relative overflow-hidden isolate ec-section border-t border-white/25"
    >
      <div className="relative ec-container break-words hyphens-none">
        {/* Section Header Plate */}
        <div className="ec-glass-plate rounded-2xl p-4 sm:p-6 lg:p-7 mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold text-[#0b66b2] mb-1.5">
              {tr('Команда та кваліфікація · Одеса', 'Команда и квалификация · Одесса')}
            </div>
            <h2
              id="our-team-heading"
              className="text-[clamp(1.2rem,4.5vw,1.875rem)] font-extrabold text-[#07213e] leading-tight mb-2"
            >
              {tr(
                'Наша команда: інженерна експертиза та сертифікація',
                'Наша команда: инженерная экспертиза и сертификация',
              )}
            </h2>
            <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed">
              {tr(
                'Власний штат досвідчених інженерів, проєктувальників та сертифікованих електромонтажників в Одесі (вул. Європейська, 93) виконує проєкти будь-якої складності — від квартирних систем резервного живлення до промислових СЕС потужністю 110 кВт.',
                'Собственный штат опытных инженеров, проектировщиков и сертифицированных электромонтажников в Одессе (ул. Европейская, 93) реализует проекты любой сложности — от квартирных систем резервного питания до промышленных СЭС мощностью 110 кВт.',
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenLeadModal(
                'Консультація з інженером команди Energo Comfort',
                undefined,
                'section',
                'Запит зі сторінки «Наша команда» на головній.',
              )
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f59e0b] px-5 text-xs sm:text-sm font-extrabold text-[#07213e] transition-colors hover:bg-[#fbbf24] cursor-pointer self-start lg:self-auto whitespace-nowrap"
          >
            <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{tr('Замовити виїзд інженера', 'Заказать выезд инженера')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        {/* Asymmetric 7/5 Bento Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: 4 Engineering & Installation Divisions */}
          <div className="lg:col-span-7 ec-glass-card rounded-2xl p-5 sm:p-7 flex flex-col justify-between">
            <div className="divide-y divide-sky-200/75">
              {TEAM_UNITS.map((unit) => (
                <article
                  key={unit.number}
                  className="py-4 first:pt-0 last:pb-0 flex items-start gap-3.5 sm:gap-4"
                >
                  <span className="font-mono text-sm sm:text-base font-extrabold text-[#0b66b2] tabular-nums pt-0.5 shrink-0">
                    {unit.number}.
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] sm:text-base font-extrabold text-[#061c36] leading-snug">
                      {tr(unit.titleUk, unit.titleRu)}
                    </h3>
                    <div className="mt-0.5 text-xs font-bold text-[#0b66b2]">
                      {tr(unit.roleUk, unit.roleRu)}
                    </div>
                    <p className="mt-1.5 text-sm text-[#133659] font-medium leading-[1.6]">
                      {tr(unit.descUk, unit.descRu)}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-bold text-[#061c36] tabular-nums">
                <span>100+ {tr('реалізованих об’єктів', 'реализованных объектов')}</span>
                <span className="text-sky-400" aria-hidden="true">·</span>
                <span>1–5 {tr('днів монтаж під ключ', 'дней монтаж под ключ')}</span>
                <span className="text-sky-400" aria-hidden="true">·</span>
                <span>&lt; 10 {tr('мс автоперемикання', 'мс автопереключение')}</span>
              </div>
              <a
                href="/projects"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigateProjects();
                  }
                }}
                className="font-extrabold text-[#0b66b2] hover:underline whitespace-nowrap shrink-0"
              >
                {tr('Переглянути роботи команди', 'Смотреть работы команды')} →
              </a>
            </div>
          </div>

          {/* Right: Certifications, Official Authorizations & Field Standard */}
          <div className="lg:col-span-5 ec-glass-sapphire rounded-2xl overflow-hidden flex flex-col justify-between text-white">
            <div className="relative h-48 sm:h-52 bg-[#041830]">
              <SmartImage
                src="/assets/energocomfort/hotel_35kw.png"
                alt={tr(
                  'Монтаж сонячної електростанції 35 кВт інженерною командою Energo Comfort в Одесі',
                  'Монтаж солнечной электростанции 35 кВт инженерной командой Energo Comfort в Одессе',
                )}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#041830]/95 via-[#041830]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="text-[11px] font-bold text-sky-200">
                  {tr('Власний інженерний підрозділ · Одеса та область', 'Собственный инженерный отдел · Одесса и область')}
                </div>
                <div className="mt-0.5 text-base font-extrabold text-white leading-snug">
                  {tr(
                    'Професійні допуски, сертифікація та стандарти ПУЕ',
                    'Профессиональные допуски, сертификация и стандарты ПУЭ',
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
              <div className="divide-y divide-sky-200/15">
                {CERTIFICATIONS.map(({ Icon, titleUk, titleRu, descUk, descRu }) => (
                  <div key={titleUk} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/20 border border-sky-300/25 text-amber-300 mt-0.5">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-white leading-snug">
                        {tr(titleUk, titleRu)}
                      </h3>
                      <p className="mt-1 text-xs text-sky-100/85 font-medium leading-[1.6]">
                        {tr(descUk, descRu)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-sky-200/15 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>
                    {tr(
                      'Сертифіковані рішення на базі офіційних партнерів:',
                      'Сертифицированные решения на базе официальных партнёров:',
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEAM_PARTNER_LOGOS.map((brand) => (
                    <div
                      key={brand.name}
                      className="h-10 rounded-lg bg-white/95 px-2.5 flex items-center justify-center border border-sky-200/40"
                    >
                      <SmartImage
                        src={brand.logo}
                        alt={brand.name}
                        loading="lazy"
                        className="max-h-6 w-auto max-w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
