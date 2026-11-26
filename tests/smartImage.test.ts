import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildBlurPlaceholderDataUri, resolveSmartImageAttrs } from '../src/components/SmartImage.tsx';

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

test('resolveSmartImageAttrs defaults non-priority images to loading="lazy" and async decoding', () => {
  assert.deepEqual(resolveSmartImageAttrs(), {
    loading: 'lazy',
    fetchPriority: 'auto',
    decoding: 'async',
  });
  assert.deepEqual(resolveSmartImageAttrs({ priority: false, loading: 'lazy' }), {
    loading: 'lazy',
    fetchPriority: 'auto',
    decoding: 'async',
  });
  assert.deepEqual(resolveSmartImageAttrs({ priority: true }), {
    loading: 'eager',
    fetchPriority: 'high',
    decoding: 'sync',
  });
  assert.deepEqual(resolveSmartImageAttrs({ priority: true, loading: 'lazy' }), {
    loading: 'lazy',
    fetchPriority: 'auto',
    decoding: 'async',
  });
});

test('Only critical above-the-fold SmartImage instances use priority; all other views and posters lazy-load', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = listSourceFiles(srcDir);

  const prioritySites: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(process.cwd(), file);
    const smartImageBlocks = content.match(/<SmartImage[\s\S]*?\/>/g) ?? [];
    for (const block of smartImageBlocks) {
      if (/\bpriority\b/.test(block)) {
        prioritySites.push(`${rel}:${block}`);
      }
    }
  }

  // Only App.tsx header brand mark and HomeView.tsx hero case showcase should opt into eager priority loading.
  assert.equal(prioritySites.length, 2);
  assert.ok(prioritySites.some((s) => s.startsWith('src/App.tsx:') && s.includes('logo_mark.svg')));
  assert.ok(prioritySites.some((s) => s.startsWith('src/components/HomeView.tsx:') && s.includes('activeHeroCase.img')));

  const appSource = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
  assert.match(appSource, /<SmartImage[\s\S]*?logo_mark\.svg[\s\S]*?loading="lazy"/);

  const videoBgSource = fs.readFileSync(path.join(srcDir, 'components', 'VideoBackground.tsx'), 'utf-8');
  assert.match(videoBgSource, /loading=\{lazy \? 'lazy' : 'eager'\}/);
});

test('buildBlurPlaceholderDataUri generates deterministic category-tinted SVG blur placeholders', () => {
  const kitsUriA = buildBlurPlaceholderDataUri('/assets/products/kit-a.jpg', 'kits');
  const kitsUriB = buildBlurPlaceholderDataUri('/assets/products/kit-b.jpg', 'kits');
  const invUri = buildBlurPlaceholderDataUri('/assets/products/inv-a.png', 'inverters');
  const batUri = buildBlurPlaceholderDataUri('/assets/products/bat-a.png', 'batteries');

  assert.ok(kitsUriA.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.equal(kitsUriA, buildBlurPlaceholderDataUri('/assets/products/kit-a.jpg', 'kits'));
  assert.notEqual(kitsUriA, kitsUriB);
  assert.notEqual(kitsUriA, invUri);

  const decodedKit = decodeURIComponent(kitsUriA.replace('data:image/svg+xml;charset=utf-8,', ''));
  const decodedBat = decodeURIComponent(batUri.replace('data:image/svg+xml;charset=utf-8,', ''));
  assert.match(decodedKit, /<svg[^>]+viewBox="0 0 16 10"/);
  assert.match(decodedKit, /#fef3c7/);
  assert.match(decodedBat, /#ccfbf1/);
});

test('SmartImage and catalog product views implement progressive blur-up loading and reduced-motion safeguards', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const smartImageSrc = fs.readFileSync(path.join(srcDir, 'components', 'SmartImage.tsx'), 'utf8');
  assert.match(smartImageSrc, /data-progressive-state=\{isLoaded \? 'loaded' : 'loading'\}/);
  assert.match(smartImageSrc, /img\.complete && img\.naturalWidth > 0/);
  assert.match(smartImageSrc, /ec-blur-shimmer/);
  assert.match(smartImageSrc, /motion-reduce:transition-none/);

  for (const rel of [
    'components/ProductCard.tsx',
    'components/ShopView.tsx',
    'components/QuickViewModal.tsx',
    'components/ProductModal.tsx',
    'components/CompareModal.tsx',
    'components/SolarSavingsCalculator.tsx',
  ]) {
    const fileSrc = fs.readFileSync(path.join(srcDir, rel), 'utf8');
    assert.match(fileSrc, /\bprogressive\b/, `${rel} should enable progressive blur-up loading`);
    assert.match(fileSrc, /placeholderTone=/, `${rel} should pass category placeholderTone`);
  }
});
