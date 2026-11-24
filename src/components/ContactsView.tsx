import { Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { trackEvent } from '../lib/analytics.ts';
import { SocialIcons } from './SocialIcons.tsx';
import type { SocialLinksConfig } from '../types.ts';

interface ContactsViewProps {
  onBackHome: () => void;
  onOpenLeadModal: (topic: string) => void;
  socialLinks: SocialLinksConfig;
}

export function ContactsView({ onBackHome, onOpenLeadModal, socialLinks }: ContactsViewProps) {
  return (
    <div>
      <section className="bg-gradient-to-b from-[#f3f7fc] to-white border-b border-slate-200 py-8">
        <div className="max-w-[1180px] mx-auto px-5">
          <nav aria-label="Хлібні крихти" className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onBackHome();
                }
              }}
              className="text-[#1769aa] font-bold hover:underline"
            >
              Головна
            </a>
            <span aria-hidden="true">/</span>
            <span>Контакти та інформація</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
            Ми на зв’язку та раді відповісти на ваші питання
          </h1>
          <p className="text-sm text-[#52657a] max-w-2xl">
            Головний офіс, склад обладнання та інженерний відділ компанії Energo Comfort в Одесі.
          </p>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-10 sm:py-12">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6">
              <div className="text-xs font-extrabold text-[#1769aa] mb-1">Контакти</div>
              <h2 className="text-2xl font-extrabold text-[#0d1f33]">Зв’яжіться з нами</h2>
              <p className="mt-2 text-sm text-[#52657a]">Проконсультуємо щодо обладнання, монтажу та підбору системи.</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><MapPin className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#52657a]">Головний офіс</p>
                  <p className="mt-1 text-sm font-bold text-[#0d1f33]">{COMPANY_INFO.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Phone className="h-5 w-5" /></span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#52657a]">Телефони</p>
                  <a href={COMPANY_INFO.phone1Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })} className="block text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.phone1}</a>
                  <a href={COMPANY_INFO.phone2Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone2 })} className="block text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.phone2}</a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Mail className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#52657a]">Електронна пошта</p>
                  <a href={`mailto:${COMPANY_INFO.email}`} className="mt-1 block break-all text-sm font-bold text-[#1769aa] hover:underline">{COMPANY_INFO.email}</a>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#1769aa]"><Clock className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold text-[#52657a]">Графік роботи</p>
                  <p className="mt-1 text-sm font-bold text-[#0d1f33]">{COMPANY_INFO.schedule}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <SocialIcons links={socialLinks} variant="light" />
              <div className="flex flex-wrap gap-2">
                <a href={COMPANY_INFO.phone1Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white hover:bg-[#12568c]">Зателефонувати</a>
                <button type="button" onClick={() => onOpenLeadModal('Консультація зі сторінки Контакти')} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-[#0d1f33] hover:bg-slate-50">Замовити дзвінок</button>
              </div>
            </div>
          </div>

          <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:min-h-[440px]">
            <iframe
              title="Google Maps — Energo Comfort, Одеса, вулиця Європейська, 93"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(COMPANY_INFO.address)}&z=16&output=embed`}
              className="h-full min-h-[360px] w-full border-0 sm:min-h-[440px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-[1180px] px-5">
          <div className="rounded-2xl border border-slate-200 bg-[#f6f8fb] p-6 sm:p-8">
              <div className="text-xs font-extrabold text-[#1769aa]">Про компанію та умови</div>
              <h2 className="text-xl font-extrabold text-[#0d1f33]">Гарантія, повернення та оферта</h2>
              <div className="space-y-3 text-xs text-[#52657a] leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">Офіційне постачання:</strong> прямі поставки інверторів Deye,
                    SolaX Power, Solis, Huawei та LiFePO4 АКБ з офіційною гарантією виробника.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">Повернення та обмін (14 днів):</strong> згідно із Законом України
                    «Про захист прав споживачів» за збереження пломб, товарного вигляду та повної комплектації.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#0d1f33]">Конфіденційність та публічна оферта:</strong> персональні дані
                    використовуються виключно для інженерного розрахунку, оформлення замовлень і гарантійного супроводу.
                  </p>
                </div>
              </div>
          </div>
        </div>
      </section>
    </div>
  );
}
