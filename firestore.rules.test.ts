import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REVIEW_LIMITS, validateProductReviewInput } from './src/lib/productReviews.ts';

interface AuthToken {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface ReviewDoc {
  productId?: unknown;
  authorUid?: unknown;
  authorName?: unknown;
  rating?: unknown;
  comment?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [extraKey: string]: unknown;
}

const ADMIN_EMAIL = 'dzendeco25@gmail.com';
const REQUIRED_KEYS = [
  'productId',
  'authorUid',
  'authorName',
  'rating',
  'comment',
  'status',
  'createdAt',
  'updatedAt',
] as const;

function simulateCreateReviewRule(
  auth: AuthToken | null,
  reviewId: string,
  incoming: ReviewDoc,
  serverTimeTag: string,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) return 'PERMISSION_DENIED';

  const keys = Object.keys(incoming);
  const hasAllRequired = REQUIRED_KEYS.every((k) => keys.includes(k));
  const hasOnlyAllowed = keys.every((k) => (REQUIRED_KEYS as readonly string[]).includes(k));
  if (!hasAllRequired || !hasOnlyAllowed) return 'PERMISSION_DENIED';

  if (typeof incoming.productId !== 'string' || !REVIEW_LIMITS.idPattern.test(incoming.productId)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof incoming.authorUid !== 'string' || !REVIEW_LIMITS.idPattern.test(incoming.authorUid)) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.authorUid !== auth.uid) return 'PERMISSION_DENIED';
  if (
    typeof incoming.authorName !== 'string' ||
    incoming.authorName.length < REVIEW_LIMITS.minAuthorName ||
    incoming.authorName.length > REVIEW_LIMITS.maxAuthorName
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof incoming.rating !== 'number' ||
    !Number.isInteger(incoming.rating) ||
    incoming.rating < REVIEW_LIMITS.minRating ||
    incoming.rating > REVIEW_LIMITS.maxRating
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof incoming.comment !== 'string' ||
    incoming.comment.length < REVIEW_LIMITS.minComment ||
    incoming.comment.length > REVIEW_LIMITS.maxComment
  ) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.status !== 'published') return 'PERMISSION_DENIED';
  if (incoming.createdAt !== serverTimeTag || incoming.updatedAt !== serverTimeTag) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function simulateUpdateReviewRule(
  auth: AuthToken | null,
  reviewId: string,
  existing: ReviewDoc,
  incoming: ReviewDoc,
  serverTimeTag: string,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) return 'PERMISSION_DENIED';

  const keys = Object.keys(incoming);
  if (
    !REQUIRED_KEYS.every((k) => keys.includes(k)) ||
    !keys.every((k) => (REQUIRED_KEYS as readonly string[]).includes(k))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    incoming.productId !== existing.productId ||
    incoming.authorUid !== existing.authorUid ||
    incoming.createdAt !== existing.createdAt ||
    incoming.updatedAt !== serverTimeTag
  ) {
    return 'PERMISSION_DENIED';
  }

  const changedKeys = keys.filter((k) => incoming[k] !== existing[k]);
  const isAdmin = auth.email_verified === true && auth.email === ADMIN_EMAIL;

  if (isAdmin && changedKeys.every((k) => k === 'status' || k === 'updatedAt')) {
    if (incoming.status === 'published' || incoming.status === 'hidden') return 'ALLOW';
  }

  if (
    existing.authorUid === auth.uid &&
    existing.status === 'published' &&
    incoming.status === 'published' &&
    changedKeys.every((k) => ['authorName', 'rating', 'comment', 'updatedAt'].includes(k))
  ) {
    const valid = validateProductReviewInput({
      productId: String(incoming.productId),
      authorName: String(incoming.authorName),
      rating: Number(incoming.rating),
      comment: String(incoming.comment),
    });
    if (valid.valid) return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules and firebase-blueprint.json stay synchronized for all collections and bounds', () => {
  const blueprint = JSON.parse(fs.readFileSync(path.resolve('firebase-blueprint.json'), 'utf8')) as {
    entities: {
      ProductReview: {
        properties: {
          authorName: { minLength: number; maxLength: number };
          comment: { minLength: number; maxLength: number };
          productId: { pattern: string; maxLength: number };
        };
      };
    };
    firestore: Record<string, unknown>;
  };
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

  assert.ok(blueprint.firestore['/product_reviews/{reviewId}']);
  assert.ok(blueprint.firestore['/admins/{adminId}']);
  assert.equal(blueprint.entities.ProductReview.properties.authorName.minLength, REVIEW_LIMITS.minAuthorName);
  assert.equal(blueprint.entities.ProductReview.properties.authorName.maxLength, REVIEW_LIMITS.maxAuthorName);
  assert.equal(blueprint.entities.ProductReview.properties.comment.minLength, REVIEW_LIMITS.minComment);
  assert.equal(blueprint.entities.ProductReview.properties.comment.maxLength, REVIEW_LIMITS.maxComment);

  assert.match(rules, /rules_version = '2';/);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/product_reviews\/\{reviewId\}/);
  assert.match(rules, /match \/admins\/\{adminId\}/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /allow list: if existing\(\)\.status == 'published';/);
});

test('Dirty Dozen adversarial payloads are strictly rejected with PERMISSION_DENIED', () => {
  const SERVER_TIME = '__SERVER_TIME__';
  const validAuth: AuthToken = { uid: 'userA_123', email: 'buyer@example.com', email_verified: true };
  const baseValid: ReviewDoc = {
    productId: 'deye-sun-5k',
    authorUid: 'userA_123',
    authorName: 'Олександр',
    rating: 5,
    comment: 'Стабільно тримає навантаження, тиха робота.',
    status: 'published',
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };

  assert.equal(simulateCreateReviewRule(validAuth, 'rev_valid_1', baseValid, SERVER_TIME), 'ALLOW');

  // 1. Unauthenticated create
  assert.equal(simulateCreateReviewRule(null, 'rev_1', baseValid, SERVER_TIME), 'PERMISSION_DENIED');

  // 2. Unverified email spoof of admin
  assert.equal(
    simulateCreateReviewRule(
      { uid: 'userA_123', email: ADMIN_EMAIL, email_verified: false },
      'rev_2',
      baseValid,
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );

  // 3. Identity spoofing
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_3', { ...baseValid, authorUid: 'victim_999' }, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 4. Shadow / Ghost field & PII injection
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_4', { ...baseValid, isVerified: true, email: 'x@y.com' }, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 5. Float / Out-of-range rating
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_5a', { ...baseValid, rating: 4.5 }, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_5b', { ...baseValid, rating: 6 }, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 6. Comment payload bomb (> 1000 chars)
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_6', { ...baseValid, comment: 'a'.repeat(1001) }, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 7. ID poisoning
  assert.equal(
    simulateCreateReviewRule(validAuth, 'bad$id!', baseValid, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 8. Client timestamp forgery
  assert.equal(
    simulateCreateReviewRule(validAuth, 'rev_8', { ...baseValid, createdAt: '2020-01-01T00:00:00Z' }, SERVER_TIME),
    'PERMISSION_DENIED',
  );

  // 9. Cross-author update hijack
  const existingDoc: ReviewDoc = { ...baseValid, createdAt: '__OLD_TIME__', updatedAt: '__OLD_TIME__' };
  assert.equal(
    simulateUpdateReviewRule(
      { uid: 'attacker_456', email: 'attacker@example.com', email_verified: true },
      'rev_valid_1',
      existingDoc,
      { ...existingDoc, comment: 'Hacked comment', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );

  // 10. Immutable productId / createdAt tampering
  assert.equal(
    simulateUpdateReviewRule(
      validAuth,
      'rev_valid_1',
      existingDoc,
      { ...existingDoc, productId: 'other-product', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );

  // 11. Non-admin moderation / editing hidden review
  assert.equal(
    simulateUpdateReviewRule(
      validAuth,
      'rev_valid_1',
      existingDoc,
      { ...existingDoc, status: 'hidden', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    simulateUpdateReviewRule(
      validAuth,
      'rev_valid_1',
      { ...existingDoc, status: 'hidden' },
      { ...existingDoc, status: 'published', comment: 'Re-opening myself', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );

  // 12. Valid author update & verified admin moderation work as designed
  assert.equal(
    simulateUpdateReviewRule(
      validAuth,
      'rev_valid_1',
      existingDoc,
      { ...existingDoc, rating: 4, comment: 'Оновлений відгук після місяця роботи.', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'ALLOW',
  );
  assert.equal(
    simulateUpdateReviewRule(
      { uid: 'admin_uid', email: ADMIN_EMAIL, email_verified: true },
      'rev_valid_1',
      existingDoc,
      { ...existingDoc, status: 'hidden', updatedAt: SERVER_TIME },
      SERVER_TIME,
    ),
    'ALLOW',
  );
});
