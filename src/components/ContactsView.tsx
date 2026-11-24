import { Clock, ShieldCheck } from 'lucide-react';
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

      <section className="bg-[#f2b83d] py-7 sm:py-10">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col justify-center bg-[#2c3c60] px-6 py-7 text-center text-white shadow-xl sm:px-8 sm:py-9">
            <h2 className="border-b border-white/50 pb-4 text-2xl font-extrabold">Energo Comfort</h2>
            <h3 className="pt-4 text-lg font-bold">Головний офіс</h3>
            <div className="my-5 space-y-1 text-sm font-semibold">
              <p>Україна</p>
              <p>м. Одеса, вул. Європейська 93</p>
            </div>
            <div className="space-y-2 font-mono text-sm font-bold">
              <a href={COMPANY_INFO.phone1Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })} className="block underline underline-offset-2">{COMPANY_INFO.phone1}</a>
              <a href={COMPANY_INFO.phone2Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone2 })} className="block underline underline-offset-2">{COMPANY_INFO.phone2}</a>
              <a href={`mailto:${COMPANY_INFO.email}`} className="block break-all underline underline-offset-2">{COMPANY_INFO.email}</a>
            </div>
            <div className="my-5 border-y border-white/50 py-4">
              <p className="mb-3 text-sm">Приєднуйтесь до нас у соціальних мережах:</p>
              <div className="flex justify-center"><SocialIcons links={socialLinks} variant="light" /></div>
            </div>
            <p className="mb-4 flex items-center justify-center gap-2 text-xs text-white/80"><Clock className="h-4 w-4" />{COMPANY_INFO.schedule}</p>
            <a href={COMPANY_INFO.phone1Href} onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })} className="mx-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-7 text-sm font-bold text-[#2c3c60] hover:bg-slate-100">Зателефонувати нам</a>
            <button type="button" onClick={() => onOpenLeadModal('Консультація зі сторінки Контакти')} className="mt-3 text-xs font-semibold text-white underline underline-offset-2">Замовити зворотний дзвінок</button>
          </div>

          <div className="min-h-[360px] overflow-hidden bg-slate-200 shadow-xl sm:min-h-[440px]">
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
