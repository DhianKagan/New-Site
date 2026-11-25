import type { ProductReview, ProductReviewInput } from '../types.ts';
import { getCurrentFirebaseIdToken } from './firebaseAuth.ts';
import { REVIEW_LIMITS, sortProductReviews, validateProductReviewInput } from './productReviews.ts';

export class ReviewsApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ReviewsApiError';
    this.status = status;
  }
}

export interface ProductReviewsFetchResult {
  reviews: ProductReview[];
  viewerUid: string | null;
  isModerator: boolean;
}

async function parseErrorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const data = (await resp.json()) as { error?: unknown };
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    // ignore non-JSON error bodies
  }
  return fallback;
}

export async function fetchProductReviews(
  productId: string,
  options?: { signal?: AbortSignal; authToken?: string | null },
): Promise<ProductReviewsFetchResult> {
  if (!REVIEW_LIMITS.idPattern.test(productId)) {
    return { reviews: [], viewerUid: null, isModerator: false };
  }

  const headers: Record<string, string> = {};
  const token = options?.authToken?.trim() || (await getCurrentFirebaseIdToken());
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
    headers,
  });
  if (!resp.ok) {
    throw new ReviewsApiError(
      await parseErrorMessage(resp, 'Не вдалося завантажити відгуки.'),
      resp.status,
    );
  }
  const data = (await resp.json()) as {
    reviews?: ProductReview[];
    viewerUid?: string | null;
    isModerator?: boolean;
  };
  return {
    reviews: sortProductReviews(Array.isArray(data.reviews) ? data.reviews : []),
    viewerUid: typeof data.viewerUid === 'string' && data.viewerUid ? data.viewerUid : null,
    isModerator: Boolean(data.isModerator),
  };
}

export async function createProductReview(
  input: ProductReviewInput,
  authTokenOverride?: string | null,
): Promise<ProductReview> {
  const validation = validateProductReviewInput(input);
  if (!validation.valid) {
    throw new ReviewsApiError(validation.errorUk, 400);
  }

  const token = authTokenOverride?.trim() || (await getCurrentFirebaseIdToken());
  if (!token) {
    throw new ReviewsApiError('Для публікації відгуку увійдіть в акаунт.', 401);
  }

  const resp = await fetch(
    `/api/products/${encodeURIComponent(validation.normalized.productId)}/reviews`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        authorName: validation.normalized.authorName,
        rating: validation.normalized.rating,
        comment: validation.normalized.comment,
      }),
    },
  );
  if (!resp.ok) {
    throw new ReviewsApiError(
      await parseErrorMessage(resp, 'Не вдалося опублікувати відгук.'),
      resp.status,
    );
  }
  const data = (await resp.json()) as { review: ProductReview };
  return data.review;
}

export async function updateProductReview(
  reviewId: string,
  input: Pick<ProductReviewInput, 'authorName' | 'rating' | 'comment'> & { productId: string },
  authTokenOverride?: string | null,
): Promise<ProductReview> {
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) {
    throw new ReviewsApiError('Некоректний ідентифікатор відгуку.', 400);
  }

  const validation = validateProductReviewInput(input);
  if (!validation.valid) {
    throw new ReviewsApiError(validation.errorUk, 400);
  }

  const token = authTokenOverride?.trim() || (await getCurrentFirebaseIdToken());
  if (!token) {
    throw new ReviewsApiError('Для редагування відгуку увійдіть в акаунт.', 401);
  }

  const resp = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      authorName: validation.normalized.authorName,
      rating: validation.normalized.rating,
      comment: validation.normalized.comment,
    }),
  });
  if (!resp.ok) {
    throw new ReviewsApiError(
      await parseErrorMessage(resp, 'Не вдалося оновити відгук.'),
      resp.status,
    );
  }
  const data = (await resp.json()) as { review: ProductReview };
  return data.review;
}

export async function deleteProductReview(
  reviewId: string,
  authTokenOverride?: string | null,
): Promise<void> {
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) {
    throw new ReviewsApiError('Некоректний ідентифікатор відгуку.', 400);
  }

  const token = authTokenOverride?.trim() || (await getCurrentFirebaseIdToken());
  if (!token) {
    throw new ReviewsApiError('Для видалення відгуку увійдіть в акаунт.', 401);
  }

  const resp = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    throw new ReviewsApiError(
      await parseErrorMessage(resp, 'Не вдалося видалити відгук.'),
      resp.status,
    );
  }
}

export function extractReadableReviewsErrorMessage(error: unknown, isRussian: boolean): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return isRussian
      ? 'Не удалось подключиться к серверу. Проверьте интернет-соединение.'
      : 'Не вдалося підключитися до сервера. Перевірте з’єднання з інтернетом.';
  }
  return raw;
}
