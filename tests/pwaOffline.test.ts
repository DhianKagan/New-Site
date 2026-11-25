import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

test('PWA icon assets and SVG exist in public/', () => {
  const requiredAssets = [
    '../public/icon.svg',
    '../public/apple-touch-icon.png',
    '../public/pwa-192x192.png',
    '../public/pwa-512x512.png',
    '../public/pwa-maskable-512x512.png',
  ];

  for (const rel of requiredAssets) {
    const url = new URL(rel, import.meta.url);
    assert.ok(existsSync(url), `Missing PWA asset: ${rel}`);
  }
});

test('vite.config.ts configures VitePWA manifest, critical precaching, and runtime catalog/asset caching', () => {
  const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.ok(viteConfig.includes("VitePWA("));
  assert.ok(viteConfig.includes("registerType: 'autoUpdate'"));
  assert.ok(viteConfig.includes("short_name: 'EnergoShop'"));
  assert.ok(viteConfig.includes("display: 'standalone'"));
  assert.ok(viteConfig.includes("purpose: 'maskable'"));
  assert.ok(viteConfig.includes("cacheName: 'api-catalog-cache'"));
  assert.ok(viteConfig.includes("cacheName: 'storefront-assets-cache'"));
  assert.ok(viteConfig.includes("navigateFallback: '/index.html'"));
  assert.ok(viteConfig.includes('enabled: true'));
});

test('index.html, main.tsx, tsconfig.json, and App.tsx wire PWA registration, install button, and offline catalog fallbacks', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('apple-touch-icon.png'));
  assert.ok(html.includes('apple-mobile-web-app-capable'));
  assert.ok(html.includes('icon.svg'));

  const tsconfig = readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8');
  assert.ok(tsconfig.includes('vite-plugin-pwa/client'));

  const mainTsx = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.ok(mainTsx.includes('virtual:pwa-register'));
  assert.ok(mainTsx.includes('registerSW'));

  const appTsx = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appTsx.includes('OFFLINE_CATALOG_STORAGE_KEY'));
  assert.ok(appTsx.includes('<PWAInstallButton'));
  assert.ok(appTsx.includes('<OfflineIndicator'));
});
