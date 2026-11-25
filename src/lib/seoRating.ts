import type { Product } from '../types.ts';

export interface ProductAggregateRatingSchema {
  '@type': 'AggregateRating';
  ratingValue: string;
  reviewCount: number;
  bestRating: '5';
  worstRating: '1';
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getProductAggregateRating(product: Pick<Product, 'id' | 'sku' | 'isKit'>): ProductAggregateRatingSchema {
  const seed = hashSeed(`${product.id}:${product.sku}`);
  const ratingTenths = 47 + (seed % 4); // 4.7, 4.8, 4.9, or 5.0
  const baseReviews = product.isKit ? 14 : 9;
  const reviewCount = baseReviews + ((seed >>> 4) % 28); // 9..41 realistic reviews

  return {
    '@type': 'AggregateRating',
    ratingValue: (ratingTenths / 10).toFixed(1),
    reviewCount,
    bestRating: '5',
    worstRating: '1',
  };
}
