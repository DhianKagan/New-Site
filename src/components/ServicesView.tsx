import { Check, ArrowRight } from 'lucide-react';
import { EXTRA_SERVICES, MONTAGE_SERVICES } from '../data/siteContent.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { SmartImage } from './SmartImage.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { getActiveLocale, tr } from '../lib/i18n.ts';

interface ServicesViewProps {
  onBackHome?: () => void;
  onOrderService: (topic: string) => void;
  usdUahRate: number | null;
}

export function ServicesView({ onOrderService, usdUahRate }: ServicesViewProps) {
  const isRussian = getActiveLocale() === 'ru';
  const formatPriceLabel = (label: string) =>
    label.replace(/\$(\d+(?:[.,]\d+)?)/g, (_match, amount: string) =>
      formatUahFromUsd(Number(amount.replace(',', '.')), usdUahRate),
    );
  return (
    <div>
      <section className="bg-[#081421]/40 backdrop-blur-[1px] border-b border-white/15 py-8 text-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            {tr('Послуги монтажу СЕС та додатковий інженерний сервіс')}
          </h1>
          <p className="text-sm text-slate-200 max-w-2xl">
            {tr('Власний монтажний підрозділ в Одесі та Одеській області. Від аудиту електромережі до пусконалагодження і юридичного супроводу «зеленого тарифу».', 'Своя монтажная команда в Одессе и области: от аудита электросети и пусконаладки до сопровождения оформления «зелёного тарифа».')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate py-12">
        <VideoBackground position="absolute" tone="light" start={20} end={36} />
        <div className="relative max-w-[1180px] mx-auto px-5 space-y-12">
          <div>
            <div className="mb-6">
              <div className="text-xs font-extrabold text-sky-300 text-on-video mb-1">{tr('Напрямок 01')}</div>
              <h2 className="text-2xl font-extrabold text-white text-on-video">{tr('Послуги монтажу під ключ')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MONTAGE_SERVICES.map((svc) => (
                <article
                  key={svc.id}
                  className="bg-white/95 backdrop-blur-md border border-white/25 shadow-xl rounded-2xl overflow-hidden flex flex-col justify-between gap-5"
                >
                  {svc.image && (
                    <div className="h-40 bg-slate-100">
                      <SmartImage src={svc.image} alt={svc.imageAlt ?? svc.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 pt-1">
                    <div className="text-[11px] font-bold text-[#1769aa] mb-1">{isRussian ? svc.kickerRu ?? svc.kicker : svc.kicker}</div>
                    <h3 className="text-lg font-extrabold text-[#0d1f33] mb-2">{isRussian ? svc.titleRu ?? svc.title : svc.title}</h3>
                    <p className="text-xs text-[#334155] font-medium leading-relaxed mb-4">{isRussian ? svc.summaryRu ?? svc.summary : svc.summary}</p>
                    <ul className="space-y-2 text-xs text-[#0f172a]">
                      {(isRussian ? svc.bulletsRu ?? svc.bullets : svc.bullets).map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mx-6 pt-4 pb-6 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-[#0d1f33]">{formatPriceLabel(isRussian ? svc.priceLabelRu ?? svc.priceLabel : svc.priceLabel)}</span>
                    <button
                      type="button"
                      onClick={() => onOrderService(`Послуга: ${svc.title}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {tr('Замовити', 'Заказать')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-white/15">
            <div className="mb-6">
              <div className="text-xs font-extrabold text-sky-300 text-on-video mb-1">{tr('Напрямок 02')}</div>
              <h2 className="text-2xl font-extrabold text-white text-on-video">{tr('Додаткові інженерні послуги')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {EXTRA_SERVICES.map((svc) => (
                <article
                  key={svc.id}
                  className="bg-white/95 backdrop-blur-md border border-white/25 shadow-xl rounded-2xl overflow-hidden flex flex-col justify-between gap-5"
                >
                  {svc.image && (
                    <div className="h-40 bg-slate-100">
                      <SmartImage src={svc.image} alt={svc.imageAlt ?? svc.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 pt-1">
                    <div className="text-[11px] font-bold text-[#1769aa] mb-1">{isRussian ? svc.kickerRu ?? svc.kicker : svc.kicker}</div>
                    <h3 className="text-lg font-extrabold text-[#0d1f33] mb-2">{isRussian ? svc.titleRu ?? svc.title : svc.title}</h3>
                    <p className="text-xs text-[#334155] font-medium leading-relaxed mb-4">{isRussian ? svc.summaryRu ?? svc.summary : svc.summary}</p>
                    <ul className="space-y-2 text-xs text-[#0f172a]">
                      {(isRussian ? svc.bulletsRu ?? svc.bullets : svc.bullets).map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mx-6 pt-4 pb-6 border-t border-slate-200 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-[#0d1f33]">{formatPriceLabel(isRussian ? svc.priceLabelRu ?? svc.priceLabel : svc.priceLabel)}</span>
                    <button
                      type="button"
                      onClick={() => onOrderService(`Додаткова послуга: ${svc.title}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {tr('Залишити заявку', 'Оставить заявку')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
