import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  VIDEO_BACKGROUND_DEFAULT_URL,
  buildYouTubeEmbedUrl,
  extractYouTubeTimeRange,
  extractYouTubeVideoId,
  normalizeTimeSeconds,
} from '../src/components/VideoBackground.tsx';

test('extractYouTubeVideoId parses standard, short, embed, and shorts YouTube URLs', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://youtu.be/o7fTs8et1QM?si=test'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/embed/o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('/assets/solar.mp4'), null);
  assert.equal(extractYouTubeVideoId(''), null);
});

test('normalizeTimeSeconds and extractYouTubeTimeRange parse numeric, s, and hms timestamps', () => {
  assert.equal(normalizeTimeSeconds(15.8), 15);
  assert.equal(normalizeTimeSeconds('24s'), 24);
  assert.equal(normalizeTimeSeconds('1m15s'), 75);
  assert.equal(normalizeTimeSeconds(-5), undefined);
  assert.equal(normalizeTimeSeconds('abc'), undefined);

  assert.deepEqual(
    extractYouTubeTimeRange('https://www.youtube.com/watch?v=o7fTs8et1QM&t=18s'),
    { start: 18 },
  );
  assert.deepEqual(
    extractYouTubeTimeRange('https://www.youtube.com/watch?v=o7fTs8et1QM&start=16&end=30'),
    { start: 16, end: 30 },
  );
  assert.deepEqual(
    extractYouTubeTimeRange('https://www.youtube.com/watch?v=o7fTs8et1QM&start=30&end=20'),
    { start: 30 },
  );
});

test('buildYouTubeEmbedUrl sets autoplay, mute, loop, playlist, playsinline, start, and end parameters', () => {
  const embed = buildYouTubeEmbedUrl('o7fTs8et1QM', {
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    origin: 'https://energocomfort.shop',
    start: 16,
    end: 30,
  });
  const url = new URL(embed);

  assert.equal(url.origin + url.pathname, 'https://www.youtube.com/embed/o7fTs8et1QM');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('mute'), '1');
  assert.equal(url.searchParams.get('loop'), '1');
  assert.equal(url.searchParams.get('playlist'), 'o7fTs8et1QM');
  assert.equal(url.searchParams.get('playsinline'), '1');
  assert.equal(url.searchParams.get('start'), '16');
  assert.equal(url.searchParams.get('end'), '30');
  assert.equal(url.searchParams.get('origin'), 'https://energocomfort.shop');

  const invalidEndEmbed = new URL(
    buildYouTubeEmbedUrl('o7fTs8et1QM', { start: 25, end: 20 }),
  );
  assert.equal(invalidEndEmbed.searchParams.get('start'), '25');
  assert.equal(invalidEndEmbed.searchParams.get('end'), null);
});

test('VideoBackground component uses z-index -1, light-tinted backdrop-filters, fade-in, distinct tints, and non-overlapping section segments', () => {
  assert.equal(VIDEO_BACKGROUND_DEFAULT_URL, 'https://www.youtube.com/watch?v=o7fTs8et1QM');
  const source = readFileSync(new URL('../src/components/VideoBackground.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('zIndex: -1'));
  assert.ok(source.includes("tone?: 'dark' | 'light'"));
  assert.ok(source.includes('tint?: VideoBackgroundTint'));
  assert.ok(source.includes('VIDEO_TINT_PRESETS'));
  assert.ok(source.includes("tone === 'light' ? 0.86 : 0.68"));
  assert.ok(source.includes('brightness(${clampedBrightness}) saturate(1.1) contrast(1.02)'));
  assert.ok(source.includes('brightness(${clampedBrightness}) saturate(1.06)'));
  assert.ok(source.includes('data-tone={tone}'));
  assert.ok(source.includes('data-tint={tint}'));
  assert.ok(source.includes('autoPlay={autoPlay}'));
  assert.ok(source.includes('loop={loop && effectiveEnd === undefined}'));
  assert.ok(source.includes('muted={muted}'));
  assert.ok(source.includes('playsInline={playsInline}'));
  assert.ok(source.includes('video-bg-fade-in'));
  assert.ok(source.includes('video-bg-poster-motion'));
  assert.ok(source.includes("!allowYouTubeIframe ? 'bg-transparent'"));
  assert.ok(source.includes('effectiveStartRef.current'));
  assert.ok(source.includes('effectiveEndRef.current'));
  for (const forbiddenTint of ['emerald', 'amber', 'teal', 'warm']) {
    assert.ok(!source.includes(`${forbiddenTint}:`), `Expected no non-blue tint preset: ${forbiddenTint}`);
  }

  const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(cssSource.includes('@keyframes videoBackgroundFadeIn'));
  assert.ok(cssSource.includes('@keyframes videoBackgroundPosterMotion'));
  assert.ok(cssSource.includes('.video-bg-fade-in'));
  assert.ok(cssSource.includes('.text-on-video'));

  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes('<VideoBackground'));
  assert.ok(appSource.includes('https://www.youtube.com/watch?v=o7fTs8et1QM'));
  assert.ok(appSource.includes('ROUTE_VIDEO_SEGMENTS'));
  assert.ok(appSource.includes('brightness={0.72}'));

  const homeSource = readFileSync(new URL('../src/components/HomeView.tsx', import.meta.url), 'utf8');
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.hero.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.brands.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.calculator.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.showcase.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.audit.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.projects.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.process.start'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.brief.start'));
  assert.ok(homeSource.includes('tone="light"'));
  assert.ok(homeSource.includes('HOME_VIDEO_SEGMENTS.hero.tint'));

  const howItWorksSource = readFileSync(new URL('../src/components/HowItWorks.tsx', import.meta.url), 'utf8');
  const faqSource = readFileSync(new URL('../src/components/FaqSection.tsx', import.meta.url), 'utf8');

  const segmentMatches = [
    ...Array.from(homeSource.matchAll(/(\w+):\s*\{\s*start:\s*(\d+),\s*end:\s*(\d+),\s*tint:\s*'([^']+)'\s*\}/g)).map((m) => ({
      name: m[1],
      start: Number(m[2]),
      end: Number(m[3]),
      tint: m[4],
    })),
    {
      name: 'howItWorks',
      start: Number(howItWorksSource.match(/start=\{(\d+)\}/)?.[1] ?? -1),
      end: Number(howItWorksSource.match(/end=\{(\d+)\}/)?.[1] ?? -1),
      tint: howItWorksSource.match(/tint="([^"]+)"/)?.[1] ?? '',
    },
    {
      name: 'faq',
      start: Number(faqSource.match(/start=\{(\d+)\}/)?.[1] ?? -1),
      end: Number(faqSource.match(/end=\{(\d+)\}/)?.[1] ?? -1),
      tint: faqSource.match(/tint="([^"]+)"/)?.[1] ?? '',
    },
  ];
  assert.equal(segmentMatches.length, 10);
  const sorted = [...segmentMatches].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(
      sorted[i].start >= sorted[i - 1].end,
      `Expected non-overlapping segment between ${sorted[i - 1].name} and ${sorted[i].name}`,
    );
  }

  for (const file of [
    '../src/components/HowItWorks.tsx',
    '../src/components/FaqSection.tsx',
    '../src/components/ShopView.tsx',
    '../src/components/ServicesView.tsx',
    '../src/components/ProjectsView.tsx',
    '../src/components/ContactsView.tsx',
    '../src/components/InfoPage.tsx',
    '../src/components/ClientCabinetView.tsx',
    '../src/components/CrmView.tsx',
  ]) {
    const viewSource = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(viewSource.includes('tone="light"'), `Expected tone="light" VideoBackground in ${file}`);
    assert.ok(viewSource.includes('tint="'), `Expected tint prop on VideoBackground in ${file}`);
  }
});
