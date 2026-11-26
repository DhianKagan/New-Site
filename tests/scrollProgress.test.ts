import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateScrollProgressPct } from '../src/components/HeaderScrollProgress.tsx';

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

test('App.tsx renders HeaderScrollProgress at the very top of the sticky header', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes("import { HeaderScrollProgress } from './components/HeaderScrollProgress.tsx';"));
  assert.ok(appSource.includes('<HeaderScrollProgress routeKey='));
});
