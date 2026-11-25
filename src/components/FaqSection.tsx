import { useState } from 'react';
import { ArrowRight, ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';
import { FAQ_ITEMS } from '../data/siteContent.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';

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
      className="py-14 sm:py-16 bg-white/92 backdrop-blur-md border-t border-slate-200/80"
    >
      <div className="max-w-[1180px] mx-auto px-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Sticky Summary & Trust Block */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1769aa] mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{tr('Відповіді інженерів · FAQ', 'Ответы инженеров · FAQ')}</span>
            </div>
            <h2
              id="faq-heading"
              className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] leading-tight mb-3"
            >
              {tr('Часті запитання', 'Частые вопросы')}
            </h2>
            <p className="text-sm text-[#52657a] leading-relaxed mb-5">
              {tr(
                'Зібрали відповіді на головні питання про перемикання на резерв, безпеку LiFePO4, терміни монтажу та оформлення в Одесі.',
                'Собрали ответы на главные вопросы о переключении на резерв, безопасности LiFePO4, сроках монтажа и оформлении в Одессе.',
              )}
            </p>

            <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#0d1f33]">
                <ShieldCheck className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {tr(
                    'Усі відповіді базуються на реальній практиці монтажу 100+ об’єктів в Одесі та області.',
                    'Все ответы основаны на реальной практике монтажа 100+ объектов в Одессе и области.',
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenLeadModal('Запитання з блоку FAQ')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#1769aa] text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                <span>{tr('Поставити своє запитання інженеру', 'Задать свой вопрос инженеру')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Accessible Accordion */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200 shadow-xs overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx;
                const questionText = isRussian && item.qRu ? item.qRu : tr(item.q);
                const answerText = isRussian && item.aRu ? item.aRu : tr(item.a);
                const buttonId = `faq-trigger-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={item.q}
                    className={`transition-colors ${isOpen ? 'bg-[#f8fbff]' : 'bg-white'}`}
                  >
                    <h3 className="m-0">
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                        className="w-full px-5 py-4 sm:px-6 sm:py-4.5 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1769aa]"
                      >
                        <span className="flex items-start gap-3 min-w-0">
                          <span
                            className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                              isOpen
                                ? 'bg-[#1769aa] text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm sm:text-[15px] font-extrabold text-[#0d1f33] leading-snug">
                            {questionText}
                          </span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#1769aa]' : 'text-slate-400'
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
                        className="px-5 pb-5 sm:px-6 sm:pb-5 pl-[3.25rem] sm:pl-[3.5rem] text-xs sm:text-sm text-[#52657a] leading-relaxed"
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
