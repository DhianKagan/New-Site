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
      <div className="relative ec-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Sticky Summary & Trust Plate (Single clean glass panel, no nested cards) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 ec-glass-plate rounded-2xl p-6 sm:p-7">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0b66b2] mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{tr('Відповіді інженерів · FAQ', 'Ответы инженеров · FAQ')}</span>
            </div>
            <h2
              id="faq-heading"
              className="text-2xl sm:text-3xl font-extrabold text-[#07213e] leading-tight mb-3"
            >
              {tr('Часті запитання', 'Частые вопросы')}
            </h2>
            <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed mb-5">
              {tr(
                'Зібрали відповіді на головні питання про перемикання на резерв, безпеку LiFePO4, терміни монтажу та оформлення в Одесі.',
                'Собрали ответы на главные вопросы о переключении на резерв, безопасности LiFePO4, сроках монтажа и оформлении в Одессе.',
              )}
            </p>

            <div className="pt-4 border-t border-sky-200/80 space-y-4">
              <div className="flex items-start gap-2.5 text-xs text-[#07213e] font-medium">
                <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
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
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                <span>{tr('Поставити своє запитання інженеру', 'Задать свой вопрос инженеру')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Accessible Accordion */}
          <div className="lg:col-span-8">
            <div className="ec-glass-card rounded-2xl divide-y divide-sky-100/90 overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx;
                const questionText = isRussian && item.qRu ? item.qRu : tr(item.q);
                const answerText = isRussian && item.aRu ? item.aRu : tr(item.a);
                const buttonId = `faq-trigger-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={item.q}
                    className={`transition-colors ${isOpen ? 'bg-[#f0f7ff]/75' : 'bg-transparent'}`}
                  >
                    <h3 className="m-0">
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                        className="w-full px-5 py-4 sm:px-6 sm:py-5 text-left flex items-center justify-between gap-4 hover:bg-white/60 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0b66b2]"
                      >
                        <span className="flex items-start gap-3 min-w-0">
                          <span
                            className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                              isOpen
                                ? 'bg-[#0b66b2] text-white'
                                : 'bg-sky-100/90 text-[#07213e]'
                            }`}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm sm:text-[15px] font-extrabold text-[#07213e] leading-snug">
                            {questionText}
                          </span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#0b66b2]' : 'text-[#1c3d5e]'
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
                        className="px-5 pb-5 sm:px-6 sm:pb-5 pl-[3.25rem] sm:pl-[3.5rem] text-xs sm:text-sm text-[#1c3d5e] leading-relaxed"
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
