import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  createDeal,
  createProduct,
  createProjectCase,
  createSqliteBackupCopy,
  deleteDeal,
  deleteProduct,
  deleteProjectCase,
  getCatalogFacets,
  getProductById,
  getPublicAnalyticsConfig,
  getRecentCatalogAndProjectChanges,
  getSetting,
  getSocialLinks,
  getStorageDiagnostics,
  getUploadsDir,
  listDeals,
  listProducts,
  listProjectCases,
  listRecentAnalyticsEvents,
  listSitemapProductEntries,
  markDealTelegramSent,
  recordAnalyticsEvent,
  saveAnalyticsSettings,
  saveSocialLinks,
  setSetting,
  setSettingIfAbsent,
  updateDeal,
  updateProduct,
  updateProjectCase,
} from './server/db.ts';
import {
  createSessionToken,
  hashPassword,
  requireAdminAuth,
  verifyEnvPassword,
  verifyScryptPassword,
} from './server/auth.ts';
import { isFirebaseAuthConfigured, verifyFirebaseGoogleToken } from './server/firebaseAuth.ts';
import {
  getTelegramWebhookInfo,
  hasTelegramToken,
  isTelegramConfigured,
  sendDealToTelegram,
  sendTelegramText,
  setTelegramWebhook,
} from './server/telegram.ts';
import type { DealStage, ProductCategory, SocialLinksConfig } from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');

function isSafeImageUrl(raw: string): boolean {
  const val = raw.trim();
  if (!val) return true;
  if (val.startsWith('/')) return !val.startsWith('//');
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeExternalUrl(raw: string): boolean {
  const val = raw.trim();
  if (!val) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return u.origin;
      }
    } catch {
      // fallback to request host
    }
  }
  const host = String(req.get('host') || 'energocomfort.shop').trim();
  const safeHost = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host) ? host : 'energocomfort.shop';
  const proto = req.protocol === 'https' || safeHost.includes('energocomfort.shop') ? 'https' : 'http';
  return `${proto}://${safeHost}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRouteSeoHtml(templateHtml: string, req: express.Request): string {
  const baseUrl = getBaseUrl(req);
  const cleanPath = req.path.replace(/\/+$/, '') || '/';
  const canonicalUrl = `${baseUrl}${cleanPath}`;

  let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
  let description =
    'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
  let robots = 'index, follow';
  let ogType = 'website';
  let ogImage = `${baseUrl}/assets/energocomfort/sto_110kw.jpg`;
  let jsonLdObj: Record<string, unknown> | null = null;

  if (cleanPath.startsWith('/shop/')) {
    const productId = decodeURIComponent(cleanPath.slice('/shop/'.length).split('/')[0] || '');
    const product = productId ? getProductById(productId) : null;
    if (product) {
      const priceText = product.price > 0 ? `$${product.price}` : 'За запитом';
      title = `${product.title} (${priceText}) — Energo Comfort`.slice(0, 70);
      description = (
        product.description.trim() ||
        `${product.title} (${product.brand}). ${product.statusLabel}. Доставка зі складу в Одесі, гарантія та професійний монтаж.`
      ).slice(0, 158);
      if (product.img) {
        ogImage = product.img.startsWith('http')
          ? product.img
          : `${baseUrl}${product.img.startsWith('/') ? '' : '/'}${product.img}`;
      }
      ogType = 'product';
      jsonLdObj = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        sku: product.sku,
        mpn: product.sku,
        image: ogImage,
        description,
        brand: { '@type': 'Brand', name: product.brand || 'Energo Comfort' },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'USD',
          price: product.price > 0 ? product.price : 0,
          itemCondition: 'https://schema.org/NewCondition',
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        },
      };
    }
  } else if (cleanPath === '/shop') {
    const facets = getCatalogFacets();
    title = 'Каталог обладнання СЕС та резервного живлення — Energo Comfort';
    description = `Каталог із ${facets.total} позицій для автономного живлення та СЕС зі складу в Одесі: Deye, SolaX, Solis, Dyness, Jinko. Замовляйте з доставкою!`;
  } else if (cleanPath === '/services') {
    title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
    description =
      'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
  } else if (cleanPath === '/projects') {
    const count = listProjectCases().length;
    title = `Реалізовані об’єкти (${count}) — Energo Comfort Одеса`;
    description =
      'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
  } else if (cleanPath === '/contacts') {
    title = 'Контакти та умови співпраці — Energo Comfort Одеса';
    description =
      'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
  } else if (cleanPath === '/crm') {
    title = 'CRM та адмін-панель — Energo Comfort';
    robots = 'noindex, nofollow';
  }

  const safeTitle = escapeXml(title);
  const safeDesc = escapeXml(description);
  const safeUrl = escapeXml(canonicalUrl);
  const safeImg = escapeXml(ogImage);

  let out = templateHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${safeDesc}" />`)
    .replace(/<meta\s+name="robots"[\s\S]*?\/>/i, `<meta name="robots" content="${robots}" />`)
    .replace(/<meta\s+property="og:type"[\s\S]*?\/>/i, `<meta property="og:type" content="${ogType}" />`)
    .replace(/<meta\s+property="og:title"[\s\S]*?\/>/i, `<meta property="og:title" content="${safeTitle}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/i, `<meta property="og:description" content="${safeDesc}" />`)
    .replace(/<meta\s+property="og:url"[\s\S]*?\/>/i, `<meta property="og:url" content="${safeUrl}" />`)
    .replace(/<meta\s+property="og:image"[\s\S]*?\/>/i, `<meta property="og:image" content="${safeImg}" />`)
    .replace(/<meta\s+name="twitter:title"[\s\S]*?\/>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
    .replace(/<meta\s+name="twitter:description"[\s\S]*?\/>/i, `<meta name="twitter:description" content="${safeDesc}" />`)
    .replace(/<meta\s+name="twitter:image"[\s\S]*?\/>/i, `<meta name="twitter:image" content="${safeImg}" />`)
    .replace(/<link\s+rel="canonical"[\s\S]*?\/>/i, `<link rel="canonical" href="${safeUrl}" />`);

  if (jsonLdObj) {
    const safeJson = JSON.stringify(jsonLdObj).replace(/</g, '\\u003c');
    out = out.replace(
      /<script type="application\/ld\+json" id="ec-jsonld">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json" id="ec-jsonld">${safeJson}</script>`,
    );
  }
  return out;
}

function createRateLimiter(options: { windowMs: number; max: number; message: string }): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 2000) {
      for (const [key, bucket] of hits.entries()) {
        if (bucket.resetAt <= now) hits.delete(key);
      }
    }
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const existing = hits.get(ip);
    if (!existing || existing.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (existing.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: options.message });
      return;
    }
    existing.count += 1;
    next();
  };
}

const ALLOWED_PRODUCT_CATS: ProductCategory[] = ['kits', 'inverters', 'batteries', 'panels', 'parts'];

function sanitizeProductSpecs(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, string][] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const k = String(entry[0] ?? '').trim().slice(0, 120);
    const v = String(entry[1] ?? '').trim().slice(0, 300);
    if (!k) continue;
    out.push([k, v]);
    if (out.length >= 25) break;
  }
  return out;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/crm/upload', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(getUploadsDir()));

  const formRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 8,
    message: 'Забагато заявок із вашої адреси. Будь ласка, зачекайте кілька хвилин або зателефонуйте +38 (050) 777-71-72.',
  });

  const authRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 12,
    message: 'Забагато спроб входу. Повторіть через 10 хвилин.',
  });

  const analyticsRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 120,
    message: 'Rate limit exceeded',
  });

  // SEO: robots.txt, sitemap.xml & Merchant XML Feed (Meta / Google Shopping)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain; charset=utf-8').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /crm',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n'),
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().slice(0, 10);
    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/shop', priority: '0.9', changefreq: 'daily' },
      { path: '/services', priority: '0.8', changefreq: 'weekly' },
      { path: '/projects', priority: '0.8', changefreq: 'weekly' },
      { path: '/contacts', priority: '0.7', changefreq: 'monthly' },
    ];
    const productEntries = listSitemapProductEntries();

    const urlsXml = [
      ...staticPages.map(
        (p) =>
          `  <url>\n    <loc>${escapeXml(baseUrl + p.path)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
      ),
      ...productEntries.map((p) => {
        const lastmod = p.updatedAt.slice(0, 10) || today;
        return `  <url>\n    <loc>${escapeXml(`${baseUrl}/shop/${encodeURIComponent(p.id)}`)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      }),
    ].join('\n');

    res
      .type('application/xml; charset=utf-8')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`,
      );
  });

  const handleMerchantFeed: express.RequestHandler = (req, res) => {
    const baseUrl = getBaseUrl(req);
    const products = listProducts().filter((p) => p.price > 0);
    const categoryMap: Record<ProductCategory, string> = {
      kits: 'Hardware > Power & Electrical Supplies > Solar Power Kits',
      inverters: 'Hardware > Power & Electrical Supplies > Power Inverters',
      batteries: 'Hardware > Power & Electrical Supplies > Batteries',
      panels: 'Hardware > Power & Electrical Supplies > Solar Panels',
      parts: 'Hardware > Power & Electrical Supplies',
    };

    const itemsXml = products
      .map((p) => {
        const link = `${baseUrl}/shop/${encodeURIComponent(p.id)}`;
        const imageLink = p.img
          ? p.img.startsWith('http')
            ? p.img
            : `${baseUrl}${p.img.startsWith('/') ? '' : '/'}${p.img}`
          : `${baseUrl}/assets/energocomfort/logo_full.png`;
        const desc = (p.description || `${p.title}. Бренд: ${p.brand}. Офіційне обладнання в Одесі — Energo Comfort.`).slice(
          0,
          4900,
        );
        const availability = p.inStock ? 'in stock' : 'preorder';
        const hasSale = p.oldPrice > p.price;
        const basePrice = hasSale ? p.oldPrice : p.price;

        return [
          '    <item>',
          `      <g:id>${escapeXml(p.sku || p.id)}</g:id>`,
          `      <g:title>${escapeXml(p.title.slice(0, 150))}</g:title>`,
          `      <g:description>${escapeXml(desc)}</g:description>`,
          `      <g:link>${escapeXml(link)}</g:link>`,
          `      <g:image_link>${escapeXml(imageLink)}</g:image_link>`,
          `      <g:availability>${availability}</g:availability>`,
          `      <g:price>${basePrice.toFixed(2)} USD</g:price>`,
          hasSale ? `      <g:sale_price>${p.price.toFixed(2)} USD</g:sale_price>` : '',
          `      <g:brand>${escapeXml(p.brand || 'Energo Comfort')}</g:brand>`,
          `      <g:mpn>${escapeXml(p.sku || p.id)}</g:mpn>`,
          `      <g:condition>new</g:condition>`,
          `      <g:google_product_category>${escapeXml(categoryMap[p.cat])}</g:google_product_category>`,
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Energo Comfort — Каталог СЕС та резервного живлення</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Товарний фід обладнання Deye, SolaX, Solis, Dyness, Trina (energocomfort.shop)</description>
${itemsXml}
  </channel>
</rss>
`;
    res.type('application/xml; charset=utf-8').send(xml);
  };

  app.get('/feed.xml', handleMerchantFeed);
  app.get('/products.xml', handleMerchantFeed);

  // Public Health & Config
  app.get('/api/health', (_req, res) => {
    const facets = getCatalogFacets();
    res.json({
      ok: true,
      catalogCount: facets.total,
      runtime: IS_PROD ? 'production' : 'development',
    });
  });

  app.get('/api/public/config', (_req, res) => {
    res.json({
      ...getPublicAnalyticsConfig(),
      socialLinks: getSocialLinks(),
    });
  });

  let usdRateCache: { rate: number; fetchedAt: number } | null = null;
  app.get('/api/public/exchange-rate', async (_req, res) => {
    if (usdRateCache && Date.now() - usdRateCache.fetchedAt < 6 * 60 * 60 * 1000) {
      res.json({ currency: 'USD', rate: usdRateCache.rate, source: 'NBU', fetchedAt: new Date(usdRateCache.fetchedAt).toISOString() });
      return;
    }
    try {
      const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`NBU responded ${response.status}`);
      const rows = (await response.json()) as { cc?: string; rate?: number }[];
      const rate = rows.find((row) => row.cc === 'USD')?.rate;
      if (!rate || !Number.isFinite(rate)) throw new Error('NBU USD exchange rate is missing');
      usdRateCache = { rate, fetchedAt: Date.now() };
      res.json({ currency: 'USD', rate, source: 'NBU', fetchedAt: new Date(usdRateCache.fetchedAt).toISOString() });
    } catch (error) {
      console.error('Unable to fetch NBU exchange rate:', error);
      if (usdRateCache) {
        res.json({ currency: 'USD', rate: usdRateCache.rate, source: 'NBU', fetchedAt: new Date(usdRateCache.fetchedAt).toISOString(), stale: true });
        return;
      }
      res.status(503).json({ error: 'Курс НБУ тимчасово недоступний' });
    }
  });

  app.get('/api/projects', (_req, res) => {
    res.json({ projects: listProjectCases() });
  });

  app.post('/api/analytics/track', analyticsRateLimit, (req, res) => {
    const body = req.body as {
      eventName?: string;
      metaEvent?: string;
      ga4Event?: string;
      payload?: Record<string, unknown>;
    };
    const allowedEvents = new Set([
      'page_view',
      'view_item',
      'add_to_cart',
      'begin_checkout',
      'purchase',
      'generate_lead',
      'contact',
    ]);
    const eventName = String(body.eventName ?? '').trim();
    if (!allowedEvents.has(eventName)) {
      res.status(400).json({ error: 'Невідома подія аналітики' });
      return;
    }

    const sanitizedPayload: Record<string, string | number> = {};
    if (body.payload && typeof body.payload === 'object') {
      for (const [k, v] of Object.entries(body.payload).slice(0, 8)) {
        if (typeof v === 'string') {
          sanitizedPayload[k.slice(0, 32)] = v.slice(0, 120);
        } else if (typeof v === 'number' && Number.isFinite(v)) {
          sanitizedPayload[k.slice(0, 32)] = v;
        }
      }
    }

    recordAnalyticsEvent(
      eventName,
      String(body.metaEvent ?? '').slice(0, 40),
      String(body.ga4Event ?? '').slice(0, 40),
      sanitizedPayload,
    );
    res.status(201).json({ ok: true });
  });

  const BOOTSTRAP_ADMIN_EMAIL = 'omkrishna.narayana@gmail.com';

  function parseEmailList(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  }

  function getAllowedAdminEmails(): { envEmails: string[]; dbEmails: string[]; effective: string[] } {
    const envEmails = parseEmailList(process.env.ADMIN_EMAILS ?? '');
    const dbEmails = parseEmailList(getSetting('admin_emails') ?? '');
    const combined = Array.from(new Set([...envEmails, ...dbEmails]));
    const effective = combined.length > 0 ? combined : [BOOTSTRAP_ADMIN_EMAIL];
    return { envEmails, dbEmails, effective };
  }

  // Admin Auth Routes (env ADMIN_PASSWORD takes precedence; otherwise one-time DB setup + Google Sign-In)
  app.get('/api/admin/auth/status', (_req, res) => {
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    const dbHash = getSetting('admin_password_hash');
    const configured = Boolean(envPass || dbHash);
    res.json({
      configured,
      mode: configured ? 'login' : 'setup',
      googleEnabled: isFirebaseAuthConfigured(),
    });
  });

  app.post('/api/admin/auth/setup', authRateLimit, (req, res) => {
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    if (envPass || getSetting('admin_password_hash')) {
      res.status(409).json({ error: 'Пароль адміністратора вже налаштовано' });
      return;
    }
    const body = req.body as { password?: string };
    const password = String(body.password ?? '');
    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль має містити щонайменше 6 символів' });
      return;
    }
    const hash = hashPassword(password);
    const saved = setSettingIfAbsent('admin_password_hash', hash);
    if (!saved) {
      res.status(409).json({ error: 'Пароль адміністратора вже налаштовано' });
      return;
    }
    res.status(201).json({ token: createSessionToken() });
  });

  app.post('/api/admin/auth/login', authRateLimit, (req, res) => {
    const body = req.body as { password?: string };
    const password = String(body.password ?? '');
    if (!password) {
      res.status(400).json({ error: 'Введіть пароль' });
      return;
    }
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    let valid = false;
    if (envPass) {
      valid = verifyEnvPassword(password, envPass);
    } else {
      const dbHash = getSetting('admin_password_hash');
      if (dbHash) {
        valid = verifyScryptPassword(password, dbHash);
      }
    }
    if (!valid) {
      res.status(401).json({ error: 'Невірний пароль адміністратора' });
      return;
    }
    res.json({ token: createSessionToken() });
  });

  app.post('/api/admin/auth/google', authRateLimit, async (req, res) => {
    if (!isFirebaseAuthConfigured()) {
      res.status(503).json({ error: 'Google-авторизацію не налаштовано' });
      return;
    }
    const body = req.body as { idToken?: string };
    const idToken = String(body.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'Відсутній Google токен' });
      return;
    }

    const verified = await verifyFirebaseGoogleToken(idToken);
    if (!verified) {
      res.status(401).json({ error: 'Не вдалося підтвердити Google акаунт' });
      return;
    }

    const { effective } = getAllowedAdminEmails();
    if (!effective.includes(verified.email)) {
      res.status(403).json({
        error: `Доступ заборонено для ${verified.email}. Додайте цей email у список адміністраторів CRM.`,
      });
      return;
    }

    res.json({
      token: createSessionToken(),
      email: verified.email,
      name: verified.name,
    });
  });

  // Catalog API
  app.get('/api/catalog', (req, res) => {
    const cat = typeof req.query.cat === 'string' ? req.query.cat : 'all';
    const brand = typeof req.query.brand === 'string' ? req.query.brand : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'default';
    const inStockOnly = req.query.inStock === 'true';

    const items = listProducts({ cat, brand, q, inStockOnly, sort });
    const facets = getCatalogFacets();
    res.json({ items, facets });
  });

  app.get('/api/catalog/:id', (req, res) => {
    const prod = getProductById(req.params.id);
    if (!prod) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json(prod);
  });

  // Storefront Cart Order -> CRM Deal + Telegram
  app.post('/api/orders', formRateLimit, async (req, res) => {
    const body = req.body as {
      customerName?: string;
      phone?: string;
      city?: string;
      channel?: string;
      notes?: string;
      website?: string;
      items?: Array<{ productId: string; qty: number }>;
    };

    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      res.status(400).json({ error: 'Перевірка форми не пройдена' });
      return;
    }

    const phone = String(body.phone ?? '').trim();
    if (phone.length < 7) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону' });
      return;
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Кошик порожній' });
      return;
    }

    const deal = createDeal({
      type: 'order',
      customerName: body.customerName,
      phone,
      city: body.city,
      channel: body.channel || 'Телефон',
      notes: body.notes,
      items: body.items,
    });

    if (deal.items.length === 0) {
      res.status(400).json({ error: 'Не вдалося розпізнати товари з кошика' });
      return;
    }

    const tg = await sendDealToTelegram(deal);
    if (tg.sent) {
      markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal, telegramSent: tg.sent });
  });

  // Storefront Engineering Lead -> CRM Deal + Telegram
  app.post('/api/leads', formRateLimit, async (req, res) => {
    const body = req.body as {
      customerName?: string;
      phone?: string;
      city?: string;
      channel?: string;
      topic?: string;
      taskType?: string;
      loads?: string[];
      notes?: string;
      website?: string;
      estimatedTotalUsd?: number;
    };

    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      res.status(400).json({ error: 'Перевірка форми не пройдена' });
      return;
    }

    const phone = String(body.phone ?? '').trim();
    if (phone.length < 7) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону' });
      return;
    }

    const deal = createDeal({
      type: 'lead',
      customerName: body.customerName,
      phone,
      city: body.city,
      channel: body.channel || 'Telegram',
      topic: body.topic,
      taskType: body.taskType,
      loads: Array.isArray(body.loads) ? body.loads.map(String) : [],
      notes: body.notes,
      estimatedTotalUsd: body.estimatedTotalUsd,
    });

    const tg = await sendDealToTelegram(deal);
    if (tg.sent) {
      markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal, telegramSent: tg.sent });
  });

  // Protected CRM / Admin Middleware
  app.use('/api/crm', requireAdminAuth);

  app.get('/api/crm/status', (_req, res) => {
    const deals = listDeals();
    const emails = getAllowedAdminEmails();
    res.json({
      dealsCount: deals.length,
      telegramConfigured: isTelegramConfigured(),
      telegramTokenPresent: hasTelegramToken(),
      authSource: process.env.ADMIN_PASSWORD?.trim() ? 'env' : 'db',
      googleEnabled: isFirebaseAuthConfigured(),
      allowedAdminEmails: emails.effective,
      storage: getStorageDiagnostics(),
      recentChanges: getRecentCatalogAndProjectChanges(12),
    });
  });

  app.get('/api/crm/social', (_req, res) => {
    res.json({ socialLinks: getSocialLinks() });
  });

  app.put('/api/crm/social', (req, res) => {
    const body = (req.body ?? {}) as Partial<SocialLinksConfig>;
    const keys: Array<keyof SocialLinksConfig> = [
      'telegram',
      'instagram',
      'facebook',
      'youtube',
      'viber',
      'tiktok',
    ];
    const next: SocialLinksConfig = {
      telegram: '',
      instagram: '',
      facebook: '',
      youtube: '',
      viber: '',
      tiktok: '',
    };
    for (const k of keys) {
      const val = String(body[k] ?? '').trim();
      if (val && !isSafeExternalUrl(val)) {
        res.status(400).json({ error: `Некоректний URL для ${k} (починайте з https:// або http://)` });
        return;
      }
      next[k] = val;
    }
    saveSocialLinks(next);
    res.json({ socialLinks: next });
  });

  app.get('/api/crm/backup', (_req, res) => {
    let backupPath = '';
    try {
      backupPath = createSqliteBackupCopy();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.download(backupPath, `energocomfort-backup-${dateStr}.db`, () => {
        if (backupPath && fs.existsSync(backupPath)) {
          fs.unlink(backupPath, () => undefined);
        }
      });
    } catch (err) {
      if (backupPath && fs.existsSync(backupPath)) {
        fs.unlink(backupPath, () => undefined);
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не вдалося сформувати бекап SQLite',
      });
    }
  });

  app.get('/api/crm/auth/emails', (_req, res) => {
    const emails = getAllowedAdminEmails();
    res.json({
      envEmails: emails.envEmails,
      dbEmails: emails.dbEmails,
      effective: emails.effective,
    });
  });

  app.put('/api/crm/auth/emails', (req, res) => {
    const body = req.body as { emails?: string };
    const parsed = parseEmailList(String(body.emails ?? ''));
    if (parsed.length === 0 && getAllowedAdminEmails().envEmails.length === 0) {
      res.status(400).json({ error: 'Вкажіть щонайменше один коректний email адміністратора' });
      return;
    }
    setSetting('admin_emails', parsed.join(', '));
    const updated = getAllowedAdminEmails();
    res.json({
      envEmails: updated.envEmails,
      dbEmails: updated.dbEmails,
      effective: updated.effective,
    });
  });

  app.get('/api/crm/analytics', (_req, res) => {
    const config = getPublicAnalyticsConfig();
    const recentEvents = listRecentAnalyticsEvents(35);
    res.json({ ...config, recentEvents });
  });

  app.put('/api/crm/analytics', (req, res) => {
    const body = req.body as {
      metaPixelId?: string;
      ga4MeasurementId?: string;
      gtmContainerId?: string;
      analyticsEnabled?: boolean;
    };
    const metaPixelId = String(body.metaPixelId ?? '').trim();
    const ga4MeasurementId = String(body.ga4MeasurementId ?? '').trim().toUpperCase();
    const gtmContainerId = String(body.gtmContainerId ?? '').trim().toUpperCase();
    const analyticsEnabled = body.analyticsEnabled !== false;

    if (metaPixelId && !/^\d{8,20}$/.test(metaPixelId)) {
      res.status(400).json({ error: 'Meta Pixel ID має містити від 8 до 20 цифр (напр. 123456789012345)' });
      return;
    }
    if (ga4MeasurementId && !/^G-[A-Z0-9]{4,20}$/.test(ga4MeasurementId)) {
      res.status(400).json({ error: 'GA4 ID має бути у форматі G-XXXXXXXXXX' });
      return;
    }
    if (gtmContainerId && !/^GTM-[A-Z0-9]{4,20}$/.test(gtmContainerId)) {
      res.status(400).json({ error: 'GTM ID має бути у форматі GTM-XXXXXXX' });
      return;
    }

    saveAnalyticsSettings({
      metaPixelId,
      ga4MeasurementId,
      gtmContainerId,
      analyticsEnabled,
    });

    res.json(getPublicAnalyticsConfig());
  });

  // CRM Deals API
  app.get('/api/crm/deals', (_req, res) => {
    const deals = listDeals();
    res.json({ deals });
  });

  app.patch('/api/crm/deals/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Некоректний ID угоди' });
      return;
    }
    const body = req.body as {
      stage?: DealStage;
      assignee?: string;
      notes?: string;
      totalUsd?: number;
    };
    const allowedStages: DealStage[] = ['new', 'audit', 'proposal', 'fulfillment', 'done', 'archived'];
    if (body.stage && !allowedStages.includes(body.stage)) {
      res.status(400).json({ error: 'Некоректний етап воронки' });
      return;
    }
    const updated = updateDeal(id, body);
    if (!updated) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ deal: updated });
  });

  app.delete('/api/crm/deals/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Некоректний ID угоди' });
      return;
    }
    const ok = deleteDeal(id);
    if (!ok) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // CRM Products API
  app.patch('/api/crm/products/:id', (req, res) => {
    const body = req.body as {
      title?: string;
      sku?: string;
      cat?: ProductCategory;
      brand?: string;
      isKit?: boolean;
      price?: number;
      oldPrice?: number;
      inStock?: boolean;
      statusLabel?: string;
      img?: string;
      specs?: unknown;
      description?: string;
    };

    if (body.title !== undefined && !String(body.title).trim()) {
      res.status(400).json({ error: 'Назва товару не може бути порожньою' });
      return;
    }
    if (body.cat !== undefined && !ALLOWED_PRODUCT_CATS.includes(body.cat)) {
      res.status(400).json({ error: 'Некоректна категорія товару' });
      return;
    }
    if (body.img !== undefined && !isSafeImageUrl(String(body.img))) {
      res.status(400).json({ error: 'Некоректне посилання на зображення (дозволено /... або https://)' });
      return;
    }

    const updated = updateProduct(req.params.id, {
      title: body.title,
      sku: body.sku,
      cat: body.cat,
      brand: body.brand,
      isKit: body.isKit,
      price: body.price,
      oldPrice: body.oldPrice,
      inStock: body.inStock,
      statusLabel: body.statusLabel,
      img: body.img,
      specs: body.specs !== undefined ? sanitizeProductSpecs(body.specs) : undefined,
      description: body.description,
    });

    if (!updated) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ product: updated });
  });

  app.post('/api/crm/products', (req, res) => {
    const body = req.body as {
      title?: string;
      sku?: string;
      cat?: ProductCategory;
      brand?: string;
      isKit?: boolean;
      price?: number;
      oldPrice?: number;
      inStock?: boolean;
      statusLabel?: string;
      img?: string;
      specs?: unknown;
      description?: string;
    };
    if (!body.title?.trim()) {
      res.status(400).json({ error: 'Вкажіть назву товару' });
      return;
    }
    if (body.img !== undefined && !isSafeImageUrl(String(body.img))) {
      res.status(400).json({ error: 'Некоректне посилання на зображення (дозволено /... або https://)' });
      return;
    }
    const cat: ProductCategory = body.cat && ALLOWED_PRODUCT_CATS.includes(body.cat) ? body.cat : 'parts';
    const created = createProduct({
      title: body.title,
      sku: body.sku || '',
      cat,
      brand: body.brand || 'Energo Comfort',
      isKit: body.isKit,
      price: Number(body.price) || 0,
      oldPrice: Number(body.oldPrice) || 0,
      inStock: body.inStock ?? true,
      statusLabel: body.statusLabel,
      img: body.img ? String(body.img).trim() : '',
      specs: sanitizeProductSpecs(body.specs),
      description: body.description,
    });
    res.status(201).json({ product: created });
  });

  app.delete('/api/crm/products/:id', (req, res) => {
    const ok = deleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // CRM Projects / Case Studies API & Persistent Upload
  app.post('/api/crm/upload', (req, res) => {
    const body = req.body as { dataUrl?: string };
    const dataUrl = String(body.dataUrl ?? '');
    const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      res.status(400).json({ error: 'Підтримуються тільки зображення JPG, PNG або WebP' });
      return;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 4.5 * 1024 * 1024) {
      res.status(400).json({ error: 'Розмір зображення має бути до 4 МБ' });
      return;
    }

    const uploadsDir = getUploadsDir();
    const filename = `project-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const targetPath = path.resolve(uploadsDir, filename);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Некоректний шлях файлу' });
      return;
    }

    fs.writeFileSync(targetPath, buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  });

  app.post('/api/crm/projects', (req, res) => {
    const body = req.body as {
      seg?: 'b2b' | 'b2c';
      tag?: string;
      title?: string;
      img?: string;
      task?: string;
      solution?: string;
      specs?: string;
      result?: string;
    };
    const title = String(body.title ?? '').trim();
    if (!title) {
      res.status(400).json({ error: 'Вкажіть назву об’єкта' });
      return;
    }
    const img = String(body.img ?? '').trim();
    if (!isSafeImageUrl(img)) {
      res.status(400).json({ error: 'Некоректне посилання на зображення' });
      return;
    }

    const created = createProjectCase({
      seg: body.seg === 'b2b' ? 'b2b' : 'b2c',
      tag: String(body.tag ?? ''),
      title,
      img,
      task: String(body.task ?? ''),
      solution: String(body.solution ?? ''),
      specs: String(body.specs ?? ''),
      result: String(body.result ?? ''),
    });
    res.status(201).json({ project: created });
  });

  app.patch('/api/crm/projects/:id', (req, res) => {
    const body = req.body as {
      seg?: 'b2b' | 'b2c';
      tag?: string;
      title?: string;
      img?: string;
      task?: string;
      solution?: string;
      specs?: string;
      result?: string;
    };
    if (body.img !== undefined && !isSafeImageUrl(String(body.img))) {
      res.status(400).json({ error: 'Некоректне посилання на зображення' });
      return;
    }
    const updated = updateProjectCase(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ project: updated });
  });

  app.delete('/api/crm/projects/:id', (req, res) => {
    const ok = deleteProjectCase(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // Telegram Bot Test Ping & Webhook Setup
  app.post('/api/crm/telegram-test', async (_req, res) => {
    if (!isTelegramConfigured()) {
      res.status(400).json({
        sent: false,
        error: 'Задайте TELEGRAM_BOT_TOKEN та TELEGRAM_CHAT_ID у змінних оточення (Railway / .env)',
      });
      return;
    }
    const chatId = process.env.TELEGRAM_CHAT_ID!.trim();
    const ok = await sendTelegramText(
      chatId,
      '<b>Energo Comfort CRM:</b> тестове з’єднання активне. Заявки та замовлення з сайту надходитимуть сюди автоматично.',
    );
    res.json({ sent: ok });
  });

  app.get('/api/crm/telegram-webhook', async (_req, res) => {
    const info = await getTelegramWebhookInfo();
    res.json(info);
  });

  app.post('/api/crm/telegram-webhook', async (req, res) => {
    const body = (req.body ?? {}) as { webhookUrl?: string };
    const rawUrl = String(body.webhookUrl ?? '').trim();
    const targetUrl = rawUrl || `${getBaseUrl(req)}/api/telegram/webhook`;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'https:') {
        res.status(400).json({ ok: false, error: 'Telegram Webhook вимагає HTTPS-адресу' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'Некоректний URL для Webhook' });
      return;
    }

    const result = await setTelegramWebhook(targetUrl);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const info = await getTelegramWebhookInfo();
    res.json({ ok: true, webhookUrl: targetUrl, description: result.description, info });
  });

  // Ready-to-use Telegram Bot Webhook (for Railway deployment)
  app.post('/api/telegram/webhook', async (req, res) => {
    const update = req.body as {
      message?: {
        chat?: { id: number };
        from?: { first_name?: string; username?: string };
        text?: string;
        contact?: { phone_number?: string; first_name?: string };
      };
    };

    const msg = update?.message;
    if (!msg?.chat?.id) {
      res.json({ ok: true });
      return;
    }

    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const senderName = [msg.from?.first_name, msg.from?.username ? `@${msg.from.username}` : '']
      .filter(Boolean)
      .join(' ');

    if (msg.contact?.phone_number) {
      const deal = createDeal({
        type: 'lead',
        customerName: msg.contact.first_name || senderName || 'Telegram клієнт',
        phone: msg.contact.phone_number,
        city: 'Одеса (Telegram Bot)',
        channel: 'Telegram',
        topic: 'Заявка з Telegram-бота',
        taskType: 'Підбір системи через Telegram',
      });
      await sendDealToTelegram(deal);
      await sendTelegramText(
        chatId,
        `Дякуємо! Вашу заявку <b>${deal.dealNumber}</b> збережено у CRM Energo Comfort. Інженер зв’яжеться з вами найближчим часом.`,
      );
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/start')) {
      await sendTelegramText(
        chatId,
        'Вітаємо в <b>Energo Comfort (Одеса)</b>!\n\nНадішліть ваш номер телефону або опис задачі (наприклад: <i>будинок 120м2, котел + холодильник, +380501234567</i>), і ми створимо інженерний розрахунок у CRM.\n\nКоманди:\n/catalog — популярні позиції\n/contacts — офіс в Одесі',
      );
    } else if (text.startsWith('/catalog')) {
      const top = listProducts({ cat: 'kits' }).slice(0, 4);
      const list = top.map((p) => `• ${p.title} — <b>$${p.price}</b>`).join('\n');
      await sendTelegramText(chatId, `<b>Готові рішення Energo Comfort:</b>\n${list}`);
    } else if (text.startsWith('/contacts')) {
      await sendTelegramText(
        chatId,
        '<b>Energo Comfort</b>\nм. Одеса, вул. Європейська 93\n+38 (050) 777-71-72\n+38 (098) 152-32-61',
      );
    } else if (text.length >= 6) {
      const phoneMatch = text.match(/(\+?\d[\d\s\-()]{7,18}\d)/);
      if (phoneMatch) {
        const deal = createDeal({
          type: 'lead',
          customerName: senderName || 'Telegram клієнт',
          phone: phoneMatch[1],
          city: 'Одеса (Telegram Bot)',
          channel: 'Telegram',
          topic: 'Повідомлення у Telegram-боті',
          notes: text,
        });
        await sendDealToTelegram(deal);
        await sendTelegramText(
          chatId,
          `Заявку <b>${deal.dealNumber}</b> зафіксовано в CRM! Інженер скоро відповість.`,
        );
      } else {
        await sendTelegramText(
          chatId,
          'Щоб ми оформили заявку для інженера, вкажіть у повідомленні ваш номер телефону.',
        );
      }
    }

    res.json({ ok: true });
  });

  // Static assets & Vite / Production serving
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const publicDir = path.resolve(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }
    const distHtmlPath = path.join(distDir, 'index.html');
    const distHtmlTemplate = fs.existsSync(distHtmlPath) ? fs.readFileSync(distHtmlPath, 'utf8') : '';
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      if (distHtmlTemplate) {
        res.type('text/html; charset=utf-8').send(buildRouteSeoHtml(distHtmlTemplate, req));
        return;
      }
      res.sendFile(distHtmlPath);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Energo Comfort server running on http://${HOST}:${PORT} (${IS_PROD ? 'production' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
