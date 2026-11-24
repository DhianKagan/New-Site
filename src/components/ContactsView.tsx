import { MapPin, Phone, Mail, Clock, ShieldCheck } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { trackEvent } from '../lib/analytics.ts';

interface ContactsViewProps {
  onBackHome: () => void;
  onOpenLeadModal: (topic: string) => void;
}

export function ContactsView({ onBackHome, onOpenLeadModal }: ContactsViewProps) {
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

      <section className="py-12 bg-white">
        <div className="max-w-[1180px] mx-auto px-5 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-2xl p-6 bg-white space-y-4">
              <div className="text-xs font-extrabold text-[#1769aa]">Головний офіс та склад</div>
              <h2 className="text-xl font-extrabold text-[#0d1f33]">{COMPANY_INFO.address}</h2>
              <div className="space-y-3 text-sm text-slate-700 pt-2">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#1769aa] shrink-0" />
                  <span>Працюємо по всій Одесі та Одеській області</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#1769aa] shrink-0" />
                  <span>Графік роботи: {COMPANY_INFO.schedule}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#1769aa] shrink-0" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono font-semibold text-[#0d1f33]">
                    <a
                      href={COMPANY_INFO.phone1Href}
                      onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })}
                      className="hover:text-[#1769aa]"
                    >
                      {COMPANY_INFO.phone1}
                    </a>
                    <a
                      href={COMPANY_INFO.phone2Href}
                      onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone2 })}
                      className="hover:text-[#1769aa]"
                    >
                      {COMPANY_INFO.phone2}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#1769aa] shrink-0" />
                  <a href={`mailto:${COMPANY_INFO.email}`} className="font-mono hover:text-[#1769aa]">
                    {COMPANY_INFO.email}
                  </a>
                </div>
              </div>
              <div className="pt-3 flex flex-wrap gap-3">
                <a
                  href={COMPANY_INFO.phone1Href}
                  onClick={() => trackEvent('contact', { phone: COMPANY_INFO.phone1 })}
                  className="px-4 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold"
                >
                  Зателефонувати зараз
                </a>
                <button
                  type="button"
                  onClick={() => onOpenLeadModal('Консультація зі сторінки Контакти')}
                  className="px-4 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-xs font-bold cursor-pointer"
                >
                  Замовити зворотний дзвінок
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-6 bg-[#f6f8fb] space-y-4">
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
        </div>
      </section>
    </div>
  );
}
