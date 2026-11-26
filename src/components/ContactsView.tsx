import { Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
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
          <div className="ec-glass-card rounded-2xl p-6 sm:p-7">
              <div className="text-xs font-extrabold text-[#0b66b2] mb-1">{tr('Про компанію та умови')}</div>
              <h2 className="text-xl font-extrabold text-[#061c36] mb-4">{tr('Гарантія, повернення та оферта')}</h2>
              <div className="space-y-3.5 text-sm text-[#133659] font-medium leading-[1.65] max-w-[75ch]">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-1" />
                  <p>
                    <strong className="text-[#061c36]">{tr('Офіційне постачання:', 'Официальные поставки:')}</strong> {tr('прямі поставки інверторів Deye, SolaX Power, Solis, Huawei та LiFePO4 АКБ з офіційною гарантією виробника.', 'прямые поставки инверторов Deye, SolaX Power, Solis, Huawei и LiFePO4 аккумуляторов с официальной гарантией производителя.')}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-1" />
                  <p>
                    <strong className="text-[#061c36]">{tr('Повернення та обмін (14 днів):', 'Возврат и обмен (14 дней):')}</strong> {tr('згідно із Законом України «Про захист прав споживачів» за збереження пломб, товарного вигляду та повної комплектації.', 'в соответствии с Законом Украины «О защите прав потребителей» при сохранении пломб, товарного вида и полной комплектации.')}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-1" />
                  <p>
                    <strong className="text-[#061c36]">{tr('Конфіденційність та публічна оферта:', 'Конфиденциальность и публичная оферта:')}</strong> {tr('персональні дані використовуються виключно для інженерного розрахунку, оформлення замовлень і гарантійного супроводу.', 'персональные данные используются только для инженерного расчёта, оформления заказов и гарантійного обслуговування.')}
                  </p>
                </div>
              </div>
          </div>
        </div>
      </section>
    </div>
  );
}
