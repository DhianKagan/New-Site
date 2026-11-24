import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSitemapXml, SITEMAP_INFO_PAGES, SITEMAP_PRODUCT_CATEGORIES } from '../server/sitemap.ts';

test('includes all information pages, product categories, and product pages in sitemap.xml', () => {
  const xml = generateSitemapXml({
    baseUrl: 'https://energocomfort.shop/',
    infoLastMod: '2026-11-20T10:00:00.000Z',
    now: new Date('2026-11-24T12:00:00.000Z'),
    categories: [
      { cat: 'kits', updatedAt: '2026-11-22T09:15:00.000Z', itemCount: 12 },
      { cat: 'inverters', updatedAt: '2026-11-23T14:30:00.000Z', itemCount: 40 },
    ],
    products: [
      {
        id: 'deye-sun-8k',
        title: 'Deye SUN-8K-SG01LP1 & Smart Meter',
        img: '/assets/energocomfort/backup_deye_8kw.jpg',
        updatedAt: '2026-11-21T08:00:00.000Z',
      },
      {
        id: 'deye-sun-8k',
        title: 'Duplicate Should Be Ignored',
        img: '/assets/energocomfort/backup_deye_8kw.jpg',
        updatedAt: '2026-11-21T08:00:00.000Z',
      },
    ],
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);

  for (const page of SITEMAP_INFO_PAGES) {
    const expectedLoc = page.path === '/' ? 'https://energocomfort.shop/' : `https://energocomfort.shop${page.path}`;
    assert.ok(xml.includes(`<loc>${expectedLoc}</loc>`), `Expected info page ${expectedLoc}`);
  }

  for (const cat of SITEMAP_PRODUCT_CATEGORIES) {
    const expectedLoc = `https://energocomfort.shop/shop?cat=${cat}`;
    assert.ok(xml.includes(`<loc>${expectedLoc}</loc>`), `Expected category page ${expectedLoc}`);
  }

  assert.ok(xml.includes('<loc>https://energocomfort.shop/shop/deye-sun-8k</loc>'));
  assert.ok(xml.includes('<image:loc>https://energocomfort.shop/assets/energocomfort/backup_deye_8kw.jpg</image:loc>'));
  assert.ok(xml.includes('<image:title>Deye SUN-8K-SG01LP1 &amp; Smart Meter</image:title>'));

  const productOccurrences = xml.match(/https:\/\/energocomfort\.shop\/shop\/deye-sun-8k<\/loc>/g) ?? [];
  assert.equal(productOccurrences.length, 1);

  assert.equal(xml.includes('/crm'), false);
  assert.equal(xml.includes('/login'), false);
  assert.equal(xml.includes('/account'), false);
});
