import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Check, ArrowRight, CheckCircle2, PhoneCall, Send } from 'lucide-react';
import type { Deal, Product, ProductCategory, ProjectCase } from '../types.ts';
import { BRAND_PARTNERS, COMPANY_INFO, FAQ_ITEMS } from '../data/siteContent.ts';
import { ProductCard } from './ProductCard.tsx';
import { SmartImage } from './SmartImage.tsx';
import { trackEvent } from '../lib/analytics.ts';

interface HomeViewProps {
  products: Product[];
  projects: ProjectCase[];
  telegramUrl?: string;
  onNavigateShop: (cat?: ProductCategory | 'all') => void;
  onNavigateServices: () => void;
  onNavigateProjects: () => void;
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onSelectCase: (project: ProjectCase) => void;
  onLeadCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
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
}: HomeViewProps) {
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

  // Instant Hero Callback state
  const [heroPhone, setHeroPhone] = useState('');
  const [heroHoneypot, setHeroHoneypot] = useState('');
  const [heroSubmitting, setHeroSubmitting] = useState(false);
  const [heroError, setHeroError] = useState('');
  const [heroSentDeal, setHeroSentDeal] = useState<Deal | null>(null);

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
      } else {
        setCreatedBrief(data.deal);
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

  async function handleHeroCallbackSubmit(e: FormEvent) {
    e.preventDefault();
    setHeroError('');
    setHeroSentDeal(null);
    const trimmed = heroPhone.trim();
    if (trimmed.replace(/\D/g, '').length < 9) {
      setHeroError('Вкажіть коректний номер телефону');
      return;
    }
    setHeroSubmitting(true);
    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Швидкий дзвінок (перший екран)',
          phone: trimmed,
          city: 'Одеса',
          channel: 'Телефон',
          topic: 'Швидка консультація з першого екрана (15 хв)',
          taskType: 'Експрес-підбір системи',
          website: heroHoneypot,
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setHeroError(data.error || 'Не вдалося надіслати номер');
      } else {
        setHeroSentDeal(data.deal);
        setHeroPhone('');
        trackEvent('generate_lead', {
          lead_topic: 'hero_instant_callback',
          value: 0,
          currency: 'USD',
        });
        onLeadCreated(data.deal);
      }
    } catch {
      setHeroError(`Сервер недоступний. Зателефонуйте: ${COMPANY_INFO.phone1}`);
    } finally {
      setHeroSubmitting(false);
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
                Резервне живлення · Сонячні електростанції · Одеса
              </div>
              <h1 className="text-[clamp(2rem,3.8vw,2.75rem)] font-extrabold text-[#0d1f33] leading-[1.1] tracking-tight mb-4 max-w-xl">
                Енергія, на яку можна <span className="text-[#1769aa]">покластися</span>
              </h1>
              <p className="text-[15px] text-[#52657a] leading-relaxed mb-6 max-w-xl">
                Проєктування, офіційне постачання обладнання (Deye, SolaX, Solis, Dyness, Trina) та сертифікований
                монтаж «під ключ» з гарантією в Одесі та області.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenLeadModal('Безкоштовний розрахунок системи з першого екрана')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Розрахувати систему за 15 хв
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="/shop"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      onNavigateShop('all');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[#0d1f33] text-sm font-bold transition-colors whitespace-nowrap"
                >
                  Каталог ({products.length})
                </a>
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('contact', { channel: 'telegram_hero' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#1769aa] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Telegram
                  </a>
                )}
              </div>

              {/* Instant 1-Field Callback Bar (Zero-Friction Above-the-Fold CTA) */}
              <div className="mt-4 p-3 rounded-xl bg-white border border-slate-200 max-w-xl">
                {heroSentDeal ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#169374]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Заявку <strong className="font-mono">{heroSentDeal.dealNumber}</strong> прийнято — інженер
                      перетелефонує протягом 15 хв.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleHeroCallbackSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="hidden" aria-hidden="true">
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={heroHoneypot}
                        onChange={(e) => setHeroHoneypot(e.target.value)}
                      />
                    </div>
                    <label htmlFor="hero-callback-phone" className="sr-only">
                      Ваш номер телефону для швидкого розрахунку
                    </label>
                    <div className="relative flex-1">
                      <PhoneCall className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hero-callback-phone"
                        type="tel"
                        required
                        value={heroPhone}
                        onChange={(e) => setHeroPhone(e.target.value)}
                        placeholder="Ваш телефон: +38 (0__) ___-__-__"
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-[13px] text-[#0d1f33] placeholder:text-slate-400 focus:outline-none focus:border-[#1769aa]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={heroSubmitting}
                      className="px-4 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-[#0d1f33] hover:text-white text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {heroSubmitting ? 'Надсилаємо...' : 'Передзвоніть мені'}
                    </button>
                  </form>
                )}
                {heroError && <div className="text-[11px] font-semibold text-red-600 mt-1.5">{heroError}</div>}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  Розрахунок під прилади
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  Офіс в Одесі (Європейська 93)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#169374]" strokeWidth={2.5} />
                  Офіційна гарантія
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
                    aria-label={`Детальніше про об’єкт: ${activeHeroCase.title}`}
                    className="block relative w-full h-full text-left cursor-pointer"
                  >
                    <SmartImage
                      key={`${activeHeroCase.id}-${activeHeroCase.img}`}
                      src={activeHeroCase.img}
                      alt={`${activeHeroCase.title} — ${activeHeroCase.specs} | Energo Comfort Одеса`}
                      priority
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15 flex flex-col justify-between p-5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-xs border border-white/15 text-[11px] font-bold text-sky-200">
                          {activeHeroCase.tag}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/55 backdrop-blur-xs border border-white/15 font-mono text-[11px] font-bold text-white tabular-nums">
                          {safeHeroIdx + 1} / {projects.length}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-sky-200 mb-0.5 line-clamp-1">
                            {activeHeroCase.title}
                          </div>
                          <div className="text-sm sm:text-base font-extrabold leading-snug line-clamp-2">
                            {activeHeroCase.specs || activeHeroCase.solution}
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
                        aria-label="Попередній об’єкт"
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
                        aria-label="Наступний об’єкт"
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
                <div className="text-xs font-bold text-[#1769aa] mb-1">01. Квартира та дім</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">Резервне живлення</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                  Інвертор + АКБ LiFePO4: котел, холодильник, роутер та світло працюють автоматично при блекауті.
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
                Дивитись комплекти 5–10 кВт →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3 hover:border-[#1769aa] transition-colors">
              <div>
                <div className="text-xs font-bold text-[#1769aa] mb-1">02. Приватний сектор</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">Сонячні станції (СЕС)</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                  Гібридні та мережеві рішення 6–12 кВт із оформленням «активного споживача» та гарантією монтажу.
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
                Дивитись готові СЕС →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3 hover:border-[#1769aa] transition-colors">
              <div>
                <div className="text-xs font-bold text-[#1769aa] mb-1">03. Бізнес 380 В і магазин</div>
                <h3 className="text-base font-extrabold text-[#0d1f33] mb-1.5">Станції 30–110 кВт та каталог</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">
                  Рішення для СТО, готелів, заводів або окремі інвертори, панелі й АКБ зі складу в Одесі.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateShop('inverters')}
                className="text-xs font-extrabold text-[#1769aa] hover:underline text-left cursor-pointer"
              >
                Відкрити каталог обладнання →
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
              Офіційні бренди обладнання
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
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">Рішення та обладнання</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
              Популярні конфігурації та комплектуючі
            </h2>
            <p className="text-sm text-[#52657a]">
              Готові комплекти з інженерним підбором під ваше навантаження, а також окремі інвертори та акумулятори зі
              складу в Одесі.
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
              Готові системи резерву
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
              Готові СЕС з панелями
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
              Популярні інвертори та АКБ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeShowcase.map((prod) => (
              <ProductCard
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
              Відкрити весь каталог обладнання ({products.length} позицій)
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
                alt="Дисплей інвертора Deye на реальному об'єкті Energo Comfort"
                className="w-full h-80 object-cover"
              />
              <div className="px-4 py-3 text-xs text-[#52657a] border-t border-slate-200">
                Реальна телеметрія монтажу Energo Comfort: PV 4,87 кВт · АКБ 100% · Статус ON
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">Інженерний підхід</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-3">
              Аудит, підбір сумісного обладнання та безпечний монтаж
            </h2>
            <p className="text-sm text-[#52657a] leading-relaxed mb-5">
              Беремо на себе повний цикл впровадження — від вимірювання реальних пускових струмів та поділу щита до
              пусконалагодження й віддаленого моніторингу:
            </p>
            <ul className="space-y-2.5 mb-6 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Аналіз споживання та виділення критичної групи навантаження в електрощиті.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Розрахунок пускових струмів насосів, компресорів і холодильного обладнання.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Підбір сумісних інверторів (Deye, SolaX, Solis) і LiFePO4 АКБ без ризику помилки.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Власний монтажний підрозділ в Одесі та офіційне гарантійне обслуговування.</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenLeadModal('Замовити аудит споживання')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer"
              >
                Запросити інженера
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
                Усі послуги та тарифи
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Realized Projects Collection */}
      <section className="py-14 bg-white">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="max-w-2xl mb-6">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">Портфоліо компанії</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mb-2">
              Реалізовані об’єкти в Одесі та області
            </h2>
            <p className="text-sm text-[#52657a]">
              Інсталяції від приватних будинків 6 кВт до промислових СЕС 110 кВт. Натисніть на об’єкт, щоб переглянути
              параметри рішення.
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
              Обрані проєкти (6)
            </button>
            <button
              type="button"
              onClick={() => setCaseSeg('b2b')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                caseSeg === 'b2b' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              Для бізнесу B2B
            </button>
            <button
              type="button"
              onClick={() => setCaseSeg('b2c')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                caseSeg === 'b2c' ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              Для дому B2C
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
              Усі {projects.length} об’єктів →
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
                  <SmartImage src={c.img} alt={c.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[11px] font-bold text-white">
                    {c.tag}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0d1f33] mb-1">{c.title}</h3>
                    <p className="text-xs text-[#52657a] line-clamp-2 leading-relaxed">{c.task}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="font-mono text-[#0d1f33] truncate">{c.specs}</span>
                    <span className="text-[#1769aa] shrink-0">Деталі →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process & FAQ */}
      <section className="py-14 bg-[#f6f8fb] border-t border-slate-200">
        <div className="max-w-[1180px] mx-auto px-5">
          <div className="max-w-2xl mb-6">
            <div className="text-xs font-extrabold text-[#1769aa] mb-1.5">Порядок співпраці</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d1f33]">
              Як ми працюємо: від розрахунку до запуску
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              ['01. Консультація', 'Уточнюємо задачу, прилади та 1 чи 3 фази мережі.'],
              ['02. Розрахунок і проєкт', 'Формуємо 1–2 сумісні конфігурації та прозорий кошторис.'],
              ['03. Поставка і монтаж', 'Доставляємо зі складу в Одесі та виконуємо акуратний монтаж.'],
              ['04. Запуск і сервіс', 'Перевіряємо під навантаженням, підключаємо моніторинг та гарантію.'],
            ].map(([title, desc]) => (
              <article key={title} className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-extrabold text-[#0d1f33] mb-1.5">{title}</h3>
                <p className="text-xs text-[#52657a] leading-relaxed">{desc}</p>
              </article>
            ))}
          </div>

          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h3 className="px-5 py-4 border-b border-slate-200 text-sm font-extrabold text-[#0d1f33]">
              Відповіді на часті питання
            </h3>
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
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-[13px] text-[#52657a] leading-relaxed">{item.a}</div>
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
            <div className="text-xs font-extrabold text-[#f59e0b] mb-2">Швидкий інженерний бриф</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
              Отримайте інженерний розрахунок під ваш об’єкт
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Заявка автоматично створює картку угоди у вбудованій CRM Energo Comfort та надсилає сповіщення менеджеру
              у Telegram.
            </p>
            <ul className="space-y-2 text-xs text-slate-200">
              <li>→ Офіс: {COMPANY_INFO.address}</li>
              <li>
                → Телефони: {COMPANY_INFO.phone1} · {COMPANY_INFO.phone2}
              </li>
              <li>→ Email: {COMPANY_INFO.email}</li>
            </ul>
          </div>

          <form
            onSubmit={handleBriefSubmit}
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
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">Тип задачі</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                >
                  <option>Резервне живлення (квартира / дім)</option>
                  <option>Сонячна електростанція для дому</option>
                  <option>Рішення для бізнесу / СТО (380 В)</option>
                  <option>Підбір комплектуючих із каталогу</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">Район або місто</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-sky-200 mb-1.5">Критичні прилади</div>
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
                      <span className="truncate">{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">Ваше ім’я</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Олексій"
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">Телефон *</label>
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
                <label className="block text-[11px] font-bold text-sky-200 mb-1.5">Канал зв’язку</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/25 bg-[#0d1f33] text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="Viber">Viber</option>
                  <option value="Телефон">Дзвінок</option>
                </select>
              </div>
            </div>

            {formError && <div className="text-xs font-semibold text-red-300">{formError}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-[#0d1f33] hover:text-white text-sm font-extrabold transition-colors cursor-pointer"
            >
              {submitting ? 'Створюємо угоду в CRM...' : 'Надіслати інженеру та отримати розрахунок'}
            </button>

            {createdBrief && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    Угоду <strong className="font-mono">{createdBrief.dealNumber}</strong> створено у CRM (
                    {createdBrief.taskType}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenCrm}
                  className="px-3 py-1.5 rounded-md bg-white text-[#0d1f33] font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Відкрити в CRM →
                </button>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
