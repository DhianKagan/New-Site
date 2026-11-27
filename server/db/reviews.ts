import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type { ProductReview, ProductReviewStatus } from '../../src/types.ts';
import { getDb, isDatabaseConfigured } from './client.ts';

function rowToProductReview(row: typeof schema.productReviewsTable.$inferSelect): ProductReview {
  const status: ProductReviewStatus = row.status === 'hidden' ? 'hidden' : 'published';
  return {
    id: row.id,
    productId: row.productId,
    authorUid: row.authorUid,
    authorName: row.authorName,
    rating: row.rating,
    comment: row.comment,
    status,
    createdAtMs: Number(row.createdAtMs ?? 0),
    updatedAtMs: Number(row.updatedAtMs ?? 0),
  };
}

export async function listPublishedProductReviews(productId: string, limitCount = 100): Promise<ProductReview[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limitCount)));
  const rows = await db
    .select()
    .from(schema.productReviewsTable)
    .where(and(eq(schema.productReviewsTable.productId, productId), eq(schema.productReviewsTable.status, 'published')))
    .orderBy(desc(schema.productReviewsTable.createdAtMs), desc(schema.productReviewsTable.id))
    .limit(safeLimit);
  return rows.map(rowToProductReview);
}

export async function getProductReviewById(reviewId: string): Promise<ProductReview | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.productReviewsTable)
    .where(eq(schema.productReviewsTable.id, reviewId))
    .limit(1);
  return row ? rowToProductReview(row) : null;
}

export async function createProductReviewRecord(input: {
  id?: string;
  productId: string;
  authorUid: string;
  authorName: string;
  rating: number;
  comment: string;
  status?: ProductReviewStatus;
}): Promise<ProductReview> {
  const db = getDb();
  const nowMs = Date.now();
  const reviewId = input.id?.trim() || `rev_${crypto.randomBytes(12).toString('hex')}`;
  const status: ProductReviewStatus = input.status === 'hidden' ? 'hidden' : 'published';
  const [inserted] = await db
    .insert(schema.productReviewsTable)
    .values({
      id: reviewId,
      productId: input.productId.trim(),
      authorUid: input.authorUid.trim(),
      authorName: input.authorName.trim(),
      rating: Math.trunc(input.rating),
      comment: input.comment.trim(),
      status,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .returning();
  return rowToProductReview(inserted);
}

export async function updateProductReviewRecord(
  reviewId: string,
  patch: { authorName: string; rating: number; comment: string },
): Promise<ProductReview | null> {
  const db = getDb();
  const nowMs = Date.now();
  const [updated] = await db
    .update(schema.productReviewsTable)
    .set({
      authorName: patch.authorName.trim(),
      rating: Math.trunc(patch.rating),
      comment: patch.comment.trim(),
      updatedAtMs: nowMs,
    })
    .where(eq(schema.productReviewsTable.id, reviewId))
    .returning();
  return updated ? rowToProductReview(updated) : null;
}

export async function deleteProductReviewRecord(reviewId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.productReviewsTable)
    .where(eq(schema.productReviewsTable.id, reviewId))
    .returning({ id: schema.productReviewsTable.id });
  return deleted.length > 0;
}
