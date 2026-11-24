import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  createContact,
  createDeal,
  createNote,
  createProduct,
  createProjectCase,
  createSqliteBackupCopy,
  createTask,
  deleteContact,
  deleteDeal,
  deleteNote,
  deleteProduct,
  deleteProjectCase,
  deleteTask,
  getCatalogFacets,
  getContactDetail,
  getProductById,
  getPublicAnalyticsConfig,
  getRecentCatalogAndProjectChanges,
  getSetting,
  getSocialLinks,
  getStorageDiagnostics,
  getUploadsDir,
  listContacts,
  listDeals,
  listNotes,
  listProducts,
  listProjectCases,
  listRecentAnalyticsEvents,
  listSitemapProductEntries,
  listTasks,
  markDealTelegramSent,
  recordAnalyticsEvent,
  saveAnalyticsSettings,
  saveSocialLinks,
  setSetting,
  setSettingIfAbsent,
  updateContact,
  updateDeal,
  updateProduct,
  updateProjectCase,
  updateTask,
} from './server/db.ts';
import {
  analyticsPutSchema,
  contactCreateSchema,
  contactPatchSchema,
  dealPatchSchema,
  isSafeExternalUrl,
  isSafeImageUrl,
  leadCreateSchema,
  normalizePhoneInput,
  noteCreateSchema,
  orderCreateSchema,
  productCreateSchema,
  productPatchSchema,
  projectCreateSchema,
  projectPatchSchema,
  socialPutSchema,
  taskCreateSchema,
  taskPatchSchema,
} from './server/validation.ts';
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

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');

const EXCHANGE_RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedUsdUahRate: { rate: number; exchangedate: string; fetchedAt: number } | null = null;

async function getUsdUahRate(): Promise<{ rate: number; exchangedate: string; stale?: boolean }> {
  const now = Date.now();
  if (cachedUsdUahRate && now - cachedUsdUahRate.fetchedAt < EXCHANGE_RATE_CACHE_TTL_MS) {
    return { rate: cachedUsdUahRate.rate, exchangedate: cachedUsdUahRate.exchangedate };
  }

  try {
    const resp = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json', {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      throw new Error(`NBU responded ${resp.status}`);
    }
    const data = (await resp.json()) as Array<{ rate?: number; exchangedate?: string }>;
    const first = Array.isArray(data) ? data[0] : undefined;
    if (first && typeof first.rate === 'number' && Number.isFinite(first.rate) && first.rate > 0) {
      cachedUsdUahRate = {
        rate: Number(first.rate.toFixed(4)),
        exchangedate: String(first.exchangedate || ''),
        fetchedAt: now,
      };
      return { rate: cachedUsdUahRate.rate, exchangedate: cachedUsdUahRate.exchangedate };
    }
    throw new Error('Invalid NBU payload');
  } catch (err) {
    if (cachedUsdUahRate) {
      return { rate: cachedUsdUahRate.rate, exchangedate: cachedUsdUahRate.exchangedate, stale: true };
    }
    throw err;
  }
}

// Helpers imported from ./server/validation.ts (isSafeImageUrl, isSafeExternalUrl, normalizePhoneInput)

function getBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return configured.replace(/\/+$/, '');
      }
    } catch {
      // fall through to request headers
    }
  }
  const protoHeader = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const proto = protoHeader === 'http' || protoHeader === 'https' ? protoHeader : 'https';
  const hostHeader = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  if (hostHeader && /^[a-z0-9.-]+(?::\d+)?$/i.test(hostHeader)) {
    return `${proto}://${hostHeader}`;
  }
  return 'https://energocomfort.shop';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtmlAttr(value: string): string {
  return escapeXml(value);
}

function parseAdminEmailList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
    ),
  );
}

function getEmailAllowlists(): { envEmails: string[]; dbEmails: string[]; effective: string[] } {
  const envEmails = parseAdminEmailList(process.env.ADMIN_EMAILS || '');
  const dbEmails = parseAdminEmailList(getSetting('admin_emails') || '');
  const effective = Array.from(new Set([...envEmails, ...dbEmails]));
  return { envEmails, dbEmails, effective };
}

function buildRouteSeoHtml(template: string, req: express.Request): string {
  const baseUrl = getBaseUrl(req);
  const rawPath = (req.path || '/').replace(/\/+$/, '') || '/';

  let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
  let description =
    'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
  let ogType = 'website';
  let ogImage = `${baseUrl}/assets/energocomfort/sto_110kw.jpg`;
  let robots = 'index, follow';
  let canonicalPath = rawPath;

  if (rawPath === '/shop') {
    title = 'Каталог обладнання СЕС та резервного живлення — Energo Comfort';
    description =
      'Каталог інверторів Deye, SolaX, Solis, акумуляторів LiFePO4, сонячних панелей та готових комплектів в Одесі з доставкою по Україні.';
  } else if (rawPath.startsWith('/shop/')) {
    const prodId = decodeURIComponent(rawPath.slice('/shop/'.length).split('/')[0] || '');
    const product = prodId ? getProductById(prodId) : null;
    if (product) {
      title = `${product.title} — Energo Comfort`.slice(0, 70);
      description = (
        product.description.trim() ||
        `${product.title} (${product.brand}). ${product.statusLabel}. Доставка зі складу в Одесі, гарантія та монтаж.`
      ).slice(0, 158);
      ogType = 'product';
      if (product.img) {
        ogImage = product.img.startsWith('http')
          ? product.img
          : `${baseUrl}${product.img.startsWith('/') ? '' : '/'}${product.img}`;
      }
      canonicalPath = `/shop/${encodeURIComponent(product.id)}`;
    }
  } else if (rawPath === '/services') {
    title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
    description =
      'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
  } else if (rawPath === '/projects') {
    title = 'Реалізовані об’єкти — Energo Comfort Одеса';
    description =
      'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
  } else if (rawPath === '/contacts') {
    title = 'Контакти та умови співпраці — Energo Comfort Одеса';
    description =
      'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
  } else if (rawPath === '/payment-delivery') {
    title = 'Оплата і доставка — Energo Comfort';
    description =
      'Умови оплати за курсом НБУ, самовивіз в Одесі та доставка обладнання СЕС по Україні.';
  } else if (rawPath === '/public-offer') {
    title = 'Публічна оферта (проєкт) — Energo Comfort';
    description = 'Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.';
  } else if (rawPath === '/crm') {
    title = 'CRM та адмін-панель — Energo Comfort';
    robots = 'noindex, nofollow';
  }

  const canonicalUrl = `${baseUrl}${canonicalPath === '/' ? '/' : canonicalPath}`;

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    )
    .replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${escapeHtmlAttr(robots)}" />`,
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="${escapeHtmlAttr(ogType)}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    );
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
      { path: '/payment-delivery', priority: '0.6', changefreq: 'monthly' },
      { path: '/public-offer', priority: '0.4', changefreq: 'monthly' },
    ];
    const productUrls = listSitemapProductEntries();

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticPages.map(
        (page) =>
          `  <url><loc>${escapeXml(`${baseUrl}${page.path}`)}</loc><lastmod>${today}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`,
      ),
      ...productUrls.map((entry) => {
        const lastmod = entry.updatedAt ? entry.updatedAt.slice(0, 10) : today;
        return `  <url><loc>${escapeXml(`${baseUrl}/shop/${encodeURIComponent(entry.id)}`)}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      }),
      '</urlset>',
    ].join('\n');

    res.type('application/xml; charset=utf-8').send(xml);
  });

  const handleMerchantFeed: express.RequestHandler = async (req, res) => {
    const baseUrl = getBaseUrl(req);
    let nbuRate: number | null = null;
    try {
      const rateInfo = await getUsdUahRate();
      nbuRate = rateInfo.rate;
    } catch {
      nbuRate = null;
    }

    const items = listProducts().filter((p) => p.price > 0);
    const channelItems = items.map((p) => {
      const link = `${baseUrl}/shop/${encodeURIComponent(p.id)}`;
      const imageLink = p.img
        ? p.img.startsWith('http')
          ? p.img
          : `${baseUrl}${p.img.startsWith('/') ? '' : '/'}${p.img}`
        : `${baseUrl}/assets/energocomfort/sto_110kw.jpg`;
      const availability = p.inStock ? 'in_stock' : 'preorder';
      const priceValue = nbuRate ? `${Math.round(p.price * nbuRate)} UAH` : `${p.price} USD`;
      const desc = (
        p.description.trim() ||
        `${p.title} (${p.brand}). Офіційне обладнання Energo Comfort в Одесі.`
      ).slice(0, 1000);

      return [
        '    <item>',
        `      <g:id>${escapeXml(p.sku || p.id)}</g:id>`,
        `      <g:title>${escapeXml(p.title.slice(0, 150))}</g:title>`,
        `      <g:description>${escapeXml(desc)}</g:description>`,
        `      <g:link>${escapeXml(link)}</g:link>`,
        `      <g:image_link>${escapeXml(imageLink)}</g:image_link>`,
        `      <g:brand>${escapeXml(p.brand || 'Energo Comfort')}</g:brand>`,
        '      <g:condition>new</g:condition>',
        `      <g:availability>${availability}</g:availability>`,
        `      <g:price>${escapeXml(priceValue)}</g:price>`,
        '    </item>',
      ].join('\n');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '  <channel>',
      '    <title>Energo Comfort — Товарний фід</title>',
      `    <link>${escapeXml(baseUrl)}</link>`,
      '    <description>Обладнання СЕС та системи резервного живлення Energo Comfort</description>',
      ...channelItems,
      '  </channel>',
      '</rss>',
    ].join('\n');

    res.type('application/xml; charset=utf-8').send(xml);
  };

  app.get('/feed.xml', handleMerchantFeed);
  app.get('/products.xml', handleMerchantFeed);

  // Public Storefront APIs
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      telegramConfigured: isTelegramConfigured(),
    });
  });

  app.get('/api/public/exchange-rate', async (_req, res) => {
    try {
      const rateInfo = await getUsdUahRate();
      res.json(rateInfo);
    } catch {
      res.status(503).json({ error: 'Курс НБУ тимчасово недоступний' });
    }
  });

  app.get('/api/public/config', (_req, res) => {
    res.json({
      ...getPublicAnalyticsConfig(),
      socialLinks: getSocialLinks(),
    });
  });

  app.get('/api/projects', (_req, res) => {
    res.json({ projects: listProjectCases() });
  });

  app.get('/api/catalog', (req, res) => {
    const cat = typeof req.query.cat === 'string' ? req.query.cat : undefined;
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const inStockOnly = req.query.inStockOnly === 'true' || req.query.inStockOnly === '1';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;

    res.json({
      items: listProducts({ cat, brand, q, inStockOnly, sort }),
      facets: getCatalogFacets(),
    });
  });

  app.get('/api/catalog/:id', (req, res) => {
    const product = getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ product });
  });

  app.post('/api/analytics/track', analyticsRateLimit, (req, res) => {
    const body = (req.body ?? {}) as {
      eventName?: string;
      metaEvent?: string;
      ga4Event?: string;
      payload?: Record<string, unknown>;
    };
    const eventName = String(body.eventName ?? '').trim().slice(0, 64);
    if (!eventName) {
      res.status(400).json({ error: 'Missing eventName' });
      return;
    }
    const metaEvent = String(body.metaEvent ?? eventName).trim().slice(0, 64);
    const ga4Event = String(body.ga4Event ?? eventName).trim().slice(0, 64);
    const safePayload: Record<string, string | number> = {};
    if (body.payload && typeof body.payload === 'object') {
      for (const [k, v] of Object.entries(body.payload)) {
        if (typeof v === 'string' || typeof v === 'number') {
          safePayload[k.slice(0, 48)] = typeof v === 'string' ? v.slice(0, 200) : v;
        }
      }
    }
    recordAnalyticsEvent(eventName, metaEvent, ga4Event, safePayload);
    res.json({ ok: true });
  });

  app.post('/api/leads', formRateLimit, async (req, res) => {
    const parsed = leadCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані форми' });
      return;
    }
    const body = parsed.data;
    if (body.website.trim()) {
      res.status(400).json({ error: 'Некоректне заповнення форми' });
      return;
    }

    const normalizedPhone = normalizePhoneInput(body.phone);
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
      return;
    }

    const deal = createDeal({
      type: 'lead',
      customerName: body.customerName.trim(),
      phone: normalizedPhone,
      city: body.city.trim(),
      channel: body.channel.trim(),
      topic: body.topic.trim(),
      taskType: body.taskType.trim(),
      loads: body.loads.map((item) => item.trim()).filter(Boolean),
      notes: body.notes.trim(),
      estimatedTotalUsd: body.estimatedTotalUsd,
    });

    const tg = await sendDealToTelegram(deal);
    if (tg.sent) {
      markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal });
  });

  app.post('/api/orders', formRateLimit, async (req, res) => {
    const parsed = orderCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані замовлення' });
      return;
    }
    const body = parsed.data;

    if (body.website.trim()) {
      res.status(400).json({ error: 'Некоректне заповнення форми' });
      return;
    }

    if (body.acceptedOffer === false) {
      res.status(400).json({ error: 'Підтвердіть ознайомлення з проєктом публічної оферти' });
      return;
    }

    const normalizedPhone = normalizePhoneInput(body.phone);
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
      return;
    }

    const deal = createDeal({
      type: 'order',
      customerName: body.customerName.trim(),
      phone: normalizedPhone,
      city: body.city.trim(),
      channel: body.channel.trim(),
      notes: body.notes.trim(),
      items: body.items,
    });

    if (deal.items.length === 0) {
      deleteDeal(deal.id);
      res.status(400).json({ error: 'Не знайдено жодного актуального товару з кошика' });
      return;
    }

    const tg = await sendDealToTelegram(deal);
    if (tg.sent) {
      markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal });
  });

  // Admin Authentication API
  app.get('/api/admin/auth/status', (_req, res) => {
    const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());
    const hasDbHash = Boolean(getSetting('admin_password_hash'));
    const configured = hasEnvPassword || hasDbHash;
    res.json({
      configured,
      mode: configured ? 'login' : 'setup',
      googleEnabled: isFirebaseAuthConfigured(),
    });
  });

  app.post('/api/admin/auth/setup', authRateLimit, (req, res) => {
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    if (envPass || getSetting('admin_password_hash')) {
      res.status(409).json({ error: 'Пароль адміністратора вже налаштовано. Використовуйте форму входу.' });
      return;
    }

    const body = (req.body ?? {}) as { password?: string };
    const password = String(body.password ?? '');
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Пароль має містити від 6 до 128 символів' });
      return;
    }

    const inserted = setSettingIfAbsent('admin_password_hash', hashPassword(password));
    if (!inserted) {
      res.status(409).json({ error: 'Пароль адміністратора вже створено.' });
      return;
    }

    res.status(201).json({ token: createSessionToken() });
  });

  app.post('/api/admin/auth/login', authRateLimit, (req, res) => {
    const body = (req.body ?? {}) as { password?: string };
    const password = String(body.password ?? '');
    if (!password) {
      res.status(400).json({ error: 'Введіть пароль адміністратора' });
      return;
    }

    const envPass = process.env.ADMIN_PASSWORD?.trim();
    if (envPass) {
      if (!verifyEnvPassword(password, envPass)) {
        res.status(401).json({ error: 'Невірний пароль адміністратора' });
        return;
      }
      res.json({ token: createSessionToken() });
      return;
    }

    const storedHash = getSetting('admin_password_hash');
    if (!storedHash) {
      res.status(400).json({ error: 'Пароль адміністратора ще не налаштовано' });
      return;
    }

    if (!verifyScryptPassword(password, storedHash)) {
      res.status(401).json({ error: 'Невірний пароль адміністратора' });
      return;
    }

    res.json({ token: createSessionToken() });
  });

  app.post('/api/admin/auth/google', authRateLimit, async (req, res) => {
    if (!isFirebaseAuthConfigured()) {
      res.status(400).json({ error: 'Google-авторизація не налаштована на сервері' });
      return;
    }
    const body = (req.body ?? {}) as { idToken?: string };
    const idToken = String(body.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'Відсутній токен авторизації Google' });
      return;
    }

    const verified = await verifyFirebaseGoogleToken(idToken);
    if (!verified) {
      res.status(401).json({ error: 'Не вдалося перевірити Google-акаунт' });
      return;
    }

    const { effective } = getEmailAllowlists();
    if (effective.length === 0) {
      // First-run bootstrap only if no admin password or email allowlist is configured yet
      const hasPassword = Boolean(process.env.ADMIN_PASSWORD?.trim() || getSetting('admin_password_hash'));
      if (hasPassword) {
        res.status(403).json({
          error: `Доступ через Google ще не відкритий: увійдіть паролем і додайте ${verified.email} у вкладці «Аналітика» або через ADMIN_EMAILS.`,
        });
        return;
      }
      const claimed = setSettingIfAbsent('admin_emails', verified.email);
      if (!claimed) {
        const refreshed = getEmailAllowlists();
        if (!refreshed.effective.includes(verified.email)) {
          res.status(403).json({ error: `Акаунт ${verified.email} не має доступу до CRM` });
          return;
        }
      }
    } else if (!effective.includes(verified.email)) {
      res.status(403).json({ error: `Акаунт ${verified.email} не входить до списку адміністраторів CRM` });
      return;
    }

    res.json({ token: createSessionToken(), email: verified.email });
  });

  // Protected CRM APIs
  app.use('/api/crm', requireAdminAuth);

  app.get('/api/crm/status', (_req, res) => {
    res.json({
      telegramConfigured: isTelegramConfigured(),
      hasTelegramToken: hasTelegramToken(),
      storage: getStorageDiagnostics(),
      recentChanges: getRecentCatalogAndProjectChanges(12),
    });
  });

  app.get('/api/crm/deals', (_req, res) => {
    res.json({ deals: listDeals() });
  });

  app.patch('/api/crm/deals/:id', (req, res) => {
    const dealId = Number(req.params.id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      res.status(400).json({ error: 'Некоректний ID угоди' });
      return;
    }
    const parsed = dealPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля угоди' });
      return;
    }

    const updated = updateDeal(dealId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ deal: updated });
  });

  app.delete('/api/crm/deals/:id', (req, res) => {
    const dealId = Number(req.params.id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      res.status(400).json({ error: 'Некоректний ID угоди' });
      return;
    }
    const ok = deleteDeal(dealId);
    if (!ok) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // Contacts, Tasks, Notes (Drizzle ORM + Zod)
  app.get('/api/crm/contacts', async (_req, res) => {
    const contacts = await listContacts();
    res.json({ contacts });
  });

  app.get('/api/crm/contacts/:id', async (req, res) => {
    const contactId = Number(req.params.id);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      res.status(400).json({ error: 'Некоректний ID контакту' });
      return;
    }
    const detail = await getContactDetail(contactId);
    if (!detail) {
      res.status(404).json({ error: 'Контакт не знайдено' });
      return;
    }
    res.json(detail);
  });

  app.post('/api/crm/contacts', async (req, res) => {
    const parsed = contactCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані контакту' });
      return;
    }
    const normalizedPhone = normalizePhoneInput(parsed.data.phone);
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
      return;
    }
    try {
      const contact = await createContact({ ...parsed.data, phone: normalizedPhone });
      res.status(201).json({ contact });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Контакт вже існує' });
    }
  });

  app.patch('/api/crm/contacts/:id', async (req, res) => {
    const contactId = Number(req.params.id);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      res.status(400).json({ error: 'Некоректний ID контакту' });
      return;
    }
    const parsed = contactPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля контакту' });
      return;
    }
    let phone: string | undefined;
    if (parsed.data.phone !== undefined) {
      const normalized = normalizePhoneInput(parsed.data.phone);
      if (!normalized) {
        res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
        return;
      }
      phone = normalized;
    }
    try {
      const updated = await updateContact(contactId, { ...parsed.data, ...(phone ? { phone } : {}) });
      if (!updated) {
        res.status(404).json({ error: 'Контакт не знайдено' });
        return;
      }
      res.json({ contact: updated });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Конфлікт номера телефону' });
    }
  });

  app.delete('/api/crm/contacts/:id', async (req, res) => {
    const contactId = Number(req.params.id);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      res.status(400).json({ error: 'Некоректний ID контакту' });
      return;
    }
    const ok = await deleteContact(contactId);
    if (!ok) {
      res.status(404).json({ error: 'Контакт не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/crm/tasks', async (req, res) => {
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const dealId = req.query.dealId ? Number(req.query.dealId) : undefined;
    const tasks = await listTasks({
      contactId: contactId && Number.isFinite(contactId) ? contactId : undefined,
      dealId: dealId && Number.isFinite(dealId) ? dealId : undefined,
    });
    res.json({ tasks });
  });

  app.post('/api/crm/tasks', async (req, res) => {
    const parsed = taskCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані задачі' });
      return;
    }
    const task = await createTask(parsed.data);
    res.status(201).json({ task });
  });

  app.patch('/api/crm/tasks/:id', async (req, res) => {
    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      res.status(400).json({ error: 'Некоректний ID задачі' });
      return;
    }
    const parsed = taskPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля задачі' });
      return;
    }
    const updated = await updateTask(taskId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Задачу не знайдено' });
      return;
    }
    res.json({ task: updated });
  });

  app.delete('/api/crm/tasks/:id', async (req, res) => {
    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      res.status(400).json({ error: 'Некоректний ID задачі' });
      return;
    }
    const ok = await deleteTask(taskId);
    if (!ok) {
      res.status(404).json({ error: 'Задачу не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/crm/notes', async (req, res) => {
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const dealId = req.query.dealId ? Number(req.query.dealId) : undefined;
    const notes = await listNotes({
      contactId: contactId && Number.isFinite(contactId) ? contactId : undefined,
      dealId: dealId && Number.isFinite(dealId) ? dealId : undefined,
    });
    res.json({ notes });
  });

  app.post('/api/crm/notes', async (req, res) => {
    const parsed = noteCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректна нотатка' });
      return;
    }
    const note = await createNote(parsed.data);
    res.status(201).json({ note });
  });

  app.delete('/api/crm/notes/:id', async (req, res) => {
    const noteId = Number(req.params.id);
    if (!Number.isFinite(noteId) || noteId <= 0) {
      res.status(400).json({ error: 'Некоректний ID нотатки' });
      return;
    }
    const ok = await deleteNote(noteId);
    if (!ok) {
      res.status(404).json({ error: 'Нотатку не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/crm/analytics', (_req, res) => {
    res.json({
      ...getPublicAnalyticsConfig(),
      recentEvents: listRecentAnalyticsEvents(35),
    });
  });

  app.put('/api/crm/analytics', (req, res) => {
    const parsed = analyticsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні налаштування аналітики' });
      return;
    }
    saveAnalyticsSettings(parsed.data);
    res.json(parsed.data);
  });

  app.put('/api/crm/social', (req, res) => {
    const parsed = socialPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні посилання соцмереж' });
      return;
    }
    saveSocialLinks(parsed.data);
    res.json({ socialLinks: getSocialLinks() });
  });

  app.get('/api/crm/auth/emails', (_req, res) => {
    res.json(getEmailAllowlists());
  });

  app.put('/api/crm/auth/emails', (req, res) => {
    const body = (req.body ?? {}) as { emails?: string };
    const parsed = parseAdminEmailList(String(body.emails ?? ''));
    setSetting('admin_emails', parsed.join(', '));
    res.json(getEmailAllowlists());
  });

  app.get('/api/crm/backup', (_req, res) => {
    let backupPath = '';
    try {
      backupPath = createSqliteBackupCopy();
      const downloadName = `energocomfort-backup-${new Date().toISOString().slice(0, 10)}.db`;
      res.download(backupPath, downloadName, () => {
        if (backupPath && fs.existsSync(backupPath)) {
          fs.unlink(backupPath, () => undefined);
        }
      });
    } catch {
      if (backupPath && fs.existsSync(backupPath)) {
        fs.unlink(backupPath, () => undefined);
      }
      res.status(500).json({ error: 'Не вдалося створити резервну копію бази даних' });
    }
  });

  app.post('/api/crm/products', (req, res) => {
    const parsed = productCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані товару' });
      return;
    }
    const body = parsed.data;
    const created = createProduct({
      title: body.title,
      sku: body.sku,
      cat: body.cat,
      brand: body.brand || 'Energo Comfort',
      isKit: body.isKit,
      price: body.price,
      oldPrice: body.oldPrice,
      inStock: body.inStock,
      statusLabel: body.statusLabel,
      img: body.img,
      specs: sanitizeProductSpecs(body.specs),
      description: body.description,
    });
    res.status(201).json({ product: created });
  });

  app.patch('/api/crm/products/:id', (req, res) => {
    const parsed = productPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля товару' });
      return;
    }
    const body = parsed.data;
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
    const body = (req.body ?? {}) as { dataUrl?: string };
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
    const parsed = projectCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані проєкту' });
      return;
    }
    const created = createProjectCase(parsed.data);
    res.status(201).json({ project: created });
  });

  app.patch('/api/crm/projects/:id', (req, res) => {
    const parsed = projectPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля проєкту' });
      return;
    }
    const updated = updateProjectCase(req.params.id, parsed.data);
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
    const update = (req.body ?? {}) as {
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
