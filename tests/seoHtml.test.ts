import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { renderRouteSeoHtml, resolveGoogleProductCategory, resolveProductTypeLabel } from '../server/seo.ts';
import type { Product } from '../src/types.ts';

const template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');

const sampleProduct: Product = {
  id: 'deye-sun-8k',
  sku: '10018',
  title: 'Гібридний інвертор Deye 8kW </script><script>alert(1)</script>',
  brand: 'Deye',
  cat: 'inverters',
  isKit: false,
  price: 1500,
  oldPrice: 1700,
  inStock: true,
  statusLabel: 'В наявності',
  img: '/assets/energocomfort/deye-8k.jpg',
  specs: [['Потужність', '8 кВт']],
  description: 'Надійний гібридний інвертор для дому та бізнесу.',
  rawCats: ['Інвертори'],
  sourceUrl: 'https://energocomfort.shop/shop/deye-sun-8k',
};

test('renderRouteSeoHtml renders Store, WebSite SearchAction, and FAQPage for home route', () => {
  const html = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/',
    socialLinks: { telegram: 'https://t.me/energocomfort', instagram: 'https://instagram.com/energocomfort' },
  });

  assert.match(html, /<link rel="canonical" href="https:\/\/energocomfort\.shop\/" \/>/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"SearchAction"/);
  assert.match(html, /https:\/\/energocomfort\.shop\/shop\?q=\{search_term_string\}/);
  assert.match(html, /"sameAs":\["https:\/\/t\.me\/energocomfort","https:\/\/instagram\.com\/energocomfort"\]/);
});

test('renderRouteSeoHtml renders category SEO and CollectionPage for /shop?cat=inverters', () => {
  const html = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/shop',
    queryCat: 'inverters',
  });

  assert.match(html, /<title>Гібридні та мережеві інвертори Deye, SolaX, Solis — Energo Comfort<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/energocomfort\.shop\/shop\?cat=inverters" \/>/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
});

test('renderRouteSeoHtml renders Product JSON-LD, UAH Offer, OpenGraph product:* meta and safely escapes HTML tags', () => {
  const html = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/shop/deye-sun-8k',
    product: sampleProduct,
    usdUahRate: 42,
  });

  assert.match(html, /<meta property="og:type" content="product" \/>/);
  assert.match(html, /<meta property="product:retailer_item_id" content="10018" \/>/);
  assert.match(html, /<meta property="product:price:amount" content="63000" \/>/);
  assert.match(html, /<meta property="product:price:currency" content="UAH" \/>/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"name":"Інвертори"/);
  assert.match(html, /"priceCurrency":"UAH","price":63000/);
  assert.match(html, /"priceValidUntil":"\d{4}-\d{2}-\d{2}"/);
  assert.match(html, /"hasMerchantReturnPolicy"/);
  assert.match(html, /"shippingDetails"/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script\\u003e/);
});

test('renderRouteSeoHtml sets noindex and strips JSON-LD for private routes', () => {
  const html = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/crm',
  });

  assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.doesNotMatch(html, /id="ec-jsonld"/);
});

test('resolveGoogleProductCategory and resolveProductTypeLabel return valid Google Merchant values', () => {
  assert.equal(resolveGoogleProductCategory('panels'), 'Hardware > Power & Electrical Supplies > Solar Panels');
  assert.equal(resolveGoogleProductCategory('inverters'), 'Hardware > Power & Electrical Supplies > Power Inverters');
  assert.equal(resolveProductTypeLabel('batteries'), 'Акумулятори LiFePO4');
});

test('renderRouteSeoHtml generates dynamic BreadcrumbList JSON-LD for all category query and slug routes', () => {
  const categories = ['kits', 'inverters', 'batteries', 'panels', 'parts'] as const;
  for (const cat of categories) {
    const queryHtml = renderRouteSeoHtml({
      template,
      baseUrl: 'https://energocomfort.shop',
      rawPath: '/shop',
      queryCat: cat,
      categoryProducts: [sampleProduct],
    });
    assert.match(queryHtml, /"@type":"CollectionPage"/);
    assert.match(queryHtml, /"@type":"BreadcrumbList"/);
    assert.match(queryHtml, new RegExp(`https://energocomfort\\.shop/shop\\?cat=${cat}#breadcrumb`));
    assert.match(queryHtml, /"@type":"ItemList"/);

    const slugHtml = renderRouteSeoHtml({
      template,
      baseUrl: 'https://energocomfort.shop',
      rawPath: `/shop/category/${cat}`,
    });
    assert.match(slugHtml, new RegExp(`<link rel="canonical" href="https://energocomfort\\.shop/shop\\?cat=${cat}" />`));
    assert.match(slugHtml, /"@type":"BreadcrumbList"/);
  }

  const missingProdHtml = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/shop/non-existent-id',
  });
  assert.ok(missingProdHtml.includes('<link rel="canonical" href="https://energocomfort.shop/shop" />'));
  assert.match(missingProdHtml, /"@type":"CollectionPage"/);
  assert.match(missingProdHtml, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(missingProdHtml, /"@type":"FAQPage"/);
});

test('renderRouteSeoHtml preserves literal $& and $1 replacement tokens in product metadata', () => {
  const dollarProduct: Product = {
    ...sampleProduct,
    id: 'test-dollar-product',
    title: 'Комплект $& $1 $2 Deye',
    description: "Ціна за 1 кВт·год $' стабільна при навантаженні $1",
  };
  const html = renderRouteSeoHtml({
    template,
    baseUrl: 'https://energocomfort.shop',
    rawPath: '/shop/test-dollar-product',
    product: dollarProduct,
    usdUahRate: 42,
  });

  assert.ok(html.includes('Комплект $&amp; $1 $2 Deye — Energo Comfort'));
  assert.ok(html.includes('"name":"Комплект $& $1 $2 Deye"'));
  assert.doesNotMatch(html, /<\/head>.*<\/head>/s);
});

