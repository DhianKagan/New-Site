import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  clearPerformanceMetrics,
  createProfilerOnRender,
  exportPerformanceReport,
  getPerformanceSnapshot,
  recordComponentLoadComplete,
  recordComponentLoadStart,
  recordProfilerRender,
  subscribePerformanceMonitor,
} from '../src/lib/performanceMonitor.ts';
import { retryDynamicImport } from '../src/lib/lazyWithRetry.ts';

test('performanceMonitor aggregates React.Profiler renders, averages, maxes, and slow frame counts', () => {
  clearPerformanceMetrics();

  const onRender = createProfilerOnRender('ShopView.ProductList', {
    itemCount: 251,
    slowThresholdMs: 16,
  });

  // Mount: 8.5ms (fast)
  onRender('ShopView.ProductList', 'mount', 8.5, 14.2, 100, 108.5);
  // Update: 22.5ms (exceeds 16ms frame budget)
  onRender('ShopView.ProductList', 'update', 22.5, 28.1, 200, 222.5);
  // Nested update: 5.0ms (fast)
  onRender('ShopView.ProductList', 'nested-update', 5.0, 9.0, 230, 235.0);

  const snap = getPerformanceSnapshot();
  assert.equal(snap.totalRenders, 3);
  assert.equal(snap.totalSlowRenders, 1);
  assert.equal(snap.recentSlowRenders.length, 1);
  assert.equal(snap.recentSlowRenders[0].actualDurationMs, 22.5);

  const summary = snap.profilers.find((p) => p.id === 'ShopView.ProductList');
  assert.ok(summary);
  assert.equal(summary.rendersCount, 3);
  assert.equal(summary.mountCount, 1);
  assert.equal(summary.updateCount, 1);
  assert.equal(summary.nestedUpdateCount, 1);
  assert.equal(summary.slowRendersCount, 1);
  assert.equal(summary.avgActualDurationMs, 12);
  assert.equal(summary.maxActualDurationMs, 22.5);
  assert.equal(summary.lastBaseDurationMs, 9);
  assert.equal(summary.lastItemCount, 251);

  const report = exportPerformanceReport();
  assert.equal(report.summary.totalRenders, 3);
  assert.equal(report.summary.totalSlowRenders, 1);
  assert.equal(report.profilers.length, 1);
});

test('performanceMonitor correlates lazy chunk load timing with first React.Profiler mount', () => {
  clearPerformanceMetrics();

  const startedAt = recordComponentLoadStart('ShopView');
  recordComponentLoadComplete({
    componentName: 'ShopView',
    durationMs: 42.4,
    attempts: 1,
    status: 'loaded',
    startedAt,
  });

  recordProfilerRender({
    id: 'ShopView',
    phase: 'mount',
    actualDuration: 11.2,
    baseDuration: 18.6,
    startTime: 10,
    commitTime: 21.2,
    itemCount: 251,
    trackComponentLoad: true,
  });

  const snap = getPerformanceSnapshot();
  const load = snap.componentLoads.find((c) => c.componentName === 'ShopView');
  assert.ok(load);
  assert.equal(load.status, 'loaded');
  assert.equal(load.chunkLoadMs, 42.4);
  assert.equal(load.mountActualDurationMs, 11.2);
  assert.equal(load.mountBaseDurationMs, 18.6);
  assert.ok(load.totalLoadToMountMs !== null && load.totalLoadToMountMs >= 42.4);
});

test('retryDynamicImport records chunk load duration and retries in performanceMonitor', async () => {
  clearPerformanceMetrics();

  let attempts = 0;
  const mod = await retryDynamicImport(
    async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new TypeError('Failed to fetch dynamically imported module: /src/components/ShopView.tsx');
      }
      return { loaded: true };
    },
    { retries: 2, delayMs: 1, componentName: 'ShopView' },
  );

  assert.deepEqual(mod, { loaded: true });
  const snap = getPerformanceSnapshot();
  const entry = snap.componentLoads.find((c) => c.componentName === 'ShopView');
  assert.ok(entry);
  assert.equal(entry.status, 'loaded');
  assert.equal(entry.attempts, 2);

  await assert.rejects(
    () =>
      retryDynamicImport(
        async () => {
          throw new Error('Fatal chunk syntax error');
        },
        { retries: 1, delayMs: 1, componentName: 'BrokenView' },
      ),
    /Fatal chunk syntax error/,
  );

  const errEntry = getPerformanceSnapshot().componentLoads.find((c) => c.componentName === 'BrokenView');
  assert.ok(errEntry);
  assert.equal(errEntry.status, 'error');
  assert.match(errEntry.errorMessage ?? '', /Fatal chunk syntax error/);
});

test('subscribePerformanceMonitor notifies subscribers asynchronously without synchronous render feedback loops', async () => {
  clearPerformanceMetrics();
  let notifications = 0;
  const unsubscribe = subscribePerformanceMonitor(() => {
    notifications += 1;
  });

  recordProfilerRender({
    id: 'CrmView.CatalogProductList',
    phase: 'mount',
    actualDuration: 15,
    baseDuration: 22,
    startTime: 0,
    commitTime: 15,
    itemCount: 251,
  });

  // Must not fire synchronously inside React.Profiler onRender commit phase
  assert.equal(notifications, 0);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(notifications, 1);
  unsubscribe();
});

test('PerformanceProfiler uses React.Profiler and is wired across large product lists and lazy components', () => {
  const profilerSource = readFileSync(new URL('../src/components/PerformanceProfiler.tsx', import.meta.url), 'utf8');
  const shopSource = readFileSync(new URL('../src/components/ShopView.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/components/HomeView.tsx', import.meta.url), 'utf8');
  const crmSource = readFileSync(new URL('../src/components/CrmView.tsx', import.meta.url), 'utf8');
  const cardSource = readFileSync(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.match(profilerSource, /import\s*\{[^}]*\bProfiler\b[^}]*\}\s*from\s*'react'/);
  assert.match(profilerSource, /<Profiler\s+id=\{id\}\s+onRender=\{handleRender\}>/);

  assert.match(shopSource, /<PerformanceProfiler\s+id="ShopView\.ProductList"/);
  assert.match(shopSource, /<PerformanceProfiler\s+id="ShopView\.SearchSuggestions"/);
  assert.match(homeSource, /<PerformanceProfiler\s+id="HomeView\.ProductShowcase"/);
  assert.match(homeSource, /<PerformanceProfiler\s+id="HomeView\.CalculatorProducts"/);
  assert.match(crmSource, /<PerformanceProfiler\s+id="CrmView\.CatalogProductList"/);
  assert.match(crmSource, /<PerformanceDiagnosticsPanel\s*\/>/);
  assert.match(cardSource, /memo\(function ProductCard/);
  assert.match(appSource, /componentName:\s*'ShopView'/);
  assert.match(appSource, /<PerformanceProfiler\s+id="ShopView"\s+trackLoad/);
});
