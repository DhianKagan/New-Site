import type { ProductCategory } from '../src/types.ts';

export type SitemapChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SitemapStaticPage {
  path: string;
  priority: string;
  changefreq: SitemapChangeFreq;
}

export interface SitemapCategoryEntry {
  cat: string;
  updatedAt?: string;
  itemCount?: number;
}

export interface SitemapProductEntry {
  id: string;
  title?: string;
  img?: string;
  updatedAt?: string;
}

export interface SitemapGeneratorInput {
  baseUrl: string;
  categories: SitemapCategoryEntry[];
  products: SitemapProductEntry[];
  infoLastMod?: string;
  now?: Date;
}

export const SITEMAP_PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'kits',
  'inverters',
  'batteries',
  'panels',
  'parts',
];

export const SITEMAP_INFO_PAGES: readonly SitemapStaticPage[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/services', priority: '0.8', changefreq: 'weekly' },
  { path: '/projects', priority: '0.8', changefreq: 'weekly' },
  { path: '/contacts', priority: '0.7', changefreq: 'monthly' },
  { path: '/payment-delivery', priority: '0.6', changefreq: 'monthly' },
  { path: '/public-offer', priority: '0.4', changefreq: 'monthly' },
];

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSitemapDate(raw: string | undefined, fallbackDate: string): string {
  if (!raw) return fallbackDate;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return fallbackDate;
}

function resolveAbsoluteImageUrl(baseUrl: string, rawImg: string | undefined): string | null {
  const trimmed = (rawImg ?? '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${baseUrl}${trimmed}`;
  return `${baseUrl}/${trimmed}`;
}

export function generateSitemapXml(input: SitemapGeneratorInput): string {
  const cleanBaseUrl = input.baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const infoLastMod = formatSitemapDate(input.infoLastMod, today);

  const seenLocs = new Set<string>();
  const urlBlocks: string[] = [];

  const appendUrl = (options: {
    loc: string;
    lastmod: string;
    changefreq: SitemapChangeFreq;
    priority: string;
    imageLoc?: string | null;
    imageTitle?: string;
  }) => {
    if (seenLocs.has(options.loc)) return;
    seenLocs.add(options.loc);

    const lines = [
      '  <url>',
      `    <loc>${escapeXml(options.loc)}</loc>`,
      `    <lastmod>${escapeXml(options.lastmod)}</lastmod>`,
      `    <changefreq>${options.changefreq}</changefreq>`,
      `    <priority>${options.priority}</priority>`,
    ];

    if (options.imageLoc) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escapeXml(options.imageLoc)}</image:loc>`);
      if (options.imageTitle) {
        lines.push(`      <image:title>${escapeXml(options.imageTitle.slice(0, 200))}</image:title>`);
      }
      lines.push('    </image:image>');
    }

    lines.push('  </url>');
    urlBlocks.push(lines.join('\n'));
  };

  // 1. Core storefront & information pages
  for (const page of SITEMAP_INFO_PAGES) {
    const pagePath = page.path === '/' ? '/' : page.path;
    appendUrl({
      loc: `${cleanBaseUrl}${pagePath}`,
      lastmod: infoLastMod,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  }

  // 2. All product category pages (canonical /shop?cat=<category>)
  const categoryMap = new Map<string, SitemapCategoryEntry>();
  for (const defaultCat of SITEMAP_PRODUCT_CATEGORIES) {
    categoryMap.set(defaultCat, { cat: defaultCat, updatedAt: infoLastMod, itemCount: 0 });
  }
  for (const entry of input.categories) {
    const cleanCat = entry.cat.trim();
    if (!cleanCat) continue;
    categoryMap.set(cleanCat, entry);
  }

  for (const [cat, entry] of categoryMap.entries()) {
    appendUrl({
      loc: `${cleanBaseUrl}/shop?cat=${encodeURIComponent(cat)}`,
      lastmod: formatSitemapDate(entry.updatedAt, infoLastMod),
      changefreq: 'daily',
      priority: '0.85',
    });
  }

  // 3. Specific product detail pages
  for (const product of input.products) {
    const cleanId = product.id.trim();
    if (!cleanId) continue;
    appendUrl({
      loc: `${cleanBaseUrl}/shop/${encodeURIComponent(cleanId)}`,
      lastmod: formatSitemapDate(product.updatedAt, today),
      changefreq: 'weekly',
      priority: '0.7',
      imageLoc: resolveAbsoluteImageUrl(cleanBaseUrl, product.img),
      imageTitle: product.title?.trim(),
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urlBlocks,
    '</urlset>',
  ].join('\n');
}
