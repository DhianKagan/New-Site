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
