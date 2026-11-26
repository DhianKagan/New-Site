import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  X,
  ShoppingBag,
  ArrowUpRight,
  CheckCircle2,
  Truck,
  ShieldCheck,
  PhoneCall,
  MessageSquarePlus,
  Heart,
  Scale,
} from 'lucide-react';
import type { Product, ProductReview } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatUahFromUsd } from '../lib/currency.ts';
import { getActiveLocale, localizeCatalogText, tr } from '../lib/i18n.ts';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { track } from '../lib/analytics.ts';
import { getRuntimeFirebaseConfig, subscribeFirebaseAuthState } from '../lib/firebaseAuth.ts';
import { extractReadableReviewsErrorMessage, fetchProductReviews } from '../lib/reviewsApi.ts';
import {
  computeProductReviewStats,
  formatAverageRatingLabel,
  sortProductReviews,
} from '../lib/productReviews.ts';
import {
  formatReviewsCountLabel,
  ProductReviews,
  StarRow,
} from './ProductReviews.tsx';

const CAT_LABELS: Record<string, string> = {
  kits: 'Готове рішення під ключ',
  inverters: 'Інвертори',
  batteries: 'Акумуляторні батареї',
  panels: 'Сонячні панелі',
  parts: 'Комплектуючі та захист',
};

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onRequestQuote: (product: Product) => void;
  usdUahRate: number | null;
  clientToken?: string | null;
  adminToken?: string | null;
  clientCustomerName?: string | null;
  onRequireLogin?: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  isCompared?: boolean;
  onToggleCompare?: (product: Product) => void;
}

export function ProductModal({
  product,
  onClose,
  onAddToCart,
  onRequestQuote,
  usdUahRate,
  clientToken = null,
  adminToken = null,
  clientCustomerName = null,
  onRequireLogin,
  isWishlisted = false,
  onToggleWishlist,
  isCompared = false,
  onToggleCompare,
}: ProductModalProps) {
  const isRussian = getActiveLocale() === 'ru';
  const productId = product?.id ?? null;

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [viewerUid, setViewerUid] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoadError, setReviewsLoadError] = useState('');
  const [reviewsReloadNonce, setReviewsReloadNonce] = useState(0);
  const [composeNonce, setComposeNonce] = useState(0);
  const [loginPromptNonce, setLoginPromptNonce] = useState(0);
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);

  const isAuthenticated = Boolean(clientToken || adminToken || authUser);
  const preferredSessionToken = adminToken || clientToken || null;

  useEffect(() => {
    void getRuntimeFirebaseConfig();
    const unsub = subscribeFirebaseAuthState((user) => {
      setAuthUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setComposeNonce(0);
    setLoginPromptNonce(0);
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setReviews([]);
      setViewerUid(null);
      setIsModerator(false);
      setReviewsLoading(false);
      setReviewsLoadError('');
      return;
    }

    const controller = new AbortController();
    setReviewsLoading(true);
    setReviewsLoadError('');

    void fetchProductReviews(productId, {
      signal: controller.signal,
      authToken: preferredSessionToken,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setReviews(result.reviews);
        setViewerUid(result.viewerUid);
        setIsModerator(result.isModerator);
        setReviewsLoading(false);
        setReviewsLoadError('');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setReviewsLoadError(extractReadableReviewsErrorMessage(error, isRussian));
        setReviewsLoading(false);
      });

    return () => controller.abort();
  }, [productId, reviewsReloadNonce, isRussian, preferredSessionToken, authUser?.uid]);

  const reviewStats = useMemo(() => computeProductReviewStats(reviews), [reviews]);

  if (!product) return null;

  const title = isRussian ? product.titleRu ?? localizeCatalogText(product.title) : product.title;
  const specs = isRussian
    ? product.specsRu ?? product.specs.map(([key, value]) => [localizeCatalogText(key), localizeCatalogText(value)] as [string, string])
    : product.specs;
  const description = isRussian ? product.descriptionRu ?? localizeCatalogText(product.description) : product.description;
  const canBuyDirect = !product.isKit && product.price > 0;
  const discountPct =
    product.oldPrice > product.price && product.price > 0
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;
  const averageRatingLabel = formatAverageRatingLabel(reviewStats);

  function handleScrollToReviews() {
    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleAddReviewClick() {
    if (isAuthenticated) {
      setComposeNonce((n) => n + 1);
    } else {
      setLoginPromptNonce((n) => n + 1);
    }
    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2 truncate">
            <span>{tr(CAT_LABELS[product.cat] || product.cat)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#0d1f33]">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">SKU {product.sku}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onToggleCompare && (
              <button
                type="button"
                onClick={() => onToggleCompare(product)}
                aria-pressed={isCompared}
                aria-label={
                  isCompared
                    ? tr('Прибрати з порівняння', 'Убрать из сравнения')
                    : tr('Додати до порівняння', 'Добавить к сравнению')
                }
                title={
                  isCompared
                    ? tr('Прибрати з порівняння', 'Убрать из сравнения')
                    : tr('Додати до порівняння', 'Добавить к сравнению')
                }
                className={`h-8 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  isCompared
                    ? 'bg-[#0b66b2] border-[#0b66b2] text-white hover:bg-[#08508e]'
                    : 'border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-[#0b66b2]'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isCompared ? tr('У порівнянні', 'В сравнении') : tr('Порівняти', 'Сравнить')}
                </span>
              </button>
            )}
            {onToggleWishlist && (
              <button
                type="button"
                onClick={() => onToggleWishlist(product)}
                aria-pressed={isWishlisted}
                aria-label={
                  isWishlisted
                    ? tr('Прибрати зі списку бажань', 'Убрать из списка желаний')
                    : tr('Додати до списку бажань', 'Добавить в список желаний')
                }
                title={
                  isWishlisted
                    ? tr('Прибрати зі списку бажань', 'Убрать из списка желаний')
                    : tr('Додати до списку бажань', 'Добавить в список желаний')
                }
                className={`h-8 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span className="hidden sm:inline">
                  {isWishlisted ? tr('У бажаннях', 'В желаниях') : tr('Зберегти', 'Сохранить')}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Закрити')}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="bg-[#f8fafc] border border-slate-200 rounded-xl h-72 md:h-80 overflow-hidden flex items-center justify-center relative">
            <SmartImage
              src={product.img}
              alt={title}
              className={`w-full h-full ${
                product.isKit && product.id !== 'vysokovoltna-sistema-solax-x3-ies-p15b15'
                  ? 'object-cover'
                  : 'object-contain p-6'
              }`}
            />
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-rose-600 text-white font-mono text-xs font-extrabold">
                -{discountPct}%
              </span>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div>
              <h2 id="product-modal-title" className="text-xl font-extrabold text-[#0d1f33] leading-tight mb-2.5">
                {title}
              </h2>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleScrollToReviews}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs transition-colors cursor-pointer"
                >
                  <StarRow rating={reviewStats.count > 0 ? reviewStats.averageRating : 0} size="sm" />
                  <span className="font-mono font-extrabold text-[#0d1f33] tabular-nums">
                    {averageRatingLabel}
                  </span>
                  <span className="text-slate-500">
                    ({reviewsLoading && reviewStats.count === 0
                      ? tr('завантаження...', 'загрузка...')
                      : formatReviewsCountLabel(reviewStats.count, isRussian)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleAddReviewClick}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-[#1769aa] text-xs font-bold transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {tr('Додати відгук', 'Добавить отзыв')}
                </button>
              </div>

              <div className="flex items-baseline gap-3 mb-3">
                {product.price > 0 ? (
                  <>
                    <span className="font-mono text-2xl font-extrabold text-[#0d1f33] tabular-nums">
                      {formatUahFromUsd(product.price, usdUahRate)}
                    </span>
                    {product.oldPrice > product.price && (
                      <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                        {formatUahFromUsd(product.oldPrice, usdUahRate)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-mono text-lg font-bold text-[#1769aa]">{tr('Ціна за запитом', 'Цена по запросу')}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#169374] mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isRussian ? product.statusLabelRu ?? (product.inStock ? 'В наличии на складе в Одессе' : 'Поставка под заказ') : product.inStock ? 'В наявності на складі в Одесі' : 'Поставка під замовлення'} · {tr('Офіційна гарантія')}
                </span>
              </div>

              {specs.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-2 mb-4">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs gap-3">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-bold text-[#0d1f33]">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {description && (
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto pr-1 mb-4">
                  {description}
                </p>
              )}

              <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[#1769aa] shrink-0" />
                  <span>{tr('Самовивіз в Одесі (вул. Європейська, 93) або Нова Пошта по Україні', 'Самовывоз в Одессе (ул. Европейская, 93) или Новая Почта по Украине')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#169374] shrink-0" />
                  <span>{tr('Безкоштовна перевірка сумісності інвертора/АКБ · Оплата: готівка, ФОП, ТОВ з ПДВ', 'Бесплатная проверка совместимости инвертора/АКБ · Оплата: наличные, ФЛП, ООО с НДС')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap gap-2.5">
                {canBuyDirect && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToCart(product);
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] hover:text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {tr('Додати в кошик', 'Добавить в корзину')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestQuote(product);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {tr('Підбір під об’єкт', 'Подбор для объекта')}
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center text-[11px] text-slate-500">
                <a
                  href={COMPANY_INFO.phone1Href}
                  onClick={() => track({ name: 'phone_click', placement: 'section', scenario: 'unspecified' })}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1769aa] hover:underline"
                >
                  <PhoneCall className="w-3 h-3" />
                  {tr('Швидке уточнення по телефону:', 'Быстрое уточнение по телефону:')} {COMPANY_INFO.phone1}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div ref={reviewsSectionRef} className="border-t border-slate-200 px-6 py-5 bg-slate-50/40">
          <ProductReviews
            product={product}
            reviews={reviews}
            stats={reviewStats}
            loading={reviewsLoading}
            loadError={reviewsLoadError}
            authUser={authUser}
            clientToken={clientToken}
            adminToken={adminToken}
            clientCustomerName={clientCustomerName}
            viewerUid={viewerUid}
            isModerator={isModerator}
            composeNonce={composeNonce}
            loginPromptNonce={loginPromptNonce}
            onAddReviewClick={handleAddReviewClick}
            onRequireLogin={onRequireLogin}
            onRetryLoad={() => setReviewsReloadNonce((n) => n + 1)}
            onReviewCreated={(created) => {
              setViewerUid((prev) => prev ?? created.authorUid);
              setReviews((prev) => sortProductReviews([created, ...prev.filter((r) => r.id !== created.id)]));
            }}
            onReviewUpdated={(updated) =>
              setReviews((prev) =>
                sortProductReviews(prev.map((r) => (r.id === updated.id ? updated : r))),
              )
            }
            onReviewDeleted={(deletedId) =>
              setReviews((prev) => prev.filter((r) => r.id !== deletedId))
            }
          />
        </div>
      </div>
    </div>
  );
}
