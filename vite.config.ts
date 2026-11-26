import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const projectDir = import.meta.dirname;

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon-16x16.png',
          'favicon-32x32.png',
          'favicon-48x48.png',
          'apple-touch-icon.png',
          'icon.svg',
          'icon-maskable.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'assets/energocomfort/logo_mark.svg',
          'assets/energocomfort/sto_110kw.jpg',
        ],
        manifest: {
          id: '/',
          name: 'Energo Comfort — СЕС та резервне живлення',
          short_name: 'EnergoShop',
          description:
            'Каталог інверторів, АКБ LiFePO4, сонячних панелей та готових систем резервного живлення в Одесі.',
          theme_color: '#0d1f33',
          background_color: '#081421',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icon-maskable.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: [
            '**/*.{js,css,html,ico,svg,woff,woff2}',
            'favicon-*.png',
            'pwa-*.png',
            'apple-touch-icon.png',
            'assets/energocomfort/logo_mark.webp',
            'assets/energocomfort/sto_110kw.jpg',
          ],
          globIgnores: [
            'assets/aistudio/**',
            'assets/products/**',
            '**/*three-vendor*',
            '**/*CrmView*',
            '**/*ClientCabinetView*',
            '**/*table-vendor*',
            '**/*firebase-vendor*',
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/uploads\//,
            /^\/sitemap\.xml$/,
            /^\/robots\.txt$/,
            /^\/feed\.xml$/,
            /^\/products\.xml$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^\/assets\/.*\.js$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'lazy-js-chunks-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^\/api\/(?:catalog|projects|public\/exchange-rate|public\/config)(?:\/.*|\?.*)?$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-catalog-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 64,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^\/(?:assets|uploads)\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'storefront-assets-cache',
                expiration: {
                  maxEntries: 350,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: '/index.html',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(projectDir, 'dist');
          const srcAssets = path.resolve(projectDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(projectDir, '.'),
      },
    },
    optimizeDeps: {
      include: [
        'three',
        'three/addons/controls/OrbitControls.js',
        'three/addons/environments/RoomEnvironment.js',
        'lucide-react',
      ],
    },
    build: {
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'three-vendor',
                test: /[\\/]node_modules[\\/]three[\\/]/,
                priority: 25,
              },
              {
                name: 'firebase-vendor',
                test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
                priority: 20,
              },
              {
                name: 'table-vendor',
                test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
                priority: 15,
              },
              {
                name: 'icons-vendor',
                test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
