import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type MouseEvent, type ReactNode } from 'react';
import {
  ShoppingBag,
  Menu,
  X,
  PhoneCall,
  Send,
  User,
  AlertTriangle,
  RefreshCw,
  Home,
  Copy,
  Check,
  Heart,
  Package,
  Wrench,
  Building2,
  Truck,
  FileText,
  LayoutDashboard,
  LogIn,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  AnalyticsConfig,
  CartItem,
  CustomerProfile,
  Deal,
  Product,
  ProductCategory,
  ProjectCase,
  SocialLinksConfig,
  UnifiedAuthResult,
} from './types.ts';
import { COMPANY_INFO, PROJECTS } from './data/siteContent.ts';
import {
  captureAttribution,
  initAnalytics,
  resolveAnalyticsMoney,
  toAnalyticsCartItem,
  toAnalyticsProductItem,
  track,
  trackEvent,
  type Placement,
} from './lib/analytics.ts';
import { reportClientError, type ClientErrorReportPayload } from './lib/errorReporting.ts';
import { isDynamicImportError, lazyWithRetry } from './lib/lazyWithRetry.ts';
import { HomeView } from './components/HomeView.tsx';
import type { CabinetTab } from './components/ClientCabinetView.tsx';
import { SmartImage } from './components/SmartImage.tsx';
import { SocialIcons } from './components/SocialIcons.tsx';
import { VideoBackground } from './components/VideoBackground.tsx';
import { Breadcrumbs } from './components/Breadcrumbs.tsx';
import { OfflineIndicator, PWAInstallButton } from './components/PWAStatusUI.tsx';
import {
  buildBreadcrumbTrail,
  isValidProductCategory,
  type BreadcrumbItem,
} from './lib/breadcrumbs.ts';
import { buildPageJsonLdDocument } from './lib/seoSchema.ts';
import { formatUahFromUsd } from './lib/currency.ts';
import { getSavedLocale, setActiveLocale, tr, type Locale } from './lib/i18n.ts';
import {
  mergeWishlistIds,
  normalizeWishlistIds,
  readWishlistFromStorage,
  toggleWishlistId,
  writeWishlistToStorage,
} from './lib/wishlist.ts';
import {
  readCompareFromStorage,
  resolveCompareProducts,
  toggleCompareId,
  writeCompareToStorage,
} from './lib/compare.ts';
import { CompareBar } from './components/CompareBar.tsx';
import { HeaderScrollProgress } from './components/HeaderScrollProgress.tsx';
import { ScrollToTopButton } from './components/ScrollToTopButton.tsx';
import { VerifiedWarrantyBadge } from './components/VerifiedWarrantyBadge.tsx';

const ShopView = lazyWithRetry(() => import('./components/ShopView.tsx').then((m) => ({ default: m.ShopView })));
const ServicesView = lazyWithRetry(() => import('./components/ServicesView.tsx').then((m) => ({ default: m.ServicesView })));
const ProjectsView = lazyWithRetry(() => import('./components/ProjectsView.tsx').then((m) => ({ default: m.ProjectsView })));
const ContactsView = lazyWithRetry(() => import('./components/ContactsView.tsx').then((m) => ({ default: m.ContactsView })));
const CrmView = lazyWithRetry(() => import('./components/CrmView.tsx').then((m) => ({ default: m.CrmView })));
const AuthPortalView = lazyWithRetry(() => import('./components/AuthPortalView.tsx').then((m) => ({ default: m.AuthPortalView })));
const ClientCabinetView = lazyWithRetry(() => import('./components/ClientCabinetView.tsx').then((m) => ({ default: m.ClientCabinetView })));
const InfoPage = lazyWithRetry(() => import('./components/InfoPage.tsx').then((m) => ({ default: m.InfoPage })));
const ProductModal = lazyWithRetry(() => import('./components/ProductModal.tsx').then((m) => ({ default: m.ProductModal })));
const QuickViewModal = lazyWithRetry(() => import('./components/QuickViewModal.tsx').then((m) => ({ default: m.QuickViewModal })));
const ProductPaybackModal = lazyWithRetry(() => import('./components/ProductPaybackModal.tsx').then((m) => ({ default: m.ProductPaybackModal })));
const CompareModal = lazyWithRetry(() => import('./components/CompareModal.tsx').then((m) => ({ default: m.CompareModal })));
const CaseModal = lazyWithRetry(() => import('./components/CaseModal.tsx').then((m) => ({ default: m.CaseModal })));
const LeadModal = lazyWithRetry(() => import('./components/LeadModal.tsx').then((m) => ({ default: m.LeadModal })));
const CartDrawer = lazyWithRetry(() => import('./components/CartDrawer.tsx').then((m) => ({ default: m.CartDrawer })));

type AppView =
  | 'home'
  | 'shop'
  | 'services'
  | 'projects'
  | 'contacts'
  | 'payment-delivery'
  | 'offer'
  | 'privacy'
  | 'terms'
  | 'login'
  | 'account'
  | 'crm';

const CART_STORAGE_KEY = 'ec_cart_v1';
const OFFLINE_CATALOG_STORAGE_KEY = 'ec_offline_catalog_v1';
const OFFLINE_PROJECTS_STORAGE_KEY = 'ec_offline_projects_v1';
const OFFLINE_RATE_STORAGE_KEY = 'ec_offline_rate_v1';
const VALID_CATS: ProductCategory[] = ['kits', 'inverters', 'batteries', 'panels', 'parts'];

const ROUTE_VIDEO_SEGMENTS: Record<AppView, { start: number; end: number }> = {
  home: { start: 2, end: 15 },
  shop: { start: 16, end: 30 },
  services: { start: 31, end: 44 },
  projects: { start: 45, end: 58 },
  contacts: { start: 8, end: 22 },
  'payment-delivery': { start: 20, end: 36 },
  offer: { start: 34, end: 48 },
  privacy: { start: 28, end: 42 },
  terms: { start: 30, end: 44 },
  login: { start: 12, end: 28 },
  account: { start: 24, end: 40 },
  crm: { start: 40, end: 56 },
};

const DEFAULT_SOCIAL_LINKS: SocialLinksConfig = {
  telegram: 'https://t.me/+380507777172',
  instagram: '',
  facebook: COMPANY_INFO.facebookUrl,
  youtube: '',
  viber: '',
  tiktok: '',
};

function parseRouteFromLocation(): {
  view: AppView;
  cat: ProductCategory | 'all';
  searchQuery: string;
  productId: string | null;
  authMode: 'login' | 'register';
} {
  if (typeof window === 'undefined') {
    return { view: 'home', cat: 'all', searchQuery: '', productId: null, authMode: 'login' };
  }
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const qCat = params.get('cat');
  const cat: ProductCategory | 'all' = qCat && VALID_CATS.includes(qCat as ProductCategory) ? (qCat as ProductCategory) : 'all';
  const searchQuery = params.get('q')?.trim() || '';
  const authMode: 'login' | 'register' = params.get('mode') === 'register' ? 'register' : 'login';

  if (pathname === '/shop') {
    return { view: 'shop', cat, searchQuery, productId: null, authMode };
  }
  if (pathname.startsWith('/shop/category/')) {
    const slug = decodeURIComponent(pathname.slice('/shop/category/'.length).split('/')[0] || '').trim();
    const resolvedCat = isValidProductCategory(slug) ? slug : cat;
    return { view: 'shop', cat: resolvedCat, searchQuery, productId: null, authMode };
  }
  if (pathname.startsWith('/shop/')) {
    const rawId = pathname.slice('/shop/'.length).split('/')[0];
    const decoded = rawId ? decodeURIComponent(rawId) : '';
    if (isValidProductCategory(decoded)) {
      return { view: 'shop', cat: decoded, searchQuery, productId: null, authMode };
    }
    return { view: 'shop', cat: 'all', searchQuery: '', productId: decoded || null, authMode };
  }
  if (pathname === '/services') return { view: 'services', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/projects') return { view: 'projects', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/contacts') return { view: 'contacts', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/payment-delivery') return { view: 'payment-delivery', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/public-offer') return { view: 'offer', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/privacy-policy') return { view: 'privacy', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/terms-of-service') return { view: 'terms', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/login') return { view: 'login', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/account') return { view: 'account', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/crm') return { view: 'crm', cat: 'all', searchQuery: '', productId: null, authMode };
  return { view: 'home', cat: 'all', searchQuery: '', productId: null, authMode };
}

function buildPathForRoute(
  view: AppView,
  cat: ProductCategory | 'all',
  productId?: string | null,
  authMode?: 'login' | 'register',
  searchQuery?: string,
): string {
  if (productId) {
    return `/shop/${encodeURIComponent(productId)}`;
  }
  if (view === 'home') return '/';
  if (view === 'shop') {
    const qs = new URLSearchParams();
    if (cat !== 'all') qs.set('cat', cat);
    if (searchQuery?.trim()) qs.set('q', searchQuery.trim());
    const qStr = qs.toString();
    return qStr ? `/shop?${qStr}` : '/shop';
  }
  if (view === 'login') {
    return authMode === 'register' ? '/login?mode=register' : '/login';
  }
  if (view === 'offer') return '/public-offer';
  if (view === 'privacy') return '/privacy-policy';
  if (view === 'terms') return '/terms-of-service';
  return `/${view}`;
}

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  report: ClientErrorReportPayload | null;
  copied: boolean;
  resetCounter: number;
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    hasError: false,
    report: null,
    copied: false,
    resetCounter: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      report: {
        errorId: 'ec-pending',
        kind: 'react_boundary',
        name: error.name || 'Error',
        message: error.message || 'Unexpected UI error',
        stack: error.stack || '',
        componentStack: '',
        route: typeof window !== 'undefined' ? window.location.pathname : '/',
        locale: getSavedLocale(),
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const payload = reportClientError({
      kind: 'react_boundary',
      error,
      componentStack: errorInfo.componentStack ?? '',
      route: typeof window !== 'undefined' ? window.location.pathname : '/',
      locale: getSavedLocale(),
    });
    this.setState({ report: payload });
  }

  private handleRetry = (): void => {
    const rep = this.state.report;
    if (rep && isDynamicImportError(`${rep.name} ${rep.message}`) && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState((prev) => ({
      hasError: false,
      report: null,
      copied: false,
      resetCounter: prev.resetCounter + 1,
    }));
  };

  private handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    this.setState((prev) => ({
      hasError: false,
      report: null,
      copied: false,
      resetCounter: prev.resetCounter + 1,
    }));
  };

  private handleCopyDiagnostics = async (): Promise<void> => {
    const rep = this.state.report;
    if (!rep || typeof navigator === 'undefined' || !navigator.clipboard) return;
    const text = [
      `Error ID: ${rep.errorId}`,
      `Route: ${rep.route}`,
      `${rep.name}: ${rep.message}`,
      rep.componentStack ? `Component stack:\n${rep.componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      this.setState({ copied: false });
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return <div key={this.state.resetCounter}>{this.props.children}</div>;
    }

    const rep = this.state.report;
    return (
      <div className="min-h-screen bg-[#f6f8fb] text-[#0d1f33] flex items-center justify-center p-5">
        <div
          role="alert"
          className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-7 shadow-sm space-y-5"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#1769aa]">Energo Comfort</div>
              <h1 className="text-lg font-extrabold text-[#0d1f33]">
                {tr('Виникла неочікувана помилка інтерфейсу', 'Возникла непредвиденная ошибка интерфейса')}
              </h1>
              <p className="text-xs text-[#52657a] mt-1 leading-relaxed">
                {tr(
                  'Ми вже зафіксували інформацію про збій для команди розробки. Спробуйте оновити інтерфейс або повернутися на головну сторінку.',
                  'Мы уже зафиксировали информацию о сбое для команды разработки. Попробуйте обновить интерфейс или вернуться на главную страницу.',
                )}
              </p>
            </div>
          </div>

          {rep && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#0d1f33]">
                  ID: {rep.errorId}
                </span>
                <button
                  type="button"
                  onClick={() => void this.handleCopyDiagnostics()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-[#0d1f33] cursor-pointer"
                >
                  {this.state.copied ? <Check className="w-3 h-3 text-[#169374]" /> : <Copy className="w-3 h-3" />}
                  {this.state.copied ? tr('Скопійовано', 'Скопировано') : tr('Копіювати деталі', 'Копировать детали')}
                </button>
              </div>
              <details className="text-[11px] text-[#52657a]">
                <summary className="cursor-pointer font-semibold text-[#1769aa] hover:underline">
                  {tr('Технічні деталі збою', 'Технические детали сбоя')}
                </summary>
                <div className="mt-2 font-mono text-[11px] text-red-700 break-words bg-white border border-slate-200 rounded-lg p-2.5">
                  <div>
                    {rep.name}: {rep.message}
                  </div>
                  {rep.componentStack && (
                    <pre className="mt-1.5 text-[10px] text-slate-600 whitespace-pre-wrap overflow-x-auto max-h-40">
                      {rep.componentStack.trim()}
                    </pre>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {tr('Спробувати відновити', 'Попробовать восстановить')}
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0d1f33] text-xs font-bold cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              {tr('На головну', 'На главную')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[#1769aa] hover:underline text-xs font-bold cursor-pointer"
            >
              {tr('Перезавантажити сторінку', 'Перезагрузить страницу')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function AppContent() {
  const initialRoute = parseRouteFromLocation();
  const [view, setView] = useState<AppView>(initialRoute.view);
  const [authPortalMode, setAuthPortalMode] = useState<'login' | 'register'>(initialRoute.authMode);
  const [shopInitialCat, setShopInitialCat] = useState<ProductCategory | 'all'>(initialRoute.cat);
  const [shopInitialQuery, setShopInitialQuery] = useState<string>(initialRoute.searchQuery);
  const [pendingProductId, setPendingProductId] = useState<string | null>(initialRoute.productId);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => getSavedLocale());
  const lastTrackedPageKeyRef = useRef('');

  useEffect(() => {
    setActiveLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      reportClientError({
        kind: 'window_error',
        error: event.error instanceof Error ? event.error : new Error(event.message || 'Unhandled script error'),
        route: window.location.pathname,
        locale: getSavedLocale(),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : '';
      if (reasonMsg.includes('WebSocket closed without opened')) {
        return;
      }
      reportClientError({
        kind: 'unhandled_rejection',
        error:
          event.reason instanceof Error
            ? event.reason
            : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled promise rejection'),
        route: window.location.pathname,
        locale: getSavedLocale(),
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  function changeLocale(nextLocale: Locale) {
    setActiveLocale(nextLocale);
    setLocale(nextLocale);
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<ProjectCase[]>(PROJECTS);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinksConfig>(DEFAULT_SOCIAL_LINKS);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [usdUahRate, setUsdUahRate] = useState<number | null>(null);

  // Auth tokens held strictly in React memory (never persisted to localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [clientCustomer, setClientCustomer] = useState<CustomerProfile | null>(null);
  const [cabinetRefreshTrigger, setCabinetRefreshTrigger] = useState(0);
  const [cabinetTabRequest, setCabinetTabRequest] = useState<{ tab: CabinetTab; nonce: number } | null>(null);
  const postLoginCabinetTabRef = useRef<CabinetTab | null>(null);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>({ configured: true, mode: 'login', googleEnabled: true });
  const [apiAvailable, setApiAvailable] = useState(true);

  // Cart state persisted in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  // Wishlist state persisted in localStorage + synced to /api/client/wishlist when logged in
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => readWishlistFromStorage());
  const wishlistIdsRef = useRef<string[]>(wishlistIds);
  wishlistIdsRef.current = wishlistIds;

  // Compare state persisted in localStorage (up to 4 products)
  const [compareIds, setCompareIds] = useState<string[]>(() => readCompareFromStorage());
  const compareIdsRef = useRef<string[]>(compareIds);
  compareIdsRef.current = compareIds;
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareLimitNotice, setCompareLimitNotice] = useState(false);
  const compareLimitTimerRef = useRef<number | null>(null);

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [paybackProduct, setPaybackProduct] = useState<Product | null>(null);
  const [selectedCase, setSelectedCase] = useState<ProjectCase | null>(null);

  const breadcrumbItems = useMemo(
    () =>
      buildBreadcrumbTrail({
        view,
        shopCat: shopInitialCat,
        searchQuery: shopInitialQuery,
        selectedProduct,
        selectedCase,
        isRussian: locale === 'ru',
      }),
    [view, shopInitialCat, shopInitialQuery, selectedProduct, selectedCase, locale],
  );
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadPlacement, setLeadPlacement] = useState<Placement>('section');
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);
  const [leadTopic, setLeadTopic] = useState('Інженерний розрахунок системи');
  const [leadNotes, setLeadNotes] = useState('');

  useEffect(() => {
    let rafId = 0;
    const updateStickyVisibility = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const viewport = window.visualViewport;
        const keyboardOpen = Boolean(viewport && viewport.height < window.innerHeight * 0.72);
        setStickyCtaVisible(window.scrollY > window.innerHeight && !keyboardOpen);
      });
    };
    window.addEventListener('scroll', updateStickyVisibility, { passive: true });
    window.addEventListener('resize', updateStickyVisibility, { passive: true });
    window.visualViewport?.addEventListener('resize', updateStickyVisibility);
    updateStickyVisibility();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updateStickyVisibility);
      window.removeEventListener('resize', updateStickyVisibility);
      window.visualViewport?.removeEventListener('resize', updateStickyVisibility);
    };
  }, []);
  const [leadEstimateUsd, setLeadEstimateUsd] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/public/exchange-rate');
        if (!response.ok) throw new Error('Комерційний курс тимчасово недоступний');
        const data = (await response.json()) as { rate?: number };
        if (active && data.rate && Number.isFinite(data.rate)) {
          setUsdUahRate(data.rate);
          try {
            localStorage.setItem(OFFLINE_RATE_STORAGE_KEY, String(data.rate));
          } catch {
            // ignore storage quota errors
          }
        }
      } catch {
        if (!active) return;
        try {
          const cachedRate = Number(localStorage.getItem(OFFLINE_RATE_STORAGE_KEY));
          if (Number.isFinite(cachedRate) && cachedRate > 0) {
            setUsdUahRate(cachedRate);
            return;
          }
        } catch {
          // ignore storage errors
        }
        setUsdUahRate(null);
      }
    };
    void loadExchangeRate();
    const timer = window.setInterval(() => void loadExchangeRate(), 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    writeWishlistToStorage(wishlistIds);
  }, [wishlistIds]);

  useEffect(() => {
    writeCompareToStorage(compareIds);
  }, [compareIds]);

  useEffect(() => {
    return () => {
      if (compareLimitTimerRef.current !== null) {
        window.clearTimeout(compareLimitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!clientToken) return;
    let active = true;
    const syncOnSignIn = async () => {
      try {
        const resp = await fetch('/api/client/wishlist', {
          headers: { Authorization: `Bearer ${clientToken}` },
        });
        if (!resp.ok || !active) return;
        const data = (await resp.json()) as { productIds?: unknown };
        const serverIds = normalizeWishlistIds(data.productIds);
        const merged = mergeWishlistIds(serverIds, wishlistIdsRef.current);
        if (!active) return;
        setWishlistIds(merged);
        const differs =
          merged.length !== serverIds.length || merged.some((id, idx) => serverIds[idx] !== id);
        if (differs) {
          await fetch('/api/client/wishlist', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${clientToken}`,
            },
            body: JSON.stringify({ productIds: merged }),
          });
        }
      } catch {
        // Keep local wishlist if network call fails
      }
    };
    void syncOnSignIn();
    return () => {
      active = false;
    };
  }, [clientToken]);

  const fetchCatalog = useCallback(async () => {
    try {
      const resp = await fetch('/api/catalog');
      const isJson = resp.headers.get('content-type')?.includes('application/json');
      if (resp.ok && isJson) {
        const data = (await resp.json()) as { items: Product[] };
        setProducts(data.items);
        setApiAvailable(true);
        try {
          localStorage.setItem(OFFLINE_CATALOG_STORAGE_KEY, JSON.stringify(data.items));
        } catch {
          // ignore storage quota errors
        }
        return;
      }
      throw new Error('Catalog API unavailable');
    } catch {
      setApiAvailable(false);
      try {
        const cachedRaw = localStorage.getItem(OFFLINE_CATALOG_STORAGE_KEY);
        if (cachedRaw) {
          const cachedItems = JSON.parse(cachedRaw) as Product[];
          if (Array.isArray(cachedItems) && cachedItems.length > 0) {
            setProducts(cachedItems);
            return;
          }
        }
      } catch {
        // fallback to bundled seed catalog
      }
      try {
        const seed = await import('../server/seed/catalog.json');
        setProducts(seed.default as Product[]);
      } catch {
        // ignore fallback load failure
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/status');
      const isJson = resp.headers.get('content-type')?.includes('application/json');
      if (resp.ok && isJson) {
        const data = (await resp.json()) as AdminAuthStatus;
        setAuthStatus(data);
        setApiAvailable(true);
      } else {
        setApiAvailable(false);
      }
    } catch {
      setApiAvailable(false);
    }
  }, []);

  const fetchPublicConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/public/config');
      const isJson = resp.headers.get('content-type')?.includes('application/json');
      if (resp.ok && isJson) {
        const cfg = (await resp.json()) as AnalyticsConfig & { socialLinks?: SocialLinksConfig };
        initAnalytics(cfg);
        if (cfg.socialLinks) {
          setSocialLinks(cfg.socialLinks);
        }
        setAnalyticsReady(true);
      }
    } catch {
      // Static mode without backend config API: skip remote pixel init silently
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    if (!adminToken) return;
    const resp = await fetch('/api/crm/deals', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resp.status === 401) {
      setAdminToken(null);
      return;
    }
    if (resp.ok) {
      const data = (await resp.json()) as { deals: Deal[] };
      setDeals(data.deals);
    }
  }, [adminToken]);

  const fetchCrmStatus = useCallback(async () => {
    if (!adminToken) return;
    const resp = await fetch('/api/crm/status', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resp.ok) {
      const data = (await resp.json()) as { telegramConfigured?: boolean };
      setTelegramConfigured(Boolean(data.telegramConfigured));
    }
  }, [adminToken]);

  const fetchProjects = useCallback(async () => {
    try {
      const resp = await fetch('/api/projects');
      const isJson = resp.headers.get('content-type')?.includes('application/json');
      if (resp.ok && isJson) {
        const data = (await resp.json()) as { projects: ProjectCase[] };
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          const mergedProjects = data.projects.map((project) => {
            const builtIn = PROJECTS.find((item) => item.id === project.id);
            if (!builtIn) return project;
            return {
              ...project,
              tagRu: project.tagRu ?? builtIn.tagRu,
              titleRu: project.titleRu ?? builtIn.titleRu,
              taskRu: project.taskRu ?? builtIn.taskRu,
              solutionRu: project.solutionRu ?? builtIn.solutionRu,
              specsRu: project.specsRu ?? builtIn.specsRu,
              resultRu: project.resultRu ?? builtIn.resultRu,
            };
          });
          setProjects(mergedProjects);
          try {
            localStorage.setItem(OFFLINE_PROJECTS_STORAGE_KEY, JSON.stringify(mergedProjects));
          } catch {
            // ignore storage quota errors
          }
        }
      }
    } catch {
      try {
        const cachedRaw = localStorage.getItem(OFFLINE_PROJECTS_STORAGE_KEY);
        if (cachedRaw) {
          const cachedProjects = JSON.parse(cachedRaw) as ProjectCase[];
          if (Array.isArray(cachedProjects) && cachedProjects.length > 0) {
            setProjects(cachedProjects);
            return;
          }
        }
      } catch {
        // keep built-in PROJECTS fallback
      }
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
    void fetchProjects();
    void fetchPublicConfig();
    void fetchAuthStatus();
  }, [fetchCatalog, fetchProjects, fetchPublicConfig, fetchAuthStatus]);

  useEffect(() => {
    if (adminToken) {
      void fetchDeals();
      void fetchCrmStatus();
    } else {
      setDeals([]);
    }
  }, [adminToken, fetchDeals, fetchCrmStatus]);

  // Open product modal automatically when visiting /shop/<id>
  useEffect(() => {
    if (!pendingProductId || products.length === 0) return;
    const found = products.find((p) => p.id === pendingProductId);
    if (found) {
      setSelectedProduct(found);
    }
    setPendingProductId(null);
  }, [pendingProductId, products]);

  // Browser Back/Forward synchronization
  useEffect(() => {
    function handlePopState() {
      const parsed = parseRouteFromLocation();
      setView(parsed.view);
      setAuthPortalMode(parsed.authMode);
      setShopInitialCat(parsed.cat);
      setShopInitialQuery(parsed.searchQuery);
      if (parsed.productId) {
        const match = products.find((p) => p.id === parsed.productId);
        if (match) {
          setSelectedProduct(match);
        } else {
          setPendingProductId(parsed.productId);
        }
      } else {
        setSelectedProduct(null);
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [products]);

  // Dynamic Client-side SEO (<title>, meta description, robots, og:*, twitter:*, canonical, JSON-LD)
  useEffect(() => {
    let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
    let description =
      'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
    let ogImage = `${window.location.origin}/assets/energocomfort/sto_110kw.jpg`;
    let ogType = 'website';
    const isPrivateView = view === 'crm' || view === 'login' || view === 'account';

    if (selectedProduct) {
      const priceText = selectedProduct.price > 0 ? formatUahFromUsd(selectedProduct.price, usdUahRate) : 'За запитом';
      const maxTitleLen = 46;
      const shortProdTitle =
        selectedProduct.title.length > maxTitleLen
          ? `${selectedProduct.title.slice(0, maxTitleLen - 1).trimEnd()}…`
          : selectedProduct.title;
      title = `${shortProdTitle} (${priceText}) — Energo Comfort`;
      description = (
        selectedProduct.description.trim() ||
        `${selectedProduct.title} (${selectedProduct.brand}). ${selectedProduct.statusLabel}. Доставка зі складу в Одесі, гарантія та професійний монтаж.`
      ).slice(0, 158);
      if (selectedProduct.img) {
        ogImage = selectedProduct.img.startsWith('http')
          ? selectedProduct.img
          : `${window.location.origin}${selectedProduct.img.startsWith('/') ? '' : '/'}${selectedProduct.img}`;
      }
      ogType = 'product';
    } else if (view === 'shop') {
      const catTitles: Record<ProductCategory | 'all', string> = {
        all: 'Каталог обладнання СЕС та резервного живлення',
        kits: 'Готові комплекти резервного живлення та СЕС',
        inverters: 'Гібридні та мережеві інвертори Deye, SolaX, Solis',
        batteries: 'Акумулятори LiFePO4 Deye, Dyness в Одесі',
        panels: 'Сонячні панелі Jinko, Trina, Longi в Одесі',
        parts: 'Комплектуючі та захист AC/DC для СЕС',
      };
      title = `${catTitles[shopInitialCat]} — Energo Comfort`;
      description = `Каталог із ${products.length || 250} позицій для автономного живлення та СЕС зі складу в Одесі: Deye, SolaX, Solis, Dyness, Jinko. Замовляйте з доставкою!`;
    } else if (view === 'services') {
      title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
      description =
        'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
    } else if (view === 'projects') {
      title = 'Реалізовані проєкти — Energo Comfort Одеса';
      description =
        'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
    } else if (view === 'contacts') {
      title = 'Контакти та умови співпраці — Energo Comfort Одеса';
      description =
        'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
    } else if (view === 'payment-delivery') {
      title = 'Оплата і доставка обладнання — Energo Comfort Одеса';
      description =
        'Способи оплати (ФОП/ТОВ з ПДВ, готівка, переказ), самовивіз зі складу в Одесі на вул. Європейська 93 та доставка по Україні Новою Поштою.';
    } else if (view === 'offer') {
      title = 'Публічна оферта та гарантія — Energo Comfort';
      description =
        'Умови публічного договору купівлі-продажу, гарантійного обслуговування та повернення обладнання в інтернет-магазині Energo Comfort.';
    } else if (view === 'privacy') {
      title = 'Політика конфіденційності — Energo Comfort';
      description =
        'Порядок збору, обробки та захисту персональних даних користувачів інтернет-магазину Energo Comfort.';
    } else if (view === 'terms') {
      title = 'Умови використання сервісу — Energo Comfort';
      description =
        'Правила користування сайтом, онлайн-калькуляторами, каталогом та оформлення замовлень в Energo Comfort.';
    } else if (view === 'login') {
      title = 'Вхід та реєстрація — Energo Comfort';
    } else if (view === 'account') {
      title = 'Особистий кабінет — Energo Comfort';
    } else if (view === 'crm') {
      title = 'CRM — Energo Comfort';
    }

    document.title = title;
    const canonicalPath = selectedProduct
      ? `/shop/${encodeURIComponent(selectedProduct.id)}`
      : view === 'shop'
        ? shopInitialCat !== 'all'
          ? `/shop?cat=${encodeURIComponent(shopInitialCat)}`
          : '/shop'
        : buildPathForRoute(view, shopInitialCat);
    const canonicalUrl = `${window.location.origin}${canonicalPath}`;

    const ensureMeta = (attrName: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attrName}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const removeMeta = (attrName: 'name' | 'property', key: string) => {
      document.querySelector(`meta[${attrName}="${key}"]`)?.remove();
    };

    ensureMeta('name', 'description', description);
    ensureMeta('name', 'robots', isPrivateView ? 'noindex, nofollow' : 'index, follow');
    ensureMeta('property', 'og:type', ogType);
    ensureMeta('property', 'og:title', title);
    ensureMeta('property', 'og:description', description);
    ensureMeta('property', 'og:url', canonicalUrl);
    ensureMeta('property', 'og:image', ogImage);
    ensureMeta('property', 'og:locale', locale === 'ru' ? 'ru_UA' : 'uk_UA');
    ensureMeta('name', 'twitter:title', title);
    ensureMeta('name', 'twitter:description', description);
    ensureMeta('name', 'twitter:image', ogImage);

    if (selectedProduct) {
      const productUah = selectedProduct.price > 0 && usdUahRate ? Math.round(selectedProduct.price * usdUahRate) : null;
      ensureMeta('property', 'product:brand', selectedProduct.brand || 'Energo Comfort');
      ensureMeta('property', 'product:availability', selectedProduct.inStock ? 'in stock' : 'available for order');
      ensureMeta('property', 'product:condition', 'new');
      ensureMeta('property', 'product:retailer_item_id', selectedProduct.sku || selectedProduct.id);
      if (productUah) {
        ensureMeta('property', 'product:price:amount', String(productUah));
        ensureMeta('property', 'product:price:currency', 'UAH');
      } else if (selectedProduct.price > 0) {
        ensureMeta('property', 'product:price:amount', String(selectedProduct.price));
        ensureMeta('property', 'product:price:currency', 'USD');
      } else {
        removeMeta('property', 'product:price:amount');
        removeMeta('property', 'product:price:currency');
      }
    } else {
      removeMeta('property', 'product:brand');
      removeMeta('property', 'product:availability');
      removeMeta('property', 'product:condition');
      removeMeta('property', 'product:retailer_item_id');
      removeMeta('property', 'product:price:amount');
      removeMeta('property', 'product:price:currency');
    }

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.setAttribute('href', canonicalUrl);
    }

    const existingJsonLdEl = document.getElementById('ec-jsonld');
    if (isPrivateView) {
      existingJsonLdEl?.remove();
    } else {
      const categoryProducts =
        view === 'shop' && !selectedProduct
          ? shopInitialCat === 'all'
            ? products
            : products.filter((p) => p.cat === shopInitialCat)
          : undefined;
      const jsonLdDoc = buildPageJsonLdDocument({
        view,
        baseUrl: window.location.origin,
        canonicalUrl,
        title,
        description,
        shopCat: shopInitialCat,
        searchQuery: shopInitialQuery,
        selectedProduct,
        selectedCase,
        categoryProducts,
        productImage: ogImage,
        usdUahRate,
        socialLinks,
        isRussian: locale === 'ru',
        breadcrumbItems,
      });
      if (jsonLdDoc) {
        let jsonLdEl = existingJsonLdEl as HTMLScriptElement | null;
        if (!jsonLdEl) {
          jsonLdEl = document.createElement('script');
          jsonLdEl.type = 'application/ld+json';
          jsonLdEl.id = 'ec-jsonld';
          document.head.appendChild(jsonLdEl);
        }
        jsonLdEl.textContent = JSON.stringify(jsonLdDoc);
      }
    }

    if (analyticsReady && !isPrivateView) {
      const pageKey = `${canonicalUrl}|${selectedProduct?.id ?? ''}`;
      if (lastTrackedPageKeyRef.current !== pageKey) {
        lastTrackedPageKeyRef.current = pageKey;
        trackEvent('page_view', {
          page_path: `${window.location.pathname}${window.location.search}`,
          page_location: window.location.href,
          page_title: title,
          locale,
        });
      }
    }
  }, [view, shopInitialCat, shopInitialQuery, selectedProduct, selectedCase, breadcrumbItems, products, projects.length, usdUahRate, locale, socialLinks, analyticsReady]);

  useEffect(() => {
    if (!analyticsReady || view === 'crm' || view === 'login' || view === 'account') return;
    const fired = new Set<number>();
    const routePath = `${window.location.pathname}${window.location.search}`;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 150) return;
        const pct = Math.round((window.scrollY / docHeight) * 100);
        for (const threshold of [50, 90]) {
          if (pct >= threshold && !fired.has(threshold)) {
            fired.add(threshold);
            trackEvent('scroll_depth', {
              percent_scrolled: threshold,
              page_path: routePath,
            });
          }
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, [analyticsReady, view, shopInitialCat, selectedProduct]);

  const selectedProductRef = useRef(selectedProduct);
  selectedProductRef.current = selectedProduct;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedProductRef.current) {
          setSelectedProduct(null);
          if (window.location.pathname.startsWith('/shop/')) {
            window.history.back();
          }
        }
        setQuickViewProduct(null);
        setPaybackProduct(null);
        setSelectedCase(null);
        setLeadModalOpen(false);
        setCartOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function navigateTo(
    nextView: AppView,
    cat?: ProductCategory | 'all',
    authMode: 'login' | 'register' = 'login',
  ) {
    const resolvedCat = nextView === 'shop' ? cat ?? 'all' : 'all';
    if (nextView === 'shop') {
      setShopInitialCat(resolvedCat);
      if (!cat || cat === 'all') {
        // clear stale search query only when navigating fresh via menu unless specified
        if (nextView === 'shop' && cat !== undefined) setShopInitialQuery('');
      }
    }
    if (nextView === 'login') {
      setAuthPortalMode(authMode);
    }
    if ((nextView === 'crm' || nextView === 'login' || nextView === 'account') && !adminToken) {
      void fetchAuthStatus();
    }
    setSelectedProduct(null);
    setQuickViewProduct(null);
    setPaybackProduct(null);
    setView(nextView);
    setMobileMenuOpen(false);
    const targetUrl = buildPathForRoute(nextView, resolvedCat, null, authMode, nextView === 'shop' && cat === undefined ? shopInitialQuery : '');
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleUnifiedAuthenticated(result: UnifiedAuthResult) {
    if (result.accountType === 'staff') {
      postLoginCabinetTabRef.current = null;
      setAdminToken(result.token);
      setClientToken(null);
      setClientCustomer(null);
      void fetchAuthStatus();
      navigateTo('crm');
      return;
    }
    const targetTab = postLoginCabinetTabRef.current;
    postLoginCabinetTabRef.current = null;
    if (targetTab) {
      setCabinetTabRequest({ tab: targetTab, nonce: Date.now() });
    }
    setClientToken(result.token);
    setClientCustomer(result.customer ?? null);
    setAdminToken(null);
    setCabinetRefreshTrigger((n) => n + 1);
    navigateTo('account');
  }

  const handleClientLogout = useCallback(() => {
    setClientToken(null);
    setClientCustomer(null);
    setCabinetTabRequest(null);
    void import('./lib/firebaseAuth.ts').then((m) => m.signOutFirebase());
    setSelectedProduct(null);
    setQuickViewProduct(null);
    setPaybackProduct(null);
    setView('home');
    setMobileMenuOpen(false);
    if (window.location.pathname + window.location.search !== '/') {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAdminLogout = useCallback(() => {
    setAdminToken(null);
    void import('./lib/firebaseAuth.ts').then((m) => m.signOutFirebase());
    void fetchAuthStatus();
  }, [fetchAuthStatus]);

  function handleNavAnchor(
    e: MouseEvent<HTMLAnchorElement>,
    nextView: AppView,
    cat?: ProductCategory | 'all',
    authMode: 'login' | 'register' = 'login',
  ) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateTo(nextView, cat, authMode);
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product);
    const targetUrl = buildPathForRoute('shop', shopInitialCat, product.id);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    const money = resolveAnalyticsMoney(product.price, usdUahRate);
    trackEvent('view_item', {
      item_id: product.sku || product.id,
      item_name: product.title,
      item_category: product.cat,
      value: money.value,
      currency: money.currency,
      items: [toAnalyticsProductItem(product, usdUahRate, 1)],
    });
  }

  function handleCloseProductModal() {
    setSelectedProduct(null);
    if (window.location.pathname.startsWith('/shop/')) {
      const targetUrl = buildPathForRoute(view, shopInitialCat, null, undefined, shopInitialQuery);
      window.history.pushState({}, '', targetUrl);
    }
  }

  function handleQuickViewProduct(product: Product) {
    setQuickViewProduct(product);
    const money = resolveAnalyticsMoney(product.price, usdUahRate);
    trackEvent('view_item', {
      item_id: product.sku || product.id,
      item_name: product.title,
      item_category: product.cat,
      value: money.value,
      currency: money.currency,
      items: [toAnalyticsProductItem(product, usdUahRate, 1)],
    });
  }

  function handleShopCategorySync(nextCat: ProductCategory | 'all') {
    setShopInitialCat(nextCat);
    const targetUrl = buildPathForRoute('shop', nextCat, null, undefined, shopInitialQuery);
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.replaceState({}, '', targetUrl);
    }
  }

  function handleShopQuerySync(nextQuery: string) {
    setShopInitialQuery(nextQuery);
    const targetUrl = buildPathForRoute('shop', shopInitialCat, null, undefined, nextQuery);
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.replaceState({}, '', targetUrl);
    }
  }

  function handleBreadcrumbNavigate(item: BreadcrumbItem) {
    setSelectedCase(null);
    if (item.view === 'shop') {
      const nextCat = item.cat ?? 'all';
      if (item.id === 'shop') {
        setShopInitialQuery('');
      }
      navigateTo('shop', nextCat);
      return;
    }
    navigateTo(item.view);
  }

  function handleAddToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          title: product.title,
          price: product.price,
          qty: 1,
          img: product.img,
        },
      ];
    });
    const money = resolveAnalyticsMoney(product.price, usdUahRate);
    trackEvent('add_to_cart', {
      item_id: product.sku || product.id,
      item_name: product.title,
      item_category: product.cat,
      value: money.value,
      currency: money.currency,
      items: [toAnalyticsProductItem(product, usdUahRate, 1)],
    });
    setCartOpen(true);
  }

  function handleOpenCart() {
    if (cart.length > 0) {
      const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
      const money = resolveAnalyticsMoney(subtotal, usdUahRate);
      trackEvent('begin_checkout', {
        value: money.value,
        currency: money.currency,
        items_count: cart.reduce((s, i) => s + i.qty, 0),
        items: cart.map((item) => toAnalyticsCartItem(item, usdUahRate)),
      });
    }
    setCartOpen(true);
  }

  function handleUpdateCartQty(id: string, delta: number) {
    const existing = cart.find((i) => i.id === id);
    if (existing && existing.qty + delta <= 0) {
      const money = resolveAnalyticsMoney(existing.price * existing.qty, usdUahRate);
      trackEvent('remove_from_cart', {
        value: money.value,
        currency: money.currency,
        items: [toAnalyticsCartItem(existing, usdUahRate)],
      });
    }
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  }

  function handleRemoveFromCart(id: string) {
    const existing = cart.find((i) => i.id === id);
    if (existing) {
      const money = resolveAnalyticsMoney(existing.price * existing.qty, usdUahRate);
      trackEvent('remove_from_cart', {
        value: money.value,
        currency: money.currency,
        items: [toAnalyticsCartItem(existing, usdUahRate)],
      });
    }
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  const pushWishlistToServer = useCallback(
    async (nextIds: string[]) => {
      if (!clientToken) return;
      try {
        await fetch('/api/client/wishlist', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clientToken}`,
          },
          body: JSON.stringify({ productIds: nextIds }),
        });
      } catch {
        // Ignore transient network errors; local state & storage remain updated
      }
    },
    [clientToken],
  );

  const handleToggleWishlist = useCallback(
    (product: Product) => {
      const nextIds = toggleWishlistId(wishlistIdsRef.current, product.id);
      setWishlistIds(nextIds);
      void pushWishlistToServer(nextIds);
    },
    [pushWishlistToServer],
  );

  const handleClearWishlist = useCallback(() => {
    setWishlistIds([]);
    void pushWishlistToServer([]);
  }, [pushWishlistToServer]);

  const compareProducts = useMemo(
    () => resolveCompareProducts(compareIds, products),
    [compareIds, products],
  );

  const handleToggleCompare = useCallback((product: Product) => {
    const result = toggleCompareId(compareIdsRef.current, product.id);
    if (result.limitReached) {
      setCompareLimitNotice(true);
      if (compareLimitTimerRef.current !== null) {
        window.clearTimeout(compareLimitTimerRef.current);
      }
      compareLimitTimerRef.current = window.setTimeout(() => {
        setCompareLimitNotice(false);
        compareLimitTimerRef.current = null;
      }, 3200);
      return;
    }
    setCompareLimitNotice(false);
    setCompareIds(result.ids);
  }, []);

  const handleRemoveCompare = useCallback((productId: string) => {
    setCompareLimitNotice(false);
    setCompareIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const handleClearCompare = useCallback(() => {
    setCompareLimitNotice(false);
    setCompareIds([]);
    setCompareModalOpen(false);
  }, []);

  const handleAddManyToCart = useCallback((items: Product[]) => {
    const buyable = items.filter((p) => !p.isKit && p.price > 0);
    if (buyable.length === 0) return;
    setCart((prev) => {
      const next = [...prev];
      for (const product of buyable) {
        const idx = next.findIndex((i) => i.id === product.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        } else {
          next.push({
            id: product.id,
            sku: product.sku,
            title: product.title,
            price: product.price,
            qty: 1,
            img: product.img,
          });
        }
      }
      return next;
    });
    setCartOpen(true);
  }, []);

  function handleOpenWishlist() {
    if (clientToken) {
      setCabinetTabRequest({ tab: 'wishlist', nonce: Date.now() });
      navigateTo('account');
      return;
    }
    postLoginCabinetTabRef.current = 'wishlist';
    navigateTo('login', undefined, 'login');
  }

  function openLeadModal(
    topic: string,
    estimatedTotalUsd?: number,
    placement: Placement = 'section',
    notes = '',
  ) {
    setLeadTopic(topic);
    setLeadEstimateUsd(estimatedTotalUsd);
    setLeadPlacement(placement);
    setLeadNotes(notes);
    setLeadModalOpen(true);
  }

  const cartTotalCount = cart.reduce((s, i) => s + i.qty, 0);
  const activeDealsCount = deals.filter((d) => d.stage !== 'archived').length;
  const crmButtonLabel = adminToken
    ? `CRM (${activeDealsCount})`
    : 'CRM';

  const activeVideoSegment = ROUTE_VIDEO_SEGMENTS[view] ?? ROUTE_VIDEO_SEGMENTS.home;

  return (
    <div className={`min-h-screen flex flex-col relative overflow-x-clip text-[#172636] ${stickyCtaVisible && view !== 'crm' ? 'pb-16 lg:pb-0' : ''}`}>
      <VideoBackground
        src="https://www.youtube.com/watch?v=o7fTs8et1QM"
        tone="light"
        tint="daylight"
        start={activeVideoSegment.start}
        end={activeVideoSegment.end}
        autoPlay
        loop
        muted
        playsInline
        brightness={0.72}
      />

      {/* Slim Utility Strip (Odessa Office + Store/CRM Workspace Switcher) */}
      <div className="bg-gradient-to-r from-[#07264d]/92 via-[#0a366c]/90 to-[#07264d]/92 backdrop-blur-md text-sky-100/90 text-xs py-1.5 border-b border-sky-200/20">
        <div className="ec-container flex items-center justify-between gap-2 sm:gap-4">
          <div className="truncate min-w-0">
            <span className="hidden md:inline">{COMPANY_INFO.address} · </span>
            <a
              href={COMPANY_INFO.phone1Href}
              onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })}
              className="font-semibold text-white hover:text-sky-200 tabular-nums text-[11px] sm:text-xs"
            >
              {COMPANY_INFO.phone1}
            </a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="inline-flex items-center rounded-md border border-sky-200/20 bg-white/10 p-0.5" aria-label={tr('Мова сайту')}>
              {(['uk', 'ru'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  lang={option}
                  aria-pressed={locale === option}
                  onClick={() => changeLocale(option)}
                  className={`rounded px-2 py-1 text-[10px] font-extrabold transition-colors ${
                    locale === option ? 'bg-white text-[#07213e]' : 'text-sky-100 hover:text-white'
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="hidden sm:block">
              <SocialIcons links={socialLinks} variant="header" />
            </div>
            <div className="flex items-center gap-1.5">
              <PWAInstallButton />
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  view !== 'crm' && view !== 'login' && view !== 'account'
                    ? 'bg-white/15 text-white'
                    : 'text-sky-100 hover:text-white'
                }`}
              >
                {tr('Магазин')}
              </button>
              {adminToken ? (
                <button
                  type="button"
                  onClick={() => navigateTo('crm')}
                  className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    view === 'crm' ? 'bg-[#f59e0b] text-[#07213e]' : 'bg-white/10 text-amber-200 hover:bg-white/20'
                  }`}
                >
                  {crmButtonLabel}
                </button>
              ) : clientToken ? (
                <button
                  type="button"
                  onClick={() => navigateTo('account')}
                  className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    view === 'account' ? 'bg-[#0b66b2] text-white' : 'bg-white/10 text-sky-200 hover:bg-white/20'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span className="max-w-[90px] truncate">{clientCustomer?.name?.split(' ')[0] || tr('Кабінет', 'Кабинет')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('login', undefined, 'login')}
                  className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    view === 'login' ? 'bg-[#f59e0b] text-[#07213e]' : 'bg-white/10 text-amber-200 hover:bg-white/20'
                  }`}
                >
                  <span className="sm:hidden">{tr('Увійти', 'Войти')}</span>
                  <span className="hidden sm:inline">{tr('Увійти / Реєстрація', 'Войти / Регистрация')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Sticky Header: Responsive 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip bg-gradient-to-r from-[#072750]/92 via-[#0d488a]/88 to-[#072750]/92 backdrop-blur-xl border-b border-sky-300/25 shadow-[0_8px_28px_rgba(4,18,40,0.28)]">
        <HeaderScrollProgress routeKey={`${view}|${shopInitialCat}|${selectedProduct?.id ?? ''}|${loadingCatalog}`} />
        <div className="ec-container h-14 sm:h-16 lg:h-[68px] grid grid-cols-[minmax(0,1fr)_auto] lg:flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
          {/* Zone 1: Crisp Solar Brand Emblem & Wordmark */}
          <a
            href="/"
            onClick={(e) => handleNavAnchor(e, 'home')}
            className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-full justify-self-start lg:shrink-0 text-left overflow-hidden group"
          >
            <SmartImage
              src="/assets/energocomfort/logo_mark.svg"
              alt="Energo Comfort"
              priority
              className="h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-xl shadow-[0_4px_14px_rgba(14,165,233,0.32)] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <span className="flex flex-col min-w-0 leading-none">
              <span className="text-[13.5px] min-[390px]:text-[15px] sm:text-lg lg:text-[20px] font-extrabold tracking-tight text-white whitespace-nowrap truncate">
                Energo Comfort
              </span>
              <span className="hidden min-[380px]:block sm:hidden mt-0.5 text-[9.5px] font-semibold tracking-wide text-sky-200/90 whitespace-nowrap truncate">
                {tr('СЕС · АКБ', 'СЭС · АКБ')}
              </span>
              <span className="hidden sm:block mt-0.5 text-[10.5px] lg:text-[11px] font-semibold tracking-wide text-sky-200/90 whitespace-nowrap truncate">
                {tr('СЕС та резервне живлення', 'СЭС и резервное питание')}
              </span>
            </span>
          </a>

          {/* Zone 2: 5 concise single-line nav links (desktop lg+) */}
          <nav aria-label={tr('Головна навігація')} className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-[13px] xl:text-sm font-semibold text-sky-100/85 min-w-0 overflow-hidden">
            <a
              href="/"
              onClick={(e) => handleNavAnchor(e, 'home')}
              className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-white transition-colors ${
                view === 'home' ? 'text-white font-bold underline decoration-sky-300/90 decoration-2 underline-offset-[6px]' : ''
              }`}
            >
              {tr('Головна')}
            </a>
            <a
              href="/shop"
              onClick={(e) => handleNavAnchor(e, 'shop', 'all')}
              className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-white transition-colors ${
                view === 'shop' ? 'text-white font-bold underline decoration-sky-300/90 decoration-2 underline-offset-[6px]' : ''
              }`}
            >
              {tr('Обладнання')}
            </a>
            <a
              href="/services"
              onClick={(e) => handleNavAnchor(e, 'services')}
              className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-white transition-colors ${
                view === 'services' ? 'text-white font-bold underline decoration-sky-300/90 decoration-2 underline-offset-[6px]' : ''
              }`}
            >
              {tr('Послуги')}
            </a>
            <a
              href="/projects"
              onClick={(e) => handleNavAnchor(e, 'projects')}
              className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-white transition-colors ${
                view === 'projects' ? 'text-white font-bold underline decoration-sky-300/90 decoration-2 underline-offset-[6px]' : ''
              }`}
            >
              {tr('Проєкти')}
            </a>
            <a
              href="/contacts"
              onClick={(e) => handleNavAnchor(e, 'contacts')}
              className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-white transition-colors ${
                view === 'contacts' ? 'text-white font-bold underline decoration-sky-300/90 decoration-2 underline-offset-[6px]' : ''
              }`}
            >
              {tr('Контакти')}
            </a>
          </nav>

          {/* Zone 3: Quick Lead CTA + Wishlist (sm+) + Compact Cart Button + Mobile/Tablet Menu (3 harmonious buttons on mobile) */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 justify-self-end">
            <button
              type="button"
              onClick={() => openLeadModal('Підбір рішення з шапки сайту')}
              className="inline-flex items-center justify-center h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg bg-gradient-to-r from-[#0ea5e9] to-[#0b66b2] hover:from-[#38bdf8] hover:to-[#0284c7] border border-sky-300/35 text-white text-[11px] sm:text-xs font-bold shadow-[0_4px_14px_rgba(14,165,233,0.3)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">{tr('Підібрати', 'Подобрать')}</span>
              <span className="hidden sm:inline">{tr('Підібрати рішення')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWishlist}
              aria-label={`${tr('Список бажань', 'Список желаний')} (${wishlistIds.length})`}
              title={tr('Список бажань', 'Список желаний')}
              className="hidden sm:inline-flex items-center justify-center gap-1 h-8 sm:h-9 px-2.5 rounded-lg border border-sky-200/30 bg-white/10 hover:bg-white/18 hover:border-sky-200/50 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Heart className={`w-4 h-4 shrink-0 ${wishlistIds.length > 0 ? 'fill-rose-400 text-rose-400' : 'text-sky-100'}`} />
              <span className="font-mono text-[11px] text-sky-100 tabular-nums leading-none">
                {wishlistIds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCart}
              aria-label={`${tr('Кошик')} (${cartTotalCount})`}
              title={tr('Кошик обладнання', 'Корзина оборудования')}
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 xl:px-3.5 rounded-lg border border-sky-200/30 bg-[#051a36]/85 hover:bg-[#07264d] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#fbbf24] shrink-0" />
              <span className="hidden xl:inline">{tr('Кошик')}</span>
              <span className="font-mono text-[11px] bg-white/15 px-1.5 py-0.5 rounded tabular-nums leading-none">
                {cartTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={tr('Меню', 'Меню')}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-sky-200/30 bg-white/10 hover:bg-white/18 flex items-center justify-center text-white cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label={tr('Мобільна навігація', 'Мобильная навигация')}
            className="lg:hidden w-full max-w-full max-h-[calc(100dvh-3.75rem)] overflow-y-auto overscroll-contain border-t border-sky-200/20 bg-gradient-to-b from-[#072750]/97 via-[#062145]/97 to-[#041731]/98 backdrop-blur-xl px-4 pt-3.5 pb-5 space-y-4"
          >
            {/* Quick Commerce Bar (mobile < sm) */}
            <div className="sm:hidden grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenWishlist();
                }}
                className="min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-sky-200/20 text-xs font-bold text-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Heart className={`w-4 h-4 shrink-0 ${wishlistIds.length > 0 ? 'fill-rose-400 text-rose-400' : 'text-sky-200'}`} />
                  <span className="truncate">{tr('Обране', 'Избранное')}</span>
                </span>
                <span className="font-mono text-[11px] bg-white/15 px-1.5 py-0.5 rounded tabular-nums leading-none shrink-0">
                  {wishlistIds.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenCart();
                }}
                className="min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#051a36]/90 hover:bg-[#07264d] border border-sky-200/20 text-xs font-bold text-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <ShoppingBag className="w-4 h-4 text-[#fbbf24] shrink-0" />
                  <span className="truncate">{tr('Кошик', 'Корзина')}</span>
                </span>
                <span className="font-mono text-[11px] bg-white/15 px-1.5 py-0.5 rounded tabular-nums leading-none shrink-0">
                  {cartTotalCount}
                </span>
              </button>
            </div>

            {/* Tier 1: Primary Storefront Navigation */}
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-sky-200/65">
                {tr('Навігація', 'Навигация')}
              </p>
              <div className="rounded-xl border border-sky-200/18 bg-white/[0.06] divide-y divide-sky-200/10 overflow-hidden">
                {(
                  [
                    {
                      v: 'home' as const,
                      href: '/',
                      label: tr('Головна'),
                      icon: Home,
                      count: null,
                    },
                    {
                      v: 'shop' as const,
                      href: '/shop',
                      label: tr('Обладнання'),
                      icon: Package,
                      count: products.length,
                    },
                    {
                      v: 'services' as const,
                      href: '/services',
                      label: tr('Послуги монтажу та інжинірингу'),
                      icon: Wrench,
                      count: null,
                    },
                    {
                      v: 'projects' as const,
                      href: '/projects',
                      label: tr('Реалізовані проєкти', 'Реализованные проекты'),
                      icon: Building2,
                      count: null,
                    },
                  ] as const
                ).map(({ v, href, label, icon: Icon, count }) => {
                  const isActive = view === v;
                  return (
                    <a
                      key={v}
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(e) => handleNavAnchor(e, v)}
                      className={`min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-300 ${
                        isActive
                          ? 'bg-sky-400/20 text-white font-bold'
                          : 'text-sky-50/95 font-semibold hover:bg-white/[0.08] active:bg-white/[0.12]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-[#0ea5e9] text-white shadow-[0_2px_10px_rgba(14,165,233,0.4)]'
                              : 'bg-sky-300/12 text-sky-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {count !== null && (
                          <span className="text-xs font-mono tabular-nums text-sky-200/80">
                            {count}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-200' : 'text-sky-200/45'}`}
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Tier 2: Information, Contacts & Account */}
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-sky-200/65">
                {tr('Інформація та кабінет', 'Информация и кабинет')}
              </p>
              <div className="rounded-xl border border-sky-200/12 bg-white/[0.03] divide-y divide-sky-200/10 overflow-hidden">
                {(
                  [
                    {
                      v: 'contacts' as const,
                      href: '/contacts',
                      label: tr('Контакти'),
                      icon: PhoneCall,
                      accent: false,
                    },
                    {
                      v: 'payment-delivery' as const,
                      href: '/payment-delivery',
                      label: tr('Оплата і доставка'),
                      icon: Truck,
                      accent: false,
                    },
                    {
                      v: 'offer' as const,
                      href: '/public-offer',
                      label: tr('Публічна оферта'),
                      icon: FileText,
                      accent: false,
                    },
                    ...(adminToken
                      ? ([
                          {
                            v: 'crm' as const,
                            href: '/crm',
                            label: crmButtonLabel,
                            icon: LayoutDashboard,
                            accent: true,
                          },
                        ] as const)
                      : clientToken
                        ? ([
                            {
                              v: 'account' as const,
                              href: '/account',
                              label: tr('Особистий кабінет', 'Личный кабинет'),
                              icon: User,
                              accent: true,
                            },
                          ] as const)
                        : ([
                            {
                              v: 'login' as const,
                              href: '/login',
                              label: tr('Увійти / Реєстрація', 'Войти / Регистрация'),
                              icon: LogIn,
                              accent: true,
                            },
                          ] as const)),
                  ] as const
                ).map(({ v, href, label, icon: Icon, accent }) => {
                  const isActive = view === v;
                  return (
                    <a
                      key={v}
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(e) => handleNavAnchor(e, v)}
                      className={`min-h-[46px] flex items-center justify-between gap-3 px-3.5 py-2 text-[13.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-300 ${
                        isActive
                          ? 'bg-sky-400/20 text-white font-bold'
                          : 'text-sky-100/90 font-medium hover:bg-white/[0.07] active:bg-white/[0.11]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-[#0ea5e9] text-white'
                              : accent
                                ? 'bg-amber-400/15 text-amber-300'
                                : 'bg-white/[0.08] text-sky-200/85'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        <span className="truncate">{label}</span>
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-200' : 'text-sky-200/40'}`}
                        aria-hidden="true"
                      />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Tier 3: Primary Action CTA */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openLeadModal('Підбір рішення з мобільного меню');
              }}
              className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#0b66b2] hover:from-[#38bdf8] hover:to-[#0284c7] border border-sky-300/35 text-white text-sm font-bold shadow-[0_6px_18px_rgba(14,165,233,0.3)] transition-all cursor-pointer active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{tr('Підібрати рішення')}</span>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-85" aria-hidden="true" />
            </button>

            {/* Tier 4: Direct Phone & Socials */}
            <div className="pt-3 border-t border-sky-200/15 flex flex-wrap items-center justify-between gap-3">
              <a
                href={COMPANY_INFO.phone1Href}
                onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })}
                className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-sky-200 tabular-nums transition-colors py-1"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" aria-hidden="true" />
                <span>{COMPANY_INFO.phone1}</span>
              </a>
              <SocialIcons links={socialLinks} variant="footer" />
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Breadcrumbs items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
        {loadingCatalog && view !== 'crm' ? (
          <div className="ec-main-radial-bg">
            <div className="ec-container py-14">
              <div className="ec-glass-plate rounded-2xl p-6 space-y-4">
                <div className="h-8 w-64 bg-sky-100 rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-72 bg-sky-50/80 rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="ec-main-radial-bg break-words hyphens-none">
            {view === 'home' && (
              <HomeView
                usdUahRate={usdUahRate}
                products={products}
                projects={projects}
                telegramUrl={socialLinks.telegram}
                isStaff={Boolean(adminToken)}
                wishlistIds={wishlistIds}
                compareIds={compareIds}
                onNavigateShop={(cat) => navigateTo('shop', cat)}
                onNavigateServices={() => navigateTo('services')}
                onNavigateProjects={() => navigateTo('projects')}
                onOpenLeadModal={openLeadModal}
                onSelectProduct={handleSelectProduct}
                onQuickViewProduct={handleQuickViewProduct}
                onToggleWishlist={handleToggleWishlist}
                onToggleCompare={handleToggleCompare}
                onAddToCart={handleAddToCart}
                onCalculatePayback={setPaybackProduct}
                onSelectCase={setSelectedCase}
                onLeadCreated={() => void fetchDeals()}
                onOpenCrm={() => navigateTo('crm')}
              />
            )}

            <Suspense
              fallback={
                <div className="ec-main-radial-bg">
                  <div className="ec-container py-14">
                    <div className="ec-glass-plate rounded-2xl p-6 space-y-4">
                      <div className="h-8 w-56 bg-sky-100 rounded animate-pulse" />
                      <div className="h-56 bg-sky-50/80 rounded-2xl animate-pulse" />
                    </div>
                  </div>
                </div>
              }
            >
              {view === 'shop' && (
                <ShopView
                  usdUahRate={usdUahRate}
                  products={products}
                  initialCategory={shopInitialCat}
                  initialQuery={shopInitialQuery}
                  wishlistIds={wishlistIds}
                  compareIds={compareIds}
                  onCategoryChange={handleShopCategorySync}
                  onQueryChange={handleShopQuerySync}
                  onSelectProduct={handleSelectProduct}
                  onQuickViewProduct={handleQuickViewProduct}
                  onToggleWishlist={handleToggleWishlist}
                  onToggleCompare={handleToggleCompare}
                  onOpenCompare={() => setCompareModalOpen(true)}
                  onAddToCart={handleAddToCart}
                  onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
                  onCalculatePayback={setPaybackProduct}
                  onOpenCustomRequest={(topic, notes) => openLeadModal(topic, undefined, 'section', notes)}
                  onBackHome={() => navigateTo('home')}
                />
              )}

              {view === 'services' && (
                <ServicesView
                  usdUahRate={usdUahRate}
                  onBackHome={() => navigateTo('home')}
                  onOrderService={(topic) => openLeadModal(topic)}
                />
              )}

              {view === 'projects' && (
                <ProjectsView
                  projects={projects}
                  onBackHome={() => navigateTo('home')}
                  onSelectCase={setSelectedCase}
                />
              )}

              {view === 'contacts' && (
                <ContactsView
                  socialLinks={socialLinks}
                  onBackHome={() => navigateTo('home')}
                  onOpenLeadModal={(topic) => openLeadModal(topic)}
                />
              )}

              {(view === 'payment-delivery' || view === 'offer' || view === 'privacy' || view === 'terms') && (
                <InfoPage
                  type={view}
                  usdUahRate={usdUahRate}
                  onBackHome={() => navigateTo('home')}
                />
              )}

              {view === 'login' && (
                <AuthPortalView
                  status={authStatus}
                  apiAvailable={apiAvailable}
                  initialMode={authPortalMode}
                  onAuthenticated={handleUnifiedAuthenticated}
                  onBackToStore={() => navigateTo('home')}
                />
              )}

              {view === 'account' &&
                (clientToken ? (
                  <ClientCabinetView
                    clientToken={clientToken}
                    initialCustomer={clientCustomer}
                    products={products}
                    usdUahRate={usdUahRate}
                    wishlistIds={wishlistIds}
                    requestedTab={cabinetTabRequest}
                    refreshTrigger={cabinetRefreshTrigger}
                    onCustomerUpdated={setClientCustomer}
                    onToggleWishlist={handleToggleWishlist}
                    onClearWishlist={handleClearWishlist}
                    onSelectProduct={handleSelectProduct}
                    onQuickViewProduct={handleQuickViewProduct}
                    onAddToCart={handleAddToCart}
                    onAddManyToCart={handleAddManyToCart}
                    onCalculatePayback={setPaybackProduct}
                    onOpenLeadModal={(topic, estUsd, notes) => openLeadModal(topic, estUsd, 'section', notes)}
                    onNavigateShop={() => navigateTo('shop', 'all')}
                    onBackToStore={() => navigateTo('home')}
                    onLogout={handleClientLogout}
                  />
                ) : (
                  <AuthPortalView
                    status={authStatus}
                    apiAvailable={apiAvailable}
                    initialMode="login"
                    onAuthenticated={handleUnifiedAuthenticated}
                    onBackToStore={() => navigateTo('home')}
                  />
                ))}

              {view === 'crm' &&
                (adminToken ? (
                  <CrmView
                    adminToken={adminToken}
                    deals={deals}
                    products={products}
                    projectsList={projects}
                    telegramConfigured={telegramConfigured}
                    socialLinks={socialLinks}
                    onRefreshDeals={fetchDeals}
                    onRefreshCatalog={fetchCatalog}
                    onRefreshProjects={fetchProjects}
                    onSocialLinksUpdated={setSocialLinks}
                    onAnalyticsUpdated={(cfg) => initAnalytics(cfg)}
                    onExchangeRateUpdated={(rate) => setUsdUahRate(rate)}
                    onLogout={handleAdminLogout}
                    onBackToStore={() => navigateTo('home')}
                  />
                ) : (
                  <AuthPortalView
                    status={authStatus}
                    apiAvailable={apiAvailable}
                    initialMode="login"
                    onAuthenticated={handleUnifiedAuthenticated}
                    onBackToStore={() => navigateTo('home')}
                  />
                ))}
            </Suspense>
          </div>
        )}
      </main>

      {/* Footer */}
      {view !== 'crm' && (
        <footer className="bg-gradient-to-r from-[#072750]/95 via-[#0d488a]/90 to-[#072750]/95 backdrop-blur-xl text-sky-100/85 pt-12 pb-20 lg:pb-12 border-t border-sky-300/25 break-words hyphens-none">
          <div className="ec-container">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="min-w-0 break-words hyphens-none">
                <a
                  href="/"
                  onClick={(e) => handleNavAnchor(e, 'home')}
                  className="inline-flex items-center gap-3 mb-3.5 text-left group"
                >
                  <SmartImage
                    src="/assets/energocomfort/logo_mark.svg"
                    alt="Energo Comfort — сонячні станції та резервне живлення"
                    loading="lazy"
                    className="h-14 w-14 rounded-2xl shadow-[0_6px_20px_rgba(14,165,233,0.28)] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="text-xl font-extrabold tracking-tight text-white leading-tight group-hover:text-sky-200 transition-colors">
                      Energo Comfort
                    </span>
                    <span className="text-xs font-semibold text-sky-200/90 leading-snug">
                      {tr('Сонячні станції · Резервне живлення', 'Солнечные станции · Резервное питание')}
                    </span>
                  </span>
                </a>
                <p className="text-xs text-sky-100/75 leading-relaxed mb-3.5">
                  {tr('Системи резервного живлення та сонячні електростанції під ключ в Одесі та області.', 'Системы резервного питания и солнечные электростанции под ключ в Одессе и области.')}
                </p>
                <SocialIcons links={socialLinks} variant="footer" />
                <VerifiedWarrantyBadge
                  variant="footer"
                  warrantyHref="/payment-delivery"
                  onWarrantyClick={(e) => handleNavAnchor(e, 'payment-delivery')}
                  className="mt-4"
                />
              </div>

              <div className="min-w-0 break-words hyphens-none">
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Обладнання')}</h2>
                <div className="space-y-1.5 text-xs text-sky-100/75">
                  {(
                    [
                      ['kits', 'Готові рішення'],
                      ['panels', 'Сонячні панелі'],
                      ['inverters', 'Інвертори'],
                      ['batteries', 'Акумулятори LiFePO4'],
                      ['parts', 'Комплектуючі та захист'],
                    ] as const
                  ).map(([c, label]) => (
                    <a
                      key={c}
                      href={`/shop?cat=${c}`}
                      onClick={(e) => handleNavAnchor(e, 'shop', c)}
                      className="block overflow-hidden text-ellipsis hover:text-white transition-colors"
                    >
                      {tr(label)}
                    </a>
                  ))}
                </div>
              </div>

              <div className="min-w-0 break-words hyphens-none">
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Компанія та сервіс', 'Компания и сервис')}</h2>
                <div className="space-y-1.5 text-xs text-sky-100/75">
                  <a
                    href="/services"
                    onClick={(e) => handleNavAnchor(e, 'services')}
                    className="block overflow-hidden text-ellipsis hover:text-white transition-colors"
                  >
                    {tr('Послуги монтажу та інжинірингу')}
                  </a>
                  <a
                    href="/projects"
                    onClick={(e) => handleNavAnchor(e, 'projects')}
                    className="block overflow-hidden text-ellipsis hover:text-white transition-colors"
                  >
                    {tr('Реалізовані проєкти', 'Реализованные проекты')}
                  </a>
                  <a
                    href="/contacts"
                    onClick={(e) => handleNavAnchor(e, 'contacts')}
                    className="block overflow-hidden text-ellipsis hover:text-white transition-colors"
                  >
                    {tr('Контакти')}
                  </a>
                  <a href="/payment-delivery" onClick={(e) => handleNavAnchor(e, 'payment-delivery')} className="block overflow-hidden text-ellipsis hover:text-white transition-colors">
                    {tr('Оплата і доставка')}
                  </a>
                  <a href="/public-offer" onClick={(e) => handleNavAnchor(e, 'offer')} className="block overflow-hidden text-ellipsis hover:text-white transition-colors">
                    {tr('Публічна оферта')}
                  </a>
                  <a href="/privacy-policy" onClick={(e) => handleNavAnchor(e, 'privacy')} className="block overflow-hidden text-ellipsis hover:text-white transition-colors">
                    {tr('Політика конфіденційності', 'Политика конфиденциальности')}
                  </a>
                  <a href="/terms-of-service" onClick={(e) => handleNavAnchor(e, 'terms')} className="block overflow-hidden text-ellipsis hover:text-white transition-colors">
                    {tr('Умови використання', 'Условия использования')}
                  </a>
                  {adminToken ? (
                    <a
                      href="/crm"
                      onClick={(e) => handleNavAnchor(e, 'crm')}
                      className="block overflow-hidden text-ellipsis text-amber-300 hover:text-amber-200"
                    >
                      {crmButtonLabel}
                    </a>
                  ) : clientToken ? (
                    <a
                      href="/account"
                      onClick={(e) => handleNavAnchor(e, 'account')}
                      className="block overflow-hidden text-ellipsis hover:text-white transition-colors"
                    >
                      {tr('Особистий кабінет', 'Личный кабинет')}
                    </a>
                  ) : (
                    <a
                      href="/login"
                      onClick={(e) => handleNavAnchor(e, 'login')}
                      className="block overflow-hidden text-ellipsis text-amber-300 hover:text-amber-200"
                    >
                      {tr('Увійти / Реєстрація', 'Войти / Регистрация')}
                    </a>
                  )}
                </div>
              </div>

              <div className="min-w-0 break-words hyphens-none">
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Контакти · Одеса', 'Контакты · Одесса')}</h2>
                <div className="space-y-1.5 text-xs text-sky-100/75">
                  <p>{tr(COMPANY_INFO.address, 'Украина, г. Одесса, ул. Европейская, 93')}</p>
                  <a
                    href={COMPANY_INFO.phone1Href}
                    onClick={() => track({ name: 'phone_click', placement: 'footer', scenario: 'unspecified' })}
                    className="block font-mono hover:text-white transition-colors"
                  >
                    {COMPANY_INFO.phone1}
                  </a>
                  <a
                    href={COMPANY_INFO.phone2Href}
                    onClick={() => track({ name: 'phone_click', placement: 'footer', scenario: 'unspecified' })}
                    className="block font-mono hover:text-white transition-colors"
                  >
                    {COMPANY_INFO.phone2}
                  </a>
                  <a
                    href={`mailto:${COMPANY_INFO.email}`}
                    onClick={() => trackEvent('contact', { channel: 'email', placement: 'footer' })}
                    className="block hover:text-white transition-colors"
                  >
                    {COMPANY_INFO.email}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-sky-200/15 text-[11px] text-sky-200/65 flex flex-wrap items-center justify-between gap-3 break-words hyphens-none">
              <span>© 2026 Energo Comfort · energocomfort.shop</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <a
                  href="/privacy-policy"
                  onClick={(e) => handleNavAnchor(e, 'privacy')}
                  className="hover:text-white transition-colors underline underline-offset-2 decoration-sky-300/35"
                >
                  {tr('Політика конфіденційності', 'Политика конфиденциальности')}
                </a>
                <a
                  href="/terms-of-service"
                  onClick={(e) => handleNavAnchor(e, 'terms')}
                  className="hover:text-white transition-colors underline underline-offset-2 decoration-sky-300/35"
                >
                  {tr('Умови використання', 'Условия использования')}
                </a>
                <span className="hidden sm:inline text-sky-200/50">·</span>
                <span>{tr('Офіційне обладнання Deye, SolaX, Solis, Dyness, Trina', 'Официальное оборудование Deye, SolaX, Solis, Dyness, Trina')}</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Product Comparison Dock */}
      {view !== 'crm' &&
        !cartOpen &&
        !leadModalOpen &&
        !selectedProduct &&
        !quickViewProduct &&
        !paybackProduct &&
        !selectedCase &&
        !compareModalOpen && (
          <CompareBar
            products={compareProducts}
            limitNotice={compareLimitNotice}
            onRemove={handleRemoveCompare}
            onClear={handleClearCompare}
            onOpenModal={() => setCompareModalOpen(true)}
          />
        )}

      {/* Slim Mobile Thumb CTA Bar (<= 44px height) */}
      {view !== 'crm' &&
        stickyCtaVisible &&
        compareProducts.length === 0 &&
        !compareModalOpen &&
        !cartOpen &&
        !leadModalOpen &&
        !selectedProduct &&
        !quickViewProduct &&
        !paybackProduct &&
        !selectedCase && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-gradient-to-r from-[#072750]/95 via-[#0d488a]/92 to-[#072750]/95 backdrop-blur-xl border-t border-sky-300/25 shadow-[0_-8px_28px_rgba(4,18,40,0.34)] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-2">
          <a
            href={COMPANY_INFO.phone1Href}
            onClick={() => track({ name: 'phone_click', placement: 'sticky', scenario: 'unspecified' })}
            className="flex-1 min-w-0 min-h-11 rounded-xl border border-sky-200/30 bg-white/10 hover:bg-white/18 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <PhoneCall className="w-4 h-4 text-sky-200 shrink-0" />
            {tr('Подзвонити', 'Позвонить')}
          </a>
          <button
            type="button"
            onClick={() => {
              track({ name: 'cta_click', placement: 'sticky', scenario: 'unspecified' });
              openLeadModal('Експрес-підбір із мобільної панелі', undefined, 'sticky');
            }}
            className="flex-1 min-w-0 min-h-11 rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#0b66b2] hover:from-[#38bdf8] hover:to-[#0284c7] border border-sky-300/40 text-white text-[11px] font-bold inline-flex items-center justify-center whitespace-nowrap shadow-[0_4px_14px_rgba(14,165,233,0.35)] transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            {tr('Розрахунок', 'Расчёт')}
          </button>
          {socialLinks.telegram && (
            <a
              href={socialLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              onClick={() => track({ name: 'messenger_click', placement: 'sticky', scenario: 'unspecified', channel: 'telegram' })}
              className="flex-1 min-w-0 min-h-11 rounded-xl border border-sky-200/30 bg-[#051a36]/85 hover:bg-[#07264d] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Send className="w-4 h-4 text-[#38bdf8] shrink-0" />
              Telegram
            </a>
          )}
        </div>
      )}

      {/* Floating Scroll-to-Top Button (appears after scrolling past the first section) */}
      <ScrollToTopButton
        routeKey={`${view}|${shopInitialCat}|${selectedProduct?.id ?? ''}|${loadingCatalog}`}
        hidden={
          view === 'crm' ||
          mobileMenuOpen ||
          compareModalOpen ||
          cartOpen ||
          leadModalOpen ||
          Boolean(selectedProduct) ||
          Boolean(quickViewProduct) ||
          Boolean(paybackProduct) ||
          Boolean(selectedCase)
        }
        hasCompareBar={compareProducts.length > 0}
        hasMobileStickyBar={stickyCtaVisible && compareProducts.length === 0}
      />

      {/* Modals & Cart Drawer (lazy loaded on interaction) */}
      <Suspense fallback={null}>
        {compareModalOpen && (
          <CompareModal
            open={compareModalOpen}
            products={compareProducts}
            usdUahRate={usdUahRate}
            onClose={() => setCompareModalOpen(false)}
            onRemoveProduct={handleRemoveCompare}
            onClearAll={handleClearCompare}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
            onBrowseCatalog={() => navigateTo('shop', 'all')}
          />
        )}

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={handleCloseProductModal}
            onAddToCart={handleAddToCart}
            onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
            usdUahRate={usdUahRate}
            clientToken={clientToken}
            adminToken={adminToken}
            clientCustomerName={clientCustomer?.name ?? null}
            onRequireLogin={() => navigateTo('login', undefined, 'login')}
            isWishlisted={wishlistIds.includes(selectedProduct.id)}
            onToggleWishlist={handleToggleWishlist}
            isCompared={compareIds.includes(selectedProduct.id)}
            onToggleCompare={handleToggleCompare}
          />
        )}

        {quickViewProduct && (
          <QuickViewModal
            product={quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
            onAddToCart={handleAddToCart}
            onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
            onOpenFullDetails={(p) => {
              setQuickViewProduct(null);
              handleSelectProduct(p);
            }}
            isWishlisted={wishlistIds.includes(quickViewProduct.id)}
            onToggleWishlist={handleToggleWishlist}
            isCompared={compareIds.includes(quickViewProduct.id)}
            onToggleCompare={handleToggleCompare}
            usdUahRate={usdUahRate}
          />
        )}

        {paybackProduct && (
          <ProductPaybackModal
            product={paybackProduct}
            usdUahRate={usdUahRate}
            onClose={() => setPaybackProduct(null)}
            onRequestQuote={(p, summary, capexUsd) =>
              openLeadModal(`Розрахунок окупності: ${p.title}`, capexUsd ?? p.price, 'section', summary)
            }
          />
        )}

        {selectedCase && (
          <CaseModal
            project={selectedCase}
            onClose={() => setSelectedCase(null)}
            onQuote={(proj) => openLeadModal(`Схоже на кейс: ${proj.title}`)}
          />
        )}

        {leadModalOpen && (
          <LeadModal
            open={leadModalOpen}
            initialTopic={leadTopic}
            initialNotes={leadNotes}
            estimatedTotalUsd={leadEstimateUsd}
            usdUahRate={usdUahRate}
            isStaff={Boolean(adminToken)}
            clientToken={clientToken}
            clientCustomer={clientCustomer}
            onClose={() => setLeadModalOpen(false)}
            onCreated={() => {
              void fetchDeals();
              setCabinetRefreshTrigger((n) => n + 1);
            }}
            onOpenCrm={() => navigateTo('crm')}
            placement={leadPlacement}
          />
        )}

        {cartOpen && (
          <CartDrawer
            open={cartOpen}
            items={cart}
            isStaff={Boolean(adminToken)}
            clientToken={clientToken}
            clientCustomer={clientCustomer}
            onClose={() => setCartOpen(false)}
            onUpdateQty={handleUpdateCartQty}
            onRemove={handleRemoveFromCart}
            onClearCart={() => setCart([])}
            onOrderCreated={() => {
              void fetchDeals();
              setCabinetRefreshTrigger((n) => n + 1);
            }}
            onOpenCrm={() => navigateTo('crm')}
            usdUahRate={usdUahRate}
          />
        )}
      </Suspense>

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppContent />
    </GlobalErrorBoundary>
  );
}
