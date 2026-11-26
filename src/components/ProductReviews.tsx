import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Edit3,
  LogIn,
  MessageSquarePlus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  Product,
  ProductReview,
  ProductReviewRatingFilter,
  ProductReviewSortOrder,
  ProductReviewStats,
} from '../types.ts';
import { signInWithGooglePopup } from '../lib/firebaseAuth.ts';
import { ReviewListSkeleton } from './CatalogSkeletons.tsx';
import {
  createProductReview,
  deleteProductReview,
  extractReadableReviewsErrorMessage,
  updateProductReview,
} from '../lib/reviewsApi.ts';
import {
  filterAndSortProductReviews,
  formatAverageRatingLabel,
  REVIEW_LIMITS,
  validateProductReviewInput,
} from '../lib/productReviews.ts';
import { getActiveLocale, tr } from '../lib/i18n.ts';

interface ProductReviewsProps {
  product: Product;
  reviews: ProductReview[];
  stats: ProductReviewStats;
  loading: boolean;
  loadError: string;
  authUser: User | null;
  clientToken: string | null;
  adminToken: string | null;
  clientCustomerName: string | null;
  viewerUid: string | null;
  isModerator: boolean;
  composeNonce: number;
  loginPromptNonce: number;
  onAddReviewClick: () => void;
  onRequireLogin?: () => void;
  onRetryLoad: () => void;
  onReviewCreated: (review: ProductReview) => void;
  onReviewUpdated: (review: ProductReview) => void;
  onReviewDeleted: (reviewId: string) => void;
}

function formatReviewDate(timestampMs: number, isRussian: boolean): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return isRussian ? 'Только что' : 'Щойно';
  }
  try {
    return new Intl.DateTimeFormat(isRussian ? 'ru-UA' : 'uk-UA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestampMs));
  } catch {
    return '';
  }
}

export function formatReviewsCountLabel(count: number, isRussian: boolean): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return isRussian ? `${count} отзыв` : `${count} відгук`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return isRussian ? `${count} отзыва` : `${count} відгуки`;
  }
  return isRussian ? `${count} отзывов` : `${count} відгуків`;
}

export function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconCls = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((starValue) => {
        const fillRatio = Math.max(0, Math.min(1, rating - (starValue - 1)));
        const fillPct = Math.round(fillRatio * 100);
        return (
          <span key={starValue} className={`relative inline-block ${iconCls} shrink-0`}>
            <Star className={`${iconCls} text-slate-300`} />
            {fillPct > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPct}%` }}
              >
                <Star className={`${iconCls} text-[#f59e0b] fill-[#f59e0b]`} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function ProductReviews({
  product,
  reviews,
  stats,
  loading,
  loadError,
  authUser,
  clientToken,
  adminToken,
  clientCustomerName,
  viewerUid,
  isModerator,
  composeNonce,
  loginPromptNonce,
  onAddReviewClick,
  onRequireLogin,
  onRetryLoad,
  onReviewCreated,
  onReviewUpdated,
  onReviewDeleted,
}: ProductReviewsProps) {
  const isRussian = getActiveLocale() === 'ru';
  const isAuthenticated = Boolean(clientToken || adminToken || authUser);
  const effectiveViewerUid = viewerUid ?? authUser?.uid ?? null;

  const [signingIn, setSigningIn] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [loginPromptHighlighted, setLoginPromptHighlighted] = useState(false);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [comment, setComment] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<ProductReviewSortOrder>('newest');
  const [ratingFilter, setRatingFilter] = useState<ProductReviewRatingFilter>('all');

  const authorInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const defaultName =
      clientCustomerName?.trim() || authUser?.displayName?.trim() || (adminToken ? tr('Менеджер Energo Comfort', 'Менеджер Energo Comfort') : '');
    if (defaultName) {
      setAuthorName((prev) => (prev.trim() ? prev : defaultName));
    }
  }, [clientCustomerName, authUser?.displayName, adminToken]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoginPromptHighlighted(false);
    } else {
      setComposerOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (composeNonce > 0 && isAuthenticated) {
      setComposerOpen(true);
      setLoginPromptHighlighted(false);
      setFormError('');
      const target = authorName.trim() ? commentInputRef.current : authorInputRef.current;
      window.setTimeout(() => {
        target?.focus();
      }, 60);
    }
  }, [composeNonce, isAuthenticated]);

  useEffect(() => {
    if (loginPromptNonce > 0 && !isAuthenticated) {
      setLoginPromptHighlighted(true);
      setFormError('');
    }
  }, [loginPromptNonce, isAuthenticated]);

  useEffect(() => {
    setFormError('');
    setFormSuccess('');
    setEditingReviewId(null);
    setConfirmDeleteId(null);
    setComposerOpen(false);
    setLoginPromptHighlighted(false);
    setSortOrder('newest');
    setRatingFilter('all');
  }, [product.id]);

  const filteredReviews = useMemo(
    () => filterAndSortProductReviews(reviews, { sortOrder, ratingFilter }),
    [reviews, sortOrder, ratingFilter],
  );

  async function resolveActiveAuthToken(): Promise<string | undefined> {
    if (adminToken) return adminToken;
    if (clientToken) return clientToken;
    if (authUser) return authUser.getIdToken();
    return undefined;
  }

  async function handleGoogleSignIn() {
    setFormError('');
    setFormSuccess('');
    setSigningIn(true);
    try {
      const result = await signInWithGooglePopup();
      if (result.displayName) {
        setAuthorName((prev) => (prev.trim() ? prev : result.displayName));
      }
      setLoginPromptHighlighted(false);
      setComposerOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('popup-closed-by-user')) {
        setFormError(
          tr(
            'Вікно входу Google було закрито до завершення авторизації.',
            'Окно входа Google было закрыто до завершения авторизации.',
          ),
        );
      } else if (message.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setFormError(
          tr(
            `Домен ${host} не додано в Authorized domains у Firebase Console.`,
            `Домен ${host} не добавлен в Authorized domains в Firebase Console.`,
          ),
        );
      } else {
        setFormError(
          tr('Не вдалося виконати вхід через Google.', 'Не удалось выполнить вход через Google.'),
        );
      }
    } finally {
      setSigningIn(false);
    }
  }

  function handleStartEdit(review: ProductReview) {
    setComposerOpen(true);
    setEditingReviewId(review.id);
    setAuthorName(review.authorName);
    setRating(review.rating);
    setComment(review.comment);
    setFormError('');
    setFormSuccess('');
    setConfirmDeleteId(null);
  }

  function handleCancelEdit() {
    setEditingReviewId(null);
    setRating(5);
    setComment('');
    setAuthorName(clientCustomerName?.trim() || authUser?.displayName || '');
    setFormError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!isAuthenticated) {
      setLoginPromptHighlighted(true);
      setFormError(
        tr(
          'Щоб опублікувати відгук, спочатку увійдіть у свій акаунт.',
          'Чтобы опубликовать отзыв, сначала войдите в свой аккаунт.',
        ),
      );
      return;
    }

    const validation = validateProductReviewInput({
      productId: product.id,
      authorName,
      rating,
      comment,
    });
    if (!validation.valid) {
      setFormError(isRussian ? validation.errorRu : validation.errorUk);
      return;
    }

    setSubmitting(true);
    try {
      const authToken = await resolveActiveAuthToken();
      if (editingReviewId) {
        const updated = await updateProductReview(
          editingReviewId,
          {
            productId: product.id,
            authorName: validation.normalized.authorName,
            rating: validation.normalized.rating,
            comment: validation.normalized.comment,
          },
          authToken,
        );
        onReviewUpdated(updated);
        setEditingReviewId(null);
        setComment('');
        setRating(5);
        setComposerOpen(false);
        setFormSuccess(tr('Відгук успішно оновлено.', 'Отзыв успешно обновлён.'));
      } else {
        const created = await createProductReview(
          {
            productId: product.id,
            authorName: validation.normalized.authorName,
            rating: validation.normalized.rating,
            comment: validation.normalized.comment,
          },
          authToken,
        );
        onReviewCreated(created);
        setComment('');
        setRating(5);
        setComposerOpen(false);
        setFormSuccess(tr('Дякуємо! Ваш відгук опубліковано.', 'Спасибо! Ваш отзыв опубликован.'));
      }
    } catch (error) {
      setFormError(extractReadableReviewsErrorMessage(error, isRussian));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reviewId: string) {
    setFormError('');
    setFormSuccess('');
    setDeletingId(reviewId);
    try {
      const authToken = await resolveActiveAuthToken();
      await deleteProductReview(reviewId, authToken);
      onReviewDeleted(reviewId);
      if (editingReviewId === reviewId) {
        handleCancelEdit();
      }
      setConfirmDeleteId(null);
      setFormSuccess(tr('Відгук видалено.', 'Отзыв удалён.'));
    } catch (error) {
      setFormError(extractReadableReviewsErrorMessage(error, isRussian));
    } finally {
      setDeletingId(null);
    }
  }

  const displayedStarValue = hoverRating ?? rating;
  const averageLabel = formatAverageRatingLabel(stats);

  return (
    <section id="product-reviews" aria-labelledby="product-reviews-heading" className="space-y-5">
      {/* Header & Aggregate Rating Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 id="product-reviews-heading" className="text-base font-extrabold text-[#0d1f33]">
              {tr('Відгуки покупців', 'Отзывы покупателей')}
            </h3>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-mono font-extrabold text-[#0d1f33] tabular-nums">
              <Star className="w-3.5 h-3.5 text-[#f59e0b] fill-[#f59e0b]" />
              {averageLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.count > 0
              ? tr(
                  `Середній рейтинг ${averageLabel} на основі ${formatReviewsCountLabel(stats.count, false)} · підтверджені облікові записи`,
                  `Средний рейтинг ${averageLabel} на основе ${formatReviewsCountLabel(stats.count, true)} · подтверждённые аккаунты`,
                )
              : tr(
                  'Поки немає відгуків — поділіться враженням про це обладнання',
                  'Пока нет отзывов — поделитесь впечатлением об этом оборудовании',
                )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200">
            <div className="font-mono text-xl font-extrabold text-[#0d1f33] tabular-nums leading-none">
              {averageLabel}
            </div>
            <div className="space-y-0.5">
              <StarRow rating={stats.count > 0 ? stats.averageRating : 0} size="sm" />
              <div className="text-[11px] font-semibold text-slate-500">
                {formatReviewsCountLabel(stats.count, isRussian)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddReviewClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <MessageSquarePlus className="w-4 h-4" />
            {tr('Додати відгук', 'Добавить отзыв')}
          </button>
        </div>
      </div>

      {/* Star Rating Distribution (interactive quick filter) */}
      {stats.count > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 grid grid-cols-1 sm:grid-cols-5 gap-2">
          {([5, 4, 3, 2, 1] as const).map((star, idx) => {
            const count = stats.distribution[idx];
            const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
            const isSelected = ratingFilter === star;
            return (
              <button
                key={star}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setRatingFilter((prev) => (prev === star ? 'all' : star))}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#1769aa] bg-sky-50/70'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono font-bold text-[#0d1f33] w-5 shrink-0 text-left">{star}★</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f59e0b] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-slate-500 w-5 text-right tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Review Submission / Login Prompt */}
      <div
        className={`rounded-xl border bg-white p-4 transition-colors ${
          loginPromptHighlighted && !isAuthenticated
            ? 'border-amber-400 ring-2 ring-amber-200/70'
            : 'border-slate-200'
        }`}
      >
        {!isAuthenticated ? (
          <div className="space-y-3">
            {loginPromptHighlighted && (
              <div
                role="status"
                className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  {tr(
                    'Щоб залишити відгук, потрібно увійти в систему (особистий кабінет, CRM або через Google).',
                    'Чтобы оставить отзыв, нужно войти в систему (личный кабинет, CRM или через Google).',
                  )}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MessageSquarePlus className="w-4 h-4 text-[#1769aa] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0d1f33]">
                    {tr('Залишити відгук про товар', 'Оставить отзыв о товаре')}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {tr(
                      'Увійдіть в акаунт клієнта або авторизуйтесь через Google, щоб поставити оцінку.',
                      'Войдите в аккаунт клиента или авторизуйтесь через Google, чтобы поставить оценку.',
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onRequireLogin && (
                  <button
                    type="button"
                    onClick={onRequireLogin}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {tr('Увійти в акаунт', 'Войти в аккаунт')}
                  </button>
                )}

                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => void handleGoogleSignIn()}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-[#0d1f33] text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {signingIn
                      ? tr('Підключення...', 'Подключение...')
                      : tr('Увійти через Google', 'Войти через Google')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : !composerOpen && !editingReviewId ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MessageSquarePlus className="w-4 h-4 text-[#169374] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-[#0d1f33]">
                  {tr('Поділіться враженням про товар', 'Поделитесь впечатлением о товаре')}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {tr(
                    'Ви авторизовані та можете поставити оцінку від 1 до 5 зірок і написати відгук.',
                    'Вы авторизованы и можете поставить оценку от 1 до 5 звёзд и написать отзыв.',
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onAddReviewClick}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              {tr('Додати відгук', 'Добавить отзыв')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-[#0d1f33]">
                {editingReviewId
                  ? tr('Редагування вашого відгуку', 'Редактирование вашего отзыва')
                  : tr('Написати відгук', 'Написать отзыв')}
              </div>
              <div
                role="radiogroup"
                aria-label={tr('Оцінка товару від 1 до 5 зірок', 'Оценка товара от 1 до 5 звёзд')}
                className="inline-flex items-center gap-1"
                onMouseLeave={() => setHoverRating(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setRating((prev) => Math.min(5, prev + 1));
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setRating((prev) => Math.max(1, prev - 1));
                  }
                }}
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const active = starValue <= displayedStarValue;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      role="radio"
                      aria-checked={rating === starValue}
                      aria-label={`${starValue} / 5`}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onClick={() => setRating(starValue)}
                      className="p-0.5 rounded hover:scale-110 transition-transform cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1769aa]"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          active ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-1.5 font-mono text-xs font-bold text-[#0d1f33] tabular-nums">
                  {rating}/5
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label htmlFor="review-author-name" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                  {tr('Ваше ім’я', 'Ваше имя')} *
                </label>
                <input
                  ref={authorInputRef}
                  id="review-author-name"
                  type="text"
                  required
                  minLength={REVIEW_LIMITS.minAuthorName}
                  maxLength={REVIEW_LIMITS.maxAuthorName}
                  disabled={submitting}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={tr('Олександр К.', 'Александр К.')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="review-comment" className="block text-[11px] font-bold text-[#0d1f33]">
                    {tr('Ваш відгук', 'Ваш отзыв')} *
                  </label>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {comment.trim().length}/{REVIEW_LIMITS.maxComment}
                  </span>
                </div>
                <textarea
                  ref={commentInputRef}
                  id="review-comment"
                  rows={2}
                  required
                  minLength={REVIEW_LIMITS.minComment}
                  maxLength={REVIEW_LIMITS.maxComment}
                  disabled={submitting}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={tr(
                    'Розкажіть про досвід встановлення, роботи або комплектації...',
                    'Расскажите об опыте установки, работы или комплектации...',
                  )}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs leading-relaxed focus:outline-none focus:border-[#1769aa]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (editingReviewId) {
                    handleCancelEdit();
                  }
                  setComposerOpen(false);
                  setFormError('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
              >
                {tr('Скасувати', 'Отмена')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {submitting
                  ? tr('Збереження...', 'Сохранение...')
                  : editingReviewId
                    ? tr('Зберегти зміни', 'Сохранить изменения')
                    : tr('Опублікувати відгук', 'Опубликовать отзыв')}
              </button>
            </div>
          </form>
        )}

        {formError && (
          <div
            role="alert"
            className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div
            role="status"
            className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}
      </div>

      {/* Reviews Filter & Sort Bar */}
      {!loading && !loadError && reviews.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tr('Фільтр за оцінкою', 'Фильтр по оценке')}>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {tr('Оцінка:', 'Оценка:')}
            </span>
            <button
              type="button"
              aria-pressed={ratingFilter === 'all'}
              onClick={() => setRatingFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                ratingFilter === 'all'
                  ? 'bg-[#0d1f33] text-white border-[#0d1f33]'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tr('Усі', 'Все')} ({reviews.length})
            </button>
            {([5, 4, 3, 2, 1] as const).map((star, idx) => {
              const bucketCount = stats.distribution[idx];
              const active = ratingFilter === star;
              return (
                <button
                  key={star}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRatingFilter((prev) => (prev === star ? 'all' : star))}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer tabular-nums ${
                    active
                      ? 'bg-[#1769aa] text-white border-[#1769aa]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {star}★ ({bucketCount})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="review-sort-select" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 whitespace-nowrap">
              <ArrowUpDown className="w-3.5 h-3.5" />
              {tr('Сортування:', 'Сортировка:')}
            </label>
            <select
              id="review-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as ProductReviewSortOrder)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0d1f33] focus:outline-none focus:border-[#1769aa] cursor-pointer"
            >
              <option value="newest">{tr('Спочатку новіші', 'Сначала новые')}</option>
              <option value="oldest">{tr('Спочатку старіші', 'Сначала старые')}</option>
              <option value="highest">{tr('Найвищий рейтинг', 'Высокий рейтинг')}</option>
              <option value="lowest">{tr('Найнижчий рейтинг', 'Низкий рейтинг')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <ReviewListSkeleton count={2} />
      ) : loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryLoad}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-[#0d1f33] hover:bg-amber-100 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {tr('Повторити', 'Повторить')}
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
          {tr(
            'Для цього товару ще немає текстових відгуків. Ваш відгук буде першим!',
            'Для этого товара ещё нет текстовых отзывов. Ваш отзыв будет первым!',
          )}
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center space-y-2.5">
          <p className="text-xs text-slate-500">
            {tr(
              `Відгуків з оцінкою ${ratingFilter}★ поки немає.`,
              `Отзывов с оценкой ${ratingFilter}★ пока нет.`,
            )}
          </p>
          <button
            type="button"
            onClick={() => setRatingFilter('all')}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#0d1f33] cursor-pointer"
          >
            {tr('Показати всі відгуки', 'Показать все отзывы')}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredReviews.map((review) => {
            const canModify = Boolean(
              isAuthenticated && (isModerator || (effectiveViewerUid && effectiveViewerUid === review.authorUid)),
            );
            const initial = review.authorName.trim().charAt(0).toUpperCase() || 'К';
            return (
              <article
                key={review.id}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#0d1f33] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0d1f33] truncate">
                        {review.authorName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatReviewDate(review.createdAtMs, isRussian)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <StarRow rating={review.rating} size="sm" />
                    {canModify && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(review)}
                          aria-label={tr('Редагувати відгук', 'Редактировать отзыв')}
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-[#1769aa] hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === review.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deletingId === review.id}
                              onClick={() => void handleDelete(review.id)}
                              className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {deletingId === review.id
                                ? '...'
                                : tr('Видалити', 'Удалить')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              {tr('Ні', 'Нет')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(review.id)}
                            aria-label={tr('Видалити відгук', 'Удалить отзыв')}
                            className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line break-words">
                  {review.comment}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
