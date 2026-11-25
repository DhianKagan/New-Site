import type { Product, ProductCategory, SocialLinksConfig } from '../src/types.ts';
import { COMPANY_INFO, FAQ_ITEMS } from '../src/data/siteContent.ts';
import { getProductAggregateRating } from '../src/lib/seoRating.ts';
import { escapeXml } from './sitemap.ts';

const ALLOWED_PRODUCT_CATS: readonly ProductCategory[] = ['kits', 'inverters', 'batteries', 'panels', 'parts'];

const CATEGORY_SEO_META: Record<ProductCategory, { title: string; description: string; breadcrumb: string }> = {
  kits: {
    title: 'Готові комплекти резервного живлення та СЕС — Energo Comfort',
    description:
      'Готові комплекти резервного живлення та сонячних електростанцій під ключ в Одесі: інвертори Deye та акумулятори LiFePO4.',
    breadcrumb: 'Готові комплекти',
  },
  inverters: {
    title: 'Гібридні та мережеві інвертори Deye, SolaX, Solis — Energo Comfort',
    description:
      'Гібридні й мережеві інвертори Deye, SolaX, Solis, Must зі складу в Одесі з офіційною гарантією та доставкою по Україні.',
    breadcrumb: 'Інвертори',
  },
  batteries: {
    title: 'Акумулятори LiFePO4 Deye, Dyness в Одесі — Energo Comfort',
    description:
      'Акумуляторні батареї LiFePO4 на 24V, 48V та високовольтні модулі для систем резервного живлення та СЕС в Одесі.',
    breadcrumb: 'Акумулятори LiFePO4',
  },
  panels: {
    title: 'Сонячні панелі Jinko, Trina, JA Solar в Одесі — Energo Comfort',
    description:
      'Монокристалічні сонячні панелі N-Type та Bifacial від Jinko Solar, Trina Solar, JA Solar, Tongwei в Одесі.',
    breadcrumb: 'Сонячні панелі',
  },
  parts: {
    title: 'Комплектуючі та захист AC/DC для СЕС — Energo Comfort',
    description:
      'Автоматика захисту AC/DC, ОПН, кабелі, кріплення, перемикачі та щити для сонячних електростанцій зі складу в Одесі.',
    breadcrumb: 'Комплектуючі та захист',
  },
};

export function resolveGoogleProductCategory(cat: ProductCategory | string): string {
  switch (cat) {
    case 'panels':
      return 'Hardware > Power & Electrical Supplies > Solar Panels';
    case 'inverters':
      return 'Hardware > Power & Electrical Supplies > Power Inverters';
    case 'batteries':
      return 'Electronics > Electronics Accessories > Power > Batteries';
    case 'kits':
      return 'Hardware > Power & Electrical Supplies > Solar Energy Kits';
    default:
      return 'Hardware > Power & Electrical Supplies';
  }
}

export function resolveProductTypeLabel(cat: ProductCategory | string): string {
  switch (cat) {
    case 'kits':
      return 'Готові комплекти СЕС та резервного живлення';
    case 'inverters':
      return 'Інвертори для СЕС';
    case 'batteries':
      return 'Акумулятори LiFePO4';
    case 'panels':
      return 'Сонячні панелі';
    default:
      return 'Комплектуючі та захист AC/DC';
  }
}

function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function getPriceValidUntilIso(): string {
  const nextYear = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return nextYear.toISOString().slice(0, 10);
}

export function buildStoreJsonLdEntity(baseUrl: string, socialLinks?: Partial<SocialLinksConfig>) {
  const sameAs = Object.values(socialLinks ?? {})
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => /^https?:\/\//i.test(v));

  return {
    '@type': 'Store',
    '@id': `${baseUrl}/#organization`,
    name: COMPANY_INFO.name,
    url: baseUrl,
    image: `${baseUrl}/assets/energocomfort/sto_110kw.jpg`,
    telephone: '+380507777172',
    email: COMPANY_INFO.email,
    priceRange: '$$',
    areaServed: ['Одеса', 'Одеська область', 'Україна'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'вул. Європейська 93',
      addressLocality: 'Одеса',
      addressRegion: 'Одеська область',
      addressCountry: 'UA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 46.4694,
      longitude: 30.7376,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function buildProductOfferJsonLd(options: {
  product: Product;
  canonicalUrl: string;
  baseUrl: string;
  usdUahRate: number | null;
}) {
  const { product, canonicalUrl, baseUrl, usdUahRate } = options;
  if (!(product.price > 0) || !usdUahRate) return undefined;

  return {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'UAH',
    price: Math.round(product.price * usdUahRate),
    priceValidUntil: getPriceValidUntilIso(),
    itemCondition: 'https://schema.org/NewCondition',
    availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    seller: { '@id': `${baseUrl}/#organization`, '@type': 'Organization', name: COMPANY_INFO.name },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'UA',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnShippingFees',
    },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'UA',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: product.inStock ? 1 : 5,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 3,
          unitCode: 'DAY',
        },
      },
    },
  };
}

export interface RouteSeoInput {
  template: string;
  baseUrl: string;
  rawPath: string;
  queryCat?: string;
  product?: Product | null;
  usdUahRate?: number | null;
  socialLinks?: Partial<SocialLinksConfig>;
}

export function renderRouteSeoHtml(input: RouteSeoInput): string {
  const baseUrl = input.baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const rawPath = (input.rawPath || '/').replace(/\/+$/, '') || '/';

  let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
  let description =
    'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
  let ogType = 'website';
  let ogImage = `${baseUrl}/assets/energocomfort/sto_110kw.jpg`;
  let robots = 'index, follow';
  let canonicalPath = rawPath;

  const storeEntity = buildStoreJsonLdEntity(baseUrl, input.socialLinks);
  let jsonLdGraph: unknown[] = [
    storeEntity,
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      name: COMPANY_INFO.name,
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/shop?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];

  let extraProductMeta = '';

  if (rawPath === '/shop') {
    const matchedCat = ALLOWED_PRODUCT_CATS.find((c) => c === (input.queryCat ?? '').trim());
    if (matchedCat) {
      title = CATEGORY_SEO_META[matchedCat].title;
      description = CATEGORY_SEO_META[matchedCat].description;
      canonicalPath = `/shop?cat=${encodeURIComponent(matchedCat)}`;
    } else {
      title = 'Каталог обладнання СЕС та резервного живлення — Energo Comfort';
      description =
        'Каталог інверторів Deye, SolaX, Solis, акумуляторів LiFePO4, сонячних панелей та готових комплектів в Одесі з доставкою по Україні.';
    }
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    jsonLdGraph = [
      storeEntity,
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonicalUrl,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Обладнання', item: `${baseUrl}/shop` },
          ...(matchedCat
            ? [{ '@type': 'ListItem', position: 3, name: CATEGORY_SEO_META[matchedCat].breadcrumb, item: canonicalUrl }]
            : []),
        ],
      },
    ];
  } else if (rawPath.startsWith('/shop/') && input.product) {
    const product = input.product;
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
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    const offer = buildProductOfferJsonLd({
      product,
      canonicalUrl,
      baseUrl,
      usdUahRate: input.usdUahRate ?? null,
    });

    jsonLdGraph = [
      storeEntity,
      {
        '@type': 'Product',
        name: product.title,
        sku: product.sku || product.id,
        mpn: product.sku || product.id,
        image: ogImage,
        description,
        category: resolveProductTypeLabel(product.cat),
        brand: { '@type': 'Brand', name: product.brand || COMPANY_INFO.name },
        aggregateRating: getProductAggregateRating(product),
        ...(offer ? { offers: offer } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Обладнання', item: `${baseUrl}/shop` },
          ...(ALLOWED_PRODUCT_CATS.includes(product.cat)
            ? [
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: CATEGORY_SEO_META[product.cat].breadcrumb,
                  item: `${baseUrl}/shop?cat=${encodeURIComponent(product.cat)}`,
                },
                { '@type': 'ListItem', position: 4, name: product.title, item: canonicalUrl },
              ]
            : [{ '@type': 'ListItem', position: 3, name: product.title, item: canonicalUrl }]),
        ],
      },
    ];

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
  } else if (rawPath === '/services') {
    title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
    description =
      'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
    const canonicalUrl = `${baseUrl}/services`;
    jsonLdGraph = [
      storeEntity,
      {
        '@type': 'Service',
        name: 'Монтаж СЕС та систем резервного живлення в Одесі',
        provider: { '@id': `${baseUrl}/#organization` },
        areaServed: 'Одеса та Одеська область',
        description,
        url: canonicalUrl,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Послуги монтажу та інжинірингу', item: canonicalUrl },
        ],
      },
    ];
  } else if (rawPath === '/projects') {
    title = 'Реалізовані об’єкти — Energo Comfort Одеса';
    description =
      'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
    const canonicalUrl = `${baseUrl}/projects`;
    jsonLdGraph = [
      storeEntity,
      { '@type': 'CollectionPage', name: title, description, url: canonicalUrl },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Реалізовані об’єкти', item: canonicalUrl },
        ],
      },
    ];
  } else if (rawPath === '/contacts') {
    title = 'Контакти та умови співпраці — Energo Comfort Одеса';
    description =
      'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
    const canonicalUrl = `${baseUrl}/contacts`;
    jsonLdGraph = [
      storeEntity,
      { '@type': 'ContactPage', name: title, description, url: canonicalUrl },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Контакти', item: canonicalUrl },
        ],
      },
    ];
  } else if (rawPath === '/payment-delivery') {
    title = 'Оплата і доставка — Energo Comfort';
    description =
      'Умови оплати за комерційним курсом, самовивіз в Одесі та доставка обладнання СЕС по Україні.';
    const canonicalUrl = `${baseUrl}/payment-delivery`;
    jsonLdGraph = [
      storeEntity,
      { '@type': 'WebPage', name: title, description, url: canonicalUrl },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Оплата і доставка', item: canonicalUrl },
        ],
      },
    ];
  } else if (rawPath === '/public-offer') {
    title = 'Публічна оферта (проєкт) — Energo Comfort';
    description = 'Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.';
    const canonicalUrl = `${baseUrl}/public-offer`;
    jsonLdGraph = [
      storeEntity,
      { '@type': 'WebPage', name: title, description, url: canonicalUrl },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Публічна оферта', item: canonicalUrl },
        ],
      },
    ];
  } else if (rawPath === '/crm' || rawPath === '/login' || rawPath === '/account') {
    title =
      rawPath === '/crm'
        ? 'CRM — Energo Comfort'
        : rawPath === '/login'
          ? 'Вхід та реєстрація — Energo Comfort'
          : 'Особистий кабінет — Energo Comfort';
    robots = 'noindex, nofollow';
    jsonLdGraph = [];
  }

  const canonicalUrl = `${baseUrl}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const jsonLdPayload = safeJsonLdString({
    '@context': 'https://schema.org',
    '@graph': jsonLdGraph,
  });

  let html = input.template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeXml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${escapeXml(robots)}" />`,
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="${escapeXml(ogType)}" />${extraProductMeta}`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeXml(title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${escapeXml(canonicalUrl)}" />`,
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeXml(ogImage)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeXml(title)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeXml(description)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeXml(ogImage)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${escapeXml(canonicalUrl)}" />`,
    );

  if (jsonLdGraph.length > 0) {
    html = html.replace(
      /<script\s+type="application\/ld\+json"\s+id="ec-jsonld">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json" id="ec-jsonld">${jsonLdPayload}</script>`,
    );
  } else {
    html = html.replace(/<script\s+type="application\/ld\+json"\s+id="ec-jsonld">[\s\S]*?<\/script>/i, '');
  }

  return html;
}
