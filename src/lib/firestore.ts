import { getAuth, type Auth } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ProductReview, ProductReviewInput, ProductReviewStatus } from '../types.ts';
import { getActiveFirebaseAppSync, getPrimaryFirebaseApp } from './firebaseAuth.ts';
import {
  generateSafeReviewId,
  REVIEW_LIMITS,
  sortProductReviews,
  validateProductReviewInput,
} from './productReviews.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const primaryApp = getPrimaryFirebaseApp();
export const db: Firestore = getFirestore(primaryApp, firebaseConfig.firestoreDatabaseId);
export const auth: Auth = getAuth(primaryApp);

function getActiveDbAndAuth(): { activeDb: Firestore; activeAuth: Auth } {
  const activeApp = getActiveFirebaseAppSync();
  if (activeApp === primaryApp) {
    return { activeDb: db, activeAuth: auth };
  }
  return {
    activeDb: getFirestore(activeApp, firebaseConfig.firestoreDatabaseId),
    activeAuth: getAuth(activeApp),
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const { activeAuth } = getActiveDbAndAuth();
  const currentUser = activeAuth.currentUser ?? auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

const REVIEWS_COLLECTION = 'product_reviews';

function timestampToMs(raw: unknown): number {
  if (raw instanceof Timestamp) {
    return raw.toMillis();
  }
  if (raw && typeof raw === 'object' && 'toMillis' in raw) {
    const fn = (raw as { toMillis?: unknown }).toMillis;
    if (typeof fn === 'function') {
      const value = (raw as { toMillis: () => number }).toMillis();
      return Number.isFinite(value) ? value : Date.now();
    }
  }
  return Date.now();
}

function mapReviewDoc(id: string, data: DocumentData): ProductReview | null {
  const productId = typeof data.productId === 'string' ? data.productId : '';
  const authorUid = typeof data.authorUid === 'string' ? data.authorUid : '';
  const authorName = typeof data.authorName === 'string' ? data.authorName : '';
  const rating = typeof data.rating === 'number' ? data.rating : 0;
  const comment = typeof data.comment === 'string' ? data.comment : '';
  const status: ProductReviewStatus = data.status === 'hidden' ? 'hidden' : 'published';

  if (!productId || !authorUid || !authorName || rating < 1 || rating > 5 || !comment) {
    return null;
  }

  return {
    id,
    productId,
    authorUid,
    authorName,
    rating,
    comment,
    status,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

export function subscribeProductReviews(
  productId: string,
  onUpdate: (reviews: ProductReview[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (!REVIEW_LIMITS.idPattern.test(productId)) {
    onUpdate([]);
    return () => {};
  }

  const { activeDb } = getActiveDbAndAuth();
  const reviewsQuery = query(
    collection(activeDb, REVIEWS_COLLECTION),
    where('productId', '==', productId),
    where('status', '==', 'published'),
    limit(50),
  );

  return onSnapshot(
    reviewsQuery,
    (snapshot) => {
      const parsed: ProductReview[] = [];
      for (const item of snapshot.docs) {
        const mapped = mapReviewDoc(item.id, item.data());
        if (mapped) parsed.push(mapped);
      }
      onUpdate(sortProductReviews(parsed));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, REVIEWS_COLLECTION);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function createProductReview(input: ProductReviewInput): Promise<string> {
  const validation = validateProductReviewInput(input);
  if (!validation.valid) {
    throw new Error(validation.errorUk);
  }

  const { activeDb, activeAuth } = getActiveDbAndAuth();
  const user = activeAuth.currentUser;
  if (!user) {
    throw new Error('Для публікації відгуку увійдіть через Google.');
  }

  const reviewId = generateSafeReviewId();
  const docPath = `${REVIEWS_COLLECTION}/${reviewId}`;

  try {
    await setDoc(doc(activeDb, REVIEWS_COLLECTION, reviewId), {
      productId: validation.normalized.productId,
      authorUid: user.uid,
      authorName: validation.normalized.authorName,
      rating: validation.normalized.rating,
      comment: validation.normalized.comment,
      status: 'published',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reviewId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateProductReview(
  reviewId: string,
  input: Pick<ProductReviewInput, 'authorName' | 'rating' | 'comment'> & { productId: string },
): Promise<void> {
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) {
    throw new Error('Некоректний ідентифікатор відгуку.');
  }
  const validation = validateProductReviewInput(input);
  if (!validation.valid) {
    throw new Error(validation.errorUk);
  }

  const { activeDb, activeAuth } = getActiveDbAndAuth();
  if (!activeAuth.currentUser) {
    throw new Error('Для редагування відгуку увійдіть через Google.');
  }

  const docPath = `${REVIEWS_COLLECTION}/${reviewId}`;
  try {
    await updateDoc(doc(activeDb, REVIEWS_COLLECTION, reviewId), {
      authorName: validation.normalized.authorName,
      rating: validation.normalized.rating,
      comment: validation.normalized.comment,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteProductReview(reviewId: string): Promise<void> {
  if (!REVIEW_LIMITS.idPattern.test(reviewId)) {
    throw new Error('Некоректний ідентифікатор відгуку.');
  }

  const { activeDb, activeAuth } = getActiveDbAndAuth();
  if (!activeAuth.currentUser) {
    throw new Error('Для видалення відгуку увійдіть через Google.');
  }

  const docPath = `${REVIEWS_COLLECTION}/${reviewId}`;
  try {
    await deleteDoc(doc(activeDb, REVIEWS_COLLECTION, reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
