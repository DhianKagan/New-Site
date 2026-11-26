import { useState } from 'react';
import { ArrowRight, ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';
import { FAQ_ITEMS } from '../data/siteContent.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';
import { VideoBackground } from './VideoBackground.tsx';

interface FaqSectionProps {
  onOpenLeadModal: (
    topic: string,
    estimatedTotalUsd?: number,
    placement?: 'hero' | 'sticky' | 'section' | 'footer',
    initialNotes?: string,
  ) => void;
}

export function FaqSection({ onOpenLeadModal }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const isRussian = getActiveLocale() === 'ru';

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative overflow-hidden isolate ec-section border-t border-white/25"
    >
      <VideoBackground position="absolute" tone="light" tint="indigo" start={47} end={53} brightness={0.54} />
      <div className="relative ec-container break-words hyphens-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Equal-Height Summary & Trust Plate */}
          <div className="lg:col-span-5 min-w-0 ec-glass-plate rounded-2xl p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-6 h-full">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0b66b2] mb-2">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{tr('Відповіді інженерів · FAQ', 'Ответы инженеров · FAQ')}</span>
              </div>
              <h2
                id="faq-heading"
                className="text-[clamp(1.2rem,4.5vw,1.875rem)] font-extrabold text-[#061c36] leading-tight mb-3"
              >
                {tr('Часті запитання', 'Частые вопросы')}
              </h2>
              <p className="text-[15px] text-[#133659] font-medium leading-[1.65] max-w-[42ch]">
                {tr(
                  'Зібрали відповіді на головні питання про перемикання на резерв, безпеку LiFePO4, терміни монтажу та оформлення в Одесі.',
                  'Собрали ответы на главные вопросы о переключении на резерв, безопасности LiFePO4, сроках монтажа и оформлении в Одессе.',
                )}
              </p>

              <dl className="mt-6 pt-5 border-t border-sky-200/80 divide-y divide-sky-200/60">
                <div className="py-3 first:pt-0 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-bold text-[#133659]">
                    {tr('Перемикання на АКБ', 'Переключение на АКБ')}
                  </dt>
                  <dd className="font-mono text-sm font-extrabold text-[#0b66b2] tabular-nums whitespace-nowrap">
                    &lt; 10 {tr('мс', 'мс')}
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-bold text-[#133659]">
                    {tr('Реалізовано в Одесі та області', 'Реализовано в Одессе и области')}
                  </dt>
                  <dd className="font-mono text-sm font-extrabold text-[#061c36] tabular-nums whitespace-nowrap">
                    100+ {tr('об’єктів', 'объектов')}
                  </dd>
                </div>
                <div className="py-3 last:pb-0 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-bold text-[#133659]">
                    {tr('Офіційна гарантія на обладнання', 'Официальная гарантия на оборудование')}
                  </dt>
                  <dd className="font-mono text-sm font-extrabold text-[#0d9488] tabular-nums whitespace-nowrap">
                    5–10 {tr('років', 'лет')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pt-5 border-t border-sky-200/80 space-y-4">
              <div className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[#061c36] font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
                <span className="leading-[1.6]">
                  {tr(
                    'Усі відповіді базуються на реальній практиці монтажу та сервісної підтримки в Одесі та області.',
                    'Все ответы основаны на реальной практике монтажа и сервисной поддержки в Одессе и области.',
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenLeadModal('Запитання з блоку FAQ')}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0b66b2] to-[#0284c7] hover:from-[#08508e] hover:to-[#0b66b2] text-white text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-md transition-all cursor-pointer"
              >
                <span>{tr('Поставити запитання інженеру', 'Задать вопрос инженеру')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* Right Accessible Accordion */}
          <div className="lg:col-span-7 flex">
            <div className="ec-glass-card rounded-2xl w-full h-full flex flex-col divide-y divide-sky-200/75 overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx;
                const questionText = isRussian && item.qRu ? item.qRu : tr(item.q);
                const answerText = isRussian && item.aRu ? item.aRu : tr(item.a);
                const buttonId = `faq-trigger-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={item.q}
                    className={`flex-1 flex flex-col justify-center transition-colors ${
                      isOpen
                        ? 'bg-gradient-to-r from-[#e6f3ff]/85 to-[#fff9ec]/75'
                        : 'bg-transparent'
                    }`}
                  >
                    <h3 className="m-0">
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                        className="w-full px-5 py-4 sm:px-6 sm:py-5 text-left flex items-center justify-between gap-4 hover:bg-white/65 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0b66b2]"
                      >
                        <span className="flex items-center gap-3.5 min-w-0">
                          <span
                            className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${
                              isOpen
                                ? 'bg-gradient-to-r from-[#0b66b2] to-[#0284c7] text-white shadow-xs'
                                : 'bg-sky-100/95 text-[#061c36]'
                            }`}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[15px] sm:text-base font-extrabold text-[#061c36] leading-snug">
                            {questionText}
                          </span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#0b66b2]' : 'text-[#133659]'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>

                    {isOpen && (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        className="px-5 pb-5 sm:px-6 sm:pb-5 pl-[3.5rem] sm:pl-[3.85rem] text-sm text-[#133659] font-medium leading-[1.7] max-w-[64ch]"
                      >
                        {answerText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
