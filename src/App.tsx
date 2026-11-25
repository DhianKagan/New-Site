import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type MouseEvent, type ReactNode } from 'react';
import { ShoppingBag, Menu, X, PhoneCall, Send, User, AlertTriangle, RefreshCw, Home, Copy, Check, Heart } from 'lucide-react';
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
import { COMPANY_INFO, FAQ_ITEMS, PROJECTS } from './data/siteContent.ts';
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
import { signOutFirebase } from './lib/firebaseAuth.ts';
import { getProductAggregateRating } from './lib/seoRating.ts';
import { HomeView } from './components/HomeView.tsx';
import { ShopView } from './components/ShopView.tsx';
import { ServicesView } from './components/ServicesView.tsx';
import { ProjectsView } from './components/ProjectsView.tsx';
import { ContactsView } from './components/ContactsView.tsx';
import { CrmView } from './components/CrmView.tsx';
import { AuthPortalView } from './components/AuthPortalView.tsx';
import { ClientCabinetView, type CabinetTab } from './components/ClientCabinetView.tsx';
import { ProductModal } from './components/ProductModal.tsx';
import { QuickViewModal } from './components/QuickViewModal.tsx';
import { CaseModal } from './components/CaseModal.tsx';
import { LeadModal } from './components/LeadModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { SmartImage } from './components/SmartImage.tsx';
import { SocialIcons } from './components/SocialIcons.tsx';
import { InfoPage } from './components/InfoPage.tsx';
import { formatUahFromUsd } from './lib/currency.ts';
import { getSavedLocale, setActiveLocale, tr, type Locale } from './lib/i18n.ts';
import {
  mergeWishlistIds,
  normalizeWishlistIds,
  readWishlistFromStorage,
  toggleWishlistId,
  writeWishlistToStorage,
} from './lib/wishlist.ts';

type AppView =
  | 'home'
  | 'shop'
  | 'services'
  | 'projects'
  | 'contacts'
  | 'payment-delivery'
  | 'offer'
  | 'login'
  | 'account'
  | 'crm';

const CART_STORAGE_KEY = 'ec_cart_v1';
const VALID_CATS: ProductCategory[] = ['kits', 'inverters', 'batteries', 'panels', 'parts'];

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
  if (pathname.startsWith('/shop/')) {
    const rawId = pathname.slice('/shop/'.length).split('/')[0];
    return { view: 'shop', cat: 'all', searchQuery: '', productId: rawId ? decodeURIComponent(rawId) : null, authMode };
  }
  if (pathname === '/services') return { view: 'services', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/projects') return { view: 'projects', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/contacts') return { view: 'contacts', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/payment-delivery') return { view: 'payment-delivery', cat: 'all', searchQuery: '', productId: null, authMode };
  if (pathname === '/public-offer') return { view: 'offer', cat: 'all', searchQuery: '', productId: null, authMode };
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
    const handleWindowError = (event: ErrorEvent) => {
      reportClientError({
        kind: 'window_error',
        error: event.error instanceof Error ? event.error : new Error(event.message || 'Unhandled script error'),
        route: window.location.pathname,
        locale: getSavedLocale(),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
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

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedCase, setSelectedCase] = useState<ProjectCase | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadPlacement, setLeadPlacement] = useState<Placement>('section');
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);
  const [leadTopic, setLeadTopic] = useState('Інженерний розрахунок системи');
  const [leadNotes, setLeadNotes] = useState('');

  useEffect(() => {
    const updateStickyVisibility = () => {
      const viewport = window.visualViewport;
      const keyboardOpen = Boolean(viewport && viewport.height < window.innerHeight * 0.72);
      setStickyCtaVisible(window.scrollY > window.innerHeight && !keyboardOpen);
    };
    window.addEventListener('scroll', updateStickyVisibility, { passive: true });
    window.addEventListener('resize', updateStickyVisibility);
    window.visualViewport?.addEventListener('resize', updateStickyVisibility);
    updateStickyVisibility();
    return () => {
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
        if (active && data.rate && Number.isFinite(data.rate)) setUsdUahRate(data.rate);
      } catch {
        if (active) setUsdUahRate(null);
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
        return;
      }
      throw new Error('Catalog API unavailable');
    } catch {
      setApiAvailable(false);
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
          setProjects(data.projects.map((project) => {
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
          }));
        }
      }
    } catch {
      // Static mode keeps PROJECTS seed fallback
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
      title = `Реалізовані об’єкти (${projects.length}) — Energo Comfort Одеса`;
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
    } else if (view === 'login') {
      title = 'Вхід та реєстрація — Energo Comfort';
    } else if (view === 'account') {
      title = 'Особистий кабінет — Energo Comfort';
    } else if (view === 'crm') {
      title = 'CRM — Energo Comfort';
    }

    document.title = title;
    const canonicalPath =
      view === 'shop' && !selectedProduct && shopInitialCat !== 'all'
        ? `/shop?cat=${encodeURIComponent(shopInitialCat)}`
        : window.location.pathname;
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

    const sameAs = Object.values(socialLinks)
      .map((v) => v.trim())
      .filter((v) => /^https?:\/\//i.test(v));

    const storeEntity = {
      '@type': 'Store',
      '@id': `${window.location.origin}/#organization`,
      name: 'Energo Comfort',
      url: window.location.origin,
      image: `${window.location.origin}/assets/energocomfort/sto_110kw.jpg`,
      telephone: '+380507777172',
      email: COMPANY_INFO.email,
      priceRange: '$$',
      areaServed: ['Одеса', 'Одеська область', 'Україна'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'вул. Європейська 93',
        addressLocality: 'Одеса',
        addressRegion: 'Одеська область',
        addressCountry: 'UA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 46.4694,
        longitude: 30.7376,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '09:00',
          closes: '18:00',
        },
      ],
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };

    const jsonLdEl = document.getElementById('ec-jsonld');
    if (jsonLdEl && !isPrivateView) {
      if (selectedProduct) {
        const priceValidUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        jsonLdEl.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Product',
              name: selectedProduct.title,
              sku: selectedProduct.sku || selectedProduct.id,
              mpn: selectedProduct.sku || selectedProduct.id,
              image: ogImage,
              description,
              brand: { '@type': 'Brand', name: selectedProduct.brand || 'Energo Comfort' },
              aggregateRating: getProductAggregateRating(selectedProduct),
              ...(selectedProduct.price > 0 && usdUahRate
                ? {
                    offers: {
                      '@type': 'Offer',
                      url: canonicalUrl,
                      priceCurrency: 'UAH',
                      price: Math.round(selectedProduct.price * usdUahRate),
                      priceValidUntil,
                      itemCondition: 'https://schema.org/NewCondition',
                      availability: selectedProduct.inStock
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/PreOrder',
                      seller: { '@id': `${window.location.origin}/#organization`, '@type': 'Organization', name: 'Energo Comfort' },
                      hasMerchantReturnPolicy: {
                        '@type': 'MerchantReturnPolicy',
                        applicableCountry: 'UA',
                        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                        merchantReturnDays: 14,
                        returnMethod: 'https://schema.org/ReturnByMail',
                        returnFees: 'https://schema.org/ReturnShippingFees',
                      },
                    },
                  }
                : {}),
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Головна', item: `${window.location.origin}/` },
                { '@type': 'ListItem', position: 2, name: 'Обладнання', item: `${window.location.origin}/shop` },
                { '@type': 'ListItem', position: 3, name: selectedProduct.title, item: canonicalUrl },
              ],
            },
          ],
        });
      } else if (view === 'home') {
        jsonLdEl.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            storeEntity,
            {
              '@type': 'WebSite',
              '@id': `${window.location.origin}/#website`,
              name: 'Energo Comfort',
              url: window.location.origin,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${window.location.origin}/shop?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@type': 'FAQPage',
              mainEntity: FAQ_ITEMS.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ],
        });
      } else {
        const pageNameMap: Record<AppView, string> = {
          home: 'Головна',
          shop: 'Каталог обладнання',
          services: 'Послуги монтажу та інжинірингу',
          projects: 'Реалізовані об’єкти',
          contacts: 'Контакти',
          'payment-delivery': 'Оплата і доставка',
          offer: 'Публічна оферта',
          login: 'Вхід та реєстрація',
          account: 'Особистий кабінет',
          crm: 'CRM',
        };
        const pageTypeMap: Record<AppView, string> = {
          home: 'WebPage',
          shop: 'CollectionPage',
          services: 'Service',
          projects: 'CollectionPage',
          contacts: 'ContactPage',
          'payment-delivery': 'WebPage',
          offer: 'WebPage',
          login: 'WebPage',
          account: 'WebPage',
          crm: 'WebPage',
        };
        jsonLdEl.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            storeEntity,
            {
              '@type': pageTypeMap[view],
              name: title,
              description,
              url: canonicalUrl,
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Головна', item: `${window.location.origin}/` },
                { '@type': 'ListItem', position: 2, name: pageNameMap[view], item: canonicalUrl },
              ],
            },
          ],
        });
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
  }, [view, shopInitialCat, selectedProduct, products.length, projects.length, usdUahRate, locale, socialLinks, analyticsReady]);

  useEffect(() => {
    if (!analyticsReady || view === 'crm' || view === 'login' || view === 'account') return;
    const fired = new Set<number>();
    const routePath = `${window.location.pathname}${window.location.search}`;
    const onScroll = () => {
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
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [analyticsReady, view, shopInitialCat, selectedProduct]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedProduct) {
          handleCloseProductModal();
        }
        setQuickViewProduct(null);
        setSelectedCase(null);
        setLeadModalOpen(false);
        setCartOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
    void signOutFirebase();
    setSelectedProduct(null);
    setQuickViewProduct(null);
    setView('home');
    setMobileMenuOpen(false);
    if (window.location.pathname + window.location.search !== '/') {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAdminLogout = useCallback(() => {
    setAdminToken(null);
    void signOutFirebase();
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

  return (
    <div className={`min-h-screen flex flex-col bg-white text-[#172636] ${stickyCtaVisible && view !== 'crm' ? 'pb-16 lg:pb-0' : ''}`}>
      {/* Slim Utility Strip (Odessa Office + Store/CRM Workspace Switcher) */}
      <div className="bg-[#0d1f33] text-slate-300 text-xs py-1.5 border-b border-white/10">
        <div className="max-w-[1180px] mx-auto px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="truncate min-w-0">
            <span className="hidden md:inline">{COMPANY_INFO.address} · </span>
            <a
              href={COMPANY_INFO.phone1Href}
              onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })}
              className="font-semibold text-white hover:text-sky-200 font-mono text-[11px] sm:text-xs"
            >
              {COMPANY_INFO.phone1}
            </a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="inline-flex items-center rounded-md border border-white/15 bg-white/5 p-0.5" aria-label={tr('Мова сайту')}>
              {(['uk', 'ru'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  lang={option}
                  aria-pressed={locale === option}
                  onClick={() => changeLocale(option)}
                  className={`rounded px-2 py-1 text-[10px] font-extrabold transition-colors ${
                    locale === option ? 'bg-white text-[#0d1f33]' : 'text-slate-300 hover:text-white'
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
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  view !== 'crm' && view !== 'login' && view !== 'account'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tr('Магазин')}
              </button>
              {adminToken ? (
                <button
                  type="button"
                  onClick={() => navigateTo('crm')}
                  className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    view === 'crm' ? 'bg-[#f59e0b] text-[#0d1f33]' : 'bg-white/10 text-amber-200 hover:bg-white/20'
                  }`}
                >
                  {crmButtonLabel}
                </button>
              ) : clientToken ? (
                <button
                  type="button"
                  onClick={() => navigateTo('account')}
                  className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    view === 'account' ? 'bg-[#1769aa] text-white' : 'bg-white/10 text-sky-200 hover:bg-white/20'
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
                    view === 'login' ? 'bg-[#f59e0b] text-[#0d1f33]' : 'bg-white/10 text-amber-200 hover:bg-white/20'
                  }`}
                >
                  {tr('Увійти / Реєстрація', 'Войти / Регистрация')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Sticky Header: Responsive 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1180px] mx-auto px-3 sm:px-5 h-14 sm:h-16 lg:h-[68px] flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleNavAnchor(e, 'home')}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 text-left min-w-0"
          >
            <SmartImage
              src="/assets/energocomfort/logo_mark.webp"
              alt="Energo Comfort"
              priority
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain rounded shrink-0"
            />
            <span className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-[#0d1f33]">
              Energo Comfort
            </span>
          </a>

          {/* Zone 2: 5 concise single-line nav links (desktop lg+) */}
          <nav aria-label={tr('Головна навігація')} className="hidden lg:flex items-center gap-5 xl:gap-6 text-[13px] xl:text-sm font-semibold text-slate-600">
            <a
              href="/"
              onClick={(e) => handleNavAnchor(e, 'home')}
              className={`whitespace-nowrap shrink-0 hover:text-[#0d1f33] transition-colors ${
                view === 'home' ? 'text-[#1769aa] font-bold' : ''
              }`}
            >
              {tr('Головна')}
            </a>
            <a
              href="/shop"
              onClick={(e) => handleNavAnchor(e, 'shop', 'all')}
              className={`whitespace-nowrap shrink-0 hover:text-[#0d1f33] transition-colors ${
                view === 'shop' ? 'text-[#1769aa] font-bold' : ''
              }`}
            >
              {tr('Обладнання')}
            </a>
            <a
              href="/services"
              onClick={(e) => handleNavAnchor(e, 'services')}
              className={`whitespace-nowrap shrink-0 hover:text-[#0d1f33] transition-colors ${
                view === 'services' ? 'text-[#1769aa] font-bold' : ''
              }`}
            >
              {tr('Послуги')}
            </a>
            <a
              href="/projects"
              onClick={(e) => handleNavAnchor(e, 'projects')}
              className={`whitespace-nowrap shrink-0 hover:text-[#0d1f33] transition-colors ${
                view === 'projects' ? 'text-[#1769aa] font-bold' : ''
              }`}
            >
              {tr('Проєкти')}
            </a>
            <a
              href="/contacts"
              onClick={(e) => handleNavAnchor(e, 'contacts')}
              className={`whitespace-nowrap shrink-0 hover:text-[#0d1f33] transition-colors ${
                view === 'contacts' ? 'text-[#1769aa] font-bold' : ''
              }`}
            >
              {tr('Контакти')}
            </a>
          </nav>

          {/* Zone 3: Quick Lead CTA + Wishlist + Compact Cart Button + Mobile/Tablet Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openLeadModal('Підбір рішення з шапки сайту')}
              className="inline-flex items-center justify-center h-9 px-2.5 sm:px-3.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="min-[440px]:hidden">{tr('Підібрати')}</span>
              <span className="hidden min-[440px]:inline">{tr('Підібрати рішення')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWishlist}
              aria-label={`${tr('Список бажань', 'Список желаний')} (${wishlistIds.length})`}
              title={tr('Список бажань', 'Список желаний')}
              className="inline-flex items-center justify-center gap-1 h-9 px-2 sm:px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-[#0d1f33] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Heart className={`w-4 h-4 shrink-0 ${wishlistIds.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
              <span className="font-mono text-[11px] text-slate-700 tabular-nums leading-none">
                {wishlistIds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCart}
              aria-label={`${tr('Кошик')} (${cartTotalCount})`}
              title={tr('Кошик обладнання', 'Корзина оборудования')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 xl:px-3.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#f59e0b] shrink-0" />
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
              className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-[#0d1f33] cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            {(
              [
                ['home', '/', tr('Головна')],
                ['shop', '/shop', `${tr('Обладнання')} (${products.length})`],
                ['services', '/services', tr('Послуги монтажу та інжинірингу')],
                ['projects', '/projects', `${tr('Реалізовані проєкти')} (${projects.length})`],
                ['contacts', '/contacts', tr('Контакти')],
                ['payment-delivery', '/payment-delivery', tr('Оплата і доставка')],
                ['offer', '/public-offer', tr('Публічна оферта')],
                ...(adminToken
                  ? ([['crm', '/crm', crmButtonLabel]] as const)
                  : clientToken
                    ? ([['account', '/account', tr('Особистий кабінет', 'Личный кабинет')]] as const)
                    : ([['login', '/login', tr('Увійти / Реєстрація', 'Войти / Регистрация')]] as const)),
              ] as const
            ).map(([v, href, label]) => (
              <a
                key={v}
                href={href}
                onClick={(e) => handleNavAnchor(e, v)}
                className="block w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 text-sm font-bold text-[#0d1f33]"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openLeadModal('Підбір рішення з мобільного меню');
              }}
              className="block w-full text-center px-3 py-2.5 rounded-lg bg-[#1769aa] text-white text-sm font-bold"
            >
              {tr('Підібрати рішення')}
            </button>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">{tr('Ми в соцмережах:', 'Мы в соцсетях:')}</span>
              <SocialIcons links={socialLinks} variant="light" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {loadingCatalog && view !== 'crm' ? (
          <div className="max-w-[1180px] mx-auto px-5 py-16 space-y-4">
            <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-72 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <HomeView
                usdUahRate={usdUahRate}
                products={products}
                projects={projects}
                telegramUrl={socialLinks.telegram}
                isStaff={Boolean(adminToken)}
                wishlistIds={wishlistIds}
                onNavigateShop={(cat) => navigateTo('shop', cat)}
                onNavigateServices={() => navigateTo('services')}
                onNavigateProjects={() => navigateTo('projects')}
                onOpenLeadModal={openLeadModal}
                onSelectProduct={handleSelectProduct}
                onQuickViewProduct={handleQuickViewProduct}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
                onSelectCase={setSelectedCase}
                onLeadCreated={() => void fetchDeals()}
                onOpenCrm={() => navigateTo('crm')}
              />
            )}

            {view === 'shop' && (
              <ShopView
                usdUahRate={usdUahRate}
                products={products}
                initialCategory={shopInitialCat}
                initialQuery={shopInitialQuery}
                wishlistIds={wishlistIds}
                onCategoryChange={handleShopCategorySync}
                onSelectProduct={handleSelectProduct}
                onQuickViewProduct={handleQuickViewProduct}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
                onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
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

            {(view === 'payment-delivery' || view === 'offer') && (
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
          </>
        )}
      </main>

      {/* Footer */}
      {view !== 'crm' && (
        <footer className="bg-[#081421] text-slate-300 pt-11 pb-20 lg:pb-11 border-t border-white/10">
          <div className="max-w-[1180px] mx-auto px-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <SmartImage
                  src="/assets/energocomfort/logo_full.png"
                  alt="Energo Comfort — сонячні станції та резервне живлення"
                  className="h-12 w-auto bg-white rounded-lg p-1.5 mb-3"
                />
                <p className="text-xs text-slate-400 leading-relaxed mb-3.5">
                  {tr('Системи резервного живлення та сонячні електростанції під ключ в Одесі та області.', 'Системы резервного питания и солнечные электростанции под ключ в Одессе и области.')}
                </p>
                <SocialIcons links={socialLinks} variant="footer" />
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Обладнання')}</h2>
                <div className="space-y-1.5 text-xs text-slate-400">
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
                      className="block hover:text-white"
                    >
                      {tr(label)}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Компанія та сервіс', 'Компания и сервис')}</h2>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <a
                    href="/services"
                    onClick={(e) => handleNavAnchor(e, 'services')}
                    className="block hover:text-white"
                  >
                    {tr('Послуги монтажу та інжинірингу')}
                  </a>
                  <a
                    href="/projects"
                    onClick={(e) => handleNavAnchor(e, 'projects')}
                    className="block hover:text-white"
                  >
                    {tr('Реалізовані об’єкти')} ({projects.length})
                  </a>
                  <a
                    href="/contacts"
                    onClick={(e) => handleNavAnchor(e, 'contacts')}
                    className="block hover:text-white"
                  >
                    {tr('Контакти')}
                  </a>
                  <a href="/payment-delivery" onClick={(e) => handleNavAnchor(e, 'payment-delivery')} className="block hover:text-white">
                    {tr('Оплата і доставка')}
                  </a>
                  <a href="/public-offer" onClick={(e) => handleNavAnchor(e, 'offer')} className="block hover:text-white">
                    {tr('Публічна оферта')}
                  </a>
                  {adminToken ? (
                    <a
                      href="/crm"
                      onClick={(e) => handleNavAnchor(e, 'crm')}
                      className="block text-amber-300 hover:text-amber-200"
                    >
                      {crmButtonLabel}
                    </a>
                  ) : clientToken ? (
                    <a
                      href="/account"
                      onClick={(e) => handleNavAnchor(e, 'account')}
                      className="block hover:text-white"
                    >
                      {tr('Особистий кабінет', 'Личный кабинет')}
                    </a>
                  ) : (
                    <a
                      href="/login"
                      onClick={(e) => handleNavAnchor(e, 'login')}
                      className="block text-amber-300 hover:text-amber-200"
                    >
                      {tr('Увійти / Реєстрація', 'Войти / Регистрация')}
                    </a>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-white mb-3">{tr('Контакти · Одеса', 'Контакты · Одесса')}</h2>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <p>{tr(COMPANY_INFO.address, 'Украина, г. Одесса, ул. Европейская, 93')}</p>
                  <a
                    href={COMPANY_INFO.phone1Href}
                    onClick={() => track({ name: 'phone_click', placement: 'footer', scenario: 'unspecified' })}
                    className="block font-mono hover:text-white"
                  >
                    {COMPANY_INFO.phone1}
                  </a>
                  <a
                    href={COMPANY_INFO.phone2Href}
                    onClick={() => track({ name: 'phone_click', placement: 'footer', scenario: 'unspecified' })}
                    className="block font-mono hover:text-white"
                  >
                    {COMPANY_INFO.phone2}
                  </a>
                  <a
                    href={`mailto:${COMPANY_INFO.email}`}
                    onClick={() => trackEvent('contact', { channel: 'email', placement: 'footer' })}
                    className="block hover:text-white"
                  >
                    {COMPANY_INFO.email}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-white/10 text-[11px] text-slate-500 flex flex-wrap justify-between gap-2">
              <span>© 2026 Energo Comfort · energocomfort.shop</span>
              <span>{tr('Офіційне обладнання Deye, SolaX, Solis, Dyness, Trina', 'Официальное оборудование Deye, SolaX, Solis, Dyness, Trina')}</span>
            </div>
          </div>
        </footer>
      )}

      {/* Slim Mobile Thumb CTA Bar (<= 44px height) */}
      {view !== 'crm' && stickyCtaVisible && !cartOpen && !leadModalOpen && !selectedProduct && !quickViewProduct && !selectedCase && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-2">
          <a
            href={COMPANY_INFO.phone1Href}
            onClick={() => track({ name: 'phone_click', placement: 'sticky', scenario: 'unspecified' })}
            className="flex-1 min-w-0 min-h-12 rounded-md border border-slate-300 bg-white text-[#0d1f33] text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <PhoneCall className="w-4 h-4 text-[#1769aa]" />
            {tr('Подзвонити', 'Позвонить')}
          </a>
          <button
            type="button"
            onClick={() => {
              track({ name: 'cta_click', placement: 'sticky', scenario: 'unspecified' });
              openLeadModal('Експрес-підбір із мобільної панелі', undefined, 'sticky');
            }}
            className="flex-1 min-w-0 min-h-12 rounded-md bg-[#1769aa] text-white text-[11px] font-bold inline-flex items-center justify-center whitespace-nowrap cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d1f33]"
          >
            {tr('Розрахунок', 'Расчёт')}
          </button>
          {socialLinks.telegram && <a href={socialLinks.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" onClick={() => track({ name: 'messenger_click', placement: 'sticky', scenario: 'unspecified', channel: 'telegram' })} className="flex-1 min-w-0 min-h-12 rounded-md border border-sky-200 bg-sky-50 text-[#1769aa] text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"><Send className="w-4 h-4" />Telegram</a>}
        </div>
      )}

      {/* Modals & Cart Drawer */}
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
        isWishlisted={selectedProduct ? wishlistIds.includes(selectedProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
      />

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCart}
        onRequestQuote={(p) => openLeadModal(`Розрахунок: ${p.title}`, p.price)}
        onOpenFullDetails={(p) => {
          setQuickViewProduct(null);
          handleSelectProduct(p);
        }}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        usdUahRate={usdUahRate}
      />

      <CaseModal
        project={selectedCase}
        onClose={() => setSelectedCase(null)}
        onQuote={(proj) => openLeadModal(`Схоже на кейс: ${proj.title}`)}
      />

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
