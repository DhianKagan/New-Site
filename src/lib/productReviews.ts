import type {
  ProductReview,
  ProductReviewInput,
  ProductReviewRatingFilter,
  ProductReviewSortOrder,
  ProductReviewStats,
} from '../types.ts';

export const REVIEW_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]{1,128}$/,
  minAuthorName: 2,
  maxAuthorName: 80,
  minRating: 1,
  maxRating: 5,
  minComment: 3,
  maxComment: 1000,
} as const;

export type ProductReviewValidationResult =
  | {
      valid: true;
      normalized: {
        productId: string;
        authorName: string;
        rating: number;
        comment: string;
      };
    }
  | {
      valid: false;
      errorUk: string;
      errorRu: string;
    };

export function validateProductReviewInput(input: ProductReviewInput): ProductReviewValidationResult {
  const productId = input.productId.trim();
  const authorName = input.authorName.trim().slice(0, REVIEW_LIMITS.maxAuthorName);
  const comment = input.comment.trim().slice(0, REVIEW_LIMITS.maxComment);
  const rating = Math.trunc(input.rating);

  if (!REVIEW_LIMITS.idPattern.test(productId)) {
    return {
      valid: false,
      errorUk: 'Некоректний ідентифікатор товару для відгуку.',
      errorRu: 'Некорректный идентификатор товара для отзыва.',
    };
  }

  if (authorName.length < REVIEW_LIMITS.minAuthorName || authorName.length > REVIEW_LIMITS.maxAuthorName) {
    return {
      valid: false,
      errorUk: `Ім’я має містити від ${REVIEW_LIMITS.minAuthorName} до ${REVIEW_LIMITS.maxAuthorName} символів.`,
      errorRu: `Имя должно содержать от ${REVIEW_LIMITS.minAuthorName} до ${REVIEW_LIMITS.maxAuthorName} символов.`,
    };
  }

  if (
    !Number.isInteger(input.rating) ||
    rating < REVIEW_LIMITS.minRating ||
    rating > REVIEW_LIMITS.maxRating
  ) {
    return {
      valid: false,
      errorUk: 'Оберіть оцінку від 1 до 5 зірок.',
      errorRu: 'Выберите оценку от 1 до 5 звёзд.',
    };
  }

  if (comment.length < REVIEW_LIMITS.minComment || comment.length > REVIEW_LIMITS.maxComment) {
    return {
      valid: false,
      errorUk: `Текст відгуку має містити від ${REVIEW_LIMITS.minComment} до ${REVIEW_LIMITS.maxComment} символів.`,
      errorRu: `Текст отзыва должен содержать от ${REVIEW_LIMITS.minComment} до ${REVIEW_LIMITS.maxComment} символов.`,
    };
  }

  return {
    valid: true,
    normalized: {
      productId,
      authorName,
      rating,
      comment,
    },
  };
}

export function sortProductReviews(
  reviews: readonly ProductReview[],
  sortOrder: ProductReviewSortOrder = 'newest',
): ProductReview[] {
  return [...reviews].sort((a, b) => {
    if (sortOrder === 'oldest') {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      return a.id.localeCompare(b.id);
    }
    if (sortOrder === 'highest') {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      return b.id.localeCompare(a.id);
    }
    if (sortOrder === 'lowest') {
      if (a.rating !== b.rating) return a.rating - b.rating;
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      return b.id.localeCompare(a.id);
    }
    if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
    return b.id.localeCompare(a.id);
  });
}

export function filterAndSortProductReviews(
  reviews: readonly ProductReview[],
  options: {
    sortOrder: ProductReviewSortOrder;
    ratingFilter: ProductReviewRatingFilter;
  },
): ProductReview[] {
  const filtered =
    options.ratingFilter === 'all'
      ? reviews
      : reviews.filter((review) => Math.trunc(review.rating) === options.ratingFilter);
  return sortProductReviews(filtered, options.sortOrder);
}

export function computeProductReviewStats(reviews: readonly ProductReview[]): ProductReviewStats {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let validCount = 0;

  for (const item of reviews) {
    if (item.status !== 'published') continue;
    const star = Math.trunc(item.rating);
    if (star < 1 || star > 5) continue;
    sum += star;
    validCount += 1;
    const bucketIndex = 5 - star;
    distribution[bucketIndex] += 1;
  }

  return {
    count: validCount,
    averageRating: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : 0,
    distribution,
  };
}

export function formatAverageRatingLabel(stats: Pick<ProductReviewStats, 'count' | 'averageRating'>): string {
  if (stats.count <= 0) {
    return '—/5';
  }
  return `${stats.averageRating.toFixed(1)}/5`;
}

export function generateSafeReviewId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `rev_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
  }
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `rev_${Date.now().toString(36)}_${randomPart}`;
}
