import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import express from 'express';
import {
  checkDatabaseHealth,
  claimMasterAdminAccount,
  clearClientErrorLogs,
  closeDatabasePool,
  createContact,
  createCustomerAccountByCrm,
  createDeal,
  createNote,
  createProduct,
  createProductReviewRecord,
  createProjectCase,
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
  exportDatabaseBackupJson,
  findCustomerForPasswordLogin,
  findStaffForGoogleLogin,
  findStaffForPasswordLogin,
  getCatalogFacets,
  getContactDetail,
  getCustomerAccountDetail,
  getCustomerAuthStateSync,
  getCustomerProfileById,
  getCustomerWishlistIds,
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
  initDatabase,
  isDatabaseConfigured,
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
  setCustomerWishlistIds,
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
  clientWishlistPutSchema,
  commercialExchangeRatePutSchema,
  contactCreateSchema,
  contactPatchSchema,
  crmCustomerCreateSchema,
  crmCustomerPatchSchema,
  crmDealCreateSchema,
  dealPatchSchema,
  firebaseDomainsPutSchema,
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
  escapeHtml,
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
  extractCategorySlugFromShopPath,
  renderRouteSeoHtml,
  resolveGoogleProductCategory,
  resolveProductTypeLabel,
} from './server/seo.ts';
import { isValidProductCategory } from './src/lib/breadcrumbs.ts';
import {
  buildSecurityHeaders,
  collectMissingProductionEnvWarnings,
  isRequestHttps,
  resolveTrustedRequestHost,
  shouldEnforceFrameProtection,
  verifyAdminSetupToken,
  verifyTelegramWebhookSecret,
} from './server/security.ts';
import { evaluateHealthResponse } from './server/health.ts';
import { getRequestId, logger, requestLoggingMiddleware } from './server/logger.ts';
import { createRateLimiter } from './server/rateLimit.ts';
import { checkRedisHealth, closeRedis, getRedisClient } from './server/redis.ts';
import {
  getUploadObject,
  isS3ProxyEnabled,
  parseMultipartImageUpload,
  uploadImageBuffer,
  UploadValidationError,
} from './server/storage.ts';

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

function isPrivateOrLocalHostname(rawHost: string): boolean {
  const host = rawHost
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.+$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === 'ip6-localhost' ||
    host === 'ip6-loopback' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const checkIpv4 = (ip: string): boolean => {
    const parts = ip.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a >= 224) return true; // multicast / reserved
    return false;
  };

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    return checkIpv4(host);
  }
  if (ipVersion === 6) {
    if (host === '::' || host === '::1') return true;
    if (host.startsWith('::ffff:')) {
      const mapped = host.slice('::ffff:'.length);
      if (net.isIP(mapped) === 4) return checkIpv4(mapped);
      const hexParts = mapped.split(':');
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (Number.isFinite(hi) && Number.isFinite(lo)) {
          return checkIpv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
        }
      }
      return true;
    }
    const firstHextet = host.split(':')[0] || '0';
    const firstVal = parseInt(firstHextet, 16);
    if (Number.isFinite(firstVal)) {
      if ((firstVal & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
      if ((firstVal & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
      if ((firstVal & 0xff00) === 0xff00) return true; // multicast ff00::/8
    }
  }
  return false;
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

async function getEmailAllowlists(): Promise<{ envEmails: string[]; dbEmails: string[]; effective: string[] }> {
  const envEmails = parseAdminEmailList(process.env.ADMIN_EMAILS || '');
  const dbEmailsRaw = isDatabaseConfigured() ? (await getSetting('admin_emails')) || '' : '';
  const dbEmails = parseAdminEmailList(dbEmailsRaw);
  const effective = Array.from(new Set([...envEmails, ...dbEmails]));
  return { envEmails, dbEmails, effective };
}

async function buildRouteSeoHtml(template: string, req: express.Request): Promise<string> {
  const baseUrl = getBaseUrl(req);
  const rawPath = (req.path || '/').replace(/\/+$/, '') || '/';
  const queryCat = typeof req.query.cat === 'string' ? req.query.cat.trim() : '';
  const querySearch = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  let product = null;
  let categoryProducts = undefined;
  let socialLinks = {
    telegram: 'https://t.me/+380507777172',
    instagram: '',
    facebook: 'https://www.facebook.com/energocomfort.shop',
    youtube: '',
    viber: '',
    tiktok: '',
  };
  let usdUahRate = getCachedActiveRateSync();

  try {
    if (rawPath.startsWith('/shop/') && !rawPath.startsWith('/shop/category/')) {
      const prodId = decodeURIComponent(rawPath.slice('/shop/'.length).split('/')[0] || '');
      product = prodId ? await getProductById(prodId) : null;
    }

    if (!product && (rawPath === '/shop' || rawPath.startsWith('/shop/'))) {
      const effectiveCat = isValidProductCategory(queryCat)
        ? queryCat
        : extractCategorySlugFromShopPath(rawPath);
      categoryProducts = await listProducts(effectiveCat ? { cat: effectiveCat } : undefined);
    }

    socialLinks = await getSocialLinks();
    if (usdUahRate === null) {
      const rateInfo = await getActiveStorefrontRate().catch(() => null);
      if (rateInfo?.rate) usdUahRate = rateInfo.rate;
    }
  } catch {
    // Fall back to static template SEO metadata when DB/rate is temporarily unavailable
  }

  return renderRouteSeoHtml({
    template,
    baseUrl,
    rawPath,
    queryCat,
    querySearch,
    product,
    categoryProducts,
    usdUahRate,
    socialLinks,
  });
}

function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

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
  if (isDatabaseConfigured()) {
    try {
      await initDatabase();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Initial Postgres migration/seed error');
    }
  } else {
    logger.warn('DATABASE_URL is not configured; database endpoints will return 503');
  }
  getRedisClient();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestLoggingMiddleware);
  const enforceFrameProtection = shouldEnforceFrameProtection();
  app.use((req, res, next) => {
    const headers = buildSecurityHeaders({
      isHttps: isRequestHttps(req),
      enforceFrameProtection,
    });
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/uploads',
    express.static(getUploadsDir(), {
      dotfiles: 'deny',
      maxAge: IS_PROD ? '7d' : 0,
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
        maxAge: IS_PROD ? '7d' : 0,
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
        },
      }),
    );
  }

  const formRateLimit = createRateLimiter({
    prefix: 'ec:v1:rl:form',
    windowMs: 10 * 60_000,
    max: 8,
    message: 'Забагато заявок із вашої адреси. Будь ласка, зачекайте кілька хвилин або зателефонуйте +38 (050) 777-71-72.',
  });

  const authRateLimit = createRateLimiter({
    prefix: 'ec:v1:rl:auth',
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
    prefix: 'ec:v1:rl:analytics',
    windowMs: 60_000,
    max: 120,
    message: 'Rate limit exceeded',
  });

  const errorReportRateLimit = createRateLimiter({
    prefix: 'ec:v1:rl:errors',
    windowMs: 60_000,
    max: 20,
    message: 'Too many error reports',
  });

  const reviewsWriteRateLimit = createRateLimiter({
    prefix: 'ec:v1:rl:reviews',
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
      const { effective } = await getEmailAllowlists();
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
        const fresh = await getStaffAuthStateSync(crmUser.userId);
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
      const fresh = await getCustomerAuthStateSync(clientUser.customerId);
      if (!fresh || !fresh.active) return null;
      return {
        uid: fresh.firebaseUid || `client:${fresh.id}`,
        name: fresh.name,
        isModerator: false,
      };
    }

    return null;
  }

  async function resolveOptionalClient(
    req: express.Request,
  ): Promise<{ customerId: number; customerEmail: string } | null> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    const parsed = verifyClientSessionToken(token);
    if (!parsed) return null;
    const fresh = await getCustomerAuthStateSync(parsed.customerId);
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

  app.get('/sitemap.xml', asyncHandler(async (req, res) => {
    const baseUrl = getBaseUrl(req);
    const [categories, products, infoLastMod] = await Promise.all([
      listSitemapCategoryEntries(),
      listSitemapProductEntries(),
      getLatestCatalogOrProjectUpdatedAt(),
    ]);
    const xml = generateSitemapXml({
      baseUrl,
      categories,
      products,
      infoLastMod,
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('application/xml; charset=utf-8').send(xml);
  }));

  const handleMerchantFeed = asyncHandler(async (req, res) => {
    const baseUrl = getBaseUrl(req);
    let commercialRate: number | null = null;
    try {
      const rateInfo = await getActiveStorefrontRate();
      commercialRate = rateInfo.rate;
    } catch {
      commercialRate = null;
    }

    const items = (await listProducts()).filter((p) => p.price > 0);
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
  });

  app.get('/feed.xml', handleMerchantFeed);
  app.get('/products.xml', handleMerchantFeed);

  // Public Storefront APIs
  app.get('/api/health', asyncHandler(async (_req, res) => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    const evaluated = evaluateHealthResponse({
      dbHealth,
      redisHealth,
      telegramConfigured: isTelegramConfigured(),
      uptimeSec: process.uptime(),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(evaluated.statusCode).json(evaluated.body);
  }));

  app.get('/api/public/exchange-rate', async (_req, res) => {
    try {
      const rateInfo = await getActiveStorefrontRate();
      res.setHeader('Cache-Control', 'no-store');
      res.json(rateInfo);
    } catch {
      res.status(503).json({ error: 'Комерційний курс тимчасово недоступний' });
    }
  });

  app.get('/api/public/config', asyncHandler(async (_req, res) => {
    const [analytics, socialLinks] = await Promise.all([
      getPublicAnalyticsConfig(),
      getSocialLinks(),
    ]);
    res.json({
      ...analytics,
      socialLinks,
    });
  }));

  app.get('/api/projects', asyncHandler(async (_req, res) => {
    res.json({ projects: await listProjectCases() });
  }));

  app.get('/api/catalog', asyncHandler(async (req, res) => {
    const cat = typeof req.query.cat === 'string' ? req.query.cat : undefined;
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const inStockOnly = req.query.inStockOnly === 'true' || req.query.inStockOnly === '1';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
    const [items, facets, latestUpdatedAt] = await Promise.all([
      listProducts({ cat, brand, q, inStockOnly, sort }),
      getCatalogFacets(),
      getLatestCatalogOrProjectUpdatedAt(),
    ]);

    res.json({
      items,
      facets,
      meta: {
        environment: process.env.NODE_ENV || 'development',
        dataDirMode: process.env.S3_BUCKET ? 's3' : process.env.DATA_DIR ? 'custom' : 'default',
        totalCount: facets.total,
        kitCount: items.filter((p) => p.cat === 'kits' || p.isKit).length,
        legacyKitCategoryMismatchCount: items.filter((p) => p.isKit && p.cat !== 'kits').length,
        missingSkuKitCount: items.filter((p) => (p.cat === 'kits' || p.isKit) && !p.sku.trim()).length,
        latestUpdatedAt,
      },
    });
  }));

  app.get('/api/catalog/:id', asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ product });
  }));

  // Product Reviews API (PostgreSQL storage + clientToken/adminToken/Google Firebase auth)
  app.get('/api/products/:productId/reviews', asyncHandler(async (req, res) => {
    const productId = String(req.params.productId || '').trim();
    if (!PRODUCT_REVIEW_ID_REGEX.test(productId)) {
      res.status(400).json({ error: 'Некоректний ідентифікатор товару' });
      return;
    }
    const [actor, reviews] = await Promise.all([
      req.headers.authorization ? resolveReviewActor(req) : Promise.resolve(null),
      listPublishedProductReviews(productId),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      reviews,
      viewerUid: actor?.uid ?? null,
      isModerator: actor?.isModerator ?? false,
    });
  }));

  app.post('/api/products/:productId/reviews', reviewsWriteRateLimit, asyncHandler(async (req, res) => {
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

    const product = await getProductById(productId);
    if (!product) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }

    const parsed = productReviewBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані відгуку' });
      return;
    }

    const review = await createProductReviewRecord({
      productId,
      authorUid: actor.uid,
      authorName: parsed.data.authorName,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    res.status(201).json({ review });
  }));

  app.patch('/api/reviews/:reviewId', reviewsWriteRateLimit, asyncHandler(async (req, res) => {
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

    const existing = await getProductReviewById(reviewId);
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

    const updated = await updateProductReviewRecord(reviewId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }
    res.json({ review: updated });
  }));

  app.delete('/api/reviews/:reviewId', reviewsWriteRateLimit, asyncHandler(async (req, res) => {
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

    const existing = await getProductReviewById(reviewId);
    if (!existing) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }

    if (existing.authorUid !== actor.uid && !actor.isModerator) {
      res.status(403).json({ error: 'Ви можете видаляти лише власні відгуки' });
      return;
    }

    const deleted = await deleteProductReviewRecord(reviewId);
    if (!deleted) {
      res.status(404).json({ error: 'Відгук не знайдено' });
      return;
    }
    res.json({ ok: true });
  }));

  app.post('/api/analytics/track', analyticsRateLimit, asyncHandler(async (req, res) => {
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
    await recordAnalyticsEvent(eventName, metaEvent, ga4Event, safePayload);
    res.json({ ok: true });
  }));

  app.post('/api/telemetry/errors', errorReportRateLimit, asyncHandler(async (req, res) => {
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

    logger.error(
      {
        requestId: getRequestId(req),
        errorId: sanitizedEntry.errorId,
        kind: sanitizedEntry.kind,
        route: sanitizedEntry.route,
        name: sanitizedEntry.name,
        message: sanitizedEntry.message,
      },
      'Client runtime error reported',
    );

    await recordClientErrorLog(sanitizedEntry);
    res.status(201).json({ ok: true, errorId });
  }));

  app.post('/api/leads', formRateLimit, asyncHandler(async (req, res) => {
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

    const linkedClient = await resolveOptionalClient(req);
    const combinedLeadNotes = [
      body.notes.trim(),
      body.attribution.trim() ? `Джерело / UTM: ${body.attribution.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const deal = await createDeal({
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
      await markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal });
  }));

  app.post('/api/orders', formRateLimit, asyncHandler(async (req, res) => {
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

    const linkedClient = await resolveOptionalClient(req);
    const combinedOrderNotes = [
      body.notes.trim(),
      body.attribution.trim() ? `Джерело / UTM: ${body.attribution.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const deal = await createDeal({
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
      await deleteDeal(deal.id);
      res.status(400).json({ error: 'Не знайдено жодного актуального товару з кошика' });
      return;
    }

    const tg = await sendDealToTelegram(deal);
    if (tg.sent) {
      await markDealTelegramSent(deal.id);
      deal.telegramSent = true;
    }

    res.status(201).json({ deal });
  }));

  // Unified Authentication API (Staff CRM + Client Cabinet) with Brute-Force Protection
  const handleAuthStatus = asyncHandler(async (_req, res) => {
    const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());
    const hasSetupToken = Boolean(process.env.ADMIN_SETUP_TOKEN?.trim());
    const dbReady = isDatabaseConfigured();
    const [master, dbHash, googleEnabled] = await Promise.all([
      dbReady ? getMasterAdminRecordSync() : Promise.resolve({ passwordHash: '' }),
      getSetting('admin_password_hash'),
      isFirebaseAuthConfigured(),
    ]);
    const hasDbHash = Boolean(dbHash || master.passwordHash);
    const configured = hasEnvPassword || hasDbHash;
    res.json({
      configured,
      mode: configured ? 'login' : 'setup',
      googleEnabled,
      setupTokenRequired: !configured && !hasEnvPassword,
      setupTokenConfigured: hasSetupToken,
    });
  });

  app.get('/api/auth/status', handleAuthStatus);
  app.get('/api/admin/auth/status', handleAuthStatus);

  app.get('/api/auth/firebase-config', asyncHandler(async (req, res) => {
    const rawQueryHost = typeof req.query.host === 'string' ? req.query.host : '';
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '');
    const requestHost = resolveTrustedRequestHost(rawHeaderHost, rawQueryHost);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getRuntimeFirebaseWebConfig(requestHost));
  }));

  app.post('/api/admin/auth/setup', authRateLimit, asyncHandler(async (req, res) => {
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    const [masterExisting, existingDbHash, consumedSetupTokenHash] = await Promise.all([
      getMasterAdminRecordSync(),
      getSetting('admin_password_hash'),
      getSetting('admin_setup_token_consumed_hash'),
    ]);
    if (envPass || existingDbHash || masterExisting.passwordHash || consumedSetupTokenHash) {
      res.status(409).json({ error: 'Акаунт адміністратора вже налаштовано. Використовуйте форму входу.' });
      return;
    }

    const setupTokenCheck = verifyAdminSetupToken(
      process.env.ADMIN_SETUP_TOKEN,
      req.header('x-setup-token'),
    );
    if (!setupTokenCheck.ok) {
      res.status(setupTokenCheck.status).json({ error: setupTokenCheck.error });
      return;
    }

    const parsed = adminSetupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані налаштування' });
      return;
    }

    const setupTokenHash = crypto
      .createHash('sha256')
      .update(process.env.ADMIN_SETUP_TOKEN!.trim())
      .digest('hex');
    const tokenClaimed = await setSettingIfAbsent('admin_setup_token_consumed_hash', setupTokenHash);
    if (!tokenClaimed) {
      res.status(409).json({ error: 'Одноразовий токен налаштування вже використано.' });
      return;
    }

    const passwordHash = hashPassword(parsed.data.password);
    const inserted = await setSettingIfAbsent('admin_password_hash', passwordHash);
    if (!inserted) {
      res.status(409).json({ error: 'Пароль адміністратора вже створено.' });
      return;
    }

    const master = await claimMasterAdminAccount({
      passwordHash,
      name: parsed.data.name || 'Головний адміністратор',
      email: parsed.data.email || '',
    });

    if (parsed.data.email && !(await getSetting('admin_emails'))) {
      await setSettingIfAbsent('admin_emails', parsed.data.email);
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
  }));

  function formatLockoutMessage(retryAfterSec: number): string {
    const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
    return `Забагато невдалих спроб входу. Спробуйте повторно через ${mins} хв.`;
  }

  const handleUnifiedPasswordLogin = asyncHandler(async (req, res) => {
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');
    const parsed = adminLoginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Введіть логін/Email і пароль' });
      return;
    }

    const { identifier, password } = parsed.data;
    const normalizedId = identifier.trim().toLowerCase();
    const guardCheck = await loginBruteGuard.check(clientIp, normalizedId);
    if (!guardCheck.allowed) {
      res.setHeader('Retry-After', String(guardCheck.retryAfterSec));
      res.status(429).json({ error: formatLockoutMessage(guardCheck.retryAfterSec), retryAfterSec: guardCheck.retryAfterSec });
      return;
    }

    const envMasterLogin = process.env.ADMIN_LOGIN?.trim().toLowerCase();
    const expectedMasterLogin = envMasterLogin || 'admin';
    const master = await getMasterAdminRecordSync();

    const isMasterAttempt =
      Boolean(normalizedId) &&
      (normalizedId === expectedMasterLogin ||
        (!envMasterLogin && Boolean(master.email) && normalizedId === master.email.toLowerCase()));

    if (isMasterAttempt) {
      const envPass = process.env.ADMIN_PASSWORD?.trim();
      const storedHash = master.passwordHash || (await getSetting('admin_password_hash'));
      const valid = envPass
        ? verifyEnvPassword(password, envPass)
        : Boolean(storedHash && (await verifyScryptPassword(password, storedHash)));

      if (!valid) {
        const fail = await loginBruteGuard.recordFailure(clientIp, normalizedId);
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

      await loginBruteGuard.recordSuccess(clientIp, normalizedId);
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
      (await verifyScryptPassword(password, staffRecord.passwordHash))
    ) {
      if (!staffRecord.user.active || !staffRecord.user.canLogin) {
        res.status(403).json({
          error: 'Обліковий запис співробітника вимкнено адміністратором',
        });
        return;
      }
      await loginBruteGuard.recordSuccess(clientIp, normalizedId);
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
      (await verifyScryptPassword(password, customerRecord.passwordHash))
    ) {
      if (!customerRecord.customer.active) {
        res.status(403).json({
          error: 'Обліковий запис клієнта вимкнено адміністратором',
        });
        return;
      }
      await loginBruteGuard.recordSuccess(clientIp, normalizedId);
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

    const fail = await loginBruteGuard.recordFailure(clientIp, normalizedId);
    if (fail.locked) {
      res.setHeader('Retry-After', String(fail.retryAfterSec));
      res.status(429).json({ error: formatLockoutMessage(fail.retryAfterSec), retryAfterSec: fail.retryAfterSec });
      return;
    }
    res.status(401).json({
      error: 'Невірний логін/Email або пароль',
      remainingAttempts: fail.remainingAttempts,
    });
  });

  app.post('/api/auth/login', authRateLimit, handleUnifiedPasswordLogin);
  app.post('/api/admin/auth/login', authRateLimit, handleUnifiedPasswordLogin);

  app.post('/api/auth/register', authRateLimit, asyncHandler(async (req, res) => {
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
  }));

  const handleUnifiedGoogleAuth = asyncHandler(async (req, res) => {
    if (!(await isFirebaseAuthConfigured())) {
      res.status(400).json({ error: 'Google-авторизація не налаштована на сервері' });
      return;
    }
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');
    const guardCheck = await loginBruteGuard.check(clientIp, 'google-oauth');
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
      await loginBruteGuard.recordFailure(clientIp, 'google-oauth');
      res.status(401).json({ error: 'Не вдалося перевірити Google-акаунт' });
      return;
    }

    await loginBruteGuard.recordSuccess(clientIp, 'google-oauth');

    const [{ effective }, staffMatch, master] = await Promise.all([
      getEmailAllowlists(),
      findStaffForGoogleLogin(verified.email),
      getMasterAdminRecordSync(),
    ]);
    const isAllowlistedAdmin = effective.includes(verified.email);

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
  });

  app.post('/api/auth/google', authRateLimit, handleUnifiedGoogleAuth);
  app.post('/api/admin/auth/google', authRateLimit, handleUnifiedGoogleAuth);

  // Protected Client Cabinet APIs
  app.use('/api/client', createRequireClientAuth(getCustomerAuthStateSync));

  app.get('/api/client/me', asyncHandler(async (req, res) => {
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
    const [deals, wishlistIds] = await Promise.all([
      listCustomerDeals({ id: customer.id, email: customer.email, phone: customer.phone }),
      getCustomerWishlistIds(client.customerId),
    ]);
    res.json({ customer, deals, wishlistIds });
  }));

  app.get('/api/client/wishlist', asyncHandler(async (req, res) => {
    const client = getClientUser(req);
    if (!client) {
      res.status(401).json({ error: 'Потрібна авторизація' });
      return;
    }
    res.json({ productIds: await getCustomerWishlistIds(client.customerId) });
  }));

  app.put('/api/client/wishlist', asyncHandler(async (req, res) => {
    const client = getClientUser(req);
    if (!client) {
      res.status(401).json({ error: 'Потрібна авторизація' });
      return;
    }
    const parsed = clientWishlistPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані списку бажань' });
      return;
    }
    const productIds = await setCustomerWishlistIds(client.customerId, parsed.data.productIds);
    res.json({ productIds });
  }));

  app.patch('/api/client/profile', asyncHandler(async (req, res) => {
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
    const deals = await listCustomerDeals({ id: updated.id, email: updated.email, phone: updated.phone });
    res.json({ customer: updated, deals });
  }));

  // Protected CRM APIs
  app.use('/api/crm', createRequireCrmAuth(getStaffAuthStateSync));

  app.get('/api/crm/me', (req, res) => {
    res.json({ user: getCrmUser(req) });
  });

  app.get('/api/crm/staff', asyncHandler(async (_req, res) => {
    const staff = await listStaffUsers();
    res.json({ staff });
  }));

  app.post('/api/crm/staff', requireRoles('admin'), asyncHandler(async (req, res) => {
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
  }));

  // Admin can edit any staff member; non-admin users can ONLY edit their own profile fields (Email/role/access locked)
  app.patch('/api/crm/staff/:id', asyncHandler(async (req, res) => {
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
  }));

  app.delete('/api/crm/staff/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
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
  }));

  // Registered Client Accounts: all CRM staff can view database & order history; Admin has full CRUD management
  app.get('/api/crm/customers', asyncHandler(async (_req, res) => {
    const customers = await listCustomerAccounts();
    res.json({ customers });
  }));

  app.get('/api/crm/customers/:id', asyncHandler(async (req, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      res.status(400).json({ error: 'Некоректний ID клієнта' });
      return;
    }
    const detail = await getCustomerAccountDetail(customerId);
    if (!detail) {
      res.status(404).json({ error: 'Клієнта не знайдено' });
      return;
    }
    res.json(detail);
  }));

  app.post('/api/crm/customers', requireRoles('admin'), asyncHandler(async (req, res) => {
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
  }));

  app.patch('/api/crm/customers/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
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
  }));

  app.delete('/api/crm/customers/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/crm/status', asyncHandler(async (_req, res) => {
    const [storage, recentChanges] = await Promise.all([
      getStorageDiagnostics(),
      getRecentCatalogAndProjectChanges(12),
    ]);
    res.json({
      telegramConfigured: isTelegramConfigured(),
      hasTelegramToken: hasTelegramToken(),
      storage,
      recentChanges,
    });
  }));

  app.get('/api/crm/deals', asyncHandler(async (_req, res) => {
    res.json({ deals: await listDeals() });
  }));

  app.post('/api/crm/deals', requireRoles('admin', 'manager', 'engineer'), asyncHandler(async (req, res) => {
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

    const deal = await createDeal({
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
      await deleteDeal(deal.id);
      res.status(400).json({ error: 'Не знайдено жодного актуального товару з каталогу' });
      return;
    }

    if (body.sendTelegram) {
      const tg = await sendDealToTelegram(deal);
      if (tg.sent) {
        await markDealTelegramSent(deal.id);
        deal.telegramSent = true;
      }
    }

    res.status(201).json({ deal });
  }));

  app.patch('/api/crm/deals/:id', requireRoles('admin', 'manager', 'engineer'), asyncHandler(async (req, res) => {
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

    const updated = await updateDeal(dealId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ deal: updated });
  }));

  app.delete('/api/crm/deals/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const dealId = Number(req.params.id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      res.status(400).json({ error: 'Некоректний ID угоди' });
      return;
    }
    const ok = await deleteDeal(dealId);
    if (!ok) {
      res.status(404).json({ error: 'Угоду не знайдено' });
      return;
    }
    res.json({ ok: true });
  }));

  // Contacts, Tasks, Notes (Drizzle ORM + Zod)
  app.get('/api/crm/contacts', asyncHandler(async (_req, res) => {
    const contacts = await listContacts();
    res.json({ contacts });
  }));

  app.get('/api/crm/contacts/:id', asyncHandler(async (req, res) => {
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
  }));

  app.post('/api/crm/contacts', requireRoles('admin', 'manager', 'engineer'), asyncHandler(async (req, res) => {
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
  }));

  app.patch('/api/crm/contacts/:id', requireRoles('admin', 'manager', 'engineer'), asyncHandler(async (req, res) => {
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
  }));

  app.delete('/api/crm/contacts/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/crm/tasks', asyncHandler(async (req, res) => {
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const dealId = req.query.dealId ? Number(req.query.dealId) : undefined;
    const tasks = await listTasks({
      contactId: contactId && Number.isFinite(contactId) ? contactId : undefined,
      dealId: dealId && Number.isFinite(dealId) ? dealId : undefined,
    });
    res.json({ tasks });
  }));

  app.post('/api/crm/tasks', asyncHandler(async (req, res) => {
    const parsed = taskCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані задачі' });
      return;
    }
    const task = await createTask(parsed.data);
    res.status(201).json({ task });
  }));

  app.patch('/api/crm/tasks/:id', asyncHandler(async (req, res) => {
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
  }));

  app.delete('/api/crm/tasks/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/crm/notes', asyncHandler(async (req, res) => {
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const dealId = req.query.dealId ? Number(req.query.dealId) : undefined;
    const notes = await listNotes({
      contactId: contactId && Number.isFinite(contactId) ? contactId : undefined,
      dealId: dealId && Number.isFinite(dealId) ? dealId : undefined,
    });
    res.json({ notes });
  }));

  app.post('/api/crm/notes', asyncHandler(async (req, res) => {
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
  }));

  app.delete('/api/crm/notes/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/crm/exchange-rate', asyncHandler(async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const [commercial, market7km] = await Promise.all([
      getStoredCommercialRate(),
      getMarket7kmRate(forceRefresh),
    ]);
    const effectiveRate = commercial.rate ?? (market7km.available ? market7km.sell : null);
    const effectiveSource =
      commercial.rate !== null ? 'commercial' : market7km.available && market7km.sell ? 'market_fallback' : 'unset';
    res.json({
      commercial,
      effectiveRate,
      effectiveSource,
      market7km,
    });
  }));

  app.put('/api/crm/exchange-rate', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = commercialExchangeRatePutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректний курс валют' });
      return;
    }
    const crmUser = getCrmUser(req);
    const actor = crmUser?.assigneeLabel || crmUser?.name || 'CRM';
    const commercial = await saveCommercialRate(parsed.data.rate, actor);
    const market7km = await getMarket7kmRate(false);
    res.json({
      commercial,
      effectiveRate: commercial.rate,
      effectiveSource: 'commercial',
      market7km,
    });
  }));

  app.get('/api/crm/analytics', asyncHandler(async (_req, res) => {
    const [config, recentEvents] = await Promise.all([
      getPublicAnalyticsConfig(),
      listRecentAnalyticsEvents(35),
    ]);
    res.json({
      ...config,
      recentEvents,
    });
  }));

  app.put('/api/crm/analytics', requireRoles('admin'), asyncHandler(async (req, res) => {
    const parsed = analyticsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні налаштування аналітики' });
      return;
    }
    await saveAnalyticsSettings(parsed.data);
    res.json(parsed.data);
  }));

  app.get('/api/crm/errors', requireRoles('admin'), asyncHandler(async (_req, res) => {
    res.json({ errors: await listRecentClientErrorLogs(30) });
  }));

  app.delete('/api/crm/errors', requireRoles('admin'), asyncHandler(async (_req, res) => {
    await clearClientErrorLogs();
    res.json({ ok: true });
  }));

  app.get('/api/crm/social', requireRoles('admin', 'manager'), asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ socialLinks: await getSocialLinks() });
  }));

  app.put('/api/crm/social', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = socialPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні посилання соцмереж' });
      return;
    }
    await saveSocialLinks(parsed.data);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ socialLinks: await getSocialLinks() });
  }));

  app.get('/api/crm/auth/emails', requireRoles('admin'), asyncHandler(async (_req, res) => {
    res.json(await getEmailAllowlists());
  }));

  app.put('/api/crm/auth/emails', requireRoles('admin'), asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as { emails?: string };
    const parsed = parseAdminEmailList(String(body.emails ?? ''));
    await setSetting('admin_emails', parsed.join(', '));
    res.json(await getEmailAllowlists());
  }));

  app.get('/api/crm/auth/firebase-domains', requireRoles('admin'), asyncHandler(async (req, res) => {
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const host = typeof req.query.host === 'string' && req.query.host.trim() ? req.query.host : rawHeaderHost;
    const [adminState, activeForCurrentHost] = await Promise.all([
      getFirebaseDomainAdminState(),
      getRuntimeFirebaseWebConfig(host),
    ]);
    res.json({
      ...adminState,
      activeForCurrentHost,
    });
  }));

  app.put('/api/crm/auth/firebase-domains', requireRoles('admin'), asyncHandler(async (req, res) => {
    const parsed = firebaseDomainsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні правила доменів Firebase' });
      return;
    }
    await saveFirebaseDomainRules(parsed.data.rules);
    const rawHeaderHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const host = typeof req.query.host === 'string' && req.query.host.trim() ? req.query.host : rawHeaderHost;
    const [adminState, activeForCurrentHost] = await Promise.all([
      getFirebaseDomainAdminState(),
      getRuntimeFirebaseWebConfig(host),
    ]);
    res.json({
      ...adminState,
      activeForCurrentHost,
    });
  }));

  app.get('/api/crm/backup', requireRoles('admin'), asyncHandler(async (_req, res) => {
    const backup = await exportDatabaseBackupJson();
    const downloadName = `energocomfort-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.send(JSON.stringify(backup, null, 2));
  }));

  app.post('/api/crm/products', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = productCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані товару' });
      return;
    }
    const body = parsed.data;
    const created = await createProduct({
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
  }));

  app.patch('/api/crm/products/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = productPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля товару' });
      return;
    }
    const body = parsed.data;
    const updated = await updateProduct(req.params.id, {
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
  }));

  app.delete('/api/crm/products/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const ok = await deleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ ok: true });
  }));

  // CRM Projects / Case Studies API & Persistent Multipart Upload (S3 or disk fallback)
  app.post('/api/crm/upload', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    try {
      const { buffer, format } = await parseMultipartImageUpload(req);
      const uploaded = await uploadImageBuffer(buffer, { format });
      res.status(201).json({ url: uploaded.url });
    } catch (err) {
      if (err instanceof UploadValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  }));

  app.post('/api/crm/projects', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = projectCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні дані проєкту' });
      return;
    }
    const created = await createProjectCase(parsed.data);
    res.status(201).json({ project: created });
  }));

  app.patch('/api/crm/projects/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const parsed = projectPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некоректні поля проєкту' });
      return;
    }
    const updated = await updateProjectCase(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ project: updated });
  }));

  app.delete('/api/crm/projects/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
    const ok = await deleteProjectCase(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ ok: true });
  }));

  // Telegram Bot Test Ping & Webhook Setup
  app.post('/api/crm/telegram-test', requireRoles('admin', 'manager'), asyncHandler(async (_req, res) => {
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
  }));

  app.get('/api/crm/telegram-webhook', requireRoles('admin'), asyncHandler(async (_req, res) => {
    const info = await getTelegramWebhookInfo();
    res.json(info);
  }));

  app.post('/api/crm/telegram-webhook', requireRoles('admin'), asyncHandler(async (req, res) => {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      res.status(400).json({
        ok: false,
        error: 'Задайте TELEGRAM_WEBHOOK_SECRET у змінних оточення перед активацією Webhook',
      });
      return;
    }
    const body = (req.body ?? {}) as { webhookUrl?: string };
    const rawUrl = String(body.webhookUrl ?? '').trim();
    const targetUrl = rawUrl || `${getBaseUrl(req)}/api/telegram/webhook`;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'https:' || isPrivateOrLocalHostname(parsed.hostname)) {
        res.status(400).json({ ok: false, error: 'Telegram Webhook вимагає публічну HTTPS-адресу' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'Некоректний URL для Webhook' });
      return;
    }

    const result = await setTelegramWebhook(targetUrl, webhookSecret);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const info = await getTelegramWebhookInfo();
    res.json({ ok: true, webhookUrl: targetUrl, description: result.description, info });
  }));

  // Ready-to-use Telegram Bot Webhook (for Railway deployment)
  app.post('/api/telegram/webhook', asyncHandler(async (req, res) => {
    const authResult = verifyTelegramWebhookSecret(
      process.env.TELEGRAM_WEBHOOK_SECRET,
      String(req.headers['x-telegram-bot-api-secret-token'] || ''),
    );
    if (!authResult.ok) {
      res.status(authResult.status).json({ ok: false, error: authResult.error });
      return;
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
      const deal = await createDeal({
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
      const top = (await listProducts({ cat: 'kits' })).slice(0, 4);
      const list = top.map((p) => `• ${escapeHtml(p.title)} — <b>$${p.price}</b>`).join('\n');
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
        const deal = await createDeal({
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
  }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
  app.use('/api', (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const isUnavailable = /DATABASE_URL is not configured|ECONNREFUSED|ETIMEDOUT|Connection terminated/i.test(message);
    if (!isUnavailable) {
      logger.error({ requestId: getRequestId(req), path: req.path, err: message }, 'Unhandled API route error');
    }
    if (res.headersSent) return;
    res.status(isUnavailable ? 503 : 500).json({
      error: isUnavailable ? 'База даних тимчасово недоступна' : 'Внутрішня помилка сервера',
    });
  });
  if (isS3ProxyEnabled()) {
    app.get('/uploads/:filename', async (req, res) => {
      const object = await getUploadObject(String(req.params.filename));
      if (!object) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', object.contentType);
      if (object.contentLength !== undefined) res.setHeader('Content-Length', String(object.contentLength));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      object.body.on('error', () => res.destroy());
      object.body.pipe(res);
    });
  }
  app.use('/uploads', (_req, res) => {
    res.status(404).end();
  });

  // Static assets & Vite / Production serving
  if (!IS_PROD) {
    if (process.env.ENABLE_HMR !== 'true' && process.env.DISABLE_HMR === undefined) {
      process.env.DISABLE_HMR = 'true';
    }
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      plugins: disableHmr
        ? [
            {
              name: 'ec-disable-hmr-client-ws',
              enforce: 'post' as const,
              transform(code: string, id: string) {
                if (id.endsWith('vite/dist/client/client.mjs')) {
                  return code.replace(
                    /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
                    'const transport = normalizeModuleRunnerTransport({ connect() {}, async disconnect() {}, send() {} });',
                  );
                }
                return null;
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        hmr: !disableHmr,
        ws: disableHmr ? false : undefined,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        next();
        return;
      }
      try {
        const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        res.status(200).type('text/html; charset=utf-8').send(await buildRouteSeoHtml(transformed, req));
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const publicDir = path.resolve(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      app.use(
        express.static(publicDir, {
          maxAge: '7d',
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.json') || filePath.endsWith('sw.js')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );
    }
    const distHtmlPath = path.join(distDir, 'index.html');
    const distHtmlTemplate = fs.existsSync(distHtmlPath) ? fs.readFileSync(distHtmlPath, 'utf8') : '';
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=604800');
          }
        },
      }),
    );
    app.get('*', asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      if (distHtmlTemplate) {
        res.type('text/html; charset=utf-8').send(await buildRouteSeoHtml(distHtmlTemplate, req));
        return;
      }
      res.sendFile(distHtmlPath);
    }));
  }

  const server = app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT, env: IS_PROD ? 'production' : 'development' }, 'Energo Comfort server started');
    for (const warning of collectMissingProductionEnvWarnings()) {
      logger.warn({ warning }, 'Missing production security configuration');
    }
  });

  let shuttingDown = false;
  const gracefulShutdown = async (signal: 'SIGTERM' | 'SIGINT') => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal, closing HTTP server, Postgres pool, and Redis');

    const forceTimer = setTimeout(() => {
      logger.error({ signal }, 'Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    try {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Error closing HTTP server');
    }

    await Promise.allSettled([
      closeDatabasePool().catch((err) => {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Error closing Postgres pool');
      }),
      closeRedis().catch((err) => {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Error closing Redis client');
      }),
    ]);

    clearTimeout(forceTimer);
    logger.info({ signal }, 'Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
}

startServer().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Failed to start server');
  process.exit(1);
});
