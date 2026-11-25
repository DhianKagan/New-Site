import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProductReviewRecord,
  deleteProductReviewRecord,
  getProductReviewById,
  listPublishedProductReviews,
  updateProductReviewRecord,
} from '../server/db.ts';
import { PRODUCT_REVIEW_ID_REGEX, productReviewBodySchema } from '../server/validation.ts';
import {
  computeProductReviewStats,
  filterAndSortProductReviews,
  formatAverageRatingLabel,
  generateSafeReviewId,
  REVIEW_LIMITS,
  sortProductReviews,
  validateProductReviewInput,
} from '../src/lib/productReviews.ts';
import type { ProductReview } from '../src/types.ts';

test('validateProductReviewInput enforces schema bounds and normalizes input', () => {
  const ok = validateProductReviewInput({
    productId: 'deye-sun-5k-sg03lp1',
    authorName: '  Іван Петренко  ',
    rating: 5,
    comment: '  Чудовий інвертор, працює безшумно.  ',
  });
  assert.equal(ok.valid, true);
  if (ok.valid) {
    assert.equal(ok.normalized.authorName, 'Іван Петренко');
    assert.equal(ok.normalized.comment, 'Чудовий інвертор, працює безшумно.');
    assert.equal(ok.normalized.rating, 5);
  }

  const badRating = validateProductReviewInput({
    productId: 'deye-sun-5k-sg03lp1',
    authorName: 'Іван',
    rating: 4.5,
    comment: 'Норм',
  });
  assert.equal(badRating.valid, false);

  const shortName = validateProductReviewInput({
    productId: 'deye-sun-5k-sg03lp1',
    authorName: 'І',
    rating: 5,
    comment: 'Гарна батарея',
  });
  assert.equal(shortName.valid, false);

  const shortComment = validateProductReviewInput({
    productId: 'deye-sun-5k-sg03lp1',
    authorName: 'Іван',
    rating: 5,
    comment: 'Ок',
  });
  assert.equal(shortComment.valid, false);
});

test('computeProductReviewStats calculates average rating and 5-to-1 distribution', () => {
  const sample: ProductReview[] = [
    {
      id: 'rev_1',
      productId: 'p1',
      authorUid: 'u1',
      authorName: 'Олег',
      rating: 5,
      comment: 'Відмінно',
      status: 'published',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
    {
      id: 'rev_2',
      productId: 'p1',
      authorUid: 'u2',
      authorName: 'Марія',
      rating: 4,
      comment: 'Добре',
      status: 'published',
      createdAtMs: 2000,
      updatedAtMs: 2000,
    },
    {
      id: 'rev_3',
      productId: 'p1',
      authorUid: 'u3',
      authorName: 'Прихований',
      rating: 1,
      comment: 'Спам',
      status: 'hidden',
      createdAtMs: 3000,
      updatedAtMs: 3000,
    },
  ];

  const stats = computeProductReviewStats(sample);
  assert.equal(stats.count, 2);
  assert.equal(stats.averageRating, 4.5);
  assert.equal(formatAverageRatingLabel(stats), '4.5/5');
  assert.equal(formatAverageRatingLabel(computeProductReviewStats([])), '—/5');
  assert.deepEqual(stats.distribution, [1, 1, 0, 0, 0]);

  const sorted = sortProductReviews(sample);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['rev_3', 'rev_2', 'rev_1'],
  );

  const generated = generateSafeReviewId();
  assert.match(generated, REVIEW_LIMITS.idPattern);
});

test('filterAndSortProductReviews supports date and rating sorting plus star filtering', () => {
  const reviews: ProductReview[] = [
    {
      id: 'rev_a',
      productId: 'p1',
      authorUid: 'u1',
      authorName: 'Анна',
      rating: 3,
      comment: 'Середньо',
      status: 'published',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
    {
      id: 'rev_b',
      productId: 'p1',
      authorUid: 'u2',
      authorName: 'Богдан',
      rating: 5,
      comment: 'Топ',
      status: 'published',
      createdAtMs: 2000,
      updatedAtMs: 2000,
    },
    {
      id: 'rev_c',
      productId: 'p1',
      authorUid: 'u3',
      authorName: 'Віктор',
      rating: 2,
      comment: 'Зауваження',
      status: 'published',
      createdAtMs: 3000,
      updatedAtMs: 3000,
    },
    {
      id: 'rev_d',
      productId: 'p1',
      authorUid: 'u4',
      authorName: 'Галина',
      rating: 5,
      comment: 'Супер',
      status: 'published',
      createdAtMs: 4000,
      updatedAtMs: 4000,
    },
  ];

  assert.deepEqual(
    filterAndSortProductReviews(reviews, { sortOrder: 'newest', ratingFilter: 'all' }).map((r) => r.id),
    ['rev_d', 'rev_c', 'rev_b', 'rev_a'],
  );
  assert.deepEqual(
    filterAndSortProductReviews(reviews, { sortOrder: 'oldest', ratingFilter: 'all' }).map((r) => r.id),
    ['rev_a', 'rev_b', 'rev_c', 'rev_d'],
  );
  assert.deepEqual(
    filterAndSortProductReviews(reviews, { sortOrder: 'highest', ratingFilter: 'all' }).map((r) => r.id),
    ['rev_d', 'rev_b', 'rev_a', 'rev_c'],
  );
  assert.deepEqual(
    filterAndSortProductReviews(reviews, { sortOrder: 'lowest', ratingFilter: 'all' }).map((r) => r.id),
    ['rev_c', 'rev_a', 'rev_d', 'rev_b'],
  );
  assert.deepEqual(
    filterAndSortProductReviews(reviews, { sortOrder: 'oldest', ratingFilter: 5 }).map((r) => r.id),
    ['rev_b', 'rev_d'],
  );
});

test('server productReviewBodySchema and SQLite product_reviews CRUD work end-to-end', () => {
  assert.equal(PRODUCT_REVIEW_ID_REGEX.test('ses-solax-5kw-t-bat-5-3kwh-trina-bifacial'), true);
  assert.equal(PRODUCT_REVIEW_ID_REGEX.test('../etc/passwd'), false);

  const badBody = productReviewBodySchema.safeParse({
    authorName: 'А',
    rating: 6,
    comment: 'Ок',
  });
  assert.equal(badBody.success, false);

  const validBody = productReviewBodySchema.safeParse({
    authorName: '  Олександр К.  ',
    rating: 5,
    comment: '  Стабільно працює в резерві.  ',
  });
  assert.equal(validBody.success, true);

  const testProductId = `__test_product_${Date.now()}`;
  let createdId = '';
  try {
    const created = createProductReviewRecord({
      productId: testProductId,
      authorUid: 'google_uid_test_1',
      authorName: 'Олександр К.',
      rating: 5,
      comment: 'Стабільно працює в резерві.',
    });
    createdId = created.id;
    assert.equal(created.productId, testProductId);
    assert.equal(created.authorUid, 'google_uid_test_1');
    assert.equal(created.rating, 5);
    assert.equal(created.status, 'published');

    const fetched = getProductReviewById(created.id);
    assert.ok(fetched);
    assert.equal(fetched.comment, 'Стабільно працює в резерві.');

    const listBefore = listPublishedProductReviews(testProductId);
    assert.equal(listBefore.length, 1);

    const updated = updateProductReviewRecord(created.id, {
      authorName: 'Олександр Кириленко',
      rating: 4,
      comment: 'Оновлений відгук після місяця роботи.',
    });
    assert.ok(updated);
    assert.equal(updated.rating, 4);
    assert.equal(updated.authorName, 'Олександр Кириленко');

    const deleted = deleteProductReviewRecord(created.id);
    assert.equal(deleted, true);
    createdId = '';

    assert.equal(getProductReviewById(created.id), null);
    assert.equal(listPublishedProductReviews(testProductId).length, 0);
  } finally {
    if (createdId) {
      deleteProductReviewRecord(createdId);
    }
  }
});
