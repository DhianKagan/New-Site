import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  claimMasterAdminAccount,
  clearClientErrorLogs,
  createContact,
  createCustomerAccountByCrm,
  createDeal,
  createNote,
  createProduct,
  createProductReviewRecord,
  createProjectCase,
  createSqliteBackupCopy,
  createStaffUser,
  createTask,
  deleteContact,
  deleteCustomerAccount,
  deleteDeal,
  deleteNote,
  deleteProduct,
  deleteProductReviewRecord,
  deleteProjectCase,
  deleteStaffUser,
  deleteTask,
  findCustomerForPasswordLogin,
  findStaffForGoogleLogin,
  findStaffForPasswordLogin,
  getCatalogFacets,
  getContactDetail,
  getCustomerAccountDetail,
  getCustomerAuthStateSync,
  getCustomerProfileById,
  getLatestCatalogOrProjectUpdatedAt,
  getMasterAdminRecordSync,
  getProductById,
  getProductReviewById,
  getPublicAnalyticsConfig,
  getRecentCatalogAndProjectChanges,
  getSetting,
  getSocialLinks,
  getStaffAuthStateSync,
  getStorageDiagnostics,
  getUploadsDir,
  listContacts,
  listCustomerAccounts,
  listCustomerDeals,
  listDeals,
  listNotes,
  listProducts,
  listProjectCases,
  listPublishedProductReviews,
  listRecentAnalyticsEvents,
  listRecentClientErrorLogs,
  listSitemapCategoryEntries,
  listSitemapProductEntries,
  listStaffUsers,
  listTasks,
  markDealTelegramSent,
  recordAnalyticsEvent,
  recordClientErrorLog,
  registerCustomerWithPassword,
  saveAnalyticsSettings,
  saveSocialLinks,
  setSetting,
  setSettingIfAbsent,
  updateContact,
  updateCustomerAccountByCrm,
  updateCustomerProfile,
  updateDeal,
  updateProduct,
  updateProductReviewRecord,
  updateProjectCase,
  updateStaffUser,
  updateTask,
  upsertGoogleCustomerAccount,
} from './server/db.ts';
import { escapeXml, generateSitemapXml } from './server/sitemap.ts';
import {
  adminLoginSchema,
  adminSetupSchema,
  analyticsPutSchema,
  clientErrorReportSchema,
  clientProfilePatchSchema,
  clientRegisterSchema,
  commercialExchangeRatePutSchema,
  contactCreateSchema,
  contactPatchSchema,
  crmCustomerCreateSchema,
  crmCustomerPatchSchema,
  crmDealCreateSchema,
  dealPatchSchema,
  firebaseDomainsPutSchema,
  isSafeExternalUrl,
  isSafeImageUrl,
  leadCreateSchema,
  normalizePhoneInput,
  noteCreateSchema,
  orderCreateSchema,
  productCreateSchema,
  productPatchSchema,
  PRODUCT_REVIEW_ID_REGEX,
  productReviewBodySchema,
  projectCreateSchema,
  projectPatchSchema,
  scrubSensitiveErrorText,
  socialPutSchema,
  staffCreateSchema,
  staffPatchSchema,
  taskCreateSchema,
  taskPatchSchema,
} from './server/validation.ts';
import {
  createClientSessionToken,
  createLoginBruteForceGuard,
  createRequireClientAuth,
  createRequireCrmAuth,
  createSessionToken,
  getClientUser,
  getCrmUser,
  hashPassword,
  requireRoles,
  verifyClientSessionToken,
  verifyEnvPassword,
  verifyScryptPassword,
  verifySessionToken,
} from './server/auth.ts';
import {
  getFirebaseDomainAdminState,
  getRuntimeFirebaseWebConfig,
  isFirebaseAuthConfigured,
  saveFirebaseDomainRules,
  verifyFirebaseGoogleToken,
} from './server/firebaseAuth.ts';
import {
  getTelegramWebhookInfo,
  hasTelegramToken,
  isTelegramConfigured,
  sendDealToTelegram,
  sendTelegramText,
  setTelegramWebhook,
} from './server/telegram.ts';
import {
  getActiveStorefrontRate,
  getCachedActiveRateSync,
  getMarket7kmRate,
  getStoredCommercialRate,
  saveCommercialRate,
} from './server/exchangeRate.ts';
import {
  renderRouteSeoHtml,
  resolveGoogleProductCategory,
  resolveProductTypeLabel,
} from './server/seo.ts';
import type { DealStage, ProductCategory, SocialLinksConfig } from './src/types.ts';

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Exchange rate is managed manually in CRM (commercial rate) with Odessa 7km market reference in ./server/exchangeRate.ts

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
  const queryCat = typeof req.query.cat === 'string' ? req.query.cat.trim() : '';
  let product = null;
  if (rawPath.startsWith('/shop/')) {
    const prodId = decodeURIComponent(rawPath.slice('/shop/'.length).split('/')[0] || '');
    product = prodId ? getProductById(prodId) : null;
  }

  return renderRouteSeoHtml({
    template,
    baseUrl,
    rawPath,
    queryCat,
    product,
    usdUahRate: getCachedActiveRateSync(),
    socialLinks: getSocialLinks(),
  });
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
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use('/api/crm/upload', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/uploads',
    express.static(getUploadsDir(), {
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
  const publicUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(publicUploadsDir)) {
    app.use(
      '/uploads',
      express.static(publicUploadsDir, {
        dotfiles: 'deny',
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
        },
      }),
    );
  }

  const formRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 8,
    message: 'Забагато заявок із вашої адреси. Будь ласка, зачекайте кілька хвилин або зателефонуйте +38 (050) 777-71-72.',
  });

  const authRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 30,
    message: 'Забагато запитів авторизації. Спробуйте через кілька хвилин.',
  });

  const loginBruteGuard = createLoginBruteForceGuard({
    windowMs: 15 * 60_000,
    lockDurationMs: 15 * 60_000,
    maxAttemptsPerPair: 5,
    maxAttemptsPerIdentifier: 8,
    maxAttemptsPerIp: 15,
  });

  const analyticsRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 120,
    message: 'Rate limit exceeded',
  });

  const errorReportRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 20,
    message: 'Too many error reports',
  });

  const reviewsWriteRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 20,
    message: 'Забагато операцій із відгуками. Будь ласка, спробуйте за кілька хвилин.',
  });

  async function resolveReviewActor(req: express.Request): Promise<{
    uid: string;
    name: string;
    isModerator: boolean;
  } | null> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return null;

    const verifiedGoogle = await verifyFirebaseGoogleToken(token);
    if (verifiedGoogle) {
      const { effective } = getEmailAllowlists();
      const staffMatch = await findStaffForGoogleLogin(verifiedGoogle.email);
      const isModerator =
        effective.includes(verifiedGoogle.email) ||
        Boolean(
          staffMatch &&
            staffMatch.active &&
            staffMatch.canLogin &&
            (staffMatch.role === 'admin' || staffMatch.role === 'manager'),
        );
      return {
        uid: verifiedGoogle.uid,
        name: verifiedGoogle.name,
        isModerator,
      };
    }

    const crmUser = verifySessionToken(token);
    if (crmUser) {
      if (crmUser.userId !== null) {
        const fresh = getStaffAuthStateSync(crmUser.userId);
        if (!fresh || !fresh.active || !fresh.canLogin) return null;
        return {
          uid: `staff:${crmUser.userId}`,
          name: fresh.name,
          isModerator: fresh.role === 'admin' || fresh.role === 'manager',
        };
      }
      return {
        uid: `staff:${crmUser.login}`,
        name: crmUser.name,
        isModerator: crmUser.role === 'admin' || crmUser.role === 'manager',
      };
    }

    const clientUser = verifyClientSessionToken(token);
    if (clientUser) {
      const fresh = getCustomerAuthStateSync(clientUser.customerId);
      if (!fresh || !fresh.active) return null;
      return {
        uid: fresh.firebaseUid || `client:${fresh.id}`,
        name: fresh.name,
        isModerator: false,
      };
    }

    return null;
  }

  function resolveOptionalClient(req: express.Request): { customerId: number; customerEmail: string } | null {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    const parsed = verifyClientSessionToken(token);
    if (!parsed) return null;
    const fresh = getCustomerAuthStateSync(parsed.customerId);
    if (!fresh || !fresh.active) return null;
    return { customerId: fresh.id, customerEmail: fresh.email };
  }

  // SEO: robots.txt, sitemap.xml & Merchant XML Feed (Meta / Google Shopping)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain; charset=utf-8').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /crm',
        'Disallow: /login',
        'Disallow: /account',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n'),
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const xml = generateSitemapXml({
      baseUrl,
      categories: listSitemapCategoryEntries(),
      products: listSitemapProductEntries(),
      infoLastMod: getLatestCatalogOrProjectUpdatedAt(),
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('application/xml; charset=utf-8').send(xml);
  });

  const handleMerchantFeed: express.RequestHandler = async (req, res) => {
    const baseUrl = getBaseUrl(req);
    let commercialRate: number | null = null;
    try {
      const rateInfo = await getActiveStorefrontRate();
      commercialRate = rateInfo.rate;
    } catch {
      commercialRate = null;
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
      const hasDiscount = p.oldPrice > p.price;
      const formatFeedMoney = (usd: number) =>
        commercialRate ? `${Math.round(usd * commercialRate)} UAH` : `${usd} USD`;
      const priceValue = hasDiscount ? formatFeedMoney(p.oldPrice) : formatFeedMoney(p.price);
      const salePriceValue = hasDiscount ? formatFeedMoney(p.price) : '';
      const desc = (
        p.description.trim() ||
        `${p.title} (${p.brand}). Офіційне обладнання Energo Comfort в Одесі.`
      ).slice(0, 1000);
      const itemId = p.sku || p.id;

      return [
        '    <item>',
        `      <g:id>${escapeXml(itemId)}</g:id>`,
        `      <g:mpn>${escapeXml(itemId)}</g:mpn>`,
        `      <g:title>${escapeXml(p.title.slice(0, 150))}</g:title>`,
        `      <g:description>${escapeXml(desc)}</g:description>`,
        `      <g:link>${escapeXml(link)}</g:link>`,
        `      <g:image_link>${escapeXml(imageLink)}</g:image_link>`,
        `      <g:brand>${escapeXml(p.brand || 'Energo Comfort')}</g:brand>`,
        `      <g:product_type>${escapeXml(resolveProductTypeLabel(p.cat))}</g:product_type>`,
        `      <g:google_product_category>${escapeXml(resolveGoogleProductCategory(p.cat))}</g:google_product_category>`,
        '      <g:condition>new</g:condition>',
        `      <g:availability>${availability}</g:availability>`,
        `      <g:price>${escapeXml(priceValue)}</g:price>`,
        ...(salePriceValue ? [`      <g:sale_price>${escapeXml(salePriceValue)}</g:sale_price>`] : []),
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

    res.setHeader('Cache-Control', 'public, max-age=300');
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
      const rateInfo = await getActiveStorefrontRate();
      res.setHeader('Cache-Control', 'no-store');
      res.json(rateInfo);
    } catch {
      res.status(503).json({ error: 'Комерційний курс тимчасово недоступний' });
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

  // Product Reviews API (SQLite storage + clientToken/adminToken/Google Firebase auth)
  app.get('/api/products/:productId/reviews', async (req, res) => {
    const productId = String(req.params.productId || '').trim();
    if (!PRODUCT_REVIEW_ID_REGEX.test(productId)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор товару' });
      return;
    }
    const actor = req.headers.authorization ? await resolveReviewActor(req) : null;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      reviews: listPublishedProductReviews(productId),
      viewerUid: actor?.uid ?? null,
      isModerator: actor?.isModerator ?? false,
    });
  });

  app.post('/api/products/:productId/reviews', reviewsWriteRateLimit, async (req, res) => {
    const productId = String(req.params.productId || '').trim();
    if (!PRODUCT_REVIEW_ID_REGEX.test(productId)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор товару' });
      return;
    }

    const actor = await resolveReviewActor(req);
    if (!actor) {
      res.status(401).json({ error: 'Для публікації відгуку увійдіть через Google.' });
      return;
    }

    const product = getProductById(productId);
    if (!product) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }

    const parsed = productReviewBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані відгуку' });
      return;
    }

    const review = createProductReviewRecord({
      productId,
      authorUid: actor.uid,
      authorName: parsed.data.authorName,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    res.status(201).json({ review });
  });

  app.patch('/api/reviews/:reviewId', reviewsWriteRateLimit, async (req, res) => {
    const reviewId = String(req.params.reviewId || '').trim();
    if (!PRODUCT_REVIEW_ID_REGEX.test(reviewId)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор відгуку' });
      return;
    }

    const actor = await resolveReviewActor(req);
    if (!actor) {
      res.status(401).json({ error: 'Для редагування відгуку увійдіть через Google.' });
      return;
    }

    const existing = getProductReviewById(reviewId);
    if (!existing) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }

    if (existing.authorUid !== actor.uid && !actor.isModerator) {
      res.status(403).json({ error: 'Ви можете редагувати лише власні відгуки' });
      return;
    }

    const parsed = productReviewBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані відгуку' });
      return;
    }

    const updated = updateProductReviewRecord(reviewId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }
    res.json({ review: updated });
  });

  app.delete('/api/reviews/:reviewId', reviewsWriteRateLimit, async (req, res) => {
    const reviewId = String(req.params.reviewId || '').trim();
    if (!PRODUCT_REVIEW_ID_REGEX.test(reviewId)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор відгуку' });
      return;
    }

    const actor = await resolveReviewActor(req);
    if (!actor) {
      res.status(401).json({ error: 'Для видалення відгуку увійдіть через Google.' });
      return;
    }

    const existing = getProductReviewById(reviewId);
    if (!existing) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }

    if (existing.authorUid !== actor.uid && !actor.isModerator) {
      res.status(403).json({ error: 'Ви можете видаляти лише власні відгуки' });
      return;
    }

    const deleted = deleteProductReviewRecord(reviewId);
    if (!deleted) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }
    res.json({ ok: true });
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

  app.post('/api/telemetry/errors', errorReportRateLimit, (req, res) => {
    const parsed = clientErrorReportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid error report payload' });
      return;
    }

    const errorId = parsed.data.errorId || `ec-${crypto.randomBytes(6).toString('hex')}`;
    const sanitizedEntry = {
      errorId,
      kind: parsed.data.kind,
      name: scrubSensitiveErrorText(parsed.data.name).slice(0, 120),
      message: scrubSensitiveErrorText(parsed.data.message).slice(0, 600),
      stack: scrubSensitiveErrorText(parsed.data.stack).slice(0, 4000),
      componentStack: scrubSensitiveErrorText(parsed.data.componentStack).slice(0, 4000),
      route: parsed.data.route,
      locale: parsed.data.locale,
    };

    console.error('[ClientRuntimeError]', {
      errorId: sanitizedEntry.errorId,
      kind: sanitizedEntry.kind,
      route: sanitizedEntry.route,
      name: sanitizedEntry.name,
      message: sanitizedEntry.message,
    });

    recordClientErrorLog(sanitizedEntry);
    res.status(201).json({ ok: true, errorId });
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

    const linkedClient = resolveOptionalClient(req);
    const combinedLeadNotes = [
      body.notes.trim(),
      body.attribution.trim() ? `Джерело / UTM: ${body.attribution.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const deal = createDeal({
      type: 'lead',
      customerName: body.customerName.trim(),
      phone: normalizedPhone,
      city: body.city.trim(),
      channel: body.channel.trim(),
      topic: body.topic.trim(),
      taskType: body.taskType.trim(),
      loads: body.loads.map((item) => item.trim()).filter(Boolean),
      notes: combinedLeadNotes,
      estimatedTotalUsd: body.estimatedTotalUsd,
      customerId: linkedClient?.customerId ?? null,
      customerEmail: linkedClient?.customerEmail ?? '',
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

    const linkedClient = resolveOptionalClient(req);
    const combinedOrderNotes = [
      body.notes.trim(),
      body.attribution.trim() ? `Джерело / UTM: ${body.attribution.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const deal = createDeal({
      type: 'order',
      customerName: body.customerName.trim(),
      phone: normalizedPhone,
      city: body.city.trim(),
      channel: body.channel.trim(),
      notes: combinedOrderNotes,
      items: body.items,
      customerId: linkedClient?.customerId ?? null,
      customerEmail: linkedClient?.customerEmail ?? '',
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

  // Unified Authentication API (Staff CRM + Client Cabinet) with Brute-Force Protection
  const handleAuthStatus: express.RequestHandler = (_req, res) => {
    const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());
    const master = getMasterAdminRecordSync();
    const hasDbHash = Boolean(getSetting('admin_password_hash') || master.passwordHash);
    const configured = hasEnvPassword || hasDbHash;
    res.json({
      configured,
      mode: configured ? 'login' : 'setup',
      googleEnabled: isFirebaseAuthConfigured(),
    });
  };

  app.get('/api/auth/status', handleAuthStatus);
  app.get('/api/admin/auth/status', handleAuthStatus);

  app.get('/api/auth/firebase-config', (req, res) => {
    const rawQueryHost = typeof req.query.host === 'string' ? req.query.host : '';
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const requestHost = rawQueryHost || rawHeaderHost;
    res.setHeader('Cache-Control', 'no-store');
    res.json(getRuntimeFirebaseWebConfig(requestHost));
  });

  app.post('/api/admin/auth/setup', authRateLimit, (req, res) => {
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    const masterExisting = getMasterAdminRecordSync();
    if (envPass || getSetting('admin_password_hash') || masterExisting.passwordHash) {
      res.status(409).json({ error: 'Акаунт адміністратора вже налаштовано. Використовуйте форму входу.' });
      return;
    }

    const parsed = adminSetupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані налаштування' });
      return;
    }

    const passwordHash = hashPassword(parsed.data.password);
    const inserted = setSettingIfAbsent('admin_password_hash', passwordHash);
    if (!inserted) {
      res.status(409).json({ error: 'Пароль адміністратора вже створено.' });
      return;
    }

    const master = claimMasterAdminAccount({
      passwordHash,
      name: parsed.data.name || 'Головний адміністратор',
      email: parsed.data.email || '',
    });

    if (parsed.data.email && !getSetting('admin_emails')) {
      setSettingIfAbsent('admin_emails', parsed.data.email);
    }

    const adminUser = {
      userId: master.id,
      name: master.name,
      login: master.login,
      email: master.email,
      role: 'admin' as const,
      assigneeLabel: master.assigneeLabel,
    };
    res.status(201).json({ accountType: 'staff', token: createSessionToken(adminUser), user: adminUser });
  });

  function formatLockoutMessage(retryAfterSec: number): string {
    const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
    return `Забагато невдалих спроб входу. Спробуйте повторно через ${mins} хв.`;
  }

  const handleUnifiedPasswordLogin: express.RequestHandler = async (req, res) => {
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');
    const parsed = adminLoginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Введіть логін/Email і пароль' });
      return;
    }

    const { identifier, password } = parsed.data;
    const normalizedId = identifier.trim().toLowerCase();
    const guardCheck = loginBruteGuard.check(clientIp, normalizedId);
    if (!guardCheck.allowed) {
      res.setHeader('Retry-After', String(guardCheck.retryAfterSec));
      res.status(429).json({ error: formatLockoutMessage(guardCheck.retryAfterSec), retryAfterSec: guardCheck.retryAfterSec });
      return;
    }

    const envMasterLogin = process.env.ADMIN_LOGIN?.trim().toLowerCase();
    const expectedMasterLogin = envMasterLogin || 'admin';
    const master = getMasterAdminRecordSync();

    const isMasterAttempt =
      Boolean(normalizedId) &&
      (normalizedId === expectedMasterLogin ||
        (!envMasterLogin && Boolean(master.email) && normalizedId === master.email.toLowerCase()));

    if (isMasterAttempt) {
      const envPass = process.env.ADMIN_PASSWORD?.trim();
      const storedHash = master.passwordHash || getSetting('admin_password_hash');
      const valid = envPass
        ? verifyEnvPassword(password, envPass)
        : Boolean(storedHash && verifyScryptPassword(password, storedHash));

      if (!valid) {
        const fail = loginBruteGuard.recordFailure(clientIp, normalizedId);
        if (fail.locked) {
          res.setHeader('Retry-After', String(fail.retryAfterSec));
          res.status(429).json({ error: formatLockoutMessage(fail.retryAfterSec), retryAfterSec: fail.retryAfterSec });
          return;
        }
        res.status(401).json({
          error: 'Невірний логін/Email або пароль',
          remainingAttempts: fail.remainingAttempts,
        });
        return;
      }

      loginBruteGuard.recordSuccess(clientIp, normalizedId);
      const adminUser = {
        userId: master.id,
        name: master.name,
        login: expectedMasterLogin,
        email: master.email,
        role: 'admin' as const,
        assigneeLabel: master.assigneeLabel,
      };
      res.json({ accountType: 'staff', token: createSessionToken(adminUser), user: adminUser });
      return;
    }

    // Check Staff User by Login or Email + Password
    const staffRecord = await findStaffForPasswordLogin(normalizedId);
    if (
      staffRecord &&
      staffRecord.passwordHash &&
      verifyScryptPassword(password, staffRecord.passwordHash)
    ) {
      if (!staffRecord.user.active || !staffRecord.user.canLogin) {
        res.status(403).json({
          error: 'Обліковий запис співробітника вимкнено адміністратором',
        });
        return;
      }
      loginBruteGuard.recordSuccess(clientIp, normalizedId);
      const staffUser = {
        userId: staffRecord.user.id,
        name: staffRecord.user.name,
        login: staffRecord.user.login,
        email: staffRecord.user.email,
        role: staffRecord.user.role,
        assigneeLabel: staffRecord.user.assigneeLabel,
      };
      res.json({ accountType: 'staff', token: createSessionToken(staffUser), user: staffUser });
      return;
    }

    // Check Customer Account by Email + Password
    const customerRecord = normalizedId.includes('@') ? await findCustomerForPasswordLogin(normalizedId) : null;
    if (
      customerRecord &&
      customerRecord.passwordHash &&
      verifyScryptPassword(password, customerRecord.passwordHash)
    ) {
      if (!customerRecord.customer.active) {
        res.status(403).json({
          error: 'Обліковий запис клієнта вимкнено адміністратором',
        });
        return;
      }
      loginBruteGuard.recordSuccess(clientIp, normalizedId);
      const client = customerRecord.customer;
      const token = createClientSessionToken({
        customerId: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        city: client.city,
      });
      res.json({ accountType: 'client', token, customer: client });
      return;
    }

    const fail = loginBruteGuard.recordFailure(clientIp, normalizedId);
    if (fail.locked) {
      res.setHeader('Retry-After', String(fail.retryAfterSec));
      res.status(429).json({ error: formatLockoutMessage(fail.retryAfterSec), retryAfterSec: fail.retryAfterSec });
      return;
    }
    res.status(401).json({
      error: 'Невірний логін/Email або пароль',
      remainingAttempts: fail.remainingAttempts,
    });
  };

  app.post('/api/auth/login', authRateLimit, handleUnifiedPasswordLogin);
  app.post('/api/admin/auth/login', authRateLimit, handleUnifiedPasswordLogin);

  app.post('/api/auth/register', authRateLimit, async (req, res) => {
    const parsed = clientRegisterSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані реєстрації' });
      return;
    }

    let normalizedPhone = '';
    if (parsed.data.phone.trim()) {
      const clean = normalizePhoneInput(parsed.data.phone.trim());
      if (!clean) {
        res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
        return;
      }
      normalizedPhone = clean;
    }

    try {
      const customer = await registerCustomerWithPassword({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: normalizedPhone,
        city: parsed.data.city,
        password: parsed.data.password,
      });
      const token = createClientSessionToken({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
      });
      res.status(201).json({ accountType: 'client', token, customer });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Не вдалося створити акаунт' });
    }
  });

  const handleUnifiedGoogleAuth: express.RequestHandler = async (req, res) => {
    if (!isFirebaseAuthConfigured()) {
      res.status(400).json({ error: 'Google-авторизація не налаштована на сервері' });
      return;
    }
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');
    const guardCheck = loginBruteGuard.check(clientIp, 'google-oauth');
    if (!guardCheck.allowed) {
      res.setHeader('Retry-After', String(guardCheck.retryAfterSec));
      res.status(429).json({ error: formatLockoutMessage(guardCheck.retryAfterSec), retryAfterSec: guardCheck.retryAfterSec });
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
      loginBruteGuard.recordFailure(clientIp, 'google-oauth');
      res.status(401).json({ error: 'Не вдалося перевірити Google-акаунт' });
      return;
    }

    loginBruteGuard.recordSuccess(clientIp, 'google-oauth');

    const { effective } = getEmailAllowlists();
    const staffMatch = await findStaffForGoogleLogin(verified.email);
    const isAllowlistedAdmin = effective.includes(verified.email);
    const master = getMasterAdminRecordSync();

    // If email belongs to a disabled/revoked staff record (and isn't in ADMIN_EMAILS), block access
    if (!isAllowlistedAdmin && staffMatch && (!staffMatch.active || !staffMatch.canLogin)) {
      res.status(403).json({
        error: 'Обліковий запис співробітника вимкнено адміністратором',
      });
      return;
    }

    // Route Staff / Admin -> CRM
    if (isAllowlistedAdmin || (staffMatch && staffMatch.active && staffMatch.canLogin)) {
      const sessionUser =
        staffMatch && staffMatch.active
          ? {
              userId: staffMatch.id,
              name: staffMatch.name,
              login: staffMatch.login,
              email: verified.email,
              role: isAllowlistedAdmin ? ('admin' as const) : staffMatch.role,
              assigneeLabel: staffMatch.assigneeLabel,
            }
          : {
              userId: master.id,
              name: verified.name || master.name,
              login: master.login,
              email: verified.email,
              role: 'admin' as const,
              assigneeLabel: master.assigneeLabel,
            };

      res.json({
        accountType: 'staff',
        token: createSessionToken(sessionUser),
        email: verified.email,
        user: sessionUser,
      });
      return;
    }

    // Route Client -> Auto-register / sign in to Client Cabinet
    try {
      const customer = await upsertGoogleCustomerAccount({
        email: verified.email,
        name: verified.name,
        firebaseUid: verified.uid,
      });
      const token = createClientSessionToken({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
      });
      res.json({
        accountType: 'client',
        token,
        email: verified.email,
        customer,
      });
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Не вдалося увійти в кабінет' });
    }
  };

  app.post('/api/auth/google', authRateLimit, handleUnifiedGoogleAuth);
  app.post('/api/admin/auth/google', authRateLimit, handleUnifiedGoogleAuth);

  // Protected Client Cabinet APIs
  app.use('/api/client', createRequireClientAuth(getCustomerAuthStateSync));

  app.get('/api/client/me', async (req, res) => {
    try {
      const client = getClientUser(req);
      if (!client) {
        res.status(401).json({ error: 'Потрібна авторизація' });
        return;
      }
      const customer = await getCustomerProfileById(client.customerId);
      if (!customer) {
        res.status(404).json({ error: 'Профіль клієнта не знайдено' });
        return;
      }
      const deals = listCustomerDeals({ id: customer.id, email: customer.email, phone: customer.phone });
      res.json({ customer, deals });
    } catch (err) {
      console.error('GET /api/client/me error:', err);
      res.status(500).json({ error: 'Помилка завантаження кабінету клієнта' });
    }
  });

  app.patch('/api/client/profile', async (req, res) => {
    try {
      const client = getClientUser(req);
      if (!client) {
        res.status(401).json({ error: 'Потрібна авторизація' });
        return;
      }
      const parsed = clientProfilePatchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані профілю' });
        return;
      }

      let nextPhone: string | undefined;
      if (parsed.data.phone !== undefined) {
        if (parsed.data.phone.trim() === '') {
          nextPhone = '';
        } else {
          const normalized = normalizePhoneInput(parsed.data.phone.trim());
          if (!normalized) {
            res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
            return;
          }
          nextPhone = normalized;
        }
      }

      const updated = await updateCustomerProfile(client.customerId, {
        name: parsed.data.name,
        phone: nextPhone,
        city: parsed.data.city,
      });
      if (!updated) {
        res.status(404).json({ error: 'Профіль клієнта не знайдено' });
        return;
      }
      const deals = listCustomerDeals({ id: updated.id, email: updated.email, phone: updated.phone });
      res.json({ customer: updated, deals });
    } catch (err) {
      console.error('PATCH /api/client/profile error:', err);
      res.status(500).json({ error: 'Помилка збереження профілю клієнта' });
    }
  });

  // Protected CRM APIs
  app.use('/api/crm', createRequireCrmAuth(getStaffAuthStateSync));

  app.get('/api/crm/me', (req, res) => {
    res.json({ user: getCrmUser(req) });
  });

  app.get('/api/crm/staff', async (_req, res) => {
    const staff = await listStaffUsers();
    res.json({ staff });
  });

  app.post('/api/crm/staff', requireRoles('admin'), async (req, res) => {
    const parsed = staffCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані користувача' });
      return;
    }
    if (parsed.data.login === 'admin') {
      res.status(409).json({ error: 'Логін admin зарезервовано за майстер-акаунтом' });
      return;
    }
    if (parsed.data.canLogin && !parsed.data.email) {
      res.status(400).json({ error: 'Вкажіть Email (Google акаунт) користувача для входу в CRM' });
      return;
    }
    try {
      const member = await createStaffUser(parsed.data);
      res.status(201).json({ member });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Не вдалося створити користувача' });
    }
  });

  // Admin can edit any staff member; non-admin users can ONLY edit their own profile fields (Email/role/access locked)
  app.patch('/api/crm/staff/:id', async (req, res) => {
    const staffId = Number(req.params.id);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      res.status(400).json({ error: 'Некоректний ID користувача' });
      return;
    }

    const currentUser = getCrmUser(req);
    const isAdmin = currentUser?.role === 'admin';
    const isSelf = currentUser?.userId !== null && currentUser?.userId === staffId;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Ви можете редагувати лише власний профіль' });
      return;
    }

    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    if (!isAdmin) {
      const restrictedKeys = ['role', 'active', 'canLogin', 'login', 'email', 'password', 'clearPassword'];
      if (restrictedKeys.some((k) => Object.prototype.hasOwnProperty.call(rawBody, k))) {
        res.status(403).json({ error: 'Лише адміністратор може змінювати Email, роль або права доступу' });
        return;
      }
    }

    const parsed = staffPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля користувача' });
      return;
    }

    if (isSelf && (parsed.data.active === false || parsed.data.canLogin === false)) {
      res.status(400).json({ error: 'Неможливо вимкнути власний поточний обліковий запис' });
      return;
    }

    const patchData = isAdmin
      ? parsed.data
      : {
          name: parsed.data.name,
          phone: parsed.data.phone,
          position: parsed.data.position,
          assigneeLabel: parsed.data.assigneeLabel,
        };

    try {
      const member = await updateStaffUser(staffId, patchData);
      if (!member) {
        res.status(404).json({ error: 'Співробітника не знайдено' });
        return;
      }
      res.json({ member });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Помилка оновлення профілю' });
    }
  });

  app.delete('/api/crm/staff/:id', requireRoles('admin'), async (req, res) => {
    const staffId = Number(req.params.id);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      res.status(400).json({ error: 'Некоректний ID співробітника' });
      return;
    }
    const currentUser = getCrmUser(req);
    if (currentUser?.userId === staffId) {
      res.status(400).json({ error: 'Неможливо видалити власний поточний обліковий запис' });
      return;
    }
    try {
      const ok = await deleteStaffUser(staffId);
      if (!ok) {
        res.status(404).json({ error: 'Співробітника не знайдено' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Не вдалося видалити акаунт' });
    }
  });

  // Registered Client Accounts: all CRM staff can view database & order history; Admin has full CRUD management
  app.get('/api/crm/customers', async (_req, res) => {
    try {
      const customers = await listCustomerAccounts();
      res.json({ customers });
    } catch (err) {
      console.error('GET /api/crm/customers error:', err);
      res.status(500).json({ error: 'Помилка завантаження бази клієнтів' });
    }
  });

  app.get('/api/crm/customers/:id', async (req, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      res.status(400).json({ error: 'Некоректний ID клієнта' });
      return;
    }
    try {
      const detail = await getCustomerAccountDetail(customerId);
      if (!detail) {
        res.status(404).json({ error: 'Клієнта не знайдено' });
        return;
      }
      res.json(detail);
    } catch (err) {
      console.error('GET /api/crm/customers/:id error:', err);
      res.status(500).json({ error: 'Помилка завантаження картки клієнта' });
    }
  });

  app.post('/api/crm/customers', requireRoles('admin'), async (req, res) => {
    const parsed = crmCustomerCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані клієнта' });
      return;
    }
    let normalizedPhone = '';
    if (parsed.data.phone.trim()) {
      const clean = normalizePhoneInput(parsed.data.phone.trim());
      if (!clean) {
        res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
        return;
      }
      normalizedPhone = clean;
    }
    try {
      const customer = await createCustomerAccountByCrm({
        ...parsed.data,
        phone: normalizedPhone,
      });
      res.status(201).json({ customer });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Не вдалося створити клієнта' });
    }
  });

  app.patch('/api/crm/customers/:id', requireRoles('admin'), async (req, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      res.status(400).json({ error: 'Некоректний ID клієнта' });
      return;
    }
    const parsed = crmCustomerPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані клієнта' });
      return;
    }
    let nextPhone: string | undefined;
    if (parsed.data.phone !== undefined) {
      if (parsed.data.phone.trim() === '') {
        nextPhone = '';
      } else {
        const clean = normalizePhoneInput(parsed.data.phone.trim());
        if (!clean) {
          res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
          return;
        }
        nextPhone = clean;
      }
    }
    try {
      const customer = await updateCustomerAccountByCrm(customerId, {
        ...parsed.data,
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
      });
      if (!customer) {
        res.status(404).json({ error: 'Клієнта не знайдено' });
        return;
      }
      res.json({ customer });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Не вдалося оновити клієнта' });
    }
  });

  app.delete('/api/crm/customers/:id', requireRoles('admin'), async (req, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      res.status(400).json({ error: 'Некоректний ID клієнта' });
      return;
    }
    try {
      const ok = await deleteCustomerAccount(customerId);
      if (!ok) {
        res.status(404).json({ error: 'Клієнта не знайдено' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Не вдалося видалити клієнта' });
    }
  });

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

  app.post('/api/crm/deals', async (req, res) => {
    const parsed = crmDealCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані угоди' });
      return;
    }

    const body = parsed.data;
    const normalizedPhone = normalizePhoneInput(body.phone);
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX' });
      return;
    }

    const crmUser = getCrmUser(req);
    const defaultAssignee =
      crmUser?.assigneeLabel?.trim() ||
      crmUser?.name?.trim() ||
      (body.type === 'order' ? 'Дмитро (менеджер)' : 'Олександр (інженер)');

    const deal = createDeal({
      type: body.type,
      stage: body.stage,
      assignee: body.assignee || defaultAssignee,
      customerName: body.customerName,
      phone: normalizedPhone,
      city: body.city,
      channel: body.channel || 'CRM (вручну)',
      topic: body.topic,
      taskType: body.taskType,
      loads: body.loads.map((item) => item.trim()).filter(Boolean),
      items: body.items,
      notes: body.notes,
      totalUsd: body.totalUsd,
      contactId: body.contactId,
      customerId: body.customerId,
      customerEmail: body.customerEmail,
    });

    if (body.items.length > 0 && deal.items.length === 0) {
      deleteDeal(deal.id);
      res.status(400).json({ error: 'Не знайдено жодного актуального товару з каталогу' });
      return;
    }

    if (body.sendTelegram) {
      const tg = await sendDealToTelegram(deal);
      if (tg.sent) {
        markDealTelegramSent(deal.id);
        deal.telegramSent = true;
      }
    }

    res.status(201).json({ deal });
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

  app.delete('/api/crm/deals/:id', requireRoles('admin', 'manager'), (req, res) => {
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

  app.delete('/api/crm/contacts/:id', requireRoles('admin', 'manager'), async (req, res) => {
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
    const crmUser = getCrmUser(req);
    const author =
      parsed.data.author && parsed.data.author !== 'Менеджер CRM'
        ? parsed.data.author
        : crmUser?.assigneeLabel || crmUser?.name || 'Менеджер CRM';
    const note = await createNote({ ...parsed.data, author });
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

  app.get('/api/crm/exchange-rate', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const commercial = getStoredCommercialRate();
    const market7km = await getMarket7kmRate(forceRefresh);
    const effectiveRate = commercial.rate ?? (market7km.available ? market7km.sell : null);
    const effectiveSource =
      commercial.rate !== null ? 'commercial' : market7km.available && market7km.sell ? 'market_fallback' : 'unset';
    res.json({
      commercial,
      effectiveRate,
      effectiveSource,
      market7km,
    });
  });

  app.put('/api/crm/exchange-rate', requireRoles('admin', 'manager'), async (req, res) => {
    const parsed = commercialExchangeRatePutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректний курс валют' });
      return;
    }
    const crmUser = getCrmUser(req);
    const actor = crmUser?.assigneeLabel || crmUser?.name || 'CRM';
    const commercial = saveCommercialRate(parsed.data.rate, actor);
    const market7km = await getMarket7kmRate(false);
    res.json({
      commercial,
      effectiveRate: commercial.rate,
      effectiveSource: 'commercial',
      market7km,
    });
  });

  app.get('/api/crm/analytics', (_req, res) => {
    res.json({
      ...getPublicAnalyticsConfig(),
      recentEvents: listRecentAnalyticsEvents(35),
    });
  });

  app.put('/api/crm/analytics', requireRoles('admin'), (req, res) => {
    const parsed = analyticsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні налаштування аналітики' });
      return;
    }
    saveAnalyticsSettings(parsed.data);
    res.json(parsed.data);
  });

  app.get('/api/crm/errors', requireRoles('admin'), (_req, res) => {
    res.json({ errors: listRecentClientErrorLogs(30) });
  });

  app.delete('/api/crm/errors', requireRoles('admin'), (_req, res) => {
    clearClientErrorLogs();
    res.json({ ok: true });
  });

  app.put('/api/crm/social', requireRoles('admin'), (req, res) => {
    const parsed = socialPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні посилання соцмереж' });
      return;
    }
    saveSocialLinks(parsed.data);
    res.json({ socialLinks: getSocialLinks() });
  });

  app.get('/api/crm/auth/emails', requireRoles('admin'), (_req, res) => {
    res.json(getEmailAllowlists());
  });

  app.put('/api/crm/auth/emails', requireRoles('admin'), (req, res) => {
    const body = (req.body ?? {}) as { emails?: string };
    const parsed = parseAdminEmailList(String(body.emails ?? ''));
    setSetting('admin_emails', parsed.join(', '));
    res.json(getEmailAllowlists());
  });

  app.get('/api/crm/auth/firebase-domains', requireRoles('admin'), (req, res) => {
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const host = typeof req.query.host === 'string' && req.query.host.trim() ? req.query.host : rawHeaderHost;
    res.json({
      ...getFirebaseDomainAdminState(),
      activeForCurrentHost: getRuntimeFirebaseWebConfig(host),
    });
  });

  app.put('/api/crm/auth/firebase-domains', requireRoles('admin'), (req, res) => {
    const parsed = firebaseDomainsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні правила доменів Firebase' });
      return;
    }
    saveFirebaseDomainRules(parsed.data.rules);
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const host = typeof req.query.host === 'string' && req.query.host.trim() ? req.query.host : rawHeaderHost;
    res.json({
      ...getFirebaseDomainAdminState(),
      activeForCurrentHost: getRuntimeFirebaseWebConfig(host),
    });
  });

  app.get('/api/crm/backup', requireRoles('admin'), (_req, res) => {
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

  app.post('/api/crm/products', requireRoles('admin', 'manager'), (req, res) => {
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

  app.patch('/api/crm/products/:id', requireRoles('admin', 'manager'), (req, res) => {
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

  app.delete('/api/crm/products/:id', requireRoles('admin', 'manager'), (req, res) => {
    const ok = deleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // CRM Projects / Case Studies API & Persistent Upload
  app.post('/api/crm/upload', requireRoles('admin', 'manager'), (req, res) => {
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

    const isValidJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isValidPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const isValidWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if ((ext === 'jpg' && !isValidJpg) || (ext === 'png' && !isValidPng) || (ext === 'webp' && !isValidWebp)) {
      res.status(400).json({ error: 'Вміст файлу не відповідає формату зображення JPG, PNG або WebP' });
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
    if (!IS_PROD && fs.existsSync(path.resolve(process.cwd(), 'public'))) {
      try {
        const workspaceUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
        fs.mkdirSync(workspaceUploadsDir, { recursive: true });
        const workspaceCopyPath = path.resolve(workspaceUploadsDir, filename);
        if (workspaceCopyPath.startsWith(workspaceUploadsDir + path.sep)) {
          fs.writeFileSync(workspaceCopyPath, buffer);
        }
      } catch {
        // ignore if workspace public directory is read-only
      }
    }
    res.status(201).json({ url: `/uploads/${filename}` });
  });

  app.post('/api/crm/projects', requireRoles('admin', 'manager'), (req, res) => {
    const parsed = projectCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані проєкту' });
      return;
    }
    const created = createProjectCase(parsed.data);
    res.status(201).json({ project: created });
  });

  app.patch('/api/crm/projects/:id', requireRoles('admin', 'manager'), (req, res) => {
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

  app.delete('/api/crm/projects/:id', requireRoles('admin', 'manager'), (req, res) => {
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

  app.post('/api/crm/telegram-webhook', requireRoles('admin'), async (req, res) => {
    const body = (req.body ?? {}) as { webhookUrl?: string };
    const rawUrl = String(body.webhookUrl ?? '').trim();
    const targetUrl = rawUrl || `${getBaseUrl(req)}/api/telegram/webhook`;
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.toLowerCase();
      const isPrivateHost =
        host === 'localhost' ||
        host === '::1' ||
        host.endsWith('.local') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      if (parsed.protocol !== 'https:' || isPrivateHost) {
        res.status(400).json({ ok: false, error: 'Telegram Webhook вимагає публічну HTTPS-адресу' });
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
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (expectedSecret) {
      const providedSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      const a = Buffer.from(providedSecret);
      const b = Buffer.from(expectedSecret);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(403).json({ ok: false });
        return;
      }
    }

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
    const text = (msg.text ?? '').trim().slice(0, 1500);
    const senderName = [msg.from?.first_name, msg.from?.username ? `@${msg.from.username}` : '']
      .filter(Boolean)
      .join(' ')
      .slice(0, 120);

    if (msg.contact?.phone_number) {
      const normalized = normalizePhoneInput(msg.contact.phone_number) || msg.contact.phone_number.slice(0, 32);
      const deal = createDeal({
        type: 'lead',
        customerName: (msg.contact.first_name || senderName || 'Telegram клієнт').slice(0, 120),
        phone: normalized,
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
        const normalized = normalizePhoneInput(phoneMatch[1]) || phoneMatch[1].slice(0, 32);
        const deal = createDeal({
          type: 'lead',
          customerName: senderName || 'Telegram клієнт',
          phone: normalized,
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
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      try {
        const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        res.status(200).type('text/html; charset=utf-8').send(buildRouteSeoHtml(transformed, req));
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
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
