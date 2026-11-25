import { Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { tr } from '../lib/i18n.ts';
import { track, trackEvent } from '../lib/analytics.ts';
import { SocialIcons } from './SocialIcons.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import type { SocialLinksConfig } from '../types.ts';

interface ContactsViewProps {
  onBackHome: () => void;
  onOpenLeadModal: (topic: string) => void;
  socialLinks: SocialLinksConfig;
}

export function ContactsView({ onBackHome, onOpenLeadModal, socialLinks }: ContactsViewProps) {
  return (
    <div>
      <section className="bg-[#081421]/40 backdrop-blur-[1px] border-b border-white/15 py-8 text-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <nav aria-label={tr('Хлібні крихти')} className="flex items-center gap-2 text-xs text-slate-300 mb-2">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onBackHome();
                }
              }}
              className="text-sky-300 font-bold hover:text-white hover:underline"
            >
              {tr('Головна')}
            </a>
            <span aria-hidden="true">/</span>
            <span>{tr('Контакти та інформація')}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            {tr('Ми на зв’язку та раді відповісти на ваші питання')}
          </h1>
          <p className="text-sm text-slate-200 max-w-2xl">
            {tr('Головний офіс, склад обладнання та інженерний відділ компанії Energo Comfort в Одесі.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate py-10 sm:py-12">
        <VideoBackground position="absolute" tone="light" start={34} end={50} />
        <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <div className="rounded-2xl border border-white/25 bg-white/95 backdrop-blur-md shadow-xl p-6 sm:p-8">
            <div className="mb-6">
              <div className="text-xs font-extrabold text-[#1769aa] mb-1">{tr('Контакти')}</div>
              <h2 className="text-2xl font-extrabold text-[#0d1f33]">{tr('Зв’яжіться з нами')}</h2>
              <p className="mt-2 text-sm text-[#334155] font-medium">{tr('Проконсультуємо щодо обладнання, монтажу та підбору системи.')}</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><MapPin className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#334155]">{tr('Головний офіс')}</p>
                  <p className="mt-1 text-sm font-bold text-[#0d1f33]">{tr(COMPANY_INFO.address, 'Украина, г. Одесса, ул. Европейская, 93')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Phone className="h-5 w-5" /></span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#334155]">{tr('Телефони')}</p>
                  <a href={COMPANY_INFO.phone1Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="block text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.phone1}</a>
                  <a href={COMPANY_INFO.phone2Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="block text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.phone2}</a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Mail className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#334155]">{tr('Електронна пошта')}</p>
                  <a href={`mailto:${COMPANY_INFO.email}`} onClick={() => trackEvent('contact', { channel: 'email', placement: 'section' })} className="mt-1 block break-all text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.email}</a>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Clock className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#334155]">{tr('Графік роботи')}</p>
                  <p className="mt-1 text-sm font-bold text-[#0d1f33]">{COMPANY_INFO.schedule}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <SocialIcons links={socialLinks} variant="light" />
              <div className="flex flex-wrap gap-2">
                <a href={COMPANY_INFO.phone1Href} onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white hover:bg-[#12568c]">{tr('Зателефонувати')}</a>
                <button type="button" onClick={() => onOpenLeadModal('Консультація зі сторінки Контакти')} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-[#0d1f33] hover:bg-slate-50">{tr('Замовити дзвінок')}</button>
              </div>
            </div>
          </div>

          <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:min-h-[440px]">
            <iframe
              title={tr('Google Maps — Energo Comfort, Одеса, вулиця Європейська, 93', 'Google Maps — Energo Comfort, Одесса, улица Европейская, 93')}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(COMPANY_INFO.address)}&z=16&output=embed`}
              className="h-full min-h-[360px] w-full border-0 sm:min-h-[440px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden isolate border-t border-white/15 py-10 sm:py-12">
        <VideoBackground position="absolute" tone="light" start={46} end={59} />
        <div className="relative mx-auto max-w-[1180px] px-5">
          <div className="rounded-2xl border border-white/25 bg-white/95 backdrop-blur-md shadow-xl p-6 sm:p-8">
              <div className="text-xs font-extrabold text-[#1769aa]">{tr('Про компанію та умови')}</div>
              <h2 className="text-xl font-extrabold text-[#0d1f33] mb-3">{tr('Гарантія, повернення та оферта')}</h2>
              <div className="space-y-3 text-xs text-[#1e293b] leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">{tr('Офіційне постачання:', 'Официальные поставки:')}</strong> {tr('прямі поставки інверторів Deye, SolaX Power, Solis, Huawei та LiFePO4 АКБ з офіційною гарантією виробника.', 'прямые поставки инверторов Deye, SolaX Power, Solis, Huawei и LiFePO4 аккумуляторов с официальной гарантией производителя.')}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">{tr('Повернення та обмін (14 днів):', 'Возврат и обмен (14 дней):')}</strong> {tr('згідно із Законом України «Про захист прав споживачів» за збереження пломб, товарного вигляду та повної комплектації.', 'в соответствии с Законом Украины «О защите прав потребителей» при сохранении пломб, товарного вида и полной комплектации.')}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">{tr('Конфіденційність та публічна оферта:', 'Конфиденциальность и публичная оферта:')}</strong> {tr('персональні дані використовуються виключно для інженерного розрахунку, оформлення замовлень і гарантійного супроводу.', 'персональные данные используются только для инженерного расчёта, оформления заказов и гарантийного обслуживания.')}
                  </p>
                </div>
              </div>
          </div>
        </div>
      </section>
    </div>
  );
}
