import type { Product, ProductCategory, SocialLinksConfig } from '../src/types.ts';
import { COMPANY_INFO } from '../src/data/siteContent.ts';
import { isValidProductCategory, type BreadcrumbView } from '../src/lib/breadcrumbs.ts';
import {
  buildPageJsonLdDocument,
  buildProductOfferJsonLd,
  buildStoreJsonLdEntity,
  CATEGORY_SEO_META,
  resolveGoogleProductCategory,
  resolveProductTypeLabel,
} from '../src/lib/seoSchema.ts';
import { escapeXml } from './sitemap.ts';

export {
  buildProductOfferJsonLd,
  buildStoreJsonLdEntity,
  resolveGoogleProductCategory,
  resolveProductTypeLabel,
};

function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function extractCategorySlugFromShopPath(rawPath: string): ProductCategory | null {
  if (rawPath.startsWith('/shop/category/')) {
    const slug = decodeURIComponent(rawPath.slice('/shop/category/'.length).split('/')[0] || '').trim();
    return isValidProductCategory(slug) ? slug : null;
  }
  if (rawPath.startsWith('/shop/')) {
    const slug = decodeURIComponent(rawPath.slice('/shop/'.length).split('/')[0] || '').trim();
    return isValidProductCategory(slug) ? slug : null;
  }
  return null;
}

export interface RouteSeoInput {
  template: string;
  baseUrl: string;
  rawPath: string;
  queryCat?: string;
  querySearch?: string;
  product?: Product | null;
  categoryProducts?: Product[];
  usdUahRate?: number | null;
  socialLinks?: Partial<SocialLinksConfig>;
}

export function renderRouteSeoHtml(input: RouteSeoInput): string {
  const baseUrl = input.baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const rawPath = (input.rawPath || '/').replace(/\/+$/, '') || '/';

  let view: BreadcrumbView = 'home';
  let shopCat: ProductCategory | 'all' = 'all';
  let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
  let description =
    'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
  let ogType = 'website';
  let ogImage = `${baseUrl}/assets/energocomfort/sto_110kw.jpg`;
  let robots = 'index, follow';
  let canonicalPath = rawPath;
  let extraProductMeta = '';

  const slugCategory = !input.product ? extractCategorySlugFromShopPath(rawPath) : null;

  if (rawPath.startsWith('/shop/') && input.product) {
    view = 'shop';
    const product = input.product;
    shopCat = isValidProductCategory(product.cat) ? product.cat : 'all';
    const uahPrice = product.price > 0 && input.usdUahRate ? Math.round(product.price * input.usdUahRate) : null;
    const shortTitle = product.title.length > 48 ? `${product.title.slice(0, 45).trimEnd()}…` : product.title;
    title = `${shortTitle} — Energo Comfort`;
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

    const availabilityOg = product.inStock ? 'in stock' : 'available for order';
    const metaLines = [
      `<meta property="product:brand" content="${escapeXml(product.brand || COMPANY_INFO.name)}" />`,
      `<meta property="product:availability" content="${availabilityOg}" />`,
      `<meta property="product:condition" content="new" />`,
      `<meta property="product:retailer_item_id" content="${escapeXml(product.sku || product.id)}" />`,
    ];
    if (uahPrice) {
      metaLines.push(`<meta property="product:price:amount" content="${uahPrice}" />`);
      metaLines.push('<meta property="product:price:currency" content="UAH" />');
    } else if (product.price > 0) {
      metaLines.push(`<meta property="product:price:amount" content="${product.price}" />`);
      metaLines.push('<meta property="product:price:currency" content="USD" />');
    }
    extraProductMeta = `\n    ${metaLines.join('\n    ')}`;
  } else if (rawPath === '/shop' || rawPath.startsWith('/shop/')) {
    view = 'shop';
    const rawCat = (input.queryCat ?? '').trim();
    const matchedCat = isValidProductCategory(rawCat) ? rawCat : slugCategory;
    if (matchedCat) {
      shopCat = matchedCat;
      title = CATEGORY_SEO_META[matchedCat].title;
      description = CATEGORY_SEO_META[matchedCat].description;
      canonicalPath = `/shop?cat=${encodeURIComponent(matchedCat)}`;
    } else {
      title = 'Каталог обладнання СЕС та резервного живлення — Energo Comfort';
      description =
        'Каталог інверторів Deye, SolaX, Solis, акумуляторів LiFePO4, сонячних панелей та готових комплектів в Одесі з доставкою по Україні.';
      canonicalPath = '/shop';
    }
  } else if (rawPath === '/services') {
    view = 'services';
    title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
    description =
      'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
    canonicalPath = '/services';
  } else if (rawPath === '/projects') {
    view = 'projects';
    title = 'Реалізовані об’єкти — Energo Comfort Одеса';
    description =
      'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
    canonicalPath = '/projects';
  } else if (rawPath === '/contacts') {
    view = 'contacts';
    title = 'Контакти та умови співпраці — Energo Comfort Одеса';
    description =
      'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
    canonicalPath = '/contacts';
  } else if (rawPath === '/payment-delivery') {
    view = 'payment-delivery';
    title = 'Оплата і доставка — Energo Comfort';
    description =
      'Умови оплати за комерційним курсом, самовивіз в Одесі та доставка обладнання СЕС по Україні.';
    canonicalPath = '/payment-delivery';
  } else if (rawPath === '/public-offer') {
    view = 'offer';
    title = 'Публічна оферта (проєкт) — Energo Comfort';
    description = 'Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.';
    canonicalPath = '/public-offer';
  } else if (rawPath === '/privacy-policy') {
    view = 'privacy';
    title = 'Політика конфіденційності — Energo Comfort';
    description =
      'Порядок збору, зберігання та захисту персональних даних клієнтів інтернет-магазину Energo Comfort.';
    canonicalPath = '/privacy-policy';
  } else if (rawPath === '/terms-of-service') {
    view = 'terms';
    title = 'Умови використання сайту — Energo Comfort';
    description =
      'Правила користування інтернет-магазином, інформацією про ціни, гарантію та замовлення обладнання Energo Comfort.';
    canonicalPath = '/terms-of-service';
  } else if (rawPath === '/crm' || rawPath === '/login' || rawPath === '/account') {
    view = rawPath === '/crm' ? 'crm' : rawPath === '/login' ? 'login' : 'account';
    title =
      rawPath === '/crm'
        ? 'CRM — Energo Comfort'
        : rawPath === '/login'
          ? 'Вхід та реєстрація — Energo Comfort'
          : 'Особистий кабінет — Energo Comfort';
    robots = 'noindex, nofollow';
  }

  const canonicalUrl = `${baseUrl}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const jsonLdDoc = buildPageJsonLdDocument({
    view,
    baseUrl,
    canonicalUrl,
    title,
    description,
    shopCat,
    searchQuery: input.querySearch,
    selectedProduct: input.product ?? null,
    categoryProducts: input.categoryProducts,
    productImage: ogImage,
    usdUahRate: input.usdUahRate ?? null,
    socialLinks: input.socialLinks,
  });

  let html = input.template
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeXml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta name="description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta name="robots" content="${escapeXml(robots)}" />`,
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:type" content="${escapeXml(ogType)}" />${extraProductMeta}`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:title" content="${escapeXml(title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:url" content="${escapeXml(canonicalUrl)}" />`,
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:image" content="${escapeXml(ogImage)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta name="twitter:title" content="${escapeXml(title)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta name="twitter:description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta name="twitter:image" content="${escapeXml(ogImage)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      () => `<link rel="canonical" href="${escapeXml(canonicalUrl)}" />`,
    );

  if (jsonLdDoc) {
    const jsonLdPayload = safeJsonLdString(jsonLdDoc);
    html = html.replace(
      /<script\s+type="application\/ld\+json"\s+id="ec-jsonld">[\s\S]*?<\/script>/i,
      () => `<script type="application/ld+json" id="ec-jsonld">${jsonLdPayload}</script>`,
    );
  } else {
    html = html.replace(/<script\s+type="application\/ld\+json"\s+id="ec-jsonld">[\s\S]*?<\/script>/i, () => '');
  }

  return html;
}
