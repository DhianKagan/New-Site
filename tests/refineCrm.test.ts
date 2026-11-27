import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CRM_RESOURCES,
  VALID_CRM_TABS,
  canRoleAccessResource,
  createEnergoCrmRouterProvider,
  getResourceMeta,
  parseCrmTabFromLocation,
  type CrmResourceMeta,
} from '../src/crm/refineProviders.ts';

test('CRM_RESOURCES registers all CRM tabs and hidden auxiliary resources for Refine', () => {
  const names = CRM_RESOURCES.map((r) => r.name);
  for (const required of [
    'deals',
    'orders-table',
    'customers',
    'contacts',
    'tasks',
    'notes',
    'products',
    'projects',
    'rates',
    'social',
    'staff',
    'analytics',
    'data-management',
  ]) {
    assert.ok(names.includes(required), `Missing Refine resource: ${required}`);
  }

  const visibleTabs = new Set(
    CRM_RESOURCES.map((r) => (r.meta as CrmResourceMeta | undefined)?.tabId).filter(Boolean),
  );
  assert.equal(visibleTabs.size, VALID_CRM_TABS.size);
  for (const tab of VALID_CRM_TABS) {
    assert.ok(visibleTabs.has(tab), `Missing resource tabId for ${tab}`);
  }

  assert.equal(getResourceMeta('products').readUrl, '/api/catalog');
  assert.equal(getResourceMeta('projects').readUrl, '/api/projects');
  assert.equal(getResourceMeta('deals').envelopeListKey, 'deals');
  assert.equal(getResourceMeta('data-management').adminOnly, true);
  assert.equal(getResourceMeta('analytics').adminOnly, true);
});

test('canRoleAccessResource enforces admin-only and role-scoped RBAC rules', () => {
  assert.equal(canRoleAccessResource(null, 'deals', 'list'), false);
  assert.equal(canRoleAccessResource('admin', 'data-management', 'list'), true);
  assert.equal(canRoleAccessResource('admin', 'analytics', 'list'), true);

  assert.equal(canRoleAccessResource('manager', 'data-management', 'list'), false);
  assert.equal(canRoleAccessResource('manager', 'analytics', 'list'), false);
  assert.equal(canRoleAccessResource('manager', 'deals', 'delete'), true);
  assert.equal(canRoleAccessResource('manager', 'products', 'create'), true);
  assert.equal(canRoleAccessResource('manager', 'staff', 'create'), false);
  assert.equal(canRoleAccessResource('manager', 'customers', 'edit'), false);

  assert.equal(canRoleAccessResource('engineer', 'deals', 'edit'), true);
  assert.equal(canRoleAccessResource('engineer', 'deals', 'delete'), false);
  assert.equal(canRoleAccessResource('engineer', 'products', 'create'), false);

  assert.equal(canRoleAccessResource('installer', 'tasks', 'list'), true);
  assert.equal(canRoleAccessResource('installer', 'deals', 'create'), false);
});

test('Refine CRM router provider parses default tab and resolves go() navigation', () => {
  assert.equal(parseCrmTabFromLocation(), 'pipeline');

  let activeTab = 'pipeline' as const;
  const activeTabRef = { current: activeTab as ReturnType<typeof parseCrmTabFromLocation> };
  const changes: string[] = [];
  const router = createEnergoCrmRouterProvider(activeTabRef, (next) => {
    changes.push(next);
    activeTabRef.current = next;
  });

  const goFn = router.go!();
  const target = goFn({ to: '/crm?tab=clients', type: 'path' });
  assert.equal(target, '/crm?tab=clients');
  assert.deepEqual(changes, ['clients']);

  const parsed = router.parse!()();
  assert.equal(parsed.resource?.name, 'customers');
  assert.equal(parsed.pathname, '/crm');
});

test('CrmView integrates Refine <Refine>, simple-rest provider, and preserves profiler/video contracts', () => {
  const crmViewSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/CrmView.tsx'), 'utf8');
  const providersSrc = fs.readFileSync(path.join(process.cwd(), 'src/crm/refineProviders.ts'), 'utf8');

  assert.match(crmViewSrc, /from '@refinedev\/core'/);
  assert.match(crmViewSrc, /<Refine\b/);
  assert.match(crmViewSrc, /useList</);
  assert.match(crmViewSrc, /useMenu\(/);
  assert.match(crmViewSrc, /<PerformanceProfiler id="CrmView\.CatalogProductList"/);
  assert.match(crmViewSrc, /<VideoBackground/);
  assert.match(providersSrc, /from '@refinedev\/simple-rest'/);
});
