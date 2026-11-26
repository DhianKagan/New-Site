import { COMPANY_INFO, FAQ_ITEMS } from '../data/siteContent.ts';
import type { Product, ProductCategory, ProjectCase, SocialLinksConfig } from '../types.ts';
import {
  buildBreadcrumbListJsonLd,
  buildBreadcrumbTrail,
  type BreadcrumbItem,
  type BreadcrumbView,
} from './breadcrumbs.ts';
import { getProductAggregateRating } from './seoRating.ts';

export const CATEGORY_SEO_META: Record<ProductCategory, { title: string; description: string; breadcrumb: string }> = {
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

function getPriceValidUntilIso(): string {
  const nextQuarter = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return nextQuarter.toISOString().slice(0, 10);
}

export function buildStoreJsonLdEntity(baseUrl: string, socialLinks?: Partial<SocialLinksConfig>) {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const sameAs = Object.values(socialLinks ?? {})
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => /^https?:\/\//i.test(v));

  return {
    '@type': 'Store',
    '@id': `${cleanBase}/#organization`,
    name: COMPANY_INFO.name,
    url: cleanBase,
    image: `${cleanBase}/assets/energocomfort/sto_110kw.jpg`,
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

  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  return {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'UAH',
    price: Math.round(product.price * usdUahRate),
    priceValidUntil: getPriceValidUntilIso(),
    itemCondition: 'https://schema.org/NewCondition',
    availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    seller: { '@id': `${cleanBase}/#organization`, '@type': 'Organization', name: COMPANY_INFO.name },
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

export function buildCollectionItemListJsonLd(
  products: Product[],
  baseUrl: string,
  maxItems = 20,
) {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const subset = products.slice(0, maxItems);
  return {
    '@type': 'ItemList',
    numberOfItems: products.length,
    itemListElement: subset.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.title,
      url: `${cleanBase}/shop/${encodeURIComponent(product.id)}`,
    })),
  };
}

export interface RouteJsonLdInput {
  view: BreadcrumbView;
  baseUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  shopCat?: ProductCategory | 'all';
  searchQuery?: string;
  selectedProduct?: Product | null;
  selectedCase?: ProjectCase | null;
  categoryProducts?: Product[];
  productImage?: string;
  usdUahRate?: number | null;
  socialLinks?: Partial<SocialLinksConfig>;
  isRussian?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
}

export function buildRouteJsonLdGraph(input: RouteJsonLdInput): unknown[] {
  if (input.view === 'crm' || input.view === 'login' || input.view === 'account') {
    return [];
  }

  const cleanBase = input.baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const storeEntity = buildStoreJsonLdEntity(cleanBase, input.socialLinks);

  const trail =
    input.breadcrumbItems ??
    buildBreadcrumbTrail({
      view: input.view,
      shopCat: input.shopCat,
      searchQuery: input.searchQuery,
      selectedProduct: input.selectedProduct,
      selectedCase: input.selectedCase,
      isRussian: input.isRussian,
    });

  const breadcrumbList = buildBreadcrumbListJsonLd(trail, cleanBase, {
    idUrl: input.canonicalUrl,
  });
  const breadcrumbRef = { '@id': breadcrumbList['@id'] };

  if (input.selectedProduct) {
    const product = input.selectedProduct;
    const productImg =
      input.productImage ||
      (product.img
        ? product.img.startsWith('http')
          ? product.img
          : `${cleanBase}${product.img.startsWith('/') ? '' : '/'}${product.img}`
        : `${cleanBase}/assets/energocomfort/sto_110kw.jpg`);
    const productIdUri = `${input.canonicalUrl}#product`;
    const offer = buildProductOfferJsonLd({
      product,
      canonicalUrl: input.canonicalUrl,
      baseUrl: cleanBase,
      usdUahRate: input.usdUahRate ?? null,
    });

    return [
      storeEntity,
      {
        '@type': 'ItemPage',
        '@id': `${input.canonicalUrl}#webpage`,
        url: input.canonicalUrl,
        name: input.title,
        description: input.description,
        isPartOf: { '@id': `${cleanBase}/#website` },
        breadcrumb: breadcrumbRef,
        mainEntity: { '@id': productIdUri },
      },
      {
        '@type': 'Product',
        '@id': productIdUri,
        url: input.canonicalUrl,
        name: product.title,
        sku: product.sku || product.id,
        mpn: product.sku || product.id,
        image: productImg,
        description: input.description,
        category: resolveProductTypeLabel(product.cat),
        brand: { '@type': 'Brand', name: product.brand || COMPANY_INFO.name },
        aggregateRating: getProductAggregateRating(product),
        ...(offer ? { offers: offer } : {}),
      },
      breadcrumbList,
    ];
  }

  if (input.view === 'home') {
    return [
      storeEntity,
      {
        '@type': 'WebSite',
        '@id': `${cleanBase}/#website`,
        name: COMPANY_INFO.name,
        url: cleanBase,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${cleanBase}/shop?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${cleanBase}/#webpage`,
        url: `${cleanBase}/`,
        name: input.title,
        description: input.description,
        isPartOf: { '@id': `${cleanBase}/#website` },
        breadcrumb: breadcrumbRef,
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      breadcrumbList,
    ];
  }

  if (input.view === 'shop') {
    const itemList =
      input.categoryProducts && input.categoryProducts.length > 0
        ? buildCollectionItemListJsonLd(input.categoryProducts, cleanBase)
        : undefined;

    return [
      storeEntity,
      {
        '@type': 'CollectionPage',
        '@id': `${input.canonicalUrl}#webpage`,
        name: input.title,
        description: input.description,
        url: input.canonicalUrl,
        isPartOf: { '@id': `${cleanBase}/#website` },
        breadcrumb: breadcrumbRef,
        ...(itemList ? { mainEntity: itemList } : {}),
      },
      breadcrumbList,
    ];
  }

  if (input.view === 'services') {
    return [
      storeEntity,
      {
        '@type': 'Service',
        name: 'Монтаж СЕС та систем резервного живлення в Одесі',
        provider: { '@id': `${cleanBase}/#organization` },
        areaServed: 'Одеса та Одеська область',
        description: input.description,
        url: input.canonicalUrl,
      },
      {
        '@type': 'WebPage',
        '@id': `${input.canonicalUrl}#webpage`,
        url: input.canonicalUrl,
        name: input.title,
        description: input.description,
        isPartOf: { '@id': `${cleanBase}/#website` },
        breadcrumb: breadcrumbRef,
      },
      breadcrumbList,
    ];
  }

  const pageTypeMap: Partial<Record<BreadcrumbView, string>> = {
    projects: 'CollectionPage',
    contacts: 'ContactPage',
    'payment-delivery': 'WebPage',
    offer: 'WebPage',
    privacy: 'WebPage',
    terms: 'WebPage',
  };

  return [
    storeEntity,
    {
      '@type': pageTypeMap[input.view] ?? 'WebPage',
      '@id': `${input.canonicalUrl}#webpage`,
      name: input.title,
      description: input.description,
      url: input.canonicalUrl,
      isPartOf: { '@id': `${cleanBase}/#website` },
      breadcrumb: breadcrumbRef,
    },
    breadcrumbList,
  ];
}

export function buildPageJsonLdDocument(input: RouteJsonLdInput) {
  const graph = buildRouteJsonLdGraph(input);
  if (graph.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export interface MetaTagEntry {
  attr: 'name' | 'property';
  key: string;
  content: string | null | undefined;
}

export interface DynamicSeoMetaInput {
  view: BreadcrumbView;
  baseUrl: string;
  canonicalPath?: string;
  shopCat?: ProductCategory | 'all';
  searchQuery?: string;
  selectedProduct?: Product | null;
  selectedCase?: ProjectCase | null;
  categoryProducts?: Product[];
  catalogCount?: number;
  usdUahRate?: number | null;
  isRussian?: boolean;
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  robots?: string;
  extraMeta?: MetaTagEntry[] | Record<string, string | null | undefined>;
}

export interface ResolvedSeoMeta {
  title: string;
  description: string;
  keywords: string;
  robots: string;
  canonicalUrl: string;
  ogType: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  ogLocale: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  metaTags: MetaTagEntry[];
}

export const CATEGORY_LONG_TAIL_KEYWORDS: Record<
  ProductCategory | 'all',
  { uk: string[]; ru: string[] }
> = {
  all: {
    uk: [
      'сонячні електростанції під ключ Одеса',
      'системи резервного живлення для дому та квартири',
      'гібридний інвертор Deye купити Україна',
      'акумулятор LiFePO4 48V 100Ah ціна',
      'сонячні панелі N-Type Bifacial купити Одеса',
      'автономне енергозабезпечення бізнесу СЕС',
    ],
    ru: [
      'солнечные электростанции под ключ Одесса',
      'системы резервного питания для дома и квартиры',
      'гибридный инвертор Deye купить Украина',
      'аккумулятор LiFePO4 48V 100Ah цена',
      'солнечные панели N-Type Bifacial купить Одесса',
      'автономное энергоснабжение бизнеса СЭС',
    ],
  },
  kits: {
    uk: [
      'готовий комплект резервного живлення під ключ Одеса',
      'комплект інвертор і акумулятор LiFePO4 для квартири',
      'гібридна сонячна електростанція 5 кВт 10 кВт під ключ',
      'резервне живлення для будинку без шуму генератора',
      'система безперебійного живлення для газового котла та холодильника',
    ],
    ru: [
      'готовый комплект резервного питания под ключ Одесса',
      'комплект инвертор и аккумулятор LiFePO4 для квартиры',
      'гибридная солнечная электростанция 5 кВт 10 кВт под ключ',
      'резервное питание для дома без шума генератора',
      'система бесперебойного питания для газового котла и холодильника',
    ],
  },
  inverters: {
    uk: [
      'гібридний інвертор Deye 6 кВт 8 кВт 10 кВт 12 кВт купити',
      'мережевий інвертор Solis Huawei SolaX для СЕС ціна',
      'однофазний та трифазний гібридний інвертор 48В HV',
      'інвертор з двома MPPT трекерами та підтримкою генератора',
      'купити інвертор для сонячних батарей Одеса',
    ],
    ru: [
      'гибридный инвертор Deye 6 кВт 8 кВт 10 кВт 12 кВт купить',
      'сетевой инвертор Solis Huawei SolaX для СЭС цена',
      'однофазный и трёхфазный гибридный инвертор 48В HV',
      'инвертор с двумя MPPT трекерами и поддержкой генератора',
      'купить инвертор для солнечных батарей Одесса',
    ],
  },
  batteries: {
    uk: [
      'акумулятор LiFePO4 51.2V 100Ah 5 кВт·год купити Одеса',
      'акумуляторна батарея Deye Dyness SolaX Pylontech 6000 циклів',
      'високовольтна батарея для гібридного інвертора HV BMS',
      'літій-залізо-фосфатний акумулятор для квартири та дому',
      'акумулятор для сонячної електростанції з підігрівом',
    ],
    ru: [
      'аккумулятор LiFePO4 51.2V 100Ah 5 кВт·ч купить Одесса',
      'аккумуляторная батарея Deye Dyness SolaX Pylontech 6000 циклов',
      'высоковольтная батарея для гибридного инвертора HV BMS',
      'литий-железо-фосфатный аккумулятор для квартиры и дома',
      'аккумулятор для солнечной электростанции с подогревом',
    ],
  },
  panels: {
    uk: [
      'сонячні панелі Trina Solar Jinko JA Solar N-Type Bifacial',
      'двосторонні сонячні батареї 450W 585W 620W купити Одеса',
      'фотоелектричні модулі Tier-1 для даху будинку та бізнесу',
      'сонячні панелі ціна за ват зі складу в Одесі',
    ],
    ru: [
      'солнечные панели Trina Solar Jinko JA Solar N-Type Bifacial',
      'двусторонние солнечные батареи 450W 585W 620W купить Одесса',
      'фотоэлектрические модули Tier-1 для крыши дома и бизнеса',
      'солнечные панели цена за ватт со склада в Одессе',
    ],
  },
  parts: {
    uk: [
      'автоматичний вимикач DC для сонячних панелей купити',
      'обмежувач перенапруги ОПН DC AC щит захисту СЕС',
      'алюмінієвий профіль та кріплення сонячних панелей на дах',
      'перемикач АВР та кабель сонячний 6 мм2 MC4 Одеса',
    ],
    ru: [
      'автоматический выключатель DC для солнечных панелей купить',
      'ограничитель перенапряжения УЗИП DC AC щит защиты СЭС',
      'алюминиевый профиль и крепления солнечных панелей на крышу',
      'переключатель АВР и солнечный кабель 6 мм2 MC4 Одесса',
    ],
  },
};

function dedupeKeywords(keywords: string[], maxCount = 16): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(clean);
    if (out.length >= maxCount) break;
  }
  return out;
}

function formatPriceText(priceUsd: number, usdUahRate?: number | null, isRussian = false): string {
  if (!(priceUsd > 0)) {
    return isRussian ? 'По запросу' : 'За запитом';
  }
  if (usdUahRate && usdUahRate > 0) {
    return `${Math.round(priceUsd * usdUahRate).toLocaleString('uk-UA')} грн`;
  }
  return `$${priceUsd.toLocaleString('uk-UA')}`;
}

export function buildLongTailSolarKeywords(input: {
  view: BreadcrumbView;
  shopCat?: ProductCategory | 'all';
  searchQuery?: string;
  selectedProduct?: Product | null;
  selectedCase?: ProjectCase | null;
  categoryProducts?: Product[];
  isRussian?: boolean;
  extraKeywords?: string[];
}): string[] {
  const isRu = Boolean(input.isRussian);
  const loc = isRu ? 'ru' : 'uk';
  const collected: string[] = [...(input.extraKeywords ?? [])];

  if (input.selectedProduct) {
    const prod = input.selectedProduct;
    const title = (isRu && prod.titleRu ? prod.titleRu : prod.title).trim();
    const specs = (isRu && prod.specsRu ? prod.specsRu : prod.specs) ?? [];
    const catBase = CATEGORY_LONG_TAIL_KEYWORDS[prod.cat]?.[loc] ?? CATEGORY_LONG_TAIL_KEYWORDS.all[loc];

    collected.push(
      isRu ? `${title} купить Одесса` : `${title} купити Одеса`,
      isRu ? `${title} цена и характеристики` : `${title} ціна та характеристики`,
      prod.brand ? `${prod.brand} ${resolveProductTypeLabel(prod.cat)}` : '',
      prod.sku ? `${prod.brand || 'Energo Comfort'} ${prod.sku}` : '',
      ...specs.slice(0, 3).map(([k, v]) => `${prod.brand || ''} ${k} ${v}`.trim()),
      ...catBase,
    );
    return dedupeKeywords(collected);
  }

  if (input.view === 'shop') {
    const catKey = input.shopCat ?? 'all';
    const trimmedQuery = input.searchQuery?.trim() ?? '';
    if (trimmedQuery) {
      collected.push(
        isRu ? `${trimmedQuery} купить Одесса` : `${trimmedQuery} купити Одеса`,
        isRu ? `${trimmedQuery} цена Украина` : `${trimmedQuery} ціна Україна`,
      );
    }
    const topBrands = Array.from(
      new Set((input.categoryProducts ?? []).map((p) => p.brand.trim()).filter(Boolean)),
    ).slice(0, 5);
    if (topBrands.length > 0) {
      collected.push(
        isRu
          ? `${topBrands.join(', ')} солнечное оборудование Одесса`
          : `${topBrands.join(', ')} сонячне обладнання Одеса`,
      );
    }
    collected.push(...(CATEGORY_LONG_TAIL_KEYWORDS[catKey]?.[loc] ?? CATEGORY_LONG_TAIL_KEYWORDS.all[loc]));
    return dedupeKeywords(collected);
  }

  if (input.view === 'services') {
    collected.push(
      ...(isRu
        ? [
            'монтаж солнечных электростанций под ключ Одесса',
            'установка систем резервного питания квартира дом',
            'энергоаудит и проектирование СЭС для бизнеса',
            'подключение зелёного тарифа и активный потребитель',
          ]
        : [
            'монтаж сонячних електростанцій під ключ Одеса',
            'встановлення систем резервного живлення квартира будинок',
            'енергоаудит та проєктування СЕС для бізнесу',
            'оформлення зеленого тарифу та активний споживач',
          ]),
    );
  } else if (input.view === 'projects') {
    if (input.selectedCase) {
      const caseTitle = isRu && input.selectedCase.titleRu ? input.selectedCase.titleRu : input.selectedCase.title;
      const caseSpecs = isRu && input.selectedCase.specsRu ? input.selectedCase.specsRu : input.selectedCase.specs;
      collected.push(caseTitle, caseSpecs);
    }
    collected.push(
      ...(isRu
        ? [
            'реализованные проекты солнечных станций Одесса',
            'СЭС для СТО завода отеля базы отдыха 30-110 кВт',
            'гибридная СЭС для частного дома 6-15 кВт кейсы',
          ]
        : [
            'реалізовані проєкти сонячних станцій Одеса',
            'СЕС для СТО заводу готелю бази відпочинку 30-110 кВт',
            'гібридна СЕС для приватного будинку 6-15 кВт кейси',
          ]),
    );
  } else {
    collected.push(...CATEGORY_LONG_TAIL_KEYWORDS.all[loc]);
  }

  return dedupeKeywords(collected);
}

function normalizeExtraMetaEntries(
  extraMeta?: MetaTagEntry[] | Record<string, string | null | undefined>,
): MetaTagEntry[] {
  if (!extraMeta) return [];
  if (Array.isArray(extraMeta)) return extraMeta;
  return Object.entries(extraMeta).map(([key, content]) => ({
    attr: key.startsWith('og:') || key.startsWith('product:') || key.startsWith('article:') ? 'property' : 'name',
    key,
    content,
  }));
}

export function buildDynamicSeoMeta(input: DynamicSeoMetaInput): ResolvedSeoMeta {
  const cleanBase = input.baseUrl.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const isRu = Boolean(input.isRussian);
  const isPrivateView = input.view === 'crm' || input.view === 'login' || input.view === 'account';

  let title = 'Energo Comfort — СЕС та резервне живлення в Одесі';
  let description =
    'Сонячні електростанції та резервне живлення в Одесі: інвертори Deye, SolaX, Solis, АКБ LiFePO4, панелі та монтаж під ключ із гарантією. Замовте розрахунок!';
  let ogImage = `${cleanBase}/assets/energocomfort/sto_110kw.jpg`;
  let ogImageAlt = isRu
    ? 'Солнечная электростанция Energo Comfort в Одессе'
    : 'Сонячна електростанція Energo Comfort в Одесі';
  let ogType = 'website';
  let canonicalPath = input.canonicalPath;

  if (input.selectedProduct) {
    const prod = input.selectedProduct;
    const localizedTitle = isRu && prod.titleRu ? prod.titleRu : prod.title;
    const priceText = formatPriceText(prod.price, input.usdUahRate, isRu);
    const maxTitleLen = 46;
    const shortProdTitle =
      localizedTitle.length > maxTitleLen
        ? `${localizedTitle.slice(0, maxTitleLen - 1).trimEnd()}…`
        : localizedTitle;
    title = `${shortProdTitle} (${priceText}) — Energo Comfort`;
    const prodDesc = (isRu && prod.descriptionRu ? prod.descriptionRu : prod.description).trim();
    const specSummary = (isRu && prod.specsRu ? prod.specsRu : prod.specs)
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    description = (
      prodDesc ||
      `${localizedTitle} (${prod.brand})${specSummary ? ` — ${specSummary}` : ''}. ${prod.statusLabel}. Доставка зі складу в Одесі, гарантія та професійний монтаж.`
    ).slice(0, 158);
    if (prod.img) {
      ogImage = prod.img.startsWith('http')
        ? prod.img
        : `${cleanBase}${prod.img.startsWith('/') ? '' : '/'}${prod.img}`;
    }
    ogImageAlt = localizedTitle;
    ogType = 'product';
    canonicalPath = canonicalPath ?? `/shop/${encodeURIComponent(prod.id)}`;
  } else if (input.view === 'shop') {
    const catKey = input.shopCat ?? 'all';
    const trimmedQuery = input.searchQuery?.trim() ?? '';
    if (trimmedQuery) {
      title = `${trimmedQuery} — ${isRu ? 'купить в Одессе | Каталог Energo Comfort' : 'купити в Одесі | Каталог Energo Comfort'}`;
      description = isRu
        ? `Подбор и продажа ${trimmedQuery} со склада в Одессе: актуальная цена, характеристики, наличие, доставка по Украине и монтаж под ключ Energo Comfort.`
        : `Підбір та продаж ${trimmedQuery} зі складу в Одесі: актуальна ціна, характеристики, наявність, доставка по Україні та монтаж під ключ Energo Comfort.`;
    } else if (catKey !== 'all') {
      title = CATEGORY_SEO_META[catKey].title;
      description = CATEGORY_SEO_META[catKey].description;
    } else {
      const countLabel = input.catalogCount && input.catalogCount > 0 ? input.catalogCount : 250;
      title = 'Каталог обладнання СЕС та резервного живлення — Energo Comfort';
      description = `Каталог із ${countLabel} позицій для автономного живлення та СЕС зі складу в Одесі: Deye, SolaX, Solis, Dyness, Jinko. Замовляйте з доставкою!`;
    }
    canonicalPath =
      canonicalPath ?? (catKey !== 'all' ? `/shop?cat=${encodeURIComponent(catKey)}` : '/shop');
  } else if (input.view === 'services') {
    title = 'Послуги монтажу СЕС та інжинірингу — Energo Comfort';
    description =
      'Професійний монтаж сонячних електростанцій, систем резервного живлення та енергоаудит для дому і бізнесу в Одесі та області з гарантією.';
    canonicalPath = canonicalPath ?? '/services';
  } else if (input.view === 'projects') {
    title = 'Реалізовані проєкти — Energo Comfort Одеса';
    description =
      'Реальні кейси СЕС і резервного живлення 6–110 кВт для бізнесу та приватних будинків в Одесі й області. Дивіться характеристики та фото об’єктів.';
    canonicalPath = canonicalPath ?? '/projects';
  } else if (input.view === 'contacts') {
    title = 'Контакти та умови співпраці — Energo Comfort Одеса';
    description =
      'Офіс та склад Energo Comfort: м. Одеса, вул. Європейська 93. Телефони +38 (050) 777-71-72, +38 (098) 152-32-61. Графік Пн–Сб 09:00–18:00.';
    canonicalPath = canonicalPath ?? '/contacts';
  } else if (input.view === 'payment-delivery') {
    title = 'Оплата і доставка обладнання — Energo Comfort Одеса';
    description =
      'Способи оплати (ФОП/ТОВ з ПДВ, готівка, переказ), самовивіз зі складу в Одесі на вул. Європейська 93 та доставка по Україні Новою Поштою.';
    canonicalPath = canonicalPath ?? '/payment-delivery';
  } else if (input.view === 'offer') {
    title = 'Публічна оферта та гарантія — Energo Comfort';
    description =
      'Умови публічного договору купівлі-продажу, гарантійного обслуговування та повернення обладнання в інтернет-магазині Energo Comfort.';
    canonicalPath = canonicalPath ?? '/public-offer';
  } else if (input.view === 'privacy') {
    title = 'Політика конфіденційності — Energo Comfort';
    description =
      'Порядок збору, обробки та захисту персональних даних користувачів інтернет-магазину Energo Comfort.';
    canonicalPath = canonicalPath ?? '/privacy-policy';
  } else if (input.view === 'terms') {
    title = 'Умови використання сервісу — Energo Comfort';
    description =
      'Правила користування сайтом, онлайн-калькуляторами, каталогом та оформлення замовлень в Energo Comfort.';
    canonicalPath = canonicalPath ?? '/terms-of-service';
  } else if (input.view === 'login') {
    title = 'Вхід та реєстрація — Energo Comfort';
    canonicalPath = canonicalPath ?? '/login';
  } else if (input.view === 'account') {
    title = 'Особистий кабінет — Energo Comfort';
    canonicalPath = canonicalPath ?? '/account';
  } else if (input.view === 'crm') {
    title = 'CRM — Energo Comfort';
    canonicalPath = canonicalPath ?? '/crm';
  } else {
    canonicalPath = canonicalPath ?? '/';
  }

  if (input.title) title = input.title;
  if (input.description) description = input.description;
  if (input.ogImage) ogImage = input.ogImage;
  if (input.ogType) ogType = input.ogType;

  const robots = input.robots ?? (isPrivateView ? 'noindex, nofollow' : 'index, follow');
  const normalizedPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const canonicalUrl = `${cleanBase}${normalizedPath}`;
  const ogLocale = isRu ? 'ru_UA' : 'uk_UA';

  const keywordsList = buildLongTailSolarKeywords({
    view: input.view,
    shopCat: input.shopCat,
    searchQuery: input.searchQuery,
    selectedProduct: input.selectedProduct,
    selectedCase: input.selectedCase,
    categoryProducts: input.categoryProducts,
    isRussian: isRu,
    extraKeywords: input.keywords,
  });
  const keywords = keywordsList.join(', ');

  const productMetaTags: MetaTagEntry[] = input.selectedProduct
    ? [
        { attr: 'property', key: 'product:brand', content: input.selectedProduct.brand || COMPANY_INFO.name },
        {
          attr: 'property',
          key: 'product:availability',
          content: input.selectedProduct.inStock ? 'in stock' : 'available for order',
        },
        { attr: 'property', key: 'product:condition', content: 'new' },
        {
          attr: 'property',
          key: 'product:retailer_item_id',
          content: input.selectedProduct.sku || input.selectedProduct.id,
        },
        ...(input.selectedProduct.price > 0
          ? input.usdUahRate && input.usdUahRate > 0
            ? [
                {
                  attr: 'property' as const,
                  key: 'product:price:amount',
                  content: String(Math.round(input.selectedProduct.price * input.usdUahRate)),
                },
                { attr: 'property' as const, key: 'product:price:currency', content: 'UAH' },
              ]
            : [
                {
                  attr: 'property' as const,
                  key: 'product:price:amount',
                  content: String(input.selectedProduct.price),
                },
                { attr: 'property' as const, key: 'product:price:currency', content: 'USD' },
              ]
          : [
              { attr: 'property' as const, key: 'product:price:amount', content: null },
              { attr: 'property' as const, key: 'product:price:currency', content: null },
            ]),
      ]
    : [
        { attr: 'property', key: 'product:brand', content: null },
        { attr: 'property', key: 'product:availability', content: null },
        { attr: 'property', key: 'product:condition', content: null },
        { attr: 'property', key: 'product:retailer_item_id', content: null },
        { attr: 'property', key: 'product:price:amount', content: null },
        { attr: 'property', key: 'product:price:currency', content: null },
      ];

  const baseMetaTags: MetaTagEntry[] = [
    { attr: 'name', key: 'description', content: description },
    { attr: 'name', key: 'keywords', content: isPrivateView ? null : keywords },
    { attr: 'name', key: 'robots', content: robots },
    { attr: 'name', key: 'geo.region', content: isPrivateView ? null : 'UA-51' },
    { attr: 'name', key: 'geo.placename', content: isPrivateView ? null : 'Одеса' },
    { attr: 'property', key: 'og:type', content: ogType },
    { attr: 'property', key: 'og:title', content: title },
    { attr: 'property', key: 'og:description', content: description },
    { attr: 'property', key: 'og:url', content: canonicalUrl },
    { attr: 'property', key: 'og:image', content: ogImage },
    { attr: 'property', key: 'og:image:alt', content: ogImageAlt },
    { attr: 'property', key: 'og:locale', content: ogLocale },
    { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { attr: 'name', key: 'twitter:title', content: title },
    { attr: 'name', key: 'twitter:description', content: description },
    { attr: 'name', key: 'twitter:image', content: ogImage },
    ...productMetaTags,
  ];

  const customTags = normalizeExtraMetaEntries(input.extraMeta);
  const mergedMap = new Map<string, MetaTagEntry>();
  for (const entry of [...baseMetaTags, ...customTags]) {
    mergedMap.set(`${entry.attr}:${entry.key}`, entry);
  }

  return {
    title,
    description,
    keywords,
    robots,
    canonicalUrl,
    ogType,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogImageAlt,
    ogLocale,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
    metaTags: Array.from(mergedMap.values()),
  };
}

export function updateSiteMetaTags(
  input: DynamicSeoMetaInput,
  targetDocument?: Document | null,
): ResolvedSeoMeta {
  const resolved = buildDynamicSeoMeta(input);
  const doc = targetDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.head) {
    return resolved;
  }

  doc.title = resolved.title;

  for (const tag of resolved.metaTags) {
    const selector = `meta[${tag.attr}="${tag.key}"]`;
    const existing = doc.head.querySelector(selector) ?? doc.querySelector(selector);
    if (tag.content === null || tag.content === undefined || tag.content === '') {
      existing?.remove();
      continue;
    }
    const el = existing ?? doc.createElement('meta');
    el.setAttribute(tag.attr, tag.key);
    el.setAttribute('content', tag.content);
    if (!existing) {
      doc.head.appendChild(el);
    }
  }

  const canonicalEl =
    doc.head.querySelector('link[rel="canonical"]') ?? doc.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    canonicalEl.setAttribute('href', resolved.canonicalUrl);
  } else {
    const linkEl = doc.createElement('link');
    linkEl.setAttribute('rel', 'canonical');
    linkEl.setAttribute('href', resolved.canonicalUrl);
    doc.head.appendChild(linkEl);
  }

  return resolved;
}

