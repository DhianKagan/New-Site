import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateScrollProgressPct } from '../src/components/HeaderScrollProgress.tsx';
import { shouldShowScrollToTop } from '../src/components/ScrollToTopButton.tsx';

test('calculateScrollProgressPct handles short non-scrollable pages, boundaries, and mid-scroll progress', () => {
  assert.equal(calculateScrollProgressPct(0, 800, 900), 0);
  assert.equal(calculateScrollProgressPct(100, 900, 900), 0);
  assert.equal(calculateScrollProgressPct(0, 3000, 1000), 0);
  assert.equal(calculateScrollProgressPct(500, 3000, 1000), 25);
  assert.equal(calculateScrollProgressPct(1000, 3000, 1000), 50);
  assert.equal(calculateScrollProgressPct(2000, 3000, 1000), 100);
  assert.equal(calculateScrollProgressPct(2600, 3000, 1000), 100);
  assert.equal(calculateScrollProgressPct(-40, 3000, 1000), 0);
  assert.equal(calculateScrollProgressPct(Number.NaN, 3000, 1000), 0);
});

test('shouldShowScrollToTop activates only after scrolling past the first section or fallback threshold', () => {
  assert.equal(
    shouldShowScrollToTop({ scrollY: 0, firstSectionBottom: 520, viewportHeight: 900, firstSectionHeight: 540 }),
    false,
  );
  assert.equal(
    shouldShowScrollToTop({ scrollY: 300, firstSectionBottom: 120, viewportHeight: 900, firstSectionHeight: 540 }),
    false,
  );
  assert.equal(
    shouldShowScrollToTop({ scrollY: 680, firstSectionBottom: 0, viewportHeight: 900, firstSectionHeight: 540 }),
    true,
  );
  assert.equal(
    shouldShowScrollToTop({ scrollY: 920, firstSectionBottom: -240, viewportHeight: 900, firstSectionHeight: 540 }),
    true,
  );
  // Ignores collapsed empty sections at tiny scroll offsets
  assert.equal(
    shouldShowScrollToTop({ scrollY: 40, firstSectionBottom: -10, viewportHeight: 900, firstSectionHeight: 0 }),
    false,
  );
  // Fallback when no section element is present
  assert.equal(
    shouldShowScrollToTop({ scrollY: 450, firstSectionBottom: null, viewportHeight: 900 }),
    false,
  );
  assert.equal(
    shouldShowScrollToTop({ scrollY: 640, firstSectionBottom: null, viewportHeight: 900 }),
    true,
  );
});

test('App.tsx renders HeaderScrollProgress and ScrollToTopButton', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes("import { HeaderScrollProgress } from './components/HeaderScrollProgress.tsx';"));
  assert.ok(appSource.includes('<HeaderScrollProgress routeKey='));
  assert.ok(appSource.includes("import { ScrollToTopButton } from './components/ScrollToTopButton.tsx';"));
  assert.ok(appSource.includes('<ScrollToTopButton'));
});
