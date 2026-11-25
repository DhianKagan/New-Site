import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hostMatchesPattern,
  normalizeHost,
  parseDomainRulesFromString,
  resolveFirebaseWebConfigForHost,
} from '../server/firebaseConfig.ts';

test('normalizes hostnames and matches exact domains and wildcard subdomains', () => {
  assert.equal(normalizeHost('https://Energo-Comfort-CRM.ai.studio:443/crm'), 'energo-comfort-crm.ai.studio');
  assert.equal(normalizeHost('*.Energocomfort.SHOP'), '*.energocomfort.shop');
  assert.equal(normalizeHost('javascript:alert(1)'), '');

  assert.equal(hostMatchesPattern('energo-comfort-crm.ai.studio', 'energo-comfort-crm.ai.studio'), true);
  assert.equal(hostMatchesPattern('crm.energocomfort.shop', '*.energocomfort.shop'), true);
  assert.equal(hostMatchesPattern('energocomfort.shop', '*.energocomfort.shop'), false);
});

test('resolves dynamic authDomain and projectId overrides with exact-match precedence', () => {
  const baseConfig = {
    projectId: 'base-project',
    apiKey: 'base-key',
    authDomain: 'base-project.firebaseapp.com',
    appId: 'base-app',
  };

  const envRules = parseDomainRulesFromString('*.energocomfort.shop=energocomfort.shop,energo-comfort-crm.ai.studio');
  const dbRules = [
    {
      hostPattern: 'crm.energocomfort.shop',
      authDomain: 'auth.energocomfort.shop',
      projectId: 'crm-project',
      apiKey: 'crm-key',
      appId: 'crm-app',
    },
  ];

  const exactMatch = resolveFirebaseWebConfigForHost({
    requestHost: 'crm.energocomfort.shop',
    baseConfig,
    envRules,
    dbRules,
  });
  assert.equal(exactMatch.matchedRule, 'crm.energocomfort.shop');
  assert.equal(exactMatch.authDomain, 'auth.energocomfort.shop');
  assert.equal(exactMatch.projectId, 'crm-project');

  const wildcardMatch = resolveFirebaseWebConfigForHost({
    requestHost: 'shop.energocomfort.shop',
    baseConfig,
    envRules,
    dbRules,
  });
  assert.equal(wildcardMatch.matchedRule, '*.energocomfort.shop');
  assert.equal(wildcardMatch.authDomain, 'energocomfort.shop');
  assert.equal(wildcardMatch.projectId, 'base-project');

  const autoHost = resolveFirebaseWebConfigForHost({
    requestHost: 'custom.example.com',
    baseConfig,
    useHostAsAuthDomain: true,
  });
  assert.equal(autoHost.authDomain, 'custom.example.com');

  const literalAuto = resolveFirebaseWebConfigForHost({
    requestHost: 'portal.energo-comfort.ua',
    baseConfig: { ...baseConfig, authDomain: 'auto' },
  });
  assert.equal(literalAuto.authDomain, 'portal.energo-comfort.ua');

  const localhostFallback = resolveFirebaseWebConfigForHost({
    requestHost: 'localhost',
    baseConfig: { ...baseConfig, authDomain: 'auto' },
  });
  assert.equal(localhostFallback.authDomain, 'base-project.firebaseapp.com');
});

test('selects environment-specific firebase config files in priority order', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { readFirebaseConfigFromPaths } = await import('../server/firebaseAuth.ts');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-fb-cfg-'));
  try {
    const envSpecific = path.join(tmpDir, 'firebase-config.production.json');
    const defaultCfg = path.join(tmpDir, 'firebase-applet-config.json');
    fs.writeFileSync(
      envSpecific,
      JSON.stringify({ projectId: 'prod-proj', authDomain: 'auth.prod.example.com' }),
      'utf8',
    );
    fs.writeFileSync(
      defaultCfg,
      JSON.stringify({ projectId: 'default-proj', authDomain: 'default-proj.firebaseapp.com' }),
      'utf8',
    );

    const loaded = readFirebaseConfigFromPaths([
      path.join(tmpDir, 'missing.json'),
      envSpecific,
      defaultCfg,
    ]);
    assert.equal(loaded.filePath, envSpecific);
    assert.equal(loaded.config.projectId, 'prod-proj');
    assert.equal(loaded.config.authDomain, 'auth.prod.example.com');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
