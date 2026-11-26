import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('VerifiedWarrantyBadge component supports product and footer variants with Energo Comfort copy', () => {
  const badgeSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'VerifiedWarrantyBadge.tsx'),
    'utf-8',
  );

  assert.match(badgeSource, /export function VerifiedWarrantyBadge/);
  assert.match(badgeSource, /variant\?: 'product' \| 'footer'/);
  assert.match(badgeSource, /Energo Comfort/);
  assert.match(badgeSource, /data-testid="verified-warranty-badge"/);
  assert.match(badgeSource, /ShieldCheck/);
  assert.match(badgeSource, /BadgeCheck/);
});

test('ProductModal and App footer render VerifiedWarrantyBadge', () => {
  const modalSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ProductModal.tsx'),
    'utf-8',
  );
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'App.tsx'),
    'utf-8',
  );

  assert.match(modalSource, /import \{ VerifiedWarrantyBadge \} from '\.\/VerifiedWarrantyBadge\.tsx'/);
  assert.match(modalSource, /<VerifiedWarrantyBadge[\s\S]*variant="product"/);

  assert.match(appSource, /import \{ VerifiedWarrantyBadge \} from '\.\/components\/VerifiedWarrantyBadge\.tsx'/);
  assert.match(appSource, /<VerifiedWarrantyBadge[\s\S]*variant="footer"/);
});
