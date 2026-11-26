import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Heart,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShoppingBag,
  Sliders,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type { CustomerProfile, Deal, DealStage, Product } from '../types.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';
import { tr } from '../lib/i18n.ts';
import { resolveWishlistProducts } from '../lib/wishlist.ts';
import { SolarConstructorTab } from './cabinet/SolarConstructorTab.tsx';
import { SystemSchemesTab } from './cabinet/SystemSchemesTab.tsx';
import { TechGuideTab } from './cabinet/TechGuideTab.tsx';
import { PerformanceProfiler } from './PerformanceProfiler.tsx';
import { ProductCard } from './ProductCard.tsx';
import { SmartImage } from './SmartImage.tsx';
import { VideoBackground } from './VideoBackground.tsx';
import { Badge } from './ui/badge.tsx';
import { Button } from './ui/button.tsx';
import { Card } from './ui/card.tsx';
import { Input } from './ui/input.tsx';

export type CabinetTab = 'overview' | 'wishlist' | 'constructor' | 'schemes' | 'guide';

interface ClientCabinetViewProps {
  clientToken: string;
  initialCustomer: CustomerProfile | null;
  products: Product[];
  usdUahRate: number | null;
  wishlistIds?: string[];
  requestedTab?: { tab: CabinetTab; nonce: number } | null;
  onCustomerUpdated: (customer: CustomerProfile) => void;
  onToggleWishlist?: (product: Product) => void;
  onClearWishlist?: () => void;
  onSelectProduct?: (product: Product) => void;
  onQuickViewProduct?: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onAddManyToCart?: (products: Product[]) => void;
  onCalculatePayback?: (product: Product) => void;
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, notes?: string) => void;
  onNavigateShop: () => void;
  onBackToStore: () => void;
  onLogout: () => void;
  refreshTrigger?: number;
}

const STAGE_META: Record<
  DealStage,
  { uk: string; ru: string; variant: 'warning' | 'info' | 'success' | 'default' }
> = {
  new: { uk: 'Нова заявка', ru: 'Новая заявка', variant: 'info' },
  audit: { uk: 'Інженерний аудит', ru: 'Инженерный аудит', variant: 'warning' },
  proposal: { uk: 'КП підготовлено', ru: 'КП подготовлено', variant: 'info' },
  fulfillment: { uk: 'Комплектація / монтаж', ru: 'Комплектация / монтаж', variant: 'warning' },
  done: { uk: 'Виконано', ru: 'Выполнено', variant: 'success' },
  archived: { uk: 'Архів', ru: 'Архив', variant: 'default' },
};

export function ClientCabinetView({
  clientToken,
  initialCustomer,
  products,
  usdUahRate,
  wishlistIds = [],
  requestedTab = null,
  onCustomerUpdated,
  onToggleWishlist,
  onClearWishlist,
  onSelectProduct,
  onQuickViewProduct,
  onAddToCart,
  onAddManyToCart,
  onCalculatePayback,
  onOpenLeadModal,
  onNavigateShop,
  onBackToStore,
  onLogout,
  refreshTrigger = 0,
}: ClientCabinetViewProps) {
  const [activeTab, setActiveTab] = useState<CabinetTab>(requestedTab?.tab ?? 'overview');
  const [customer, setCustomer] = useState<CustomerProfile | null>(initialCustomer);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab.tab);
    }
  }, [requestedTab]);

  const wishlistProducts = useMemo(
    () => resolveWishlistProducts(wishlistIds, products),
    [wishlistIds, products],
  );
  const purchasableWishlistProducts = useMemo(
    () => wishlistProducts.filter((p) => !p.isKit && p.price > 0),
    [wishlistProducts],
  );
  const wishlistTotalUsd = useMemo(
    () => wishlistProducts.reduce((sum, p) => sum + (p.price > 0 ? p.price : 0), 0),
    [wishlistProducts],
  );

  const [name, setName] = useState(initialCustomer?.name || '');
  const [phone, setPhone] = useState(initialCustomer?.phone ? formatUaPhone(initialCustomer.phone) : '');
  const [city, setCity] = useState(initialCustomer?.city || 'Одеса');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');

  const onCustomerUpdatedRef = useRef(onCustomerUpdated);
  onCustomerUpdatedRef.current = onCustomerUpdated;
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const hasLoadedOnceRef = useRef(false);

  const loadCabinet = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }
    setLoadError('');
    try {
      const resp = await fetch('/api/client/me', {
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      if (resp.status === 401) {
        onLogoutRef.current();
        return;
      }
      const data = (await resp.json()) as { customer?: CustomerProfile; deals?: Deal[]; error?: string };
      if (!resp.ok || !data.customer) {
        setLoadError(data.error || tr('Не вдалося завантажити дані кабінету', 'Не удалось загрузить данные кабинета'));
        return;
      }
      hasLoadedOnceRef.current = true;
      setCustomer(data.customer);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setName(data.customer.name);
      setPhone(data.customer.phone ? formatUaPhone(data.customer.phone) : '');
      setCity(data.customer.city || 'Одеса');
      onCustomerUpdatedRef.current(data.customer);
    } catch {
      setLoadError(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setLoading(false);
    }
  }, [clientToken]);

  useEffect(() => {
    void loadCabinet();
  }, [loadCabinet, refreshTrigger]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileNotice('');
    setProfileError('');

    if (name.trim().length < 2) {
      setProfileError(tr('Ім’я має містити щонайменше 2 символи', 'Имя должно содержать минимум 2 символа'));
      return;
    }
    if (phone.trim() && !isValidUaPhone(phone)) {
      setProfileError(tr('Вкажіть коректний номер у форматі +380 XX XXX XX XX', 'Укажите корректный номер в формате +380 XX XXX XX XX'));
      return;
    }

    setSavingProfile(true);
    try {
      const resp = await fetch('/api/client/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() ? `+${phone.replace(/\D/g, '')}` : '',
          city: city.trim() || 'Одеса',
        }),
      });
      const data = (await resp.json()) as { customer?: CustomerProfile; deals?: Deal[]; error?: string };
      if (!resp.ok || !data.customer) {
        setProfileError(data.error || tr('Не вдалося зберегти профіль', 'Не удалось сохранить профиль'));
        return;
      }
      setCustomer(data.customer);
      if (Array.isArray(data.deals)) setDeals(data.deals);
      onCustomerUpdated(data.customer);
      setProfileNotice(tr('Профіль оновлено', 'Профиль обновлён'));
    } catch {
      setProfileError(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSavingProfile(false);
    }
  }

  const activeDeals = deals.filter((d) => d.stage !== 'done' && d.stage !== 'archived');
  const completedDeals = deals.filter((d) => d.stage === 'done');

  return (
    <div className="relative overflow-hidden isolate min-h-[calc(100vh-140px)] pb-14">
      <VideoBackground position="absolute" tone="light" tint="indigo" start={38} end={50} brightness={0.56} />
      {/* Cabinet Header Bar */}
      <div className="relative ec-glass-sapphire text-white border-x-0 border-t-0 rounded-none">
        <div className="ec-container py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-200 hover:text-white mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {tr('Повернутися до магазину', 'Вернуться в магазин')}
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-normal truncate">
              {tr('Особистий кабінет', 'Личный кабинет')} · {customer?.name || tr('Клієнт', 'Клиент')}
            </h1>
            {customer?.email && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-sky-100">
                <Mail className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>{customer.email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              size="sm"
              onClick={() => setActiveTab('constructor')}
              className="bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07213e] border-0 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {tr('Конструктор СЕС', 'Конструктор СЭС')}
            </Button>
            <Button variant="outline" size="sm" onClick={onNavigateShop} className="bg-white/10 text-white border-white/25 hover:bg-white/20">
              <ShoppingBag className="w-3.5 h-3.5" />
              {tr('Каталог', 'Каталог')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="bg-transparent text-sky-100 border-white/25 hover:bg-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              {tr('Вийти', 'Выйти')}
            </Button>
          </div>
        </div>

        {/* Interactive Cabinet Sub-Navigation */}
        <div className="ec-container flex items-center gap-1.5 overflow-x-auto pb-3">
          {(
            [
              ['overview', ClipboardList, tr('Огляд та замовлення', 'Обзор и заказы'), null],
              ['wishlist', Heart, tr('Список бажань', 'Список желаний'), wishlistProducts.length],
              ['constructor', Sliders, tr('Конструктор СЕС і навантажень', 'Конструктор СЭС и нагрузок'), null],
              ['schemes', GitBranch, tr('Схеми підключення', 'Схемы подключения'), null],
              ['guide', BookOpen, tr('Панелі, АКБ та інвертори', 'Панели, АКБ и инверторы'), null],
            ] as const
          ).map(([tabId, Icon, label, badgeCount]) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-[#07213e] shadow-sm'
                    : 'bg-white/10 text-sky-100 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    tabId === 'wishlist'
                      ? active
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-rose-400'
                      : active
                        ? 'text-[#0b66b2]'
                        : 'text-[#f59e0b]'
                  }`}
                />
                <span>{label}</span>
                {badgeCount !== null && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                      active ? 'bg-rose-50 text-rose-600' : 'bg-white/15 text-white'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative ec-container pt-6 space-y-6">
        {activeTab === 'wishlist' && (
          <div className="space-y-5">
            <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0d1f33]">
                    {tr('Список бажань', 'Список желаний')} ({wishlistProducts.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {wishlistProducts.length > 0 && wishlistTotalUsd > 0 ? (
                      <>
                        {tr('Орієнтовна вартість збереженого обладнання:', 'Ориентировочная стоимость сохранённого оборудования:')}{' '}
                        <strong className="font-mono text-[#0d1f33]">
                          {formatUahFromUsd(wishlistTotalUsd, usdUahRate)}
                        </strong>
                      </>
                    ) : (
                      tr(
                        'Зберігайте інвертори, акумулятори, панелі та готові комплекти, щоб порівняти конфігурації або замовити пізніше.',
                        'Сохраняйте инверторы, аккумуляторы, панели и готовые комплекты, чтобы сравнить конфигурации или заказать позже.',
                      )
                    )}
                  </p>
                </div>
              </div>

              {wishlistProducts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {purchasableWishlistProducts.length > 0 && (
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => {
                        if (onAddManyToCart) {
                          onAddManyToCart(purchasableWishlistProducts);
                        } else {
                          for (const item of purchasableWishlistProducts) {
                            onAddToCart(item);
                          }
                        }
                      }}
                      className="bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] font-bold"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {tr('Усе в кошик', 'Всё в корзину')} ({purchasableWishlistProducts.length})
                    </Button>
                  )}
                  {onClearWishlist && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onClearWishlist}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {tr('Очистити список', 'Очистить список')}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {wishlistProducts.length === 0 ? (
              <Card className="p-10 text-center">
                <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-extrabold text-[#0d1f33] mb-1">
                  {tr('Список бажань поки порожній', 'Список желаний пока пуст')}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                  {tr(
                    'Натисніть іконку серця на будь-якій картці товару в каталозі, щоб зберегти обладнання в цьому розділі.',
                    'Нажмите иконку сердца на любой карточке товара в каталоге, чтобы сохранить оборудование в этом разделе.',
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Button onClick={onNavigateShop}>
                    <ShoppingBag className="w-4 h-4" />
                    {tr('Перейти в каталог', 'Перейти в каталог')}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('constructor')}>
                    <Sliders className="w-4 h-4" />
                    {tr('Конструктор СЕС', 'Конструктор СЭС')}
                  </Button>
                </div>
              </Card>
            ) : (
              <PerformanceProfiler id="ClientCabinetView.WishlistProducts" itemCount={wishlistProducts.length}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {wishlistProducts.map((product) => (
                    <ProductCard
                      key={`wishlist-${product.id}`}
                      product={product}
                      usdUahRate={usdUahRate}
                      isWishlisted={true}
                      onToggleWishlist={onToggleWishlist}
                      onSelect={(p) => {
                        if (onSelectProduct) {
                          onSelectProduct(p);
                        } else {
                          onNavigateShop();
                        }
                      }}
                      onQuickView={onQuickViewProduct}
                      onAddToCart={onAddToCart}
                      onCalculatePayback={onCalculatePayback}
                      onRequestQuote={(p) =>
                        onOpenLeadModal(`Розрахунок (зі списку бажань): ${p.title}`, p.price)
                      }
                    />
                  ))}
                </div>
              </PerformanceProfiler>
            )}
          </div>
        )}

        {activeTab === 'constructor' && (
          <SolarConstructorTab
            products={products}
            usdUahRate={usdUahRate}
            onAddToCart={onAddToCart}
            onOpenLeadModal={onOpenLeadModal}
          />
        )}

        {activeTab === 'schemes' && <SystemSchemesTab onOpenLeadModal={onOpenLeadModal} />}

        {activeTab === 'guide' && <TechGuideTab products={products} onOpenLeadModal={onOpenLeadModal} />}

        {activeTab === 'overview' && (
          <>
            {/* Interactive Tools Quick-Launch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('constructor')}
                className="text-left rounded-xl bg-white border border-slate-200 hover:border-[#1769aa] hover:shadow-md transition-all cursor-pointer group overflow-hidden flex flex-col"
              >
                <div className="relative h-28 w-full overflow-hidden bg-[#0d1f33]">
                  <SmartImage
                    src="/assets/energocomfort/backup_deye_8kw.jpg"
                    alt={tr('Конструктор станції і навантажень', 'Конструктор станции и нагрузок')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1f33]/80 via-[#0d1f33]/20 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 w-8 h-8 rounded-lg bg-amber-500 text-[#0d1f33] flex items-center justify-center shadow-sm">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <span className="absolute bottom-2.5 right-3 text-[11px] font-bold text-white bg-[#0d1f33]/75 px-2 py-0.5 rounded-md">
                    {tr('Відкрити →', 'Открыть →')}
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-extrabold text-[#0d1f33]">
                    {tr('Конструктор станції і навантажень', 'Конструктор станции и нагрузок')}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {tr(
                      'Зберіть список приладів, змоделюйте 24-годинний баланс і підберіть комплект зі складу.',
                      'Соберите список приборов, смоделируйте 24-часовой баланс и подберите комплект со склада.',
                    )}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schemes')}
                className="text-left rounded-xl bg-white border border-slate-200 hover:border-[#1769aa] hover:shadow-md transition-all cursor-pointer group overflow-hidden flex flex-col"
              >
                <div className="relative h-28 w-full overflow-hidden bg-[#0d1f33]">
                  <SmartImage
                    src="/assets/energocomfort/house_6kw.png"
                    alt={tr('Інтерактивні схеми підключення', 'Интерактивные схемы подключения')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1f33]/80 via-[#0d1f33]/20 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 w-8 h-8 rounded-lg bg-[#1769aa] text-white flex items-center justify-center shadow-sm">
                    <GitBranch className="w-4 h-4" />
                  </span>
                  <span className="absolute bottom-2.5 right-3 text-[11px] font-bold text-white bg-[#0d1f33]/75 px-2 py-0.5 rounded-md">
                    {tr('Відкрити →', 'Открыть →')}
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-extrabold text-[#0d1f33]">
                    {tr('Інтерактивні схеми підключення', 'Интерактивные схемы подключения')}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {tr(
                      'Подивіться, як працює ДБЖ, гібридна СЕС або АВР у блекаут, і які захисти обов’язкові.',
                      'Посмотрите, как работает ИБП, гибридная СЭС или АВР в блэкаут, и какие защиты обязательны.',
                    )}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className="text-left rounded-xl bg-white border border-slate-200 hover:border-[#1769aa] hover:shadow-md transition-all cursor-pointer group overflow-hidden flex flex-col"
              >
                <div className="relative h-28 w-full overflow-hidden bg-[#0d1f33]">
                  <SmartImage
                    src="/assets/energocomfort/kit_battery_30kwh_real.jpg"
                    alt={tr('Гід по панелях, АКБ та інверторах', 'Гид по панелям, АКБ и инверторам')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1f33]/80 via-[#0d1f33]/20 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 w-8 h-8 rounded-lg bg-[#169374] text-white flex items-center justify-center shadow-sm">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <span className="absolute bottom-2.5 right-3 text-[11px] font-bold text-white bg-[#0d1f33]/75 px-2 py-0.5 rounded-md">
                    {tr('Відкрити →', 'Открыть →')}
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-extrabold text-[#0d1f33]">
                    {tr('Гід по панелях, АКБ та інверторах', 'Гид по панелям, АКБ и инверторам')}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {tr(
                      'Порівняння TOPCon vs PERC vs Bifacial, калькулятор окупності LiFePO4 і підбір під дах.',
                      'Сравнение TOPCon vs PERC vs Bifacial, калькулятор окупаемости LiFePO4 и подбор под крышу.',
                    )}
                  </p>
                </div>
              </button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#1769aa] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('Усього замовлень і заявок', 'Всего заказов и заявок')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{deals.length}</div>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('В роботі зараз', 'В работе сейчас')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{activeDeals.length}</div>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('Виконано', 'Выполнено')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{completedDeals.length}</div>
            </div>
          </Card>

          <button
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className="text-left rounded-xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-sm p-4 flex items-center gap-3.5 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Heart className={`w-5 h-5 ${wishlistProducts.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 truncate">{tr('Список бажань', 'Список желаний')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{wishlistProducts.length}</div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Orders & Requests History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#0d1f33]">
                {tr('Мої замовлення та заявки', 'Мои заказы и заявки')}
              </h2>
              <button
                type="button"
                onClick={() => void loadCabinet()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769aa] hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {tr('Оновити', 'Обновить')}
              </button>
            </div>

            {loadError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {loadError}
              </div>
            )}

            {loading && deals.length === 0 ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-32 rounded-xl bg-white border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <Card className="p-8 text-center">
                <ShoppingBag className="w-9 h-9 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-extrabold text-[#0d1f33] mb-1">
                  {tr('Поки немає замовлень чи заявок', 'Пока нет заказов или заявок')}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  {tr(
                    'Оформіть замовлення в каталозі або надішліть запит на підбір обладнання — усі ваші заявки з’являться тут автоматично.',
                    'Оформите заказ в каталоге или отправьте запрос на подбор оборудования — все ваши заявки появятся здесь автоматически.',
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Button onClick={() => onOpenLeadModal(tr('Підбір рішення з кабінету', 'Подбор решения из кабинета'))}>
                    {tr('Підібрати рішення', 'Подобрать решение')}
                  </Button>
                  <Button variant="outline" onClick={onNavigateShop}>
                    {tr('Перейти в каталог', 'Перейти в каталог')}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3.5">
                {deals.map((deal) => {
                  const stageInfo = STAGE_META[deal.stage] || STAGE_META.new;
                  const createdLabel = new Date(deal.createdAt).toLocaleDateString('uk-UA', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <Card key={deal.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-[#1769aa] bg-sky-50 px-2 py-0.5 rounded">
                              {deal.dealNumber}
                            </span>
                            <Badge variant={stageInfo.variant}>{tr(stageInfo.uk, stageInfo.ru)}</Badge>
                            <span className="text-[11px] text-slate-400">{createdLabel}</span>
                          </div>
                          <h3 className="text-sm font-extrabold text-[#0d1f33] mt-1.5">{deal.topic}</h3>
                        </div>

                        {deal.totalUsd > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-extrabold text-[#0d1f33] font-mono">
                              {formatUahFromUsd(deal.totalUsd, usdUahRate)}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">≈ ${deal.totalUsd.toLocaleString('en-US')}</div>
                          </div>
                        )}
                      </div>

                      {deal.items.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
                          {deal.items.map((item, idx) => {
                            const matchedProd = products.find((p) => p.id === item.productId);
                            return (
                              <div key={`${item.productId}-${idx}`} className="flex items-center justify-between gap-2.5 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  {matchedProd?.img && (
                                    <SmartImage
                                      src={matchedProd.img}
                                      alt={item.title}
                                      className="w-8 h-8 rounded-md object-cover border border-slate-200 bg-white shrink-0"
                                    />
                                  )}
                                  <span className="text-[#0d1f33] font-medium truncate">
                                    {item.title} <span className="text-slate-400">× {item.qty}</span>
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-700 shrink-0">
                                  {formatUahFromUsd(item.price * item.qty, usdUahRate)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {deal.phone}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {deal.city || 'Одеса'}
                        </span>
                        {deal.assignee && (
                          <span>
                            {tr('Відповідальний:', 'Ответственный:')} <strong className="text-[#0d1f33]">{deal.assignee}</strong>
                          </span>
                        )}
                      </div>

                      {deal.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50/70 border-l-2 border-slate-300 pl-3 py-1 whitespace-pre-line">
                          {deal.notes}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Client Profile Card */}
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#0d1f33] text-white flex items-center justify-center">
                <User className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#0d1f33]">{tr('Мій профіль', 'Мой профиль')}</h2>
                <div className="text-[11px] text-slate-500">{customer?.email}</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              {tr(
                'Вкажіть номер телефону, з якого ви залишали заявки раніше — вони автоматично підтягнуться до вашого кабінету.',
                'Укажите номер телефона, с которого вы оставляли заявки ранее — они автоматически привяжутся к вашему кабинету.',
              )}
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label htmlFor="client-profile-name" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Ім’я', 'Имя')}
                </label>
                <Input
                  id="client-profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingProfile}
                  required
                />
              </div>

              <div>
                <label htmlFor="client-profile-phone" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Телефон', 'Телефон')}
                </label>
                <Input
                  id="client-profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 50 000 00 00"
                  disabled={savingProfile}
                  className="font-mono"
                />
              </div>

              <div>
                <label htmlFor="client-profile-city" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Місто', 'Город')}
                </label>
                <Input
                  id="client-profile-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Одеса"
                  disabled={savingProfile}
                />
              </div>

              {profileError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {profileError}
                </div>
              )}
              {profileNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileNotice}</span>
                </div>
              )}

              <Button type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? tr('Збереження...', 'Сохранение…') : tr('Зберегти дані', 'Сохранить данные')}
              </Button>
            </form>
          </Card>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
