import { Building2, Clock, FileText, Mail, MapPin, Phone, RotateCcw, ShieldCheck, Truck, Wrench, Zap } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { tr } from '../lib/i18n.ts';
import { track, trackEvent } from '../lib/analytics.ts';
import { SocialIcons } from './SocialIcons.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import type { SocialLinksConfig } from '../types.ts';

interface ContactsViewProps {
  onBackHome?: () => void;
  onOpenLeadModal: (topic: string) => void;
  socialLinks: SocialLinksConfig;
}

export function ContactsView({ onOpenLeadModal, socialLinks }: ContactsViewProps) {
  return (
    <div>
      <section className="ec-banner text-[#07213e] break-words hyphens-none">
        <div className="ec-container">
          <h1 className="text-[clamp(1.25rem,4.8vw,1.875rem)] font-extrabold text-[#07213e] leading-tight mb-2">
            {tr('Ми на зв’язку та раді відповісти на ваші питання')}
          </h1>
          <p className="text-sm text-[#1c3d5e] font-medium max-w-2xl">
            {tr('Головний офіс, склад обладнання та інженерний відділ компанії Energo Comfort в Одесі.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="azure" start={14} end={26} brightness={0.56} />
        <div className="relative ec-container grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch break-words hyphens-none">
          <div className="lg:col-span-5 ec-glass-card rounded-2xl p-4 sm:p-6 lg:p-7 h-full flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <div className="text-xs font-extrabold text-[#0b66b2] mb-1">{tr('Контакти')}</div>
                <h2 className="text-2xl font-extrabold text-[#061c36]">{tr('Зв’яжіться з нами')}</h2>
                <p className="mt-2 text-sm text-[#133659] font-medium leading-[1.6]">{tr('Проконсультуємо щодо обладнання, монтажу та підбору системи.')}</p>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f3ff] text-[#0b66b2]"><MapPin className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-bold text-[#133659]">{tr('Головний офіс')}</p>
                    <p className="mt-1 text-sm font-bold text-[#061c36]">{tr(COMPANY_INFO.address, 'Украина, г. Одесса, ул. Европейская, 93')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f3ff] text-[#0b66b2]"><Phone className="h-5 w-5" /></span>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#133659]">{tr('Телефони')}</p>
                    <a href={COMPANY_INFO.phone1Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="block text-sm font-bold text-[#0b66b2] hover:underline">{COMPANY_INFO.phone1}</a>
                    <a href={COMPANY_INFO.phone2Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="block text-sm font-bold text-[#0b66b2] hover:underline">{COMPANY_INFO.phone2}</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f3ff] text-[#0b66b2]"><Mail className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-bold text-[#133659]">{tr('Електронна пошта')}</p>
                    <a href={`mailto:${COMPANY_INFO.email}`} onClick={() => trackEvent('contact', { channel: 'email', placement: 'section' })} className="mt-1 block break-all text-sm font-bold text-[#0b66b2] hover:underline">{COMPANY_INFO.email}</a>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-sky-200/75 pt-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f3ff] text-[#0b66b2]"><Clock className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-bold text-[#133659]">{tr('Графік роботи')}</p>
                    <p className="mt-1 text-sm font-bold text-[#061c36]">{COMPANY_INFO.schedule}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-sky-200/75 pt-5">
              <SocialIcons links={socialLinks} variant="light" />
              <div className="flex flex-wrap gap-2">
                <a href={COMPANY_INFO.phone1Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0b66b2] px-4 text-sm font-bold text-white hover:bg-[#08508e] whitespace-nowrap">{tr('Зателефонувати')}</a>
                <button type="button" onClick={() => onOpenLeadModal('Консультація зі сторінки Контакти')} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-200 bg-white/90 px-4 text-sm font-bold text-[#061c36] hover:bg-white whitespace-nowrap cursor-pointer">{tr('Замовити дзвінок')}</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 min-h-[380px] h-full overflow-hidden rounded-2xl border border-white/75 bg-sky-100/70 shadow-lg sm:min-h-[440px]">
            <iframe
              title={tr('Google Maps — Energo Comfort, Одеса, вулиця Європейська, 93', 'Google Maps — Energo Comfort, Одесса, улица Европейская, 93')}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(COMPANY_INFO.address)}&z=16&output=embed`}
              className="h-full min-h-[380px] w-full border-0 sm:min-h-[440px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden isolate border-t border-white/25 ec-section">
        <VideoBackground position="absolute" tone="light" tint="sapphire" start={44} end={56} brightness={0.56} />
        <div className="relative ec-container">
          <div className="ec-glass-card rounded-2xl p-6 sm:p-8 break-words hyphens-none">
            <div className="pb-5 border-b border-sky-200/75 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-[#0b66b2] mb-1">
                  {tr('Про компанію та умови')}
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#061c36]">
                  {tr('Energo Comfort — сонячна енергетика, гарантія та сервіс', 'Energo Comfort — солнечная энергетика, гарантия и сервис')}
                </h2>
                <p className="mt-2 text-sm text-[#133659] font-medium leading-[1.65] max-w-3xl">
                  {tr(
                    'Спеціалізований інтернет-магазин та інженерна компанія в Одесі (energocomfort.shop). Забезпечуємо приватні будинки, квартири та комерційні об’єкти сонячними електростанціями, системами резервного живлення й накопичення енергії під ключ — від аудиту та підбору обладнання до монтажу, оформлення «зеленого тарифу» та сервісного супроводу.',
                    'Специализированный интернет-магазин и инженерная компания в Одессе (energocomfort.shop). Обеспечиваем частные дома, квартиры и коммерческие объекты солнечными электростанциями, системами резервного питания и накопления энергии под ключ — от аудита и подбора оборудования до монтажа, оформления «зелёного тарифа» и сервисного сопровождения.',
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <a
                  href="/payment-delivery"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-sky-200 bg-white/85 px-3.5 text-xs font-bold text-[#061c36] hover:bg-white transition-colors"
                >
                  {tr('Оплата і доставка')}
                </a>
                <a
                  href="/public-offer"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-sky-200 bg-white/85 px-3.5 text-xs font-bold text-[#061c36] hover:bg-white transition-colors"
                >
                  {tr('Публічна оферта')}
                </a>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#0b66b2]">
                  {tr('Про компанію та інженерний підхід', 'О компании и инженерном подходе')}
                </h3>
                <div className="space-y-3.5 text-sm text-[#133659] font-medium leading-[1.65]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f3ff] text-[#0b66b2] mt-0.5">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Досвід і команда в Одесі:', 'Опыт и команда в Одессе:')}
                      </strong>{' '}
                      {tr(
                        'сертифіковані інженери та монтажні бригади реалізують проєкти B2C (квартири, котеджі, дачі) і B2B (СТО, заводи, готелі, навчальні заклади, офісні центри) в Одесі та Одеській області.',
                        'сертифицированные инженеры и монтажные бригады реализуют проекты B2C (квартиры, коттеджи, дачи) и B2B (СТО, заводы, отели, учебные заведения, офисные центры) в Одессе и Одесской области.',
                      )}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f3ff] text-[#0b66b2] mt-0.5">
                      <Zap className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Повний цикл робіт «під ключ»:', 'Полный цикл работ «под ключ»:')}
                      </strong>{' '}
                      {tr(
                        'інструментальний аудит споживання й пускових струмів, розрахунок окупності, 3D-проєктування на скатних/плоских покрівлях і наземних конструкціях, монтаж захисту AC/DC та грозозахисту (резервне живлення за 1–2 дні, СЕС за 2–5 днів).',
                        'инструментальный аудит потребления и пусковых токов, расчёт окупаемости, 3D-проектирование на скатных/плоских кровлях и наземных конструкциях, монтаж защиты AC/DC и грозозащиты (резервное питание за 1–2 дня, СЭС за 2–5 дней).',
                      )}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f3ff] text-[#0b66b2] mt-0.5">
                      <Wrench className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Сертифіковане обладнання та сервіс:', 'Сертифицированное оборудование и сервис:')}
                      </strong>{' '}
                      {tr(
                        'прямі поставки інверторів Deye, SolaX Power, Solis, Huawei, MUST, сонячних панелей Jinko Solar, JA Solar, TW Solar і безпечних LiFePO4 АКБ Deye, Dyness, BYD, Pylontech. Допомога в оформленні «зеленого тарифу» чи статусу «активного споживача», підключення хмарного моніторингу та планове ТО.',
                        'прямые поставки инверторов Deye, SolaX Power, Solis, Huawei, MUST, солнечных панелей Jinko Solar, JA Solar, TW Solar и безопасных LiFePO4 АКБ Deye, Dyness, BYD, Pylontech. Помощь в оформлении «зелёного тарифа» или статуса «активного потребителя», подключение облачного мониторинга и плановое ТО.',
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#0b66b2]">
                  {tr('Гарантія, повернення та оферта')}
                </h3>
                <div className="space-y-3.5 text-sm text-[#133659] font-medium leading-[1.65]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Офіційна гарантія на техніку і монтаж:', 'Официальная гарантия на технику и монтаж:')}
                      </strong>{' '}
                      {tr(
                        'заводська гарантія на інвертори та СНЕ (5–12 років), LiFePO4 акумулятори (до 10 років, ресурс понад 6 000 циклів), генерацію сонячних панелей (до 25 років) та гарантія на монтажні роботи від 2 років.',
                        'заводская гарантия на инверторы и СНЭ (5–12 лет), LiFePO4 аккумуляторы (до 10 лет, ресурс свыше 6 000 циклов), генерацию солнечных панелей (до 25 лет) и гарантия на монтажные работы от 2 лет.',
                      )}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] mt-0.5">
                      <Truck className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Оплата та доставка по Україні:', 'Оплата и доставка по Украине:')}
                      </strong>{' '}
                      {tr(
                        'самовивіз зі складу в Одесі (вул. Європейська, 93) або доставка «Новою Поштою» на відділення чи адресно у посиленому пакуванні / на палеті зі страхуванням повної вартості. Доступний розрахунок за реквізитами (ФОП/ТОВ з ПДВ), переказом або післяплатою після перевірки сумісності інженером.',
                        'самовывоз со склада в Одессе (ул. Европейская, 93) или доставка «Новой Почтой» в отделение либо адресно в усиленной упаковке / на паллете со страхованием полной стоимости. Доступна оплата по реквизитам (ФЛП/ООО с НДС), переводом или наложенным платежом после проверки совместимости инженером.',
                      )}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Повернення та обмін (14 днів):', 'Возврат и обмен (14 дней):')}
                      </strong>{' '}
                      {tr(
                        'згідно із Законом України «Про захист прав споживачів» за збереження пломб, заводської упаковки, товарного вигляду та повної комплектації. У разі виявлення виробничого браку витрати на логістику компенсує компанія.',
                        'в соответствии с Законом Украины «О защите прав потребителей» при сохранении пломб, заводской упаковки, товарного вида и полной комплектации. При выявлении производственного брака расходы на логистику компенсирует компания.',
                      )}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] mt-0.5">
                      <FileText className="w-4 h-4" />
                    </span>
                    <p>
                      <strong className="text-[#061c36]">
                        {tr('Конфіденційність та публічна оферта:', 'Конфиденциальность и публичная оферта:')}
                      </strong>{' '}
                      {tr(
                        'продаж і сервіс регулюються публічною офертою; персональні дані використовуються виключно для інженерного розрахунку, оформлення замовлень, доставки та гарантійного супроводу.',
                        'продажа и сервис регулируются публичной офертой; персональные данные используются исключительно для инженерного расчёта, оформления заказов, доставки и гарантийного сопровождения.',
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
