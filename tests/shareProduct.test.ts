import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildProductShareUrl,
  shareOrCopyProductUrl,
} from '../src/lib/shareProduct.ts';

test('buildProductShareUrl builds encoded /shop/<id> URLs from origin', () => {
  assert.equal(
    buildProductShareUrl('deye-sun-8k', 'https://energocomfort.shop/'),
    'https://energocomfort.shop/shop/deye-sun-8k',
  );
  assert.equal(
    buildProductShareUrl('item with spaces', 'https://example.com'),
    'https://example.com/shop/item%20with%20spaces',
  );
});

test('shareOrCopyProductUrl prefers Web Share API and handles user cancellation', async () => {
  const sharedPayloads: Array<{ title?: string; text?: string; url?: string }> = [];
  const outcome = await shareOrCopyProductUrl(
    {
      title: 'Deye 8kW',
      text: 'Hybrid inverter',
      url: 'https://energocomfort.shop/shop/deye-8k',
    },
    {
      share: async (data) => {
        sharedPayloads.push(data);
      },
    },
  );
  assert.equal(outcome, 'shared');
  assert.deepEqual(sharedPayloads, [
    {
      title: 'Deye 8kW',
      text: 'Hybrid inverter',
      url: 'https://energocomfort.shop/shop/deye-8k',
    },
  ]);

  const cancelled = await shareOrCopyProductUrl(
    { title: 'Deye 8kW', url: 'https://energocomfort.shop/shop/deye-8k' },
    {
      share: async () => {
        const err = new Error('User cancelled');
        err.name = 'AbortError';
        throw err;
      },
      clipboard: {
        writeText: async () => {
          throw new Error('Should not copy when share is aborted');
        },
      },
    },
  );
  assert.equal(cancelled, 'cancelled');
});

test('shareOrCopyProductUrl falls back to clipboard when Web Share is unavailable or throws non-abort error', async () => {
  let copiedText = '';
  const desktopOutcome = await shareOrCopyProductUrl(
    { title: 'SolaX 10kW', url: 'https://energocomfort.shop/shop/solax-10k' },
    {
      clipboard: {
        writeText: async (text) => {
          copiedText = text;
        },
      },
    },
  );
  assert.equal(desktopOutcome, 'copied');
  assert.equal(copiedText, 'https://energocomfort.shop/shop/solax-10k');

  let fallbackCopiedText = '';
  const errorFallbackOutcome = await shareOrCopyProductUrl(
    { title: 'SolaX 10kW', url: 'https://energocomfort.shop/shop/solax-10k' },
    {
      share: async () => {
        throw new Error('NotAllowedError');
      },
      clipboard: {
        writeText: async (text) => {
          fallbackCopiedText = text;
        },
      },
    },
  );
  assert.equal(errorFallbackOutcome, 'copied');
  assert.equal(fallbackCopiedText, 'https://energocomfort.shop/shop/solax-10k');
});

test('ProductModal includes Share button wired to shareOrCopyProductUrl', () => {
  const modalSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ProductModal.tsx'),
    'utf-8',
  );
  assert.match(modalSource, /shareOrCopyProductUrl/);
  assert.match(modalSource, /buildProductShareUrl/);
  assert.match(modalSource, /Поділитися/);
  assert.match(modalSource, /Share2/);
});
