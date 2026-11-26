import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ALLOWED_PRODUCT_CATEGORIES,
  buildBreadcrumbListJsonLd,
  buildBreadcrumbTrail,
  buildCategoryBreadcrumbJsonLd,
  buildProductBreadcrumbJsonLd,
  getCategoryBreadcrumbLabel,
} from '../src/lib/breadcrumbs.ts';
import { buildPageJsonLdDocument } from '../src/lib/seoSchema.ts';
import type { Product, ProjectCase } from '../src/types.ts';

const sampleProduct: Product = {
  id: 'deye-sun-8k',
  sku: '10018',
  title: 'Гібридний інвертор Deye 8kW',
  titleRu: 'Гибридный инвертор Deye 8kW',
  brand: 'Deye',
  cat: 'inverters',
  isKit: false,
  price: 1500,
  oldPrice: 1700,
  inStock: true,
  statusLabel: 'В наявності',
  img: '/assets/energocomfort/deye-8k.jpg',
  specs: [['Потужність', '8 кВт']],
  description: 'Надійний гібридний інвертор.',
  rawCats: ['Інвертори'],
  sourceUrl: 'https://energocomfort.shop/shop/deye-sun-8k',
};

const sampleCase: ProjectCase = {
  id: 'case-1',
  seg: 'b2b',
  tag: 'Комерційна СЕС',
  tagRu: 'Коммерческая СЭС',
  title: 'СТО в Одесі 110 кВт',
  titleRu: 'СТО в Одессе 110 кВт',
  img: '/assets/energocomfort/sto_110kw.jpg',
  task: 'Зменшити витрати на електроенергію.',
  solution: 'Мережевий інвертор Solis 110 кВт.',
  specs: '110 кВт · 3 фази',
  result: 'Економія 65% у денний час.',
};

test('buildBreadcrumbTrail returns Home crumb on home route', () => {
  const trail = buildBreadcrumbTrail({ view: 'home' });
  assert.equal(trail.length, 1);
  assert.deepEqual(trail[0], {
    id: 'home',
    label: 'Головна',
    href: '/',
    view: 'home',
    isCurrent: true,
  });
});

test('buildBreadcrumbTrail builds Home > Shop > Category > Search trail dynamically', () => {
  const shopAll = buildBreadcrumbTrail({ view: 'shop', shopCat: 'all' });
  assert.deepEqual(
    shopAll.map((i) => ({ label: i.label, href: i.href, current: i.isCurrent })),
    [
      { label: 'Головна', href: '/', current: false },
      { label: 'Обладнання', href: '/shop', current: true },
    ],
  );

  const shopCat = buildBreadcrumbTrail({ view: 'shop', shopCat: 'batteries' });
  assert.deepEqual(
    shopCat.map((i) => ({ label: i.label, href: i.href, current: i.isCurrent })),
    [
      { label: 'Головна', href: '/', current: false },
      { label: 'Обладнання', href: '/shop', current: false },
      { label: 'Акумулятори LiFePO4', href: '/shop?cat=batteries', current: true },
    ],
  );

  const shopSearch = buildBreadcrumbTrail({
    view: 'shop',
    shopCat: 'inverters',
    searchQuery: 'Deye 12',
  });
  assert.deepEqual(
    shopSearch.map((i) => ({ label: i.label, href: i.href, current: i.isCurrent })),
    [
      { label: 'Головна', href: '/', current: false },
      { label: 'Обладнання', href: '/shop', current: false },
      { label: 'Інвертори', href: '/shop?cat=inverters', current: false },
      { label: 'Пошук: «Deye 12»', href: '/shop?cat=inverters&q=Deye+12', current: true },
    ],
  );
});

test('buildBreadcrumbTrail builds full Home > Shop > Category > Product hierarchy', () => {
  const trail = buildBreadcrumbTrail({
    view: 'shop',
    shopCat: 'all',
    selectedProduct: sampleProduct,
  });

  assert.deepEqual(
    trail.map((i) => ({ label: i.label, href: i.href, cat: i.cat, current: i.isCurrent })),
    [
      { label: 'Головна', href: '/', cat: undefined, current: false },
      { label: 'Обладнання', href: '/shop', cat: 'all', current: false },
      { label: 'Інвертори', href: '/shop?cat=inverters', cat: 'inverters', current: false },
      {
        label: 'Гібридний інвертор Deye 8kW',
        href: '/shop/deye-sun-8k',
        cat: 'inverters',
        current: true,
      },
    ],
  );
});

test('buildBreadcrumbTrail supports Russian locale and project case modal trails', () => {
  const ruProductTrail = buildBreadcrumbTrail({
    view: 'shop',
    selectedProduct: sampleProduct,
    isRussian: true,
  });
  assert.deepEqual(
    ruProductTrail.map((i) => i.label),
    ['Главная', 'Оборудование', 'Инверторы', 'Гибридный инвертор Deye 8kW'],
  );

  const caseTrail = buildBreadcrumbTrail({
    view: 'projects',
    selectedCase: sampleCase,
    isRussian: true,
  });
  assert.deepEqual(
    caseTrail.map((i) => i.label),
    ['Главная', 'Реализованные объекты', 'СТО в Одессе 110 кВт'],
  );
  assert.equal(getCategoryBreadcrumbLabel('panels', true), 'Солнечные панели');
});

test('buildBreadcrumbListJsonLd generates valid Schema.org BreadcrumbList items with sequential positions', () => {
  const trail = buildBreadcrumbTrail({
    view: 'shop',
    selectedProduct: sampleProduct,
  });
  const jsonLd = buildBreadcrumbListJsonLd(trail, 'https://energocomfort.shop/');
  assert.equal(jsonLd['@type'], 'BreadcrumbList');
  assert.equal(jsonLd['@id'], 'https://energocomfort.shop/shop/deye-sun-8k#breadcrumb');
  assert.equal(jsonLd.itemListElement.length, 4);
  assert.deepEqual(
    jsonLd.itemListElement.map((el) => ({ pos: el.position, name: el.name, item: el.item })),
    [
      { pos: 1, name: 'Головна', item: 'https://energocomfort.shop/' },
      { pos: 2, name: 'Обладнання', item: 'https://energocomfort.shop/shop' },
      { pos: 3, name: 'Інвертори', item: 'https://energocomfort.shop/shop?cat=inverters' },
      { pos: 4, name: 'Гібридний інвертор Deye 8kW', item: 'https://energocomfort.shop/shop/deye-sun-8k' },
    ],
  );
});

test('buildCategoryBreadcrumbJsonLd and buildProductBreadcrumbJsonLd generate Schema.org JSON-LD for all categories and products', () => {
  for (const cat of ALLOWED_PRODUCT_CATEGORIES) {
    const catSchema = buildCategoryBreadcrumbJsonLd(cat, 'https://energocomfort.shop', {
      includeContext: true,
    });
    assert.equal(catSchema['@context'], 'https://schema.org');
    assert.equal(catSchema['@type'], 'BreadcrumbList');
    assert.equal(catSchema['@id'], `https://energocomfort.shop/shop?cat=${cat}#breadcrumb`);
    assert.equal(catSchema.itemListElement.length, 3);
    assert.equal(catSchema.itemListElement[0].position, 1);
    assert.equal(catSchema.itemListElement[1].item, 'https://energocomfort.shop/shop');
    assert.equal(catSchema.itemListElement[2].item, `https://energocomfort.shop/shop?cat=${cat}`);
  }

  const productSchema = buildProductBreadcrumbJsonLd(sampleProduct, 'https://energocomfort.shop', {
    includeContext: true,
    isRussian: true,
  });
  assert.equal(productSchema['@context'], 'https://schema.org');
  assert.equal(productSchema['@id'], 'https://energocomfort.shop/shop/deye-sun-8k#breadcrumb');
  assert.equal(productSchema.itemListElement[2].name, 'Инверторы');
  assert.equal(productSchema.itemListElement[3].name, 'Гибридный инвертор Deye 8kW');
});

test('buildPageJsonLdDocument links CollectionPage and ItemPage to BreadcrumbList @id', () => {
  const categoryDoc = buildPageJsonLdDocument({
    view: 'shop',
    baseUrl: 'https://energocomfort.shop',
    canonicalUrl: 'https://energocomfort.shop/shop?cat=inverters',
    title: 'Інвертори — Energo Comfort',
    description: 'Каталог інверторів',
    shopCat: 'inverters',
    categoryProducts: [sampleProduct],
  });
  assert.ok(categoryDoc);
  const collectionPage = categoryDoc['@graph'].find((n: any) => n['@type'] === 'CollectionPage') as any;
  const catBreadcrumb = categoryDoc['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList') as any;
  assert.equal(collectionPage.breadcrumb['@id'], catBreadcrumb['@id']);
  assert.equal(collectionPage.mainEntity['@type'], 'ItemList');
  assert.equal(collectionPage.mainEntity.numberOfItems, 1);

  const productDoc = buildPageJsonLdDocument({
    view: 'shop',
    baseUrl: 'https://energocomfort.shop',
    canonicalUrl: 'https://energocomfort.shop/shop/deye-sun-8k',
    title: 'Deye 8kW',
    description: 'Гібридний інвертор',
    selectedProduct: sampleProduct,
    usdUahRate: 42,
  });
  assert.ok(productDoc);
  const itemPage = productDoc['@graph'].find((n: any) => n['@type'] === 'ItemPage') as any;
  const prodEntity = productDoc['@graph'].find((n: any) => n['@type'] === 'Product') as any;
  const prodBreadcrumb = productDoc['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList') as any;
  assert.equal(itemPage.breadcrumb['@id'], prodBreadcrumb['@id']);
  assert.equal(itemPage.mainEntity['@id'], prodEntity['@id']);
  assert.equal(prodBreadcrumb.itemListElement.length, 4);

  const privateDoc = buildPageJsonLdDocument({
    view: 'crm',
    baseUrl: 'https://energocomfort.shop',
    canonicalUrl: 'https://energocomfort.shop/crm',
    title: 'CRM',
    description: '',
  });
  assert.equal(privateDoc, null);
});

test('App.tsx renders Breadcrumbs at the top of main and Breadcrumbs.tsx sets Schema.org microdata + aria-current', () => {
  const appSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
  const componentSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Breadcrumbs.tsx'), 'utf-8');

  assert.match(appSource, /<main className="flex-1">\s*<Breadcrumbs\b/);
  assert.match(componentSource, /https:\/\/schema\.org\/BreadcrumbList/);
  assert.match(componentSource, /aria-current="page"/);
});
