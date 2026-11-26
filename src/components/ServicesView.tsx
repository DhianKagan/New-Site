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
      <section className="ec-banner text-[#07213e]">
        <div className="ec-container">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-2">
            {tr('Послуги монтажу СЕС та додатковий інженерний сервіс')}
          </h1>
          <p className="text-sm text-[#1c3d5e] font-medium max-w-2xl">
            {tr('Власний монтажний підрозділ в Одесі та Одеській області. Від аудиту електромережі до пусконалагодження і юридичного супроводу «зеленого тарифу».', 'Своя монтажная команда в Одессе и области: от аудита электросети и пусконаладки до сопровождения оформления «зелёного тарифа».')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="teal" start={20} end={32} brightness={0.56} />
        <div className="relative ec-container space-y-12">
          <div>
            <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-7">
              <div className="text-xs font-extrabold text-[#0b66b2] mb-1">{tr('Напрямок 01')}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e]">{tr('Послуги монтажу під ключ')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {MONTAGE_SERVICES.map((svc) => (
                <article
                  key={svc.id}
                  className="ec-glass-card rounded-2xl overflow-hidden h-full flex flex-col justify-between"
                >
                  <div>
                    {svc.image && (
                      <div className="h-48 bg-white/80 overflow-hidden">
                        <SmartImage src={svc.image} alt={svc.imageAlt ?? svc.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5 sm:p-6">
                      <div className="text-[11px] font-bold text-[#0b66b2] mb-1">{isRussian ? svc.kickerRu ?? svc.kicker : svc.kicker}</div>
                      <h3 className="text-lg font-extrabold text-[#061c36] mb-2">{isRussian ? svc.titleRu ?? svc.title : svc.title}</h3>
                      <p className="text-sm text-[#133659] font-medium leading-[1.65] mb-4">{isRussian ? svc.summaryRu ?? svc.summary : svc.summary}</p>
                      <ul className="space-y-2 text-[13px] text-[#061c36] font-medium">
                        {(isRussian ? svc.bulletsRu ?? svc.bullets : svc.bullets).map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mx-5 sm:mx-6 pt-4 pb-5 sm:pb-6 border-t border-sky-100 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-[#07213e]">{formatPriceLabel(isRussian ? svc.priceLabelRu ?? svc.priceLabel : svc.priceLabel)}</span>
                    <button
                      type="button"
                      onClick={() => onOrderService(`Послуга: ${svc.title}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b66b2] hover:bg-[#08508e] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {tr('Замовити', 'Заказать')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-white/40">
            <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-7">
              <div className="text-xs font-extrabold text-[#0b66b2] mb-1">{tr('Напрямок 02')}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e]">{tr('Додаткові інженерні послуги')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {EXTRA_SERVICES.map((svc) => (
                <article
                  key={svc.id}
                  className="ec-glass-card rounded-2xl overflow-hidden h-full flex flex-col justify-between"
                >
                  <div>
                    {svc.image && (
                      <div className="h-48 bg-white/80 overflow-hidden">
                        <SmartImage src={svc.image} alt={svc.imageAlt ?? svc.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5 sm:p-6">
                      <div className="text-[11px] font-bold text-[#0b66b2] mb-1">{isRussian ? svc.kickerRu ?? svc.kicker : svc.kicker}</div>
                      <h3 className="text-lg font-extrabold text-[#061c36] mb-2">{isRussian ? svc.titleRu ?? svc.title : svc.title}</h3>
                      <p className="text-sm text-[#133659] font-medium leading-[1.65] mb-4">{isRussian ? svc.summaryRu ?? svc.summary : svc.summary}</p>
                      <ul className="space-y-2 text-[13px] text-[#061c36] font-medium">
                        {(isRussian ? svc.bulletsRu ?? svc.bullets : svc.bullets).map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mx-5 sm:mx-6 pt-4 pb-5 sm:pb-6 border-t border-sky-100 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-[#07213e]">{formatPriceLabel(isRussian ? svc.priceLabelRu ?? svc.priceLabel : svc.priceLabel)}</span>
                    <button
                      type="button"
                      onClick={() => onOrderService(`Додаткова послуга: ${svc.title}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#07213e] hover:text-white text-xs font-bold cursor-pointer whitespace-nowrap transition-colors"
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
