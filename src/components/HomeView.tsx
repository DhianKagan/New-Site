import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowRight,
  CheckCircle2,
  PhoneCall,
  Send,
  Truck,
  Zap,
} from 'lucide-react';
import type { Deal, Product, ProductCategory, ProjectCase } from '../types.ts';
import { BRAND_PARTNERS, COMPANY_INFO, FAQ_ITEMS } from '../data/siteContent.ts';
import { ProductCard } from './ProductCard.tsx';
import { SmartImage } from './SmartImage.tsx';
import { track, trackEvent, type Property, type Scenario } from '../lib/analytics.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';

interface HomeViewProps {
  products: Product[];
  projects: ProjectCase[];
  telegramUrl?: string;
  onNavigateShop: (cat?: ProductCategory | 'all') => void;
  onNavigateServices: () => void;
  onNavigateProjects: () => void;
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, placement?: 'hero' | 'sticky' | 'section' | 'footer') => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onSelectCase: (project: ProjectCase) => void;
  onLeadCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
  usdUahRate: number | null;
}

type ShowcaseTab = 'backup-kits' | 'solar-kits' | 'hardware';

export function HomeView({
  products,
  projects,
  telegramUrl,
  onNavigateShop,
  onNavigateServices,
  onNavigateProjects,
  onOpenLeadModal,
  onSelectProduct,
  onAddToCart,
  onSelectCase,
  onLeadCreated,
  onOpenCrm,
  usdUahRate,
}: HomeViewProps) {
  const isRussian = getActiveLocale() === 'ru';
  const [showcaseTab, setShowcaseTab] = useState<ShowcaseTab>('backup-kits');
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [caseSeg, setCaseSeg] = useState<'all' | 'b2b' | 'b2c'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const safeHeroIdx = projects.length > 0 ? ((heroIdx % projects.length) + projects.length) % projects.length : 0;
  const activeHeroCase = projects[safeHeroIdx];

  useEffect(() => {
    if (heroPaused || projects.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % projects.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroPaused, projects.length]);

  // Engineering Brief Form state
  const [taskType, setTaskType] = useState('Резервне живлення (квартира / дім)');
  const [loads, setLoads] = useState<string[]>(['Газовий котел', 'Холодильник']);
  const [city, setCity] = useState('Одеса (Таїрова / Фонтан / Центр)');
  const [channel, setChannel] = useState('Telegram');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdBrief, setCreatedBrief] = useState<Deal | null>(null);
  const briefFormStarted = useRef(false);

  function getFormScenario(topic: string): Scenario {
    if (/сес|соняч|solar/i.test(topic)) return 'solar';
    if (/гібрид|гибрид|hybrid/i.test(topic)) return 'hybrid';
    if (/резерв|backup|живлен/i.test(topic)) return 'backup';
    return 'unspecified';
  }

  function getFormProperty(topic: string): Property {
    if (/бізнес|бизнес|сто|business/i.test(topic)) return 'business';
    if (/дім|дом|house/i.test(topic)) return 'house';
    return 'apartment';
  }

  const backupKits = products
    .filter(
      (p) =>
        p.isKit &&
        !p.title.toLowerCase().includes('сес') &&
        !p.title.toLowerCase().includes('соняч') &&
        p.price > 0,
    )
    .slice(0, 3);

  const solarKits = products
    .filter(
      (p) =>
        p.isKit &&
        (p.title.toLowerCase().includes('сес') || p.title.toLowerCase().includes('соняч')) &&
        p.price > 0,
    )
    .slice(0, 3);

  const popularHardware = products
    .filter(
      (p) =>
        !p.isKit &&
        p.price > 0 &&
        (p.cat === 'inverters' || p.cat === 'batteries') &&
        (p.brand === 'Deye' || p.brand === 'SolaX'),
    )
    .slice(0, 3);

  const activeShowcase =
    showcaseTab === 'backup-kits'
      ? backupKits.length
        ? backupKits
        : products.filter((p) => p.isKit).slice(0, 3)
      : showcaseTab === 'solar-kits'
        ? solarKits.length
          ? solarKits
          : products.filter((p) => p.isKit).slice(0, 3)
        : popularHardware;

  const visibleCases = projects.filter((p) => caseSeg === 'all' || p.seg === caseSeg).slice(0, 6);

  function toggleLoad(val: string) {
    setLoads((prev) => (prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]));
  }

  async function handleBriefSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const scenario = getFormScenario(taskType);
    setSubmitting(true);
    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'Клієнт із головної форми',
          phone,
          city,
          channel,
          topic: taskType,
          taskType,
          loads,
          website,
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setFormError(data.error || 'Помилка відправки заявки');
        track({ name: 'form_error', field: 'phone', placement: 'section', scenario });
      } else {
        setCreatedBrief(data.deal);
        track({ name: 'lead_submit', property: getFormProperty(taskType), placement: 'section', scenario });
        trackEvent('generate_lead', {
          lead_topic: taskType,
          value: 0,
          currency: 'USD',
        });
        onLeadCreated(data.deal);
        setPhone('');
        setCustomerName('');
      }
    } catch {
      setFormError('Сервер заявок зараз недоступний. Зателефонуйте нам напряму: +38 (050) 777-71-72.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Hero + 3-Scenario Fork */}
      <section className="bg-gradient-to-b from-[#f4f8fc] to-white border-b border-slate-200 py-10 lg:py-12">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-8">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="text-xs font-extrabold text-[#1769aa] tracking-wide mb-2.5">
                {tr('Резервне живлення · Сонячні електростанції · Одеса')}
              </div>
              <h1 className="text-[clamp(2rem,3.8vw,2.75rem)] font-extrabold text-[#0d1f33] leading-[1.1] tracking-tight mb-4 max-w-xl">
                {tr('Енергія, на яку можна')} <span className="text-[#1769aa]">{tr('покластися')}</span>
              </h1>
              <p className="text-[15px] text-[#52657a] leading-relaxed mb-6 max-w-xl">
                {tr('Проєктування, офіційне постачання обладнання (Deye, SolaX, Solis, Dyness, Trina) та сертифікований монтаж «під ключ» з гарантією в Одесі та області.', 'Проектирование, официальные поставки оборудования (Deye, SolaX, Solis, Dyness, Trina) и сертифицированный монтаж под ключ с гарантией в Одессе и области.')}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    track({ name: 'cta_click', placement: 'hero', scenario: 'unspecified' });
                    onOpenLeadModal('Безкоштовний розрахунок системи з першого екрана', undefined, 'hero');
                  }}
                  className="inline-flex min-h-12 items-center gap-2 px-5 py-3 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d1f33]"
                >
                  {tr('Замовити розрахунок', 'Заказать расчёт')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={COMPANY_INFO.phone1Href}
                  onClick={() => track({ name: 'phone_click', placement: 'hero', scenario: 'unspecified' })}
                  className="inline-flex min-h-12 items-center gap-2 px-4 py-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[#0d1f33] text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <PhoneCall className="w-4 h-4 text-[#1769aa]" />
                  {tr('Подзвонити', 'Позвонить')}
                </a>
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      track({ name: 'messenger_click', placement: 'hero', scenario: 'unspecified', channel: 'telegram' });
                      trackEvent('contact', { channel: 'telegram_hero' });
                    }}
                    className="inline-flex min-h-12 items-center gap-1.5 px-3.5 py-3 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#1769aa] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {tr('Telegram')}
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  {tr('Підбір за вашим сценарієм', 'Подбор под ваш сценарий')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  {tr('Офіс в Одесі · Європейська, 93', 'Офис в Одессе · Европейская, 93')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  {tr('Deye · SolaX · Solis', 'Deye · SolaX · Solis')}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 flex items-center">
              {activeHeroCase && (
                <div
                  className="relative w-full h-[290px] sm:h-[330px] lg:h-[340px] rounded-2xl overflow-hidden border border-slate-300 bg-[#0d1f33] shadow-sm group"
                  onMouseEnter={() => setHeroPaused(true)}
                  onMouseLeave={() => setHeroPaused(false)}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCase(activeHeroCase)}
                    aria-label={`${tr('Детальніше про об’єкт', 'Подробнее об объекте')}: ${isRussian ? activeHeroCase.titleRu ?? activeHeroCase.title : activeHeroCase.title}`}
                    className="block relative w-full h-full text-left cursor-pointer"
                  >
                    <SmartImage
                      key={`${activeHeroCase.id}-${activeHeroCase.img}`}
                      src={activeHeroCase.img}
                      alt={`${isRussian ? activeHeroCase.titleRu ?? activeHeroCase.title : activeHeroCase.title} — ${isRussian ? activeHeroCase.specsRu ?? activeHeroCase.specs : activeHeroCase.specs} | Energo Comfort Одеса`}
                      priority
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15 flex flex-col justify-between p-5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-xs border border-white/15 text-[11px] font-bold text-sky-200">
                          {isRussian ? activeHeroCase.tagRu ?? activeHeroCase.tag : activeHeroCase.tag}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/55 backdrop-blur-xs border border-white/15 font-mono text-[11px] font-bold text-white tabular-nums">
                          {safeHeroIdx + 1} / {projects.length}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-sky-200 mb-0.5 line-clamp-1">
                            {isRussian ? activeHeroCase.titleRu ?? activeHeroCase.title : activeHeroCase.title}
                          </div>
                          <div className="text-sm sm:text-base font-extrabold leading-snug line-clamp-2">
                            {(isRussian ? activeHeroCase.specsRu ?? activeHeroCase.specs : activeHeroCase.specs) || activeHeroCase.solution}
                          </div>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-sky-200 whitespace-nowrap shrink-0 group-hover:text-white">
                          Деталі →
                        </span>
                      </div>
                    </div>
                  </button>

                  {projects.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeroIdx((prev) => (prev - 1 + projects.length) % projects.length);
                        }}
                        aria-label={tr('Попередній об’єкт', 'Предыдущий объект')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#0d1f33]/75 hover:bg-[#1769aa] text-white border border-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-md"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeroIdx((prev) => (prev + 1) % projects.length);
                        }}
                        aria-label={tr('Наступний об’єкт', 'Следующий объект')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#0d1f33]/75 hover:bg-[#1769aa] text-white border border-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-md"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3 hover:border-[#1769aa] transition-colors">
              <div>
                <div className="text-xs font-bold text-[#1769aa] mb-1">{tr('01. Квартира та дім', '01. Квартира и дом')}</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">{tr('Резервне живлення', 'Резервное питание')}</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                {tr('Інвертор + АКБ LiFePO4: котел, холодильник, роутер та світло працюють автоматично при блекауті.', 'Инвертор и аккумулятор LiFePO4 автоматически обеспечивают питание котла, холодильника, роутера и освещения при отключении света.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowcaseTab('backup-kits');
                  document.getElementById('home-kits')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-extrabold text-[#1769aa] hover:underline text-left cursor-pointer"
              >
                {tr('Дивитись комплекти 5–10 кВт →', 'Посмотреть комплекты 5–10 кВт →')}
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3 hover:border-[#1769aa] transition-colors">
              <div>
                <div className="text-xs font-bold text-[#1769aa] mb-1">{tr('02. Приватний сектор', '02. Частный сектор')}</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">{tr('Сонячні станції (СЕС)', 'Солнечные электростанции')}</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                  {tr('Гібридні та мережеві рішення 6–12 кВт із оформленням «активного споживача» та гарантією монтажу.', 'Гибридные и сетевые решения 6–12 кВт с оформлением статуса активного потребителя и гарантией на монтаж.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowcaseTab('solar-kits');
                  document.getElementById('home-kits')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-extrabold text-[#1769aa] hover:underline text-left cursor-pointer"
              >
                {tr('Дивитись готові СЕС →', 'Посмотреть готовые СЭС →')}
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3 hover:border-[#1769aa] transition-colors">
              <div>
                <div className="text-xs font-bold text-[#1769aa] mb-1">{tr('03. Бізнес 380 В і магазин', '03. Бизнес 380 В и магазин')}</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">{tr('Станції 30–110 кВт та каталог', 'Станции 30–110 кВт и каталог')}</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                  {tr('Рішення для СТО, готелів, заводів або окремі інвертори, панелі й АКБ зі складу в Одесі.', 'Решения для СТО, гостиниц и заводов, а также отдельные инверторы, панели и аккумуляторы со склада в Одессе.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateShop('inverters')}
                className="text-xs font-extrabold text-[#1769aa] hover:underline text-left cursor-pointer"
              >
                {tr('Відкрити каталог обладнання →', 'Открыть каталог оборудования →')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Official Brand Partners */}
      <section className="border-b border-slate-200 bg-white py-6">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h2 className="text-xs font-bold text-slate-500 shrink-0 whitespace-nowrap">
              {tr('Офіційні бренди обладнання')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
              {BRAND_PARTNERS.map((b) => (
                <div
                  key={b.name}
                  title={b.name}
                  className="h-14 px-4 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden"
                >
                  <SmartImage
                    src={b.logo}
                    alt={`${b.name} — офіційне обладнання Energo Comfort`}
                    className={`${b.sizeClass} object-contain`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Solutions & Hardware Showcase */}
      <section id="home-kits" className="py-14 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="max-w-2xl mb-7">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">{tr('Рішення та обладнання')}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
              {tr('Популярні конфігурації та комплектуючі')}
            </h2>
            <p className="text-sm text-[#52657a]">
              {tr('Готові комплекти з інженерним підбором під ваше навантаження, а також окремі інвертори та акумулятори зі складу в Одесі.', 'Готовые комплекты с инженерным подбором под вашу нагрузку, а также отдельные инверторы и аккумуляторы со склада в Одессе.')}
            </p>
          </div>

          <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg mb-7">
            <button
              type="button"
              onClick={() => setShowcaseTab('backup-kits')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                showcaseTab === 'backup-kits'
                  ? 'bg-white text-[#0d1f33] shadow-xs'
                  : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Готові системи резерву', 'Готовые системы резервного питания')}
            </button>
            <button
              type="button"
              onClick={() => setShowcaseTab('solar-kits')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                showcaseTab === 'solar-kits'
                  ? 'bg-white text-[#0d1f33] shadow-xs'
                  : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Готові СЕС з панелями', 'Готовые СЭС с панелями')}
            </button>
            <button
              type="button"
              onClick={() => setShowcaseTab('hardware')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                showcaseTab === 'hardware'
                  ? 'bg-white text-[#0d1f33] shadow-xs'
                  : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Популярні інвертори та АКБ', 'Популярные инверторы и аккумуляторы')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeShowcase.map((prod) => (
              <ProductCard
                usdUahRate={usdUahRate}
                key={prod.id}
                product={prod}
                onSelect={onSelectProduct}
                onAddToCart={onAddToCart}
                onRequestQuote={(p) => onOpenLeadModal(`Розрахунок: ${p.title}`, p.price)}
              />
            ))}
          </div>

          <div className="mt-8 text-center">
            <a
              href="/shop"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onNavigateShop('all');
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33]"
            >
              {tr('Відкрити весь каталог обладнання', 'Открыть весь каталог оборудования')} ({products.length} {tr('позицій', 'позиций')})
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Engineering Audit Split */}
      <section className="py-14 bg-[#f6f8fb] border-y border-slate-200">
        <div className="max-w-[1180px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-12 gap-9 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
              <SmartImage
                src="/assets/energocomfort/kit_battery_30kwh_real.jpg"
                alt={tr("Дисплей інвертора Deye на реальному об'єкті Energo Comfort", 'Дисплей инвертора Deye на реальном объекте Energo Comfort')}
                className="w-full h-80 object-cover"
              />
              <div className="px-4 py-3 text-xs text-[#52657a] border-t border-slate-200">
                {tr('Реальна телеметрія монтажу Energo Comfort: PV 4,87 кВт · АКБ 100% · Статус ON', 'Телеметрия Energo Comfort в реальном времени: PV 4,87 кВт · АКБ 100% · Статус ON')}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">{tr('Інженерний підхід')}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-3">
              {tr('Аудит, підбір сумісного обладнання та безпечний монтаж')}
            </h2>
            <p className="text-sm text-[#52657a] leading-relaxed mb-5">
              {tr('Беремо на себе повний цикл впровадження — від вимірювання реальних пускових струмів та поділу щита до пусконалагодження й віддаленого моніторингу:', 'Берём на себя весь цикл: измеряем пусковые токи, разделяем нагрузки в щите, запускаем систему и настраиваем удалённый мониторинг.')}
            </p>
            <ul className="space-y-2.5 mb-6 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Аналіз споживання та виділення критичної групи навантаження в електрощиті.', 'Анализируем потребление и выделяем критические нагрузки в электрощите.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Розрахунок пускових струмів насосів, компресорів і холодильного обладнання.', 'Рассчитываем пусковые токи насосов, компрессоров и холодильного оборудования.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Підбір сумісних інверторів (Deye, SolaX, Solis) і LiFePO4 АКБ без ризику помилки.', 'Подбираем совместимые инверторы (Deye, SolaX, Solis) и аккумуляторы LiFePO4.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Власний монтажний підрозділ в Одесі та офіційне гарантійне обслуговування.', 'Своя монтажная команда в Одессе и официальное гарантийное обслуживание.')}</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenLeadModal('Замовити аудит споживання')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer"
              >
                {tr('Запросити інженера')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href="/services"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigateServices();
                  }
                }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33]"
              >
                {tr('Усі послуги та тарифи')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Realized Projects Collection */}
      <section className="py-14 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="max-w-2xl mb-6">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">{tr('Портфоліо компанії')}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
              {tr('Реалізовані об’єкти в Одесі та області')}
            </h2>
            <p className="text-sm text-[#52657a]">
              {tr('Інсталяції від приватних будинків 6 кВт до промислових СЕС 110 кВт. Натисніть на об’єкт, щоб переглянути параметри рішення.', 'Наши проекты — от домашних систем 6 кВт до промышленных СЭС 110 кВт. Откройте объект, чтобы увидеть параметры решения.')}
            </p>
          </div>

          <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg mb-7">
            <button
              type="button"
              onClick={() => setCaseSeg('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                caseSeg === 'all' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Обрані проєкти', 'Избранные проекты')} ({visibleCases.length})
            </button>
            <button
              type="button"
              onClick={() => setCaseSeg('b2b')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                caseSeg === 'b2b' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Для бізнесу B2B', 'Для бизнеса B2B')}
            </button>
            <button
              type="button"
              onClick={() => setCaseSeg('b2c')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                caseSeg === 'b2c' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              {tr('Для дому B2C', 'Для дома B2C')}
            </button>
            <a
              href="/projects"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onNavigateProjects();
                }
              }}
              className="px-3.5 py-2 text-xs font-bold text-[#1769aa] hover:underline whitespace-nowrap"
            >
              {tr('Усі', 'Все')} {projects.length} {tr('об’єктів', 'объектов')} →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visibleCases.map((c) => (
              <article
                key={c.id}
                onClick={() => onSelectCase(c)}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="relative h-48 bg-[#0d1f33]">
                  <SmartImage src={c.img} alt={isRussian ? c.titleRu ?? c.title : c.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[11px] font-bold text-white">
                    {isRussian ? c.tagRu ?? c.tag : c.tag}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0d1f33] mb-1">{isRussian ? c.titleRu ?? c.title : c.title}</h3>
                    <p className="text-xs text-[#52657a] line-clamp-2 leading-relaxed">{c.task}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#0d1f33] truncate">{isRussian ? c.specsRu ?? c.specs : c.specs}</span>
                    <span className="text-[#1769aa] shrink-0">{tr('Деталі')} →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process & FAQ */}
      <section className="py-16 bg-gradient-to-br from-[#eff6fc] via-white to-[#f6f8fb] border-t border-slate-200">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#1769aa]/15 bg-white px-3 py-1 text-xs font-extrabold text-[#1769aa]">
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> {tr('Порядок співпраці')}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33]">
                {tr('Як ми працюємо: від розрахунку до запуску')}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[#52657a]">
              {tr('Один інженерний маршрут — від першої розмови до системи, готової до роботи.', 'Один понятный путь — от первого разговора до готовой к работе системы.')}
            </p>
          </div>

          <div className="relative mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-6 hidden h-px bg-gradient-to-r from-[#1769aa]/10 via-[#1769aa]/40 to-[#f59e0b]/50 lg:block" />
            {[
              {
                number: '01',
                title: 'Консультація',
                desc: 'Уточнюємо вашу задачу, прилади та тип електромережі.',
                detail: 'Знайомимось із вашим об’єктом',
                Icon: PhoneCall,
              },
              {
                number: '02',
                title: 'Розрахунок і проєкт',
                desc: 'Підбираємо сумісне обладнання та готуємо зрозумілий кошторис.',
                detail: 'Погоджуємо конфігурацію',
                Icon: Calculator,
              },
              {
                number: '03',
                title: 'Поставка і монтаж',
                desc: 'Комплектуємо систему та встановлюємо її на об’єкті.',
                detail: 'Працюємо за погодженим планом',
                Icon: Truck,
              },
              {
                number: '04',
                title: 'Запуск і сервіс',
                desc: 'Перевіряємо систему, налаштовуємо моніторинг і гарантійний супровід.',
                detail: 'Передаємо готову систему',
                Icon: Zap,
              },
            ].map(({ number, title, desc, detail, Icon }) => (
              <article
                key={number}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#1769aa]/35 hover:shadow-lg"
              >
                <div className="relative mb-5 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6fc] text-[#1769aa] ring-4 ring-white transition-colors group-hover:bg-[#1769aa] group-hover:text-white">
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-slate-200 group-hover:text-[#1769aa]/25">
                    {number}
                  </span>
                </div>
                <h3 className="mb-2 text-base font-extrabold text-[#0d1f33]">{tr(title)}</h3>
                <p className="min-h-12 text-xs leading-relaxed text-[#52657a]">{tr(desc)}</p>
                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-[11px] font-bold text-[#1769aa]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> {tr(detail)}
                </div>
              </article>
            ))}
          </div>

          <div className="mb-12 flex flex-col gap-4 rounded-2xl bg-[#0d1f33] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <p className="font-extrabold">{tr('Є питання щодо вашого об’єкта?', 'Есть вопросы по вашему объекту?')}</p>
              <p className="mt-1 text-xs text-slate-300">{tr('Почнемо з короткої консультації та підкажемо наступний крок.', 'Начнём с короткой консультации и подскажем следующий шаг.')}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLeadModal('Консультація щодо вашого об’єкта')}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#f59e0b] px-4 text-sm font-extrabold text-[#0d1f33] transition-colors hover:bg-[#fbbf24]"
            >
              {tr('Обговорити проєкт')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-extrabold text-[#0d1f33]">{tr('Відповіді на часті питання')}</h3>
              <span className="text-xs text-[#52657a]">{tr('Щоб простіше було зробити перший крок')}</span>
            </div>
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="border-b border-slate-200 last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-3.5 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
                  >
                    <span>{tr(item.q)}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-[13px] text-[#52657a] leading-relaxed">{tr(item.a)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Engineering Brief -> Direct CRM & Telegram */}
      <section id="home-request" className="bg-[#0d1f33] text-white py-14">
        <div className="max-w-[1180px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-12 gap-9 items-start">
          <div className="lg:col-span-5">
            <div className="text-xs font-extrabold text-[#f59e0b] mb-2">{tr('Швидкий інженерний бриф', 'Краткий бриф для инженера')}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
              {tr('Отримайте інженерний розрахунок під ваш оЀѢєкт', 'Получите инженерный расчёт для вашего объекта')}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {tr('Заявка автоматично створює картку угоди у вбудованій CRM Energo Comfort та надсилає сповіщення менеджеру у Telegram.', 'Заявка автоматически создаёт сделку во встроенной CRM Energo Comfort и отправляет уведомление менеджеру в Telegram.')}
            </p>
            <ul className="space-y-2 text-xs text-slate-200">
              <li>→ {tr('Офіс:', 'Офис:')} {tr(COMPANY_INFO.address, 'Украина, г. Одесса, ул. Европейская, 93')}</li>
              <li>
                → {tr('Телефони:', 'Телефоны:')} {COMPANY_INFO.phone1} · {COMPANY_INFO.phone2}
              </li>
              <li>→ Email: {COMPANY_INFO.email}</li>
            </ul>
          </div>

          <form
            onSubmit={handleBriefSubmit}
            onFocus={() => {
              if (!briefFormStarted.current) {
                briefFormStarted.current = true;
                track({ name: 'form_start', placement: 'section', scenario: getFormScenario(taskType) });
              }
            }}
            className="lg:col-span-7 bg-white/[0.06] border border-white/15 rounded-2xl p-6 space-y-4"
          >
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Тип задачі', 'Тип задачи')}</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                >
                  <option value="Резервне живлення (квартира / дім)">{tr('Резервне живлення (квартира / дім)', 'Резервное питание (квартира / дом)')}</option>
                  <option value="Сонячна електростанція для дому">{tr('Сонячна електростанція для дому', 'Солнечная электростанция для дома')}</option>
                  <option value="Рішення для бізнесу / СТО (380 В)">{tr('Рішення для бізнесу / СТО (380 В)', 'Решение для бизнеса / СТО (380 В)')}</option>
                  <option value="Підбір комплектуючих із каталогу">{tr('Підбір комплектуючих із каталогу', 'Подбор комплектующих из каталога')}</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Район або місто', 'Район или город')}</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-sky-200 mb-1.5">{tr('Критичні прилади')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Газовий котел', 'Холодильник', 'Насос води', 'Кондиціонер'].map((item) => {
                  const checked = loads.includes(item);
                  return (
                    <label
                      key={item}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                          : 'bg-[#0d1f33]/60 border-white/15 text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLoad(item)}
                        className="accent-[#f59e0b]"
                      />
                      <span className="truncate">{tr(item)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Ваше ім’я')}</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={tr('Олексій', 'Алексей')}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Телефон *', 'Телефон *')}</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+38 (0__) ___-__-__"
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Канал зв’язку', 'Канал связи')}</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="Viber">Viber</option>
                  <option value="Телефон">{tr('Дзвінок')}</option>
                </select>
              </div>
            </div>

            {formError && <div className="text-xs font-semibold text-red-300">{formError}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-[#0d1f33] hover:text-white text-sm font-extrabold transition-colors cursor-pointer"
            >
              {submitting ? tr('Створюємо угоду в CRM...', 'Создаём сделку в CRM…') : tr('Надіслати інженеру та отримати розрахунок', 'Отправить инженеру и получить расчёт')}
            </button>

            {createdBrief && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    {tr('Угоду', 'Сделка')} <strong className="font-mono">{createdBrief.dealNumber}</strong> {tr('створено у CRM (', 'создана в CRM (')}
                    {createdBrief.taskType}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenCrm}
                  className="px-3 py-1.5 rounded-md bg-white text-[#0d1f33] font-bold hover:bg-slate-100 cursor-pointer"
                >
                  {tr('Відкрити в CRM →', 'Открыть в CRM →')}
                </button>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
