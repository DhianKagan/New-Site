import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidSocialUrl,
  normalizeSocialLinksConfig,
  normalizeSocialUrl,
  safeSocialHref,
} from '../src/lib/socialLinks.ts';
import { socialPutSchema } from '../server/validation.ts';

test('normalizes handles, bare domains, and Viber phone numbers into safe URLs', () => {
  assert.equal(normalizeSocialUrl('instagram', '@energocomfort.shop'), 'https://www.instagram.com/energocomfort.shop');
  assert.equal(normalizeSocialUrl('youtube', '@energocomfort'), 'https://www.youtube.com/@energocomfort');
  assert.equal(normalizeSocialUrl('tiktok', '@energocomfort'), 'https://www.tiktok.com/@energocomfort');
  assert.equal(normalizeSocialUrl('instagram', 'instagram.com/energocomfort.shop'), 'https://instagram.com/energocomfort.shop');
  assert.equal(normalizeSocialUrl('viber', '+380507777172'), 'viber://chat?number=%2B380507777172');
  assert.equal(normalizeSocialUrl('viber', '050 777 71 72'), 'viber://chat?number=%2B380507777172');
  assert.equal(
    normalizeSocialUrl('viber', 'https://invite.viber.com/?g2=TEST123'),
    'https://invite.viber.com/?g2=TEST123',
  );
});

test('safeSocialHref allows http/https and viber deep links while blocking XSS schemes', () => {
  assert.equal(safeSocialHref('https://instagram.com/energocomfort', 'instagram'), 'https://instagram.com/energocomfort');
  assert.equal(safeSocialHref('viber://chat?number=%2B380507777172', 'viber'), 'viber://chat?number=%2B380507777172');
  assert.equal(safeSocialHref('viber://chat?number=%2B380507777172', 'instagram'), null);
  assert.equal(safeSocialHref('javascript:alert(1)', 'instagram'), null);
  assert.equal(safeSocialHref('data:text/html,<script>alert(1)</script>', 'youtube'), null);
  assert.equal(safeSocialHref('vbscript:msgbox(1)', 'tiktok'), null);
  assert.equal(isValidSocialUrl('instagram', 'javascript:alert(1)'), false);
  assert.equal(isValidSocialUrl('viber', 'not-a-valid-viber-link'), false);
});

test('socialPutSchema validates and normalizes Instagram, YouTube, TikTok, Viber, Telegram, and Facebook', () => {
  const valid = socialPutSchema.safeParse({
    instagram: '@energocomfort.shop',
    youtube: 'youtube.com/@energocomfort',
    tiktok: 'https://www.tiktok.com/@energocomfort',
    viber: '+380507777172',
    telegram: 'https://t.me/energocomfort',
    facebook: '',
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.instagram, 'https://www.instagram.com/energocomfort.shop');
    assert.equal(valid.data.youtube, 'https://youtube.com/@energocomfort');
    assert.equal(valid.data.tiktok, 'https://www.tiktok.com/@energocomfort');
    assert.equal(valid.data.viber, 'viber://chat?number=%2B380507777172');
    assert.equal(valid.data.telegram, 'https://t.me/energocomfort');
    assert.equal(valid.data.facebook, '');
  }

  const invalid = socialPutSchema.safeParse({
    instagram: 'javascript:alert(1)',
  });
  assert.equal(invalid.success, false);

  const normalizedConfig = normalizeSocialLinksConfig({
    instagram: '@ec_solar',
    youtube: 'https://youtube.com/@ec_solar',
    tiktok: '@ec_solar',
    viber: 'https://invite.viber.com/?g2=ABC',
  });
  assert.equal(normalizedConfig.instagram, 'https://www.instagram.com/ec_solar');
  assert.equal(normalizedConfig.tiktok, 'https://www.tiktok.com/@ec_solar');
  assert.equal(normalizedConfig.viber, 'https://invite.viber.com/?g2=ABC');
});
