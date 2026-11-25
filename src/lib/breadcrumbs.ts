import type { Product, ProductCategory, ProjectCase } from '../types.ts';
import { localizeCatalogText } from './i18n.ts';

export type BreadcrumbView =
  | 'home'
  | 'shop'
  | 'services'
  | 'projects'
  | 'contacts'
  | 'payment-delivery'
  | 'offer'
  | 'login'
  | 'account'
  | 'crm';

export interface BreadcrumbItem {
  id: string;
  label: string;
  href: string;
  view: BreadcrumbView;
  cat?: ProductCategory | 'all';
  isCurrent: boolean;
}

export interface BreadcrumbTrailInput {
  view: BreadcrumbView;
  shopCat?: ProductCategory | 'all';
  searchQuery?: string;
  selectedProduct?: Product | null;
  selectedCase?: ProjectCase | null;
  isRussian?: boolean;
}

export const CATEGORY_BREADCRUMB_LABELS: Record<ProductCategory, { uk: string; ru: string }> = {
  kits: { uk: 'Готові комплекти', ru: 'Готовые комплекты' },
  inverters: { uk: 'Інвертори', ru: 'Инверторы' },
  batteries: { uk: 'Акумулятори LiFePO4', ru: 'Аккумуляторы LiFePO4' },
  panels: { uk: 'Сонячні панелі', ru: 'Солнечные панели' },
  parts: { uk: 'Комплектуючі та захист', ru: 'Комплектующие и защита' },
};

const VIEW_BREADCRUMB_LABELS: Record<BreadcrumbView, { uk: string; ru: string }> = {
  home: { uk: 'Головна', ru: 'Главная' },
  shop: { uk: 'Обладнання', ru: 'Оборудование' },
  services: { uk: 'Послуги монтажу та інжинірингу', ru: 'Монтаж и инженерные услуги' },
  projects: { uk: 'Реалізовані об’єкти', ru: 'Реализованные объекты' },
  contacts: { uk: 'Контакти', ru: 'Контакты' },
  'payment-delivery': { uk: 'Оплата і доставка', ru: 'Оплата и доставка' },
  offer: { uk: 'Публічна оферта', ru: 'Публичная оферта' },
  login: { uk: 'Вхід та реєстрація', ru: 'Вход и регистрация' },
  account: { uk: 'Особистий кабінет', ru: 'Личный кабинет' },
  crm: { uk: 'CRM', ru: 'CRM' },
};

function isValidProductCategory(cat: string | undefined): cat is ProductCategory {
  return (
    cat === 'kits' ||
    cat === 'inverters' ||
    cat === 'batteries' ||
    cat === 'panels' ||
    cat === 'parts'
  );
}

function buildShopHref(cat?: ProductCategory | 'all', searchQuery?: string): string {
  const params = new URLSearchParams();
  if (cat && cat !== 'all') {
    params.set('cat', cat);
  }
  const trimmed = searchQuery?.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  const qs = params.toString();
  return qs ? `/shop?${qs}` : '/shop';
}

export function getCategoryBreadcrumbLabel(cat: ProductCategory, isRussian = false): string {
  const entry = CATEGORY_BREADCRUMB_LABELS[cat];
  return isRussian ? entry.ru : entry.uk;
}

export function buildBreadcrumbTrail(input: BreadcrumbTrailInput): BreadcrumbItem[] {
  const isRussian = Boolean(input.isRussian);
  const pick = (pair: { uk: string; ru: string }) => (isRussian ? pair.ru : pair.uk);
  const locale = isRussian ? 'ru' : 'uk';

  const homeItem: BreadcrumbItem = {
    id: 'home',
    label: pick(VIEW_BREADCRUMB_LABELS.home),
    href: '/',
    view: 'home',
    isCurrent: false,
  };

  if (input.selectedProduct) {
    const product = input.selectedProduct;
    const productTitle = isRussian
      ? product.titleRu ?? localizeCatalogText(product.title, locale)
      : product.title;
    const hasCat = isValidProductCategory(product.cat);

    const trail: BreadcrumbItem[] = [
      homeItem,
      {
        id: 'shop',
        label: pick(VIEW_BREADCRUMB_LABELS.shop),
        href: '/shop',
        view: 'shop',
        cat: 'all',
        isCurrent: false,
      },
    ];

    if (hasCat) {
      trail.push({
        id: `cat-${product.cat}`,
        label: getCategoryBreadcrumbLabel(product.cat, isRussian),
        href: buildShopHref(product.cat),
        view: 'shop',
        cat: product.cat,
        isCurrent: false,
      });
    }

    trail.push({
      id: `product-${product.id}`,
      label: productTitle,
      href: `/shop/${encodeURIComponent(product.id)}`,
      view: 'shop',
      cat: hasCat ? product.cat : 'all',
      isCurrent: true,
    });

    return trail;
  }

  if (input.selectedCase && (input.view === 'home' || input.view === 'projects')) {
    const projectCase = input.selectedCase;
    const caseTitle = isRussian
      ? projectCase.titleRu ?? projectCase.title
      : projectCase.title;
    return [
      homeItem,
      {
        id: 'projects',
        label: pick(VIEW_BREADCRUMB_LABELS.projects),
        href: '/projects',
        view: 'projects',
        isCurrent: false,
      },
      {
        id: `case-${projectCase.id}`,
        label: caseTitle,
        href: '/projects',
        view: 'projects',
        isCurrent: true,
      },
    ];
  }

  if (input.view === 'home') {
    return [{ ...homeItem, isCurrent: true }];
  }

  if (input.view === 'shop') {
    const cat = isValidProductCategory(input.shopCat) ? input.shopCat : 'all';
    const trimmedQuery = input.searchQuery?.trim() ?? '';
    const hasCat = cat !== 'all';
    const hasQuery = trimmedQuery.length > 0;

    const trail: BreadcrumbItem[] = [
      homeItem,
      {
        id: 'shop',
        label: pick(VIEW_BREADCRUMB_LABELS.shop),
        href: '/shop',
        view: 'shop',
        cat: 'all',
        isCurrent: !hasCat && !hasQuery,
      },
    ];

    if (hasCat) {
      trail.push({
        id: `cat-${cat}`,
        label: getCategoryBreadcrumbLabel(cat, isRussian),
        href: buildShopHref(cat),
        view: 'shop',
        cat,
        isCurrent: !hasQuery,
      });
    }

    if (hasQuery) {
      trail.push({
        id: 'search',
        label: `${isRussian ? 'Поиск' : 'Пошук'}: «${trimmedQuery}»`,
        href: buildShopHref(cat, trimmedQuery),
        view: 'shop',
        cat,
        isCurrent: true,
      });
    }

    return trail;
  }

  const routeHref = input.view === 'offer' ? '/public-offer' : `/${input.view}`;
  return [
    homeItem,
    {
      id: input.view,
      label: pick(VIEW_BREADCRUMB_LABELS[input.view]),
      href: routeHref,
      view: input.view,
      isCurrent: true,
    },
  ];
}

export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[], origin: string) {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.label,
      item: `${cleanOrigin}${item.href}`,
    })),
  };
}
