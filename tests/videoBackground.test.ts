import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  VIDEO_BACKGROUND_DEFAULT_URL,
  buildYouTubeEmbedUrl,
  extractYouTubeVideoId,
} from '../src/components/VideoBackground.tsx';

test('extractYouTubeVideoId parses standard, short, embed, and shorts YouTube URLs', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://youtu.be/o7fTs8et1QM?si=test'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/embed/o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/o7fTs8et1QM'), 'o7fTs8et1QM');
  assert.equal(extractYouTubeVideoId('/assets/solar.mp4'), null);
  assert.equal(extractYouTubeVideoId(''), null);
});

test('buildYouTubeEmbedUrl sets autoplay, mute, loop, playlist, and playsinline parameters', () => {
  const embed = buildYouTubeEmbedUrl('o7fTs8et1QM', {
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    origin: 'https://energocomfort.shop',
  });
  const url = new URL(embed);

  assert.equal(url.origin + url.pathname, 'https://www.youtube.com/embed/o7fTs8et1QM');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('mute'), '1');
  assert.equal(url.searchParams.get('loop'), '1');
  assert.equal(url.searchParams.get('playlist'), 'o7fTs8et1QM');
  assert.equal(url.searchParams.get('playsinline'), '1');
  assert.equal(url.searchParams.get('origin'), 'https://energocomfort.shop');
});

test('VideoBackground component uses z-index -1, brightness(0.4) backdrop-filter, and default YouTube URL', () => {
  assert.equal(VIDEO_BACKGROUND_DEFAULT_URL, 'https://www.youtube.com/watch?v=o7fTs8et1QM');
  const source = readFileSync(new URL('../src/components/VideoBackground.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('zIndex: -1'));
  assert.ok(source.includes('backdropFilter: `brightness(${clampedBrightness})`'));
  assert.ok(source.includes('autoPlay={autoPlay}'));
  assert.ok(source.includes('loop={loop}'));
  assert.ok(source.includes('muted={muted}'));
  assert.ok(source.includes('playsInline={playsInline}'));
  assert.ok(source.includes('video-bg-fade-in'));

  const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(cssSource.includes('@keyframes videoBackgroundFadeIn'));
  assert.ok(cssSource.includes('.video-bg-fade-in'));

  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes('<VideoBackground'));
  assert.ok(appSource.includes('https://www.youtube.com/watch?v=o7fTs8et1QM'));
  assert.ok(appSource.includes('brightness={0.4}'));
});
