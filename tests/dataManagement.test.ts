import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  executeAdminSqlQuery,
  getAdminDbOverview,
  getCatalogAndSiteIntegrityReport,
  insertAdminDbRow,
  listAdminDbTableRows,
} from '../server/db/adminSql.ts';
import {
  guessContentTypeFromKey,
  sanitizeLocalFileName,
  sanitizeS3Key,
  sanitizeS3Prefix,
} from '../server/storage.ts';
import {
  adminDbQuerySchema,
  adminDbRowDeleteSchema,
  adminDbRowInsertSchema,
  adminDbRowUpdateSchema,
  s3DeleteSchema,
  s3RenameSchema,
  volumeDeleteSchema,
} from '../server/validation.ts';

test('admin SQL validation schemas enforce safe identifiers and payload bounds', () => {
  assert.equal(adminDbQuerySchema.safeParse({ sql: 'SELECT * FROM deals LIMIT 10;', allowWrite: false }).success, true);
  assert.equal(adminDbQuerySchema.safeParse({ sql: '   ' }).success, false);

  assert.equal(
    adminDbRowInsertSchema.safeParse({ values: { key: 'custom_flag', value: '1' } }).success,
    true,
  );
  assert.equal(
    adminDbRowInsertSchema.safeParse({ values: { 'bad-col; DROP': '1' } }).success,
    false,
  );

  assert.equal(
    adminDbRowUpdateSchema.safeParse({ pk: { id: 10 }, updates: { stage: 'new' } }).success,
    true,
  );
  assert.equal(
    adminDbRowDeleteSchema.safeParse({ pks: [{ id: 1 }, { id: 2 }] }).success,
    true,
  );
  assert.equal(adminDbRowDeleteSchema.safeParse({ pks: [] }).success, false);

  assert.equal(
    s3RenameSchema.safeParse({ sourceKey: 'uploads/a.png', targetKey: 'uploads/b.png' }).success,
    true,
  );
  assert.equal(s3DeleteSchema.safeParse({ keys: ['uploads/a.png'] }).success, true);
  assert.equal(volumeDeleteSchema.safeParse({ fileNames: ['a.png'] }).success, true);
});

test('S3 and local volume sanitizers block path traversal, null bytes, and disallowed extensions', () => {
  assert.equal(sanitizeS3Key('/uploads//banner.webp'), 'uploads/banner.webp');
  assert.equal(sanitizeS3Key('../secrets.env'), null);
  assert.equal(sanitizeS3Key('uploads/../etc/passwd'), null);
  assert.equal(sanitizeS3Key('uploads/bad\0key.png'), null);
  assert.equal(sanitizeS3Key('uploads/script<xss>.png'), null);

  assert.equal(sanitizeS3Prefix('/uploads/2026'), 'uploads/2026/');
  assert.equal(sanitizeS3Prefix(''), '');
  assert.equal(sanitizeS3Prefix('../bad'), '');

  assert.equal(sanitizeLocalFileName('Solar Panel 2026.png'), 'Solar-Panel-2026.png');
  assert.equal(sanitizeLocalFileName('../../evil.png'), 'evil.png');
  assert.equal(sanitizeLocalFileName('malware.exe'), null);
  assert.equal(sanitizeLocalFileName('index.html'), null);
  assert.equal(sanitizeLocalFileName('.hidden.png'), null);

  assert.equal(guessContentTypeFromKey('docs/spec.pdf'), 'application/pdf');
  assert.equal(guessContentTypeFromKey('img/photo.webp'), 'image/webp');
});

test('adminSql in-memory preview mode inspects tables, redacts sensitive hashes, and blocks destructive SQL', async () => {
  const prevDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const overview = await getAdminDbOverview();
    assert.equal(overview.mode, 'memory');
    assert.ok(overview.tables.some((t) => t.name === 'products'));
    assert.ok(overview.tables.some((t) => t.name === 'deals'));
    assert.ok(overview.tables.some((t) => t.name === 'settings'));

    const rowsRes = await listAdminDbTableRows('products', { page: 1, limit: 10 });
    assert.equal(rowsRes.mode, 'memory');
    assert.ok(rowsRes.rows.length > 0);

    const queryRes = await executeAdminSqlQuery('SELECT * FROM deals LIMIT 5;', { allowWrite: false });
    assert.equal(queryRes.mode, 'memory');
    assert.equal(queryRes.readOnly, true);

    await assert.rejects(
      () => executeAdminSqlQuery('DROP DATABASE postgres;', { allowWrite: true }),
      /DROP DATABASE/,
    );
    await assert.rejects(
      () => executeAdminSqlQuery('SELECT 1; COMMIT; DELETE FROM deals;', { allowWrite: false }),
      /Read-Only/,
    );
    await assert.rejects(
      () => insertAdminDbRow('settings', { key: 'admin_password_hash', value: 'hacked' }),
      /коректний ключ/,
    );

    const integrity = await getCatalogAndSiteIntegrityReport();
    assert.ok(integrity.productsCount > 0);
    assert.ok(integrity.projectsCount > 0);
  } finally {
    if (prevDbUrl !== undefined) {
      process.env.DATABASE_URL = prevDbUrl;
    }
  }
});

test('server.ts enforces admin role on all SQL DB, S3, and Volume data-management endpoints', () => {
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const expectedAdminRoutes = [
    '/api/crm/data/db/overview',
    '/api/crm/data/db/tables/:table/rows',
    '/api/crm/data/db/query',
    '/api/crm/data/db/export',
    '/api/crm/data/integrity',
    '/api/crm/data/storage/overview',
    '/api/crm/data/s3/objects',
    '/api/crm/data/s3/object',
    '/api/crm/data/s3/upload',
    '/api/crm/data/s3/rename',
    '/api/crm/data/s3/migrate-from-volume',
    '/api/crm/data/volume/files',
    '/api/crm/data/volume/file',
    '/api/crm/data/volume/upload',
  ];
  for (const route of expectedAdminRoutes) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(serverSrc, new RegExp(`'${escaped}'\\s*,\\s*requireRoles\\('admin'\\)`), route);
  }
});
