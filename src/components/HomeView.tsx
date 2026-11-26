import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Calculator,
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
import { BRAND_PARTNERS, COMPANY_INFO } from '../data/siteContent.ts';
import { ProductCard } from './ProductCard.tsx';
import { SmartImage } from './SmartImage.tsx';
import { HowItWorks } from './HowItWorks.tsx';
import { FaqSection } from './FaqSection.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { getAttributionSummary, resolveAnalyticsMoney, track, trackEvent, type Property, type Scenario } from '../lib/analytics.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import {
  calculateSolarPayback,
  DEFAULT_BUSINESS_TARIFF_UAH,
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  ODESA_ANNUAL_YIELD_PER_KW,
  type PaybackSystemMode,
} from '../lib/calculators.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';

interface HomeViewProps {
  products: Product[];
  projects: ProjectCase[];
  telegramUrl?: string;
  isStaff?: boolean;
  wishlistIds?: string[];
  compareIds?: string[];
  onNavigateShop: (cat?: ProductCategory | 'all') => void;
  onNavigateServices: () => void;
  onNavigateProjects: () => void;
  onOpenLeadModal: (
    topic: string,
    estimatedTotalUsd?: number,
    placement?: 'hero' | 'sticky' | 'section' | 'footer',
    initialNotes?: string,
  ) => void;
  onSelectProduct: (product: Product) => void;
  onQuickViewProduct?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onToggleCompare?: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onCalculatePayback?: (product: Product) => void;
  onSelectCase: (project: ProjectCase) => void;
  onLeadCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
  usdUahRate: number | null;
}

type ShowcaseTab = 'backup-kits' | 'solar-kits' | 'hardware';

const HOME_VIDEO_SEGMENTS = {
  hero: { start: 0, end: 6, tint: 'sky' },
  brands: { start: 6, end: 11, tint: 'daylight' },
  calculator: { start: 17, end: 23, tint: 'azure' },
  showcase: { start: 23, end: 29, tint: 'cobalt' },
  audit: { start: 29, end: 35, tint: 'indigo' },
  projects: { start: 35, end: 41, tint: 'sapphire' },
  process: { start: 41, end: 47, tint: 'ocean' },
  brief: { start: 53, end: 59, tint: 'sky' },
} as const;

const isKitProduct = (p: Product) => p.isKit || p.cat === 'kits';
const isSolarKitProduct = (p: Product) => {
  const titleLower = p.title.toLowerCase();
  return titleLower.includes('сес') || titleLower.includes('соняч');
};

export function HomeView({
  products,
  projects,
  telegramUrl,
  isStaff = false,
  wishlistIds = [],
  compareIds = [],
  onNavigateShop,
  onNavigateServices,
  onNavigateProjects,
  onOpenLeadModal,
  onSelectProduct,
  onQuickViewProduct,
  onToggleWishlist,
  onToggleCompare,
  onAddToCart,
  onCalculatePayback,
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

  const safeHeroIdx = projects.length > 0 ? ((heroIdx % projects.length) + projects.length) % projects.length : 0;
  const activeHeroCase = projects[safeHeroIdx];

  useEffect(() => {
    if (heroPaused || projects.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % projects.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroPaused, projects.length]);

  // Payback Calculator state
  const [monthlyKwh, setMonthlyKwh] = useState(600);
  const [calcTariffType, setCalcTariffType] = useState<'home' | 'business'>('home');
  const [calcSystemMode, setCalcSystemMode] = useState<PaybackSystemMode>('hybrid');
  const [tariffUah, setTariffUah] = useState(DEFAULT_RESIDENTIAL_TARIFF_UAH);

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
  const calcTrackedRef = useRef(false);

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

  const { backupKits, solarKits, popularHardware, fallbackKits } = useMemo(() => {
    const allKits = products.filter(isKitProduct);
    const backupCandidates = allKits.filter((p) => !isSolarKitProduct(p));
    const solarCandidates = allKits.filter(isSolarKitProduct);
    return {
      backupKits: [
        ...backupCandidates.filter((p) => p.price > 0),
        ...backupCandidates.filter((p) => p.price <= 0),
      ].slice(0, 3),
      solarKits: [
        ...solarCandidates.filter((p) => p.price > 0),
        ...solarCandidates.filter((p) => p.price <= 0),
      ].slice(0, 3),
      popularHardware: products
        .filter(
          (p) =>
            !p.isKit &&
            p.price > 0 &&
            (p.cat === 'inverters' || p.cat === 'batteries') &&
            (p.brand === 'Deye' || p.brand === 'SolaX'),
        )
        .slice(0, 3),
      fallbackKits: allKits.slice(0, 3),
    };
  }, [products]);

  const activeShowcase =
    showcaseTab === 'backup-kits'
      ? backupKits.length
        ? backupKits
        : fallbackKits
      : showcaseTab === 'solar-kits'
        ? solarKits.length
          ? solarKits
          : fallbackKits
        : popularHardware;

  const showcaseGridClass =
    activeShowcase.length === 1
      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
      : activeShowcase.length === 2
        ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
        : 'grid grid-cols-1 md:grid-cols-3 gap-6';

  const visibleCases = useMemo(
    () => projects.filter((p) => caseSeg === 'all' || p.seg === caseSeg).slice(0, 6),
    [projects, caseSeg],
  );

  // Payback Calculator math (PVGIS Odesa ~1230 kWh/year per 1 kW PV + self-consumption & Net Billing)
  const payback = useMemo(
    () =>
      calculateSolarPayback({
        monthlyKwh,
        tariffType: calcTariffType,
        systemMode: calcSystemMode,
        tariffUah,
        usdUahRate,
        products,
      }),
    [monthlyKwh, calcTariffType, calcSystemMode, tariffUah, usdUahRate, products],
  );
  const {
    safeMonthlyKwh,
    safeTariffUah,
    recommendedKw,
    estimatedAnnualGenKwh,
    annualSavingsUah,
    monthlySavingsUah,
    coveragePct,
    directSelfPct,
    matchedProducts: matchedCalculatorProducts,
    primaryKit: primaryCalcKit,
    indicativeCapexUah,
    paybackMonths,
  } = payback;

  const calcGridClass =
    matchedCalculatorProducts.length === 1
      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
      : matchedCalculatorProducts.length === 2
        ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
        : 'grid grid-cols-1 md:grid-cols-3 gap-6';

  function toggleLoad(val: string) {
    setLoads((prev) => (prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]));
  }

  async function handleBriefSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const scenario = getFormScenario(taskType);
    if (!isValidUaPhone(phone)) {
      setFormError(
        tr('Вкажіть номер телефону у форматі +380 XX XXX XX XX', 'Укажите номер телефона в формате +380 XX XXX XX XX'),
      );
      track({ name: 'form_error', field: 'phone', placement: 'section', scenario });
      return;
    }
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
          attribution: getAttributionSummary(),
          consent: true,
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setFormError(data.error || tr('Помилка відправки заявки', 'Ошибка отправки заявки'));
        track({ name: 'form_error', field: 'phone', placement: 'section', scenario });
      } else {
        setCreatedBrief(data.deal);
        const leadMoney = resolveAnalyticsMoney(0, usdUahRate);
        track({ name: 'lead_submit', property: getFormProperty(taskType), placement: 'section', scenario });
        trackEvent('generate_lead', {
          lead_topic: taskType,
          placement: 'section',
          scenario,
          value: leadMoney.value,
          currency: leadMoney.currency,
        });
        onLeadCreated(data.deal);
        setPhone('');
        setCustomerName('');
      }
    } catch {
      setFormError(
        tr(
          'Сервер заявок зараз недоступний. Зателефонуйте нам напряму: +38 (050) 777-71-72.',
          'Сервер заявок временно недоступен. Позвоните нам напрямую: +38 (050) 777-71-72.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Hero + 3-Scenario Fork */}
      <section className="relative overflow-hidden isolate border-b border-sky-200/45 py-10 sm:py-12">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.hero.tint}
          start={HOME_VIDEO_SEGMENTS.hero.start}
          end={HOME_VIDEO_SEGMENTS.hero.end}
          autoPlay
          loop
          muted
          playsInline
          brightness={0.56}
        />
        <div className="relative ec-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-center ec-glass-plate rounded-2xl p-6 sm:p-7 break-words hyphens-auto">
              <div className="text-xs font-extrabold text-[#0b66b2] uppercase tracking-wider mb-2.5">
                {tr('Резервне живлення · Сонячні електростанції · Одеса')}
              </div>
              <h1 className="text-[clamp(1.85rem,3.6vw,2.65rem)] font-extrabold text-[#07213e] leading-[1.2] tracking-normal mb-4 max-w-2xl">
                {tr('Сонячні електростанції та резервне живлення', 'Солнечные электростанции и резервное питание')}{' '}
                <span className="text-[#0b66b2]">{tr('в Одесі та області під ключ', 'в Одессе и области под ключ')}</span>
              </h1>
              <p className="text-[15px] text-[#1c3d5e] font-medium leading-relaxed mb-6 max-w-xl">
                {tr('Проєктування, офіційне постачання обладнання (Deye, SolaX, Solis, Dyness, Trina) та сертифікований монтаж «під ключ» з гарантією в Одесі та області.', 'Проектирование, официальные поставки оборудования (Deye, SolaX, Solis, Dyness, Trina) и сертифицированный монтаж под ключ с гарантией в Одессе и области.')}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    track({ name: 'cta_click', placement: 'hero', scenario: 'unspecified' });
                    onOpenLeadModal('Безкоштовний розрахунок системи з першого екрана', undefined, 'hero');
                  }}
                  className="inline-flex min-h-12 items-center gap-2 px-5 py-3 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07213e] text-sm font-extrabold transition-colors whitespace-nowrap cursor-pointer shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07213e]"
                >
                  {tr('Замовити розрахунок', 'Заказать расчёт')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={COMPANY_INFO.phone1Href}
                  onClick={() => track({ name: 'phone_click', placement: 'hero', scenario: 'unspecified' })}
                  className="inline-flex min-h-12 items-center gap-2 px-4 py-3 rounded-xl bg-white/80 hover:bg-white border border-sky-200/80 text-[#07213e] text-sm font-bold transition-colors whitespace-nowrap shadow-xs"
                >
                  <PhoneCall className="w-4 h-4 text-[#0b66b2]" />
                  {tr('Подзвонити', 'Позвонить')}
                </a>
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      track({ name: 'messenger_click', placement: 'hero', scenario: 'unspecified', channel: 'telegram' });
                    }}
                    className="inline-flex min-h-12 items-center gap-1.5 px-4 py-3 rounded-xl border border-[#0b66b2]/25 bg-[#e6f2fc]/90 hover:bg-[#d7ebfb] text-[#0b66b2] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {tr('Telegram')}
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-4 border-t border-sky-200/75 text-xs font-bold text-[#07213e]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#0d9488]" strokeWidth={2.5} />
                  {tr('Підбір за вашим сценарієм', 'Подбор под ваш сценарий')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#0d9488]" strokeWidth={2.5} />
                  {tr('Офіс в Одесі · Європейська, 93', 'Офис в Одессе · Европейская, 93')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#0d9488]" strokeWidth={2.5} />
                  {tr('Deye · SolaX · Solis', 'Deye · SolaX · Solis')}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 flex items-stretch">
              {activeHeroCase && (
                <div
                  className="relative w-full min-h-[310px] sm:min-h-[340px] h-full rounded-2xl overflow-hidden border border-white/60 bg-[#07213e] shadow-xl group"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-[#041830]/90 via-[#041830]/25 to-[#041830]/15 flex flex-col justify-between p-5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#07213e]/75 backdrop-blur-sm border border-sky-200/25 text-[11px] font-bold text-sky-100">
                          {isRussian ? activeHeroCase.tagRu ?? activeHeroCase.tag : activeHeroCase.tag}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#07213e]/75 backdrop-blur-sm border border-sky-200/25 font-mono text-[11px] font-bold text-white tabular-nums">
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
                          {tr('Деталі')} →
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
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#07213e]/75 hover:bg-[#0b66b2] text-white border border-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-md"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#07213e]/75 hover:bg-[#0b66b2] text-white border border-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-md"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch break-words hyphens-auto">
            <div className="ec-glass-sapphire rounded-2xl p-6 flex flex-col justify-between gap-4 h-full min-w-0 hover:border-sky-300/60 transition-colors">
              <div>
                <div className="text-xs font-bold text-sky-200 mb-1.5">{tr('01. Квартира та дім', '01. Квартира и дом')}</div>
                <h3 className="text-[17px] font-extrabold text-white mb-2">{tr('Резервне живлення', 'Резервное питание')}</h3>
                <p className="text-[13px] text-sky-50/90 leading-[1.6]">
                  {tr('Інвертор + АКБ LiFePO4: котел, холодильник, роутер та світло працюють автоматично при блекауті.', 'Инвертор и аккумулятор LiFePO4 автоматически обеспечивают питание котла, холодильника, роутера и освещения при отключении света.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowcaseTab('backup-kits');
                  document.getElementById('home-kits')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-extrabold text-[#fbbf24] hover:underline text-left cursor-pointer pt-2 border-t border-sky-200/15"
              >
                {tr('Дивитись комплекти 5–10 кВт →', 'Посмотреть комплекты 5–10 кВт →')}
              </button>
            </div>

            <div className="ec-glass-sapphire rounded-2xl p-6 flex flex-col justify-between gap-4 h-full min-w-0 hover:border-sky-300/60 transition-colors">
              <div>
                <div className="text-xs font-bold text-sky-200 mb-1.5">{tr('02. Приватний сектор', '02. Частный сектор')}</div>
                <h3 className="text-[17px] font-extrabold text-white mb-2">{tr('Сонячні станції (СЕС)', 'Солнечные электростанции')}</h3>
                <p className="text-[13px] text-sky-50/90 leading-[1.6]">
                  {tr('Гібридні та мережеві рішення 6–12 кВт із оформленням «активного споживача» та гарантією монтажу.', 'Гибридные и сетевые решения 6–12 кВт с оформлением статуса активного потребителя и гарантией на монтаж.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowcaseTab('solar-kits');
                  document.getElementById('home-kits')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-extrabold text-[#fbbf24] hover:underline text-left cursor-pointer pt-2 border-t border-sky-200/15"
              >
                {tr('Дивитись готові СЕС →', 'Посмотреть готовые СЭС →')}
              </button>
            </div>

            <div className="ec-glass-sapphire rounded-2xl p-6 flex flex-col justify-between gap-4 h-full min-w-0 hover:border-sky-300/60 transition-colors">
              <div>
                <div className="text-xs font-bold text-sky-200 mb-1.5">{tr('03. Бізнес 380 В і магазин', '03. Бизнес 380 В и магазин')}</div>
                <h3 className="text-[17px] font-extrabold text-white mb-2">{tr('Станції 30–110 кВт та каталог', 'Станции 30–110 кВт и каталог')}</h3>
                <p className="text-[13px] text-sky-50/90 leading-[1.6]">
                  {tr('Рішення для СТО, готелів, заводів або окремі інвертори, панелі й АКБ зі складу в Одесі.', 'Решения для СТО, гостиниц и заводов, а также отдельные инверторы, панели и аккумуляторы со склада в Одессе.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateShop('inverters')}
                className="text-xs font-extrabold text-[#fbbf24] hover:underline text-left cursor-pointer pt-2 border-t border-sky-200/15"
              >
                {tr('Відкрити каталог обладнання →', 'Открыть каталог оборудования →')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Official Brand Partners */}
      <section className="relative overflow-hidden isolate border-b border-sky-200/45 py-6">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.brands.tint}
          start={HOME_VIDEO_SEGMENTS.brands.start}
          end={HOME_VIDEO_SEGMENTS.brands.end}
          brightness={0.56}
        />
        <div className="relative ec-container">
          <div className="ec-glass-plate rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#07213e] shrink-0 whitespace-nowrap">
              {tr('Офіційні бренди обладнання')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
              {BRAND_PARTNERS.map((b) => (
                <div
                  key={b.name}
                  title={b.name}
                  className="h-14 px-3 rounded-xl border border-sky-100/90 bg-white/85 flex items-center justify-center overflow-hidden"
                >
                  <SmartImage
                    src={b.logo}
                    alt={`${b.name} — офіційне обладнання Energo Comfort`}
                    loading="lazy"
                    className={`${b.sizeClass} object-contain`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 3D How It Works Section */}
      <HowItWorks onOpenLeadModal={onOpenLeadModal} />

      {/* Payback Calculator + Matched Catalog Solutions */}
      <section id="payback-calculator" className="relative overflow-hidden isolate ec-section border-b border-sky-200/45">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.calculator.tint}
          start={HOME_VIDEO_SEGMENTS.calculator.start}
          end={HOME_VIDEO_SEGMENTS.calculator.end}
          brightness={0.54}
        />
        <div className="relative ec-container break-words hyphens-auto">
          <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">
                <Calculator className="w-3.5 h-3.5" />
                <span>{tr('Онлайн-підбір за вашим лічильником', 'Онлайн-подбор по вашему счётчику')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-2">
                {tr('Калькулятор окупності СЕС', 'Калькулятор окупаемости СЭС')}
              </h2>
              <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed">
                {tr(
                  'Вкажіть середньомісячне споживання у кВт·год, щоб оцінити річну економію, орієнтовну окупність та побачити сумісні комплекти з каталогу.',
                  'Укажите среднемесячное потребление в кВт·ч, чтобы оценить годовую экономию, ориентировочную окупаемость и подобрать комплекты из каталога.',
                )}
              </p>
            </div>
            <div className="inline-flex p-1 bg-sky-100/80 border border-sky-200/80 rounded-xl self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCalcTariffType('home');
                  setCalcSystemMode('hybrid');
                  setTariffUah(DEFAULT_RESIDENTIAL_TARIFF_UAH);
                  if (!calcTrackedRef.current) {
                    calcTrackedRef.current = true;
                    trackEvent('calculator_used', { tariff_type: 'home', monthly_kwh: safeMonthlyKwh, recommended_kw: recommendedKw });
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  calcTariffType === 'home' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Дім / Квартира (4.32 ₴)', 'Дом / Квартира (4.32 ₴)')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalcTariffType('business');
                  setCalcSystemMode('ongrid');
                  setTariffUah(DEFAULT_BUSINESS_TARIFF_UAH);
                  if (!calcTrackedRef.current) {
                    calcTrackedRef.current = true;
                    trackEvent('calculator_used', { tariff_type: 'business', monthly_kwh: safeMonthlyKwh, recommended_kw: recommendedKw });
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  calcTariffType === 'business' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Бізнес 380 В (9.60 ₴)', 'Бизнес 380 В (9.60 ₴)')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
            <div className="lg:col-span-5 ec-glass-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label htmlFor="calc-monthly-kwh" className="text-xs font-extrabold text-[#07213e]">
                      {tr('Середньомісячне споживання (кВт·год)', 'Среднемесячное потребление (кВт·ч)')}
                    </label>
                    <span className="font-mono text-sm font-extrabold text-[#0b66b2] tabular-nums">
                      {safeMonthlyKwh.toLocaleString('uk-UA')} {tr('кВт·год/міс', 'кВт·ч/мес')}
                    </span>
                  </div>
                  <input
                    id="calc-monthly-kwh"
                    name="monthlyKwh"
                    type="number"
                    min={50}
                    max={50000}
                    step={50}
                    value={monthlyKwh}
                    onChange={(e) => {
                      const nextVal = Number(e.target.value) || 0;
                      setMonthlyKwh(nextVal);
                      if (!calcTrackedRef.current) {
                        calcTrackedRef.current = true;
                        trackEvent('calculator_used', { tariff_type: calcTariffType, monthly_kwh: nextVal, recommended_kw: recommendedKw });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sky-200 bg-white/85 font-mono text-base font-bold text-[#07213e] focus:outline-none focus:border-[#0b66b2] mb-3"
                  />
                  <input
                    type="range"
                    aria-label={tr('Регулятор споживання у кВт·год на місяць', 'Регулятор потребления в кВт·ч в месяц')}
                    min={100}
                    max={6000}
                    step={50}
                    value={Math.min(6000, Math.max(100, safeMonthlyKwh))}
                    onChange={(e) => {
                      const nextVal = Number(e.target.value);
                      setMonthlyKwh(nextVal);
                      if (!calcTrackedRef.current) {
                        calcTrackedRef.current = true;
                        trackEvent('calculator_used', { tariff_type: calcTariffType, monthly_kwh: nextVal, recommended_kw: recommendedKw });
                      }
                    }}
                    className="w-full accent-[#0b66b2] cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {[300, 600, 1000, 2500, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setMonthlyKwh(preset);
                          if (!calcTrackedRef.current) {
                            calcTrackedRef.current = true;
                            trackEvent('calculator_used', { tariff_type: calcTariffType, monthly_kwh: preset, recommended_kw: recommendedKw });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                          safeMonthlyKwh === preset
                            ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#0b66b2]'
                            : 'bg-white/75 border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                        }`}
                      >
                        {preset.toLocaleString('uk-UA')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-extrabold text-[#07213e] mb-1.5">
                    {tr('Тип станції', 'Тип станции')}
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCalcSystemMode('hybrid')}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-colors cursor-pointer ${
                        calcSystemMode === 'hybrid'
                          ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                          : 'bg-white/75 border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                      }`}
                    >
                      <div>{tr('Гібридна з АКБ', 'Гибридная с АКБ')}</div>
                      <div className="text-[10px] font-medium text-[#1c3d5e]/75">
                        {tr('Резерв + вечір', 'Резерв + вечер')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcSystemMode('ongrid')}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-colors cursor-pointer ${
                        calcSystemMode === 'ongrid'
                          ? 'bg-[#e6f2fc] border-[#0b66b2] text-[#07213e]'
                          : 'bg-white/75 border-sky-200/80 text-[#1c3d5e] hover:border-sky-300'
                      }`}
                    >
                      <div>{tr('Мережева (без АКБ)', 'Сетевая (без АКБ)')}</div>
                      <div className="text-[10px] font-medium text-[#1c3d5e]/75">
                        {tr('Швидша окупність', 'Быстрее окупаемость')}
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="calc-tariff" className="block text-xs font-extrabold text-[#07213e] mb-1.5">
                    {tr('Ваш тариф на електроенергію (грн/кВт·год)', 'Ваш тариф на электроэнергию (грн/кВт·ч)')}
                  </label>
                  <input
                    id="calc-tariff"
                    name="tariffUah"
                    type="number"
                    min={1}
                    max={30}
                    step={0.1}
                    value={tariffUah}
                    onChange={(e) => setTariffUah(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sky-200 bg-white/85 font-mono text-sm font-bold text-[#07213e] focus:outline-none focus:border-[#0b66b2]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#1c3d5e] font-medium leading-relaxed pt-3 border-t border-sky-200/75">
                {tr(
                  `Розрахунок за даними PVGIS для Одеси (~${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·год/рік з 1 кВт панелей) з урахуванням прямого споживання (${directSelfPct}%) та заліку надлишків за Net Billing, без урахування інфляції тарифів.`,
                  `Расчёт по данным PVGIS для Одессы (~${ODESA_ANNUAL_YIELD_PER_KW.toLocaleString('uk-UA')} кВт·ч/год с 1 кВт панелей) с учётом прямого потребления (${directSelfPct}%) и зачёта излишков по Net Billing, без учёта инфляции тарифов.`,
                )}
              </p>
            </div>

            <div className="lg:col-span-7 ec-glass-sapphire text-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs font-bold text-[#fbbf24] uppercase tracking-wider mb-2">
                  {tr('Орієнтовний результат для вашого споживання', 'Ориентировочный результат для вашего потребления')}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3">
                  <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                    <div className="text-[11px] text-sky-100/85 mb-1">{tr('Потужність СЕС', 'Мощность СЭС')}</div>
                    <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                      {recommendedKw} {tr('кВт', 'кВт')}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                    <div className="text-[11px] text-sky-100/85 mb-1">{tr('Економія / місяць', 'Экономия / месяц')}</div>
                    <div className="font-mono text-xl font-extrabold text-emerald-300 tabular-nums">
                      ~{monthlySavingsUah.toLocaleString('uk-UA')} ₴
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                    <div className="text-[11px] text-sky-100/85 mb-1">{tr('Вигода за рік', 'Выгода за год')}</div>
                    <div className="font-mono text-xl font-extrabold text-[#fbbf24] tabular-nums">
                      ~{annualSavingsUah.toLocaleString('uk-UA')} ₴
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-sky-200/20 p-3.5">
                    <div className="text-[11px] text-sky-100/85 mb-1">{tr('Окупність (орієнт.)', 'Окупаемость (ориент.)')}</div>
                    <div className="font-mono text-xl font-extrabold text-sky-200 tabular-nums">
                      {paybackMonths ? `~${paybackMonths} ${tr('міс.', 'мес.')}` : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sky-100">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
                    {tr('Генерація станції:', 'Генерация станции:')}{' '}
                    <strong className="font-mono text-white">~{estimatedAnnualGenKwh.toLocaleString('uk-UA')} {tr('кВт·год/рік', 'кВт·ч/год')}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    {tr('Покриття споживання:', 'Покрытие потребления:')}{' '}
                    <strong className="font-mono text-white">{coveragePct}%</strong>
                  </span>
                  {indicativeCapexUah && (
                    <span className="inline-flex items-center gap-1.5 text-sky-100/90">
                      {tr('База окупності:', 'База окупаемости:')}{' '}
                      <strong className="font-mono text-white">~{indicativeCapexUah.toLocaleString('uk-UA')} ₴</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-sky-200/15">
                <span className="text-xs text-sky-100/85 max-w-md">
                  {tr(
                    'Інженер перевірить ваш щит, фазність (220/380 В) та підготує точний кошторис із фіксацією ціни.',
                    'Инженер проверит ваш щит, фазность (220/380 В) и подготовит точную смету с фиксацией цены.',
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const summaryNote = [
                      `${tr('Споживання', 'Потребление')}: ${safeMonthlyKwh} ${tr('кВт·год/міс', 'кВт·ч/мес')}`,
                      `${tr('Тариф', 'Тариф')}: ${safeTariffUah} грн/кВт·год (${calcTariffType === 'business' ? tr('Бізнес 380 В', 'Бизнес 380 В') : tr('Дім / Квартира', 'Дом / Квартира')}) · ${calcSystemMode === 'hybrid' ? tr('Гібридна з АКБ', 'Гибридная с АКБ') : tr('Мережева без АКБ', 'Сетевая без АКБ')}`,
                      `${tr('Рекомендована СЕС', 'Рекомендованная СЭС')}: ${recommendedKw} кВт (~${annualSavingsUah.toLocaleString('uk-UA')} грн/рік${paybackMonths ? `, ${tr('окупність', 'окупаемость')} ~${paybackMonths} ${tr('міс.', 'мес.')}` : ''})`,
                      primaryCalcKit ? `${tr('Підібраний комплект', 'Подобранный комплект')}: ${primaryCalcKit.title} (SKU ${primaryCalcKit.sku}, ${formatUahFromUsd(primaryCalcKit.price, usdUahRate)})` : '',
                    ]
                      .filter(Boolean)
                      .join('\n');
                    track({ name: 'cta_click', placement: 'section', scenario: 'solar' });
                    trackEvent('calculator_used', { tariff_type: calcTariffType, monthly_kwh: safeMonthlyKwh, recommended_kw: recommendedKw, submitted: true });
                    onOpenLeadModal(
                      `Калькулятор окупності: СЕС ${recommendedKw} кВт (${safeMonthlyKwh} кВт·год/міс)`,
                      indicativeCapexUah && usdUahRate ? Math.round(indicativeCapexUah / usdUahRate) : primaryCalcKit?.price,
                      'section',
                      summaryNote,
                    );
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07213e] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr('Отримати точний кошторис', 'Получить точную смету')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {matchedCalculatorProducts.length > 0 && (
            <div>
              <div className="ec-glass-plate rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-[#07213e]">
                  {tr('Підібрані комплекти та рішення з каталогу під', 'Подобранные комплекты и решения из каталога под')}{' '}
                  <span className="text-[#0b66b2]">{recommendedKw} кВт</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateShop(recommendedKw <= 15 ? 'kits' : 'inverters')}
                  className="text-xs font-extrabold text-[#0b66b2] hover:underline cursor-pointer"
                >
                  {tr('Переглянути всі рішення →', 'Посмотреть все решения →')}
                </button>
              </div>
              <div className={calcGridClass}>
                {matchedCalculatorProducts.map((prod) => (
                  <ProductCard
                    usdUahRate={usdUahRate}
                    key={`calc-${prod.id}`}
                    product={prod}
                    onSelect={onSelectProduct}
                    onQuickView={onQuickViewProduct}
                    isWishlisted={wishlistIds.includes(prod.id)}
                    onToggleWishlist={onToggleWishlist}
                    isCompared={compareIds.includes(prod.id)}
                    onToggleCompare={onToggleCompare}
                    onAddToCart={onAddToCart}
                    onCalculatePayback={onCalculatePayback}
                    onRequestQuote={(p) =>
                      onOpenLeadModal(
                        `Розрахунок (${recommendedKw} кВт): ${p.title}`,
                        p.price,
                        'section',
                        `${tr('Споживання', 'Потребление')}: ${safeMonthlyKwh} ${tr('кВт·год/міс', 'кВт·ч/мес')} · ${tr('Тариф', 'Тариф')}: ${safeTariffUah} грн`,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured Solutions & Hardware Showcase */}
      <section id="home-kits" className="relative overflow-hidden isolate ec-section">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.showcase.tint}
          start={HOME_VIDEO_SEGMENTS.showcase.start}
          end={HOME_VIDEO_SEGMENTS.showcase.end}
          brightness={0.54}
        />
        <div className="relative ec-container break-words hyphens-auto">
          <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-6 flex flex-col gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">{tr('Рішення та обладнання')}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-1.5">
                {tr('Популярні конфігурації та комплектуючі')}
              </h2>
              <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed max-w-3xl">
                {tr('Готові комплекти з інженерним підбором під ваше навантаження, а також окремі інвертори та акумулятори зі складу в Одесі.', 'Готовые комплекты с инженерным подбором под вашу нагрузку, а также отдельные инверторы и аккумуляторы со склада в Одессе.')}
              </p>
            </div>

            <div className="inline-flex flex-wrap gap-1 p-1 bg-sky-100/80 border border-sky-200/80 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setShowcaseTab('backup-kits')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  showcaseTab === 'backup-kits'
                    ? 'bg-[#0b66b2] text-white shadow-sm'
                    : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Готові системи резерву', 'Готовые системы резервного питания')}
              </button>
              <button
                type="button"
                onClick={() => setShowcaseTab('solar-kits')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  showcaseTab === 'solar-kits'
                    ? 'bg-[#0b66b2] text-white shadow-sm'
                    : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Готові СЕС з панелями', 'Готовые СЭС с панелями')}
              </button>
              <button
                type="button"
                onClick={() => setShowcaseTab('hardware')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  showcaseTab === 'hardware'
                    ? 'bg-[#0b66b2] text-white shadow-sm'
                    : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Популярні інвертори та АКБ', 'Популярные инверторы и аккумуляторы')}
              </button>
            </div>
          </div>

          <div className={showcaseGridClass}>
            {activeShowcase.map((prod) => (
              <ProductCard
                usdUahRate={usdUahRate}
                key={prod.id}
                product={prod}
                onSelect={onSelectProduct}
                onQuickView={onQuickViewProduct}
                isWishlisted={wishlistIds.includes(prod.id)}
                onToggleWishlist={onToggleWishlist}
                isCompared={compareIds.includes(prod.id)}
                onToggleCompare={onToggleCompare}
                onAddToCart={onAddToCart}
                onCalculatePayback={onCalculatePayback}
                onRequestQuote={(p) => onOpenLeadModal(`Розрахунок: ${p.title}`, p.price)}
              />
            ))}
          </div>

          <div className="mt-7 text-center">
            <a
              href="/shop"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onNavigateShop('all');
                }
              }}
              className="ec-glass-plate inline-flex items-center gap-2 px-5 py-3 rounded-xl hover:bg-white/95 text-xs font-extrabold text-[#07213e] transition-colors"
            >
              {tr('Відкрити весь каталог обладнання', 'Открыть весь каталог оборудования')} ({products.length} {tr('позицій', 'позиций')})
              <ArrowRight className="w-3.5 h-3.5 text-[#0b66b2]" />
            </a>
          </div>
        </div>
      </section>

      {/* Engineering Audit Split */}
      <section className="relative overflow-hidden isolate ec-section border-y border-sky-200/45">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.audit.tint}
          start={HOME_VIDEO_SEGMENTS.audit.start}
          end={HOME_VIDEO_SEGMENTS.audit.end}
          autoPlay
          loop
          muted
          playsInline
          brightness={0.52}
        />
        <div className="relative ec-container grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 flex">
            <div className="ec-glass-sapphire rounded-2xl overflow-hidden flex flex-col justify-between w-full">
              <SmartImage
                src="/assets/energocomfort/kit_battery_30kwh_real.jpg"
                alt={tr("Дисплей інвертора Deye на реальному об'єкті Energo Comfort", 'Дисплей инвертора Deye на реальном объекте Energo Comfort')}
                loading="lazy"
                className="w-full flex-1 min-h-[280px] object-cover"
              />
              <div className="px-5 py-3.5 text-xs text-sky-100 border-t border-sky-200/20">
                {tr('Реальна телеметрія монтажу Energo Comfort: PV 4,87 кВт · АКБ 100% · Статус ON', 'Телеметрия Energo Comfort в реальном времени: PV 4,87 кВт · АКБ 100% · Статус ON')}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 min-w-0 ec-glass-plate rounded-2xl p-6 sm:p-7 flex flex-col justify-center break-words hyphens-auto">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">{tr('Інженерний підхід')}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-3">
              {tr('Аудит, підбір сумісного обладнання та безпечний монтаж')}
            </h2>
            <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed mb-5">
              {tr('Беремо на себе повний цикл впровадження — від вимірювання реальних пускових струмів та поділу щита до пусконалагодження й віддаленого моніторингу:', 'Берём на себя весь цикл: измеряем пусковые токи, разделяем нагрузки в щите, запускаем систему и настраиваем удалённый мониторинг.')}
            </p>
            <ul className="space-y-2.5 mb-6 text-sm text-[#07213e] font-medium">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Аналіз споживання та виділення критичної групи навантаження в електрощиті.', 'Анализируем потребление и выделяем критические нагрузки в электрощите.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Розрахунок пускових струмів насосів, компресорів і холодильного обладнання.', 'Рассчитываем пусковые токи насосов, компрессоров и холодильного оборудования.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Підбір сумісних інверторів (Deye, SolaX, Solis) і LiFePO4 АКБ без ризику помилки.', 'Подбираем совместимые инверторы (Deye, SolaX, Solis) и аккумуляторы LiFePO4.')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>{tr('Власний монтажний підрозділ в Одесі та офіційне гарантійне обслуговування.', 'Своя монтажная команда в Одессе и официальное гарантийное обслуживание.')}</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenLeadModal('Замовити аудит споживання')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07213e] text-xs font-extrabold cursor-pointer transition-colors"
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
                className="px-4 py-2.5 rounded-xl border border-sky-200/80 bg-white/80 hover:bg-white text-xs font-bold text-[#07213e] transition-colors"
              >
                {tr('Усі послуги та тарифи')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Realized Projects Collection */}
      <section className="relative overflow-hidden isolate ec-section border-b border-sky-200/45">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.projects.tint}
          start={HOME_VIDEO_SEGMENTS.projects.start}
          end={HOME_VIDEO_SEGMENTS.projects.end}
          brightness={0.54}
        />
        <div className="relative ec-container break-words hyphens-auto">
          <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-xl">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">{tr('Портфоліо компанії')}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e] mb-2">
                {tr('Реалізовані об’єкти в Одесі та області')}
              </h2>
              <p className="text-sm text-[#1c3d5e] font-medium leading-relaxed">
                {tr('Інсталяції від приватних будинків 6 кВт до промислових СЕС 110 кВт. Натисніть на об’єкт, щоб переглянути параметри рішення.', 'Наши проекты — от домашних систем 6 кВт до промышленных СЭС 110 кВт. Откройте объект, чтобы увидеть параметры решения.')}
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-sky-100/80 border border-sky-200/80 rounded-xl self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setCaseSeg('all')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  caseSeg === 'all' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Обрані проєкти', 'Избранные проекты')} ({visibleCases.length})
              </button>
              <button
                type="button"
                onClick={() => setCaseSeg('b2b')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  caseSeg === 'b2b' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e]'
                }`}
              >
                {tr('Для бізнесу B2B', 'Для бизнеса B2B')}
              </button>
              <button
                type="button"
                onClick={() => setCaseSeg('b2c')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  caseSeg === 'b2c' ? 'bg-[#0b66b2] text-white shadow-sm' : 'text-[#1c3d5e] hover:text-[#07213e]'
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
                className="px-3.5 py-2 text-xs font-bold text-[#0b66b2] hover:underline whitespace-nowrap"
              >
                {tr('Усі', 'Все')} {projects.length} {tr('об’єктів', 'объектов')} →
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {visibleCases.map((c) => (
              <article
                key={c.id}
                onClick={() => onSelectCase(c)}
                className="ec-glass-card rounded-2xl overflow-hidden h-full min-w-0 flex flex-col cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="relative h-48 bg-[#061c36]">
                  <SmartImage src={c.img} alt={isRussian ? c.titleRu ?? c.title : c.title} loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-[#041830]/85 to-transparent text-[11px] font-bold text-white">
                    {isRussian ? c.tagRu ?? c.tag : c.tag}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-extrabold text-[#061c36] mb-1.5 line-clamp-2 overflow-hidden text-ellipsis min-h-[2.6rem]">
                      {isRussian ? c.titleRu ?? c.title : c.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-[#133659] font-medium line-clamp-2 min-h-[2.5rem] leading-[1.6]">
                      {isRussian ? c.taskRu ?? c.task : c.task}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-sky-200/75 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#061c36] truncate">{isRussian ? c.specsRu ?? c.specs : c.specs}</span>
                    <span className="text-[#0b66b2] shrink-0 whitespace-nowrap">{tr('Деталі')} →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process & FAQ */}
      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.process.tint}
          start={HOME_VIDEO_SEGMENTS.process.start}
          end={HOME_VIDEO_SEGMENTS.process.end}
          autoPlay
          loop
          muted
          playsInline
          brightness={0.52}
        />
        <div className="relative ec-container break-words hyphens-auto">
          <div className="ec-glass-plate rounded-2xl p-6 sm:p-7 mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-1.5">
                {tr('Порядок співпраці')}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#07213e]">
                {tr('Як ми працюємо: від розрахунку до запуску')}
              </h2>
            </div>
            <p className="max-w-sm text-sm font-medium leading-relaxed text-[#1c3d5e]">
              {tr('Один інженерний маршрут — від першої розмови до системи, готової до роботи.', 'Один понятный путь — от первого разговора до готовой к работе системы.')}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
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
                className="group ec-glass-sapphire rounded-2xl p-5 sm:p-6 h-full flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/60"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/20 text-sky-200 border border-sky-300/25 transition-colors group-hover:bg-[#0b66b2] group-hover:text-white">
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="font-mono text-2xl font-extrabold tracking-tight text-white/30 group-hover:text-sky-200/70">
                      {number}
                    </span>
                  </div>
                  <h3 className="mb-2 text-[16px] font-extrabold text-white">{tr(title)}</h3>
                  <p className="text-[13px] leading-[1.6] text-sky-50/90 min-h-[3.9rem]">{tr(desc)}</p>
                </div>
                <div className="mt-5 border-t border-sky-200/15 pt-3 text-[11px] font-bold text-sky-200">
                  {tr(detail)}
                </div>
              </article>
            ))}
          </div>

          <div className="ec-glass-plate rounded-2xl p-5 sm:px-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-extrabold text-[#07213e]">{tr('Є питання щодо вашого об’єкта?', 'Есть вопросы по вашему объекту?')}</p>
              <p className="mt-1 text-xs text-[#1c3d5e] font-medium">{tr('Почнемо з короткої консультації та підкажемо наступний крок.', 'Начнём с короткой консультации и подскажем следующий шаг.')}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLeadModal('Консультація щодо вашого об’єкта')}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f59e0b] px-5 text-sm font-extrabold text-[#07213e] transition-colors hover:bg-[#fbbf24] cursor-pointer"
            >
              {tr('Обговорити проєкт')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Dedicated FAQ Accordion Section */}
      <FaqSection onOpenLeadModal={onOpenLeadModal} />

      {/* Engineering Brief -> Direct CRM & Telegram */}
      <section id="home-request" className="relative overflow-hidden isolate border-t border-sky-200/45 ec-section">
        <VideoBackground
          position="absolute"
          tone="light"
          tint={HOME_VIDEO_SEGMENTS.brief.tint}
          start={HOME_VIDEO_SEGMENTS.brief.start}
          end={HOME_VIDEO_SEGMENTS.brief.end}
          autoPlay
          loop
          muted
          playsInline
          brightness={0.52}
        />
        <div className="relative ec-container grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch break-words hyphens-auto">
          <div className="lg:col-span-5 min-w-0 ec-glass-plate rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 h-full">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0b66b2] mb-2">{tr('Швидкий інженерний бриф', 'Краткий бриф для инженера')}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#061c36] leading-tight mb-3">
                {tr('Отримайте інженерний розрахунок під ваш об’єкт', 'Получите инженерный расчёт для вашего объекта')}
              </h2>
              <p className="text-[15px] text-[#133659] font-medium leading-[1.65] max-w-[44ch]">
                {tr('Заявка автоматично створює картку угоди у вбудованій CRM Energo Comfort та надсилає сповіщення менеджеру у Telegram.', 'Заявка автоматически создаёт сделку во встроенной CRM Energo Comfort и отправляет уведомление менеджеру в Telegram.')}
              </p>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-[13px] font-semibold text-[#061c36] pt-5 border-t border-sky-200/80">
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
            className="lg:col-span-7 ec-glass-sapphire text-white rounded-2xl p-6 sm:p-8 h-full flex flex-col justify-between gap-4"
          >
            <div className="hidden" aria-hidden="true">
              <label htmlFor="brief-website">Website</label>
              <input
                id="brief-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="brief-task" className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Тип задачі', 'Тип задачи')}</label>
                <select
                  id="brief-task"
                  name="taskType"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-200/30 bg-[#07213e]/75 text-white text-xs font-semibold focus:outline-none focus:border-sky-300"
                >
                  <option value="Резервне живлення (квартира / дім)">{tr('Резервне живлення (квартира / дім)', 'Резервное питание (квартира / дом)')}</option>
                  <option value="Сонячна електростанція для дому">{tr('Сонячна електростанція для дому', 'Солнечная электростанция для дома')}</option>
                  <option value="Рішення для бізнесу / СТО (380 В)">{tr('Рішення для бізнесу / СТО (380 В)', 'Решение для бизнеса / СТО (380 В)')}</option>
                  <option value="Підбір комплектуючих із каталогу">{tr('Підбір комплектуючих із каталогу', 'Подбор комплектующих из каталога')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="brief-city" className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Район або місто', 'Район или город')}</label>
                <input
                  id="brief-city"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-200/30 bg-[#07213e]/75 text-white text-xs font-semibold focus:outline-none focus:border-sky-300"
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
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-sky-400/25 border-sky-300 text-white font-semibold'
                          : 'bg-[#07213e]/55 border-sky-200/20 text-sky-100'
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="brief-name" className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Ваше ім’я')}</label>
                <input
                  id="brief-name"
                  name="customerName"
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={tr('Олексій', 'Алексей')}
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-200/30 bg-[#07213e]/75 text-white text-xs placeholder:text-sky-200/55 focus:outline-none focus:border-sky-300"
                />
              </div>
              <div>
                <label htmlFor="brief-phone" className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Телефон *', 'Телефон *')}</label>
                <input
                  id="brief-phone"
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(formError)}
                  value={phone}
                  onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 XX XXX XX XX"
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-200/30 bg-[#07213e]/75 text-white text-xs placeholder:text-sky-200/55 focus:outline-none focus:border-sky-300"
                />
              </div>
              <div>
                <label htmlFor="brief-channel" className="block text-[11px] font-bold text-sky-200 mb-1.5">{tr('Канал зв’язку', 'Канал связи')}</label>
                <select
                  id="brief-channel"
                  name="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-200/30 bg-[#07213e]/75 text-white text-xs font-semibold focus:outline-none focus:border-sky-300"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="Viber">Viber</option>
                  <option value="Телефон">{tr('Дзвінок')}</option>
                </select>
              </div>
            </div>

            {formError && <div className="text-xs font-semibold text-red-300" role="alert" aria-live="polite">{formError}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 text-[#07213e] text-sm font-extrabold transition-colors cursor-pointer"
            >
              {submitting ? tr('Створюємо угоду в CRM...', 'Создаём сделку в CRM…') : tr('Надіслати інженеру та отримати розрахунок', 'Отправить инженеру и получить расчёт')}
            </button>
            <p className="text-[11px] text-sky-100/75 leading-relaxed">
              {tr('Надсилаючи форму, ви погоджуєтесь на обробку контактних даних для підготовки інженерного розрахунку.', 'Отправляя форму, вы соглашаетесь на обработку контактных данных для подготовки инженерного расчёта.')}
            </p>

            {createdBrief && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    {tr('Заявку', 'Заявка')} <strong className="font-mono">{createdBrief.dealNumber}</strong>{' '}
                    {tr('прийнято! Інженер зв’яжеться протягом 15 хвилин у робочий час.', 'принята! Инженер свяжется в течение 15 минут в рабочее время.')}
                  </span>
                </div>
                {isStaff && (
                  <button
                    type="button"
                    onClick={onOpenCrm}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#07213e] font-bold hover:bg-sky-50 cursor-pointer"
                  >
                    {tr('Відкрити в CRM →', 'Открыть в CRM →')}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
