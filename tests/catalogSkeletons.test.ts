import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CabinetOrdersSkeleton,
  GenericSectionSkeleton,
  HomeCatalogSkeleton,
  ProductCardSkeleton,
  ProjectsCatalogSkeleton,
  ReviewListSkeleton,
  ShopCatalogSkeleton,
  ViewRouteSkeleton,
} from '../src/components/CatalogSkeletons.tsx';

test('CatalogSkeletons exports all structured skeleton components', () => {
  assert.equal(typeof ProductCardSkeleton, 'function');
  assert.equal(typeof ShopCatalogSkeleton, 'function');
  assert.equal(typeof HomeCatalogSkeleton, 'function');
  assert.equal(typeof ProjectsCatalogSkeleton, 'function');
  assert.equal(typeof CabinetOrdersSkeleton, 'function');
  assert.equal(typeof ReviewListSkeleton, 'function');
  assert.equal(typeof GenericSectionSkeleton, 'function');
  assert.equal(typeof ViewRouteSkeleton, 'function');
});

test('CatalogSkeletons mimics ProductCard and ShopView geometry with CSS shimmer and reduced-motion rules', () => {
  const skeletonsSource = readFileSync(new URL('../src/components/CatalogSkeletons.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(skeletonsSource, /ec-skeleton-shimmer/);
  assert.match(skeletonsSource, /h-52 w-full/);
  assert.match(skeletonsSource, /min-h-\[2\.6rem\]/);
  assert.match(skeletonsSource, /min-h-\[4\.6rem\]/);
  assert.match(skeletonsSource, /lg:w-\[240px\] xl:w-\[255px\]/);
  assert.match(skeletonsSource, /grid-cols-1 sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(skeletonsSource, /view === 'shop'/);
  assert.match(skeletonsSource, /view === 'home'/);
  assert.match(skeletonsSource, /view === 'projects'/);
  assert.match(skeletonsSource, /view === 'account'/);

  assert.match(cssSource, /@keyframes ecSkeletonSweep/);
  assert.match(cssSource, /\.ec-skeleton-shimmer::after/);
  assert.match(cssSource, /\.ec-skeleton-shimmer::after\s*\{\s*animation:\s*none;\s*display:\s*none;\s*\}/);
});

test('App, ShopView, HomeView, ClientCabinetView, and ProductReviews use structured shimmer skeletons instead of plain pulse blocks', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const shopSource = readFileSync(new URL('../src/components/ShopView.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/components/HomeView.tsx', import.meta.url), 'utf8');
  const cabinetSource = readFileSync(new URL('../src/components/ClientCabinetView.tsx', import.meta.url), 'utf8');
  const reviewsSource = readFileSync(new URL('../src/components/ProductReviews.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(appSource, /animate-pulse/);
  assert.match(appSource, /<ViewRouteSkeleton view=\{view\} \/>/);
  assert.match(shopSource, /<ProductCardSkeleton/);
  assert.match(homeSource, /<ProductCardSkeleton/);
  assert.doesNotMatch(cabinetSource, /animate-pulse/);
  assert.match(cabinetSource, /<CabinetOrdersSkeleton/);
  assert.doesNotMatch(reviewsSource, /animate-pulse/);
  assert.match(reviewsSource, /<ReviewListSkeleton/);
});
