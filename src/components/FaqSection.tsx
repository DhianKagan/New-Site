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
      className="relative overflow-hidden isolate py-14 sm:py-16 border-t border-white/15"
    >
      <VideoBackground position="absolute" tone="light" start={6} end={22} />
      <div className="relative max-w-[1180px] mx-auto px-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Sticky Summary & Trust Block */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-300 text-on-video mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{tr('Відповіді інженерів · FAQ', 'Ответы инженеров · FAQ')}</span>
            </div>
            <h2
              id="faq-heading"
              className="text-2xl sm:text-3xl font-extrabold text-white text-on-video leading-tight mb-3"
            >
              {tr('Часті запитання', 'Частые вопросы')}
            </h2>
            <p className="text-sm text-slate-100 font-medium text-on-video leading-relaxed mb-5">
              {tr(
                'Зібрали відповіді на головні питання про перемикання на резерв, безпеку LiFePO4, терміни монтажу та оформлення в Одесі.',
                'Собрали ответы на главные вопросы о переключении на резерв, безопасности LiFePO4, сроках монтажа и оформлении в Одессе.',
              )}
            </p>

            <div className="rounded-xl bg-white/95 backdrop-blur-md border border-white/25 shadow-lg p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#0d1f33] font-medium">
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
            <div className="rounded-2xl border border-white/25 bg-white/95 backdrop-blur-md divide-y divide-slate-200 shadow-xl overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx;
                const questionText = isRussian && item.qRu ? item.qRu : tr(item.q);
                const answerText = isRussian && item.aRu ? item.aRu : tr(item.a);
                const buttonId = `faq-trigger-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={item.q}
                    className={`transition-colors ${isOpen ? 'bg-[#f8fbff]/90' : 'bg-transparent'}`}
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
                                : 'bg-slate-200 text-[#0d1f33]'
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
                            isOpen ? 'rotate-180 text-[#1769aa]' : 'text-slate-600'
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
                        className="px-5 pb-5 sm:px-6 sm:pb-5 pl-[3.25rem] sm:pl-[3.5rem] text-xs sm:text-sm text-[#1e293b] leading-relaxed"
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
