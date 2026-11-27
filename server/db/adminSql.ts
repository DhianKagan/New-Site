import fs from 'node:fs';
import path from 'node:path';
import type {
  CatalogIntegrityReport,
  DbColumnMeta,
  DbOverviewResponse,
  DbQueryResponse,
  DbRowsResponse,
  DbTableMeta,
} from '../../src/types.ts';
import { isS3Configured, listAllS3Keys, listLocalVolumeFiles } from '../storage.ts';
import { listProjectCases, listProducts } from './catalog.ts';
import { getPool, isDatabaseConfigured } from './client.ts';
import { listContacts } from './contacts.ts';
import { listCustomerAccounts } from './customers.ts';
import { listDeals } from './deals.ts';
import { getSetting, listRecentAnalyticsEvents, listRecentClientErrorLogs, setSetting, deleteSetting } from './settings.ts';
import { listStaffUsers } from './staff.ts';
import { listNotes, listTasks } from './tasks.ts';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

const REDACTED_HASH_SENTINEL = '[PROTECTED_HASH]';

function sanitizeRowForBrowser(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row };
  if ((table === 'staff_users' || table === 'customer_accounts') && typeof copy.password_hash === 'string') {
    copy.password_hash = copy.password_hash ? REDACTED_HASH_SENTINEL : '';
  }
  if (table === 'settings' && copy.key === 'admin_password_hash') {
    copy.value = copy.value ? REDACTED_HASH_SENTINEL : '';
  }
  return copy;
}

function isNumericDataType(col: DbColumnMeta): boolean {
  const dt = col.dataType.toLowerCase();
  const udt = col.udtName.toLowerCase();
  return (
    dt.includes('int') ||
    dt.includes('numeric') ||
    dt.includes('decimal') ||
    dt.includes('real') ||
    dt.includes('double') ||
    udt.startsWith('int') ||
    udt.startsWith('float') ||
    udt === 'numeric'
  );
}

function isIntegerDataType(col: DbColumnMeta): boolean {
  const dt = col.dataType.toLowerCase();
  const udt = col.udtName.toLowerCase();
  return dt.includes('int') || udt === 'int2' || udt === 'int4' || udt === 'int8';
}

function isBooleanDataType(col: DbColumnMeta): boolean {
  return col.dataType.toLowerCase() === 'boolean' || col.udtName.toLowerCase() === 'bool';
}

function coerceColumnValue(rawValue: unknown, col: DbColumnMeta): unknown {
  if (rawValue === undefined) return undefined;
  if (rawValue === null) {
    if (!col.nullable) {
      throw new Error(`Поле "${col.name}" не може бути NULL`);
    }
    return null;
  }

  if (isBooleanDataType(col)) {
    if (typeof rawValue === 'boolean') return rawValue;
    const s = String(rawValue).trim().toLowerCase();
    if (s === '' && col.nullable) return null;
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    throw new Error(`Некоректне булеве значення для "${col.name}"`);
  }

  if (isNumericDataType(col)) {
    if (typeof rawValue === 'string' && rawValue.trim() === '') {
      if (col.nullable) return null;
      throw new Error(`Поле "${col.name}" вимагає числове значення`);
    }
    const num = Number(rawValue);
    if (!Number.isFinite(num)) {
      throw new Error(`Поле "${col.name}" має бути числом`);
    }
    return isIntegerDataType(col) ? Math.trunc(num) : num;
  }

  if (col.udtName === 'json' || col.udtName === 'jsonb') {
    if (typeof rawValue === 'string') {
      try {
        JSON.parse(rawValue);
        return rawValue;
      } catch {
        throw new Error(`Поле "${col.name}" містить невалідний JSON`);
      }
    }
    return JSON.stringify(rawValue);
  }

  return typeof rawValue === 'string' ? rawValue : String(rawValue);
}

async function fetchPgTableSchemas(): Promise<DbTableMeta[]> {
  const pool = getPool();

  const tablesRes = await pool.query<{
    table_name: string;
    total_bytes: string | number;
    est_rows: string | number;
  }>(`
    SELECT
      t.table_name,
      COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0) AS total_bytes,
      COALESCE(c.reltuples, 0)::bigint AS est_rows
    FROM information_schema.tables t
    LEFT JOIN pg_class c ON c.relname = t.table_name
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name ASC
  `);

  const colsRes = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
    is_identity: string;
  }>(`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      is_identity
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name ASC, ordinal_position ASC
  `);

  const pkRes = await pool.query<{ table_name: string; column_name: string }>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY tc.table_name ASC, kcu.ordinal_position ASC
  `);

  const fkRes = await pool.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
  `);

  const pkMap = new Map<string, string[]>();
  for (const r of pkRes.rows) {
    const arr = pkMap.get(r.table_name) ?? [];
    arr.push(r.column_name);
    pkMap.set(r.table_name, arr);
  }

  const fkMap = new Map<string, { table: string; column: string }>();
  for (const r of fkRes.rows) {
    fkMap.set(`${r.table_name}.${r.column_name}`, {
      table: r.foreign_table_name,
      column: r.foreign_column_name,
    });
  }

  const colsByTable = new Map<string, DbColumnMeta[]>();
  for (const c of colsRes.rows) {
    const pkCols = pkMap.get(c.table_name) ?? [];
    const fk = fkMap.get(`${c.table_name}.${c.column_name}`);
    const defaultVal = c.column_default;
    const isAuto =
      c.is_identity === 'YES' ||
      (typeof defaultVal === 'string' && defaultVal.toLowerCase().includes('nextval('));
    const arr = colsByTable.get(c.table_name) ?? [];
    arr.push({
      name: c.column_name,
      dataType: c.data_type,
      udtName: c.udt_name,
      nullable: c.is_nullable === 'YES',
      defaultValue: defaultVal,
      isPrimaryKey: pkCols.includes(c.column_name),
      isAutoGenerated: isAuto,
      ...(fk ? { foreignKey: fk } : {}),
    });
    colsByTable.set(c.table_name, arr);
  }

  // Exact counts for tables (small/medium tables — fast and accurate in CRM)
  const exactCounts = new Map<string, number>();
  await Promise.all(
    tablesRes.rows.map(async (t) => {
      try {
        const cntRes = await pool.query<{ cnt: string | number }>(
          `SELECT COUNT(*) AS cnt FROM ${quoteIdent(t.table_name)}`,
        );
        exactCounts.set(t.table_name, Number(cntRes.rows[0]?.cnt ?? 0) || 0);
      } catch {
        exactCounts.set(t.table_name, Math.max(0, Number(t.est_rows ?? 0) || 0));
      }
    }),
  );

  return tablesRes.rows.map((t) => {
    const pkCols = pkMap.get(t.table_name) ?? [];
    return {
      name: t.table_name,
      rowCount: exactCounts.get(t.table_name) ?? 0,
      totalBytes: Number(t.total_bytes ?? 0) || 0,
      primaryKey: pkCols,
      writable: pkCols.length > 0,
      columns: colsByTable.get(t.table_name) ?? [],
    };
  });
}

async function resolvePgTableMeta(tableName: string): Promise<DbTableMeta> {
  const schemas = await fetchPgTableSchemas();
  const found = schemas.find((t) => t.name === tableName);
  if (!found) {
    throw new Error(`Таблицю "${tableName}" не знайдено у базі даних`);
  }
  return found;
}

// ============================================================================
// In-Memory Fallback Inspection (Preview Mode without DATABASE_URL)
// ============================================================================

const MEMORY_SETTING_KEYS = [
  'exchange_rate_commercial',
  'exchange_rate_updated_at',
  'exchange_rate_updated_by',
  'social_links_json',
  'meta_pixel_id',
  'ga4_measurement_id',
  'gtm_container_id',
  'analytics_enabled',
  'admin_emails',
  'firebase_domain_rules_json',
];

async function buildMemoryDatasets(): Promise<
  Record<
    string,
    {
      primaryKey: string[];
      writable: boolean;
      columns: DbColumnMeta[];
      rows: Array<Record<string, unknown>>;
    }
  >
> {
  const [products, projects, deals, contacts, tasks, notes, staff, customers, analyticsEvents, errorLogs] =
    await Promise.all([
      listProducts(),
      listProjectCases(),
      listDeals(),
      listContacts(),
      listTasks(),
      listNotes(),
      listStaffUsers(),
      listCustomerAccounts(),
      listRecentAnalyticsEvents(100),
      listRecentClientErrorLogs(100),
    ]);

  const settingRows: Array<Record<string, unknown>> = [];
  for (const key of MEMORY_SETTING_KEYS) {
    const val = await getSetting(key);
    if (val !== null) {
      settingRows.push({ key, value: val, updated_at: new Date().toISOString() });
    }
  }

  const col = (name: string, dataType = 'text', pk = false, auto = false): DbColumnMeta => ({
    name,
    dataType,
    udtName: dataType,
    nullable: false,
    defaultValue: null,
    isPrimaryKey: pk,
    isAutoGenerated: auto,
  });

  return {
    products: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'text', true),
        col('sku', 'text'),
        col('title', 'text'),
        col('cat', 'text'),
        col('brand', 'text'),
        col('is_kit', 'integer'),
        col('price', 'integer'),
        col('old_price', 'integer'),
        col('in_stock', 'integer'),
        col('img', 'text'),
      ],
      rows: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        cat: p.cat,
        brand: p.brand,
        is_kit: p.isKit ? 1 : 0,
        price: p.price,
        old_price: p.oldPrice,
        in_stock: p.inStock ? 1 : 0,
        img: p.img,
      })),
    },
    projects: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'text', true),
        col('seg', 'text'),
        col('tag', 'text'),
        col('title', 'text'),
        col('specs', 'text'),
        col('img', 'text'),
      ],
      rows: projects.map((pr) => ({
        id: pr.id,
        seg: pr.seg,
        tag: pr.tag,
        title: pr.title,
        specs: pr.specs,
        img: pr.img,
      })),
    },
    deals: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('deal_number', 'text'),
        col('type', 'text'),
        col('stage', 'text'),
        col('customer_name', 'text'),
        col('phone', 'text'),
        col('customer_email', 'text'),
        col('city', 'text'),
        col('total_usd', 'integer'),
        col('assignee', 'text'),
        col('created_at', 'text'),
      ],
      rows: deals.map((d) => ({
        id: d.id,
        deal_number: d.dealNumber,
        type: d.type,
        stage: d.stage,
        customer_name: d.customerName,
        phone: d.phone,
        customer_email: d.customerEmail || '',
        city: d.city,
        total_usd: d.totalUsd,
        assignee: d.assignee,
        created_at: d.createdAt,
      })),
    },
    contacts: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('name', 'text'),
        col('company', 'text'),
        col('phone', 'text'),
        col('email', 'text'),
        col('city', 'text'),
        col('segment', 'text'),
        col('channel', 'text'),
      ],
      rows: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        phone: c.phone,
        email: c.email,
        city: c.city,
        segment: c.segment,
        channel: c.channel,
      })),
    },
    tasks: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('title', 'text'),
        col('status', 'text'),
        col('priority', 'text'),
        col('assignee', 'text'),
        col('due_date', 'text'),
        col('deal_id', 'integer'),
      ],
      rows: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        due_date: t.dueDate,
        deal_id: t.dealId,
      })),
    },
    notes: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('contact_id', 'integer'),
        col('deal_id', 'integer'),
        col('author', 'text'),
        col('body', 'text'),
        col('created_at', 'text'),
      ],
      rows: notes.map((n) => ({
        id: n.id,
        contact_id: n.contactId,
        deal_id: n.dealId,
        author: n.author,
        body: n.body,
        created_at: n.createdAt,
      })),
    },
    staff_users: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('name', 'text'),
        col('login', 'text'),
        col('email', 'text'),
        col('role', 'text'),
        col('position', 'text'),
        col('can_login', 'integer'),
        col('active', 'integer'),
      ],
      rows: staff.map((s) => ({
        id: s.id,
        name: s.name,
        login: s.login,
        email: s.email,
        role: s.role,
        position: s.position,
        can_login: s.canLogin ? 1 : 0,
        active: s.active ? 1 : 0,
      })),
    },
    customer_accounts: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('name', 'text'),
        col('email', 'text'),
        col('phone', 'text'),
        col('city', 'text'),
        col('auth_provider', 'text'),
        col('active', 'integer'),
      ],
      rows: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        auth_provider: c.authProvider,
        active: c.active ? 1 : 0,
      })),
    },
    settings: {
      primaryKey: ['key'],
      writable: true,
      columns: [col('key', 'text', true), col('value', 'text'), col('updated_at', 'text')],
      rows: settingRows,
    },
    analytics_events: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('event_name', 'text'),
        col('meta_event', 'text'),
        col('ga4_event', 'text'),
        col('created_at', 'text'),
      ],
      rows: analyticsEvents.map((e) => ({
        id: e.id,
        event_name: e.eventName,
        meta_event: e.metaEvent,
        ga4_event: e.ga4Event,
        created_at: e.createdAt,
      })),
    },
    client_error_logs: {
      primaryKey: ['id'],
      writable: false,
      columns: [
        col('id', 'integer', true, true),
        col('error_id', 'text'),
        col('kind', 'text'),
        col('message', 'text'),
        col('route', 'text'),
        col('created_at', 'text'),
      ],
      rows: errorLogs.map((e) => ({
        id: e.id,
        error_id: e.errorId,
        kind: e.kind,
        message: e.message,
        route: e.route,
        created_at: e.createdAt,
      })),
    },
  };
}

export async function getAdminDbOverview(): Promise<DbOverviewResponse> {
  if (!isDatabaseConfigured()) {
    const datasets = await buildMemoryDatasets();
    const tables: DbTableMeta[] = Object.entries(datasets).map(([name, d]) => ({
      name,
      rowCount: d.rows.length,
      totalBytes: Buffer.byteLength(JSON.stringify(d.rows), 'utf8'),
      primaryKey: d.primaryKey,
      writable: d.writable,
      columns: d.columns,
    }));
    return {
      mode: 'memory',
      connected: true,
      databaseName: 'in-memory-preview',
      hostLabel: 'AI Studio Preview (без DATABASE_URL)',
      version: 'In-Memory Store (CRM fallback)',
      sizeBytes: tables.reduce((s, t) => s + t.totalBytes, 0),
      activeConnections: 1,
      tables,
    };
  }

  const pool = getPool();
  const [infoRes, tables] = await Promise.all([
    pool.query<{
      db_name: string;
      pg_version: string;
      db_size: string | number;
      active_conns: string | number;
    }>(`
      SELECT
        current_database() AS db_name,
        split_part(version(), ' on ', 1) AS pg_version,
        pg_database_size(current_database()) AS db_size,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) AS active_conns
    `),
    fetchPgTableSchemas(),
  ]);

  let hostLabel = 'PostgreSQL';
  try {
    const raw = process.env.DATABASE_URL?.trim();
    if (raw) {
      const parsed = new URL(raw);
      hostLabel = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    }
  } catch {
    hostLabel = 'PostgreSQL';
  }

  const row = infoRes.rows[0];
  return {
    mode: 'postgresql',
    connected: true,
    databaseName: row?.db_name || 'postgres',
    hostLabel,
    version: row?.pg_version || 'PostgreSQL',
    sizeBytes: Number(row?.db_size ?? 0) || 0,
    activeConnections: Number(row?.active_conns ?? 1) || 1,
    tables,
  };
}

export async function listAdminDbTableRows(
  tableName: string,
  opts?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    search?: string;
    filterCol?: string;
    filterVal?: string;
  },
): Promise<DbRowsResponse> {
  const started = Date.now();
  const page = Math.max(1, Math.trunc(opts?.page ?? 1));
  const limit = Math.max(5, Math.min(100, Math.trunc(opts?.limit ?? 25)));
  const offset = (page - 1) * limit;
  const search = (opts?.search ?? '').trim();
  const filterCol = (opts?.filterCol ?? '').trim();
  const filterVal = (opts?.filterVal ?? '').trim();
  const sortDir = opts?.sortDir === 'asc' ? 'asc' : 'desc';

  if (!isDatabaseConfigured()) {
    const datasets = await buildMemoryDatasets();
    const ds = datasets[tableName];
    if (!ds) {
      throw new Error(`Таблицю "${tableName}" не знайдено`);
    }
    let filtered = [...ds.rows];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
      );
    }
    if (filterCol && filterVal && ds.columns.some((c) => c.name === filterCol)) {
      const fq = filterVal.toLowerCase();
      filtered = filtered.filter((r) => String(r[filterCol] ?? '').toLowerCase().includes(fq));
    }
    const sortCol =
      opts?.sortBy && ds.columns.some((c) => c.name === opts.sortBy)
        ? opts.sortBy
        : ds.primaryKey[0] || ds.columns[0]?.name || '';
    if (sortCol) {
      filtered.sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''), 'uk')
          : String(bv ?? '').localeCompare(String(av ?? ''), 'uk');
      });
    }
    const paged = filtered.slice(offset, offset + limit).map((r) => sanitizeRowForBrowser(tableName, r));
    return {
      mode: 'memory',
      table: tableName,
      primaryKey: ds.primaryKey,
      writable: ds.writable,
      columns: ds.columns,
      rows: paged,
      total: filtered.length,
      page,
      limit,
      executionMs: Date.now() - started,
    };
  }

  const meta = await resolvePgTableMeta(tableName);
  const colNames = new Set(meta.columns.map((c) => c.name));
  const pool = getPool();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search}%`);
    const pIdx = params.length;
    const orParts = meta.columns.map((c) => `CAST(${quoteIdent(c.name)} AS TEXT) ILIKE $${pIdx}`);
    if (orParts.length > 0) {
      conditions.push(`(${orParts.join(' OR ')})`);
    }
  }

  if (filterCol && filterVal && colNames.has(filterCol)) {
    params.push(`%${filterVal}%`);
    conditions.push(`CAST(${quoteIdent(filterCol)} AS TEXT) ILIKE $${params.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol =
    opts?.sortBy && colNames.has(opts.sortBy)
      ? opts.sortBy
      : meta.primaryKey[0] || meta.columns[0]?.name || '';
  const orderSql = sortCol ? `ORDER BY ${quoteIdent(sortCol)} ${sortDir.toUpperCase()}` : '';

  const countRes = await pool.query<{ cnt: string | number }>(
    `SELECT COUNT(*) AS cnt FROM ${quoteIdent(meta.name)} ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0]?.cnt ?? 0) || 0;

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rowsRes = await pool.query<Record<string, unknown>>(
    `SELECT * FROM ${quoteIdent(meta.name)} ${whereSql} ${orderSql} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  );

  return {
    mode: 'postgresql',
    table: meta.name,
    primaryKey: meta.primaryKey,
    writable: meta.writable,
    columns: meta.columns,
    rows: rowsRes.rows.map((r) => sanitizeRowForBrowser(meta.name, r)),
    total,
    page,
    limit,
    executionMs: Date.now() - started,
  };
}

export async function insertAdminDbRow(
  tableName: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isDatabaseConfigured()) {
    if (tableName === 'settings') {
      const key = String(values.key ?? '').trim();
      const value = String(values.value ?? '');
      if (!key || key === 'admin_password_hash') {
        throw new Error('Вкажіть коректний ключ налаштування');
      }
      await setSetting(key, value);
      return { key, value, updated_at: new Date().toISOString() };
    }
    throw new Error('Пряме додавання SQL-рядків доступне лише при підключеному PostgreSQL (DATABASE_URL)');
  }

  const meta = await resolvePgTableMeta(tableName);
  const colMap = new Map(meta.columns.map((c) => [c.name, c]));

  const insertCols: string[] = [];
  const insertVals: unknown[] = [];

  for (const [colName, rawVal] of Object.entries(values)) {
    const colMeta = colMap.get(colName);
    if (!colMeta) continue;
    if (colMeta.isAutoGenerated && (rawVal === undefined || rawVal === null || rawVal === '')) {
      continue;
    }
    const coerced = coerceColumnValue(rawVal, colMeta);
    if (coerced === undefined) continue;
    insertCols.push(colName);
    insertVals.push(coerced);
  }

  if (insertCols.length === 0) {
    throw new Error('Передайте хоча б одне поле для створення рядка');
  }

  const colsSql = insertCols.map(quoteIdent).join(', ');
  const placeholdersSql = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');
  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `INSERT INTO ${quoteIdent(meta.name)} (${colsSql}) VALUES (${placeholdersSql}) RETURNING *`,
    insertVals,
  );
  return sanitizeRowForBrowser(meta.name, res.rows[0] ?? {});
}

export async function updateAdminDbRow(
  tableName: string,
  pk: Record<string, unknown>,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!isDatabaseConfigured()) {
    if (tableName === 'settings') {
      const key = String(pk.key ?? '').trim();
      if (!key || key === 'admin_password_hash') {
        throw new Error('Редагування цього ключа заборонено');
      }
      const nextVal = String(updates.value ?? '');
      await setSetting(key, nextVal);
      return { key, value: nextVal, updated_at: new Date().toISOString() };
    }
    throw new Error('Пряме редагування SQL-рядків доступне лише при підключеному PostgreSQL (DATABASE_URL)');
  }

  const meta = await resolvePgTableMeta(tableName);
  if (meta.primaryKey.length === 0) {
    throw new Error(`Таблиця "${meta.name}" не має первинного ключа`);
  }
  const colMap = new Map(meta.columns.map((c) => [c.name, c]));

  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [colName, rawVal] of Object.entries(updates)) {
    const colMeta = colMap.get(colName);
    if (!colMeta) continue;
    if (meta.primaryKey.includes(colName)) continue;
    if (colName === 'password_hash' && rawVal === REDACTED_HASH_SENTINEL) continue;
    if (tableName === 'settings' && pk.key === 'admin_password_hash' && rawVal === REDACTED_HASH_SENTINEL) {
      continue;
    }
    const coerced = coerceColumnValue(rawVal, colMeta);
    if (coerced === undefined) continue;
    params.push(coerced);
    setClauses.push(`${quoteIdent(colName)} = $${params.length}`);
  }

  if (setClauses.length === 0) {
    throw new Error('Немає змін для збереження');
  }

  const whereParts: string[] = [];
  for (const pkCol of meta.primaryKey) {
    const colMeta = colMap.get(pkCol);
    if (!colMeta) throw new Error(`Первинний ключ "${pkCol}" не знайдено`);
    if (pk[pkCol] === undefined || pk[pkCol] === null || pk[pkCol] === '') {
      throw new Error(`Не передано значення первинного ключа "${pkCol}"`);
    }
    const coercedPk = coerceColumnValue(pk[pkCol], colMeta);
    params.push(coercedPk);
    whereParts.push(`${quoteIdent(pkCol)} = $${params.length}`);
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `UPDATE ${quoteIdent(meta.name)} SET ${setClauses.join(', ')} WHERE ${whereParts.join(' AND ')} RETURNING *`,
    params,
  );
  const updated = res.rows[0];
  return updated ? sanitizeRowForBrowser(meta.name, updated) : null;
}

export async function deleteAdminDbRows(
  tableName: string,
  pks: Array<Record<string, unknown>>,
): Promise<{ deleted: number }> {
  if (pks.length === 0) return { deleted: 0 };

  if (!isDatabaseConfigured()) {
    if (tableName === 'settings') {
      let deleted = 0;
      for (const pk of pks) {
        const key = String(pk.key ?? '').trim();
        if (!key || key === 'admin_password_hash') continue;
        await deleteSetting(key);
        deleted += 1;
      }
      return { deleted };
    }
    throw new Error('Видалення SQL-рядків доступне лише при підключеному PostgreSQL (DATABASE_URL)');
  }

  const meta = await resolvePgTableMeta(tableName);
  if (meta.primaryKey.length === 0) {
    throw new Error(`Таблиця "${meta.name}" не має первинного ключа`);
  }
  const colMap = new Map(meta.columns.map((c) => [c.name, c]));
  const pool = getPool();
  let deleted = 0;

  for (const pk of pks.slice(0, 100)) {
    const whereParts: string[] = [];
    const params: unknown[] = [];
    for (const pkCol of meta.primaryKey) {
      const colMeta = colMap.get(pkCol);
      if (!colMeta) continue;
      if (pk[pkCol] === undefined || pk[pkCol] === null) {
        throw new Error(`Не передано первинний ключ "${pkCol}"`);
      }
      params.push(coerceColumnValue(pk[pkCol], colMeta));
      whereParts.push(`${quoteIdent(pkCol)} = $${params.length}`);
    }
    const res = await pool.query(
      `DELETE FROM ${quoteIdent(meta.name)} WHERE ${whereParts.join(' AND ')}`,
      params,
    );
    deleted += res.rowCount ?? 0;
  }

  return { deleted };
}

const BLOCKED_DESTRUCTIVE_DDL_RE = /\b(DROP\s+DATABASE|DROP\s+SCHEMA|CREATE\s+DATABASE|ALTER\s+SYSTEM)\b/i;

function assertSafeReadOnlySql(sqlText: string): void {
  const withoutStrings = sqlText
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
  const strippedTrailingSemicolons = withoutStrings.replace(/;+\s*$/, '');
  if (strippedTrailingSemicolons.includes(';')) {
    throw new Error('У режимі Read-Only дозволено виконувати лише один SQL-запит за раз (без «;» всередині)');
  }
  if (!/^(SELECT|WITH|EXPLAIN|SHOW)\b/i.test(strippedTrailingSemicolons)) {
    throw new Error('У режимі Read-Only дозволені лише запити SELECT / WITH / EXPLAIN / SHOW');
  }
  if (/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|COMMIT|ROLLBACK|COPY|CALL|DO)\b/i.test(strippedTrailingSemicolons)) {
    throw new Error('Операції зміни даних заблоковані в режимі Read-Only — увімкніть режим запису за потреби');
  }
}

export async function executeAdminSqlQuery(
  sqlText: string,
  opts?: { allowWrite?: boolean },
): Promise<DbQueryResponse> {
  const cleanSql = sqlText.trim();
  if (!cleanSql) {
    throw new Error('Введіть SQL-запит');
  }
  if (BLOCKED_DESTRUCTIVE_DDL_RE.test(cleanSql)) {
    throw new Error('Операції DROP DATABASE / DROP SCHEMA / ALTER SYSTEM заблоковані з міркувань безпеки');
  }

  const readOnly = !opts?.allowWrite;
  if (readOnly) {
    assertSafeReadOnlySql(cleanSql);
  }
  const started = Date.now();

  if (!isDatabaseConfigured()) {
    const simpleSelect = cleanSql.match(/^SELECT\s+\*\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?(?:\s+LIMIT\s+(\d+))?;?$/i);
    if (!simpleSelect) {
      throw new Error(
        'Зараз сайт працює у режимі превью без PostgreSQL (DATABASE_URL не задано). У цьому режимі підтримуються перегляд таблиць або простий запит виду: SELECT * FROM deals LIMIT 20;',
      );
    }
    const tableName = simpleSelect[1];
    const limitVal = Math.min(500, Math.max(1, Number(simpleSelect[2] || 100)));
    const datasets = await buildMemoryDatasets();
    const ds = datasets[tableName];
    if (!ds) {
      throw new Error(`Таблицю "${tableName}" не знайдено у пам’яті превью`);
    }
    const rows = ds.rows.slice(0, limitVal).map((r) => sanitizeRowForBrowser(tableName, r));
    return {
      mode: 'memory',
      columns: ds.columns.map((c) => c.name),
      rows,
      rowCount: rows.length,
      command: 'SELECT',
      durationMs: Date.now() - started,
      truncated: ds.rows.length > limitVal,
      readOnly: true,
    };
  }

  const client = await getPool().connect();
  try {
    if (readOnly) {
      await client.query('SET default_transaction_read_only = on');
    }
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    await client.query('SET LOCAL statement_timeout = 10000');
    const rawResult = await client.query<Record<string, unknown>>(cleanSql);
    await client.query('COMMIT');

    const lastResult = (Array.isArray(rawResult) ? rawResult[rawResult.length - 1] : rawResult) as
      | { rows?: Array<Record<string, unknown>>; fields?: Array<{ name: string }>; rowCount?: number | null; command?: string }
      | undefined;
    const allRows = lastResult?.rows ?? [];
    const truncated = allRows.length > 500;
    const cappedRows = (truncated ? allRows.slice(0, 500) : allRows).map((r) => {
      const sanitized = { ...r };
      if (typeof sanitized.password_hash === 'string' && sanitized.password_hash) {
        sanitized.password_hash = REDACTED_HASH_SENTINEL;
      }
      if (sanitized.key === 'admin_password_hash' && sanitized.value) {
        sanitized.value = REDACTED_HASH_SENTINEL;
      }
      return sanitized;
    });
    const columns =
      lastResult?.fields?.map((f) => f.name) ||
      (cappedRows[0] ? Object.keys(cappedRows[0]) : []);

    return {
      mode: 'postgresql',
      columns,
      rows: cappedRows,
      rowCount: lastResult?.rowCount ?? cappedRows.length,
      command: lastResult?.command || 'SQL',
      durationMs: Date.now() - started,
      truncated,
      readOnly,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    if (readOnly) {
      try {
        await client.query('RESET default_transaction_read_only');
      } catch {
        // ignore reset error
      }
    }
    client.release();
  }
}

export async function exportAdminDbTable(
  tableName: string,
  format: 'json' | 'csv',
): Promise<{ content: string; contentType: string; fileName: string }> {
  let rows: Array<Record<string, unknown>> = [];
  let columns: string[] = [];

  if (!isDatabaseConfigured()) {
    const datasets = await buildMemoryDatasets();
    const ds = datasets[tableName];
    if (!ds) throw new Error(`Таблицю "${tableName}" не знайдено`);
    columns = ds.columns.map((c) => c.name);
    rows = ds.rows.map((r) => sanitizeRowForBrowser(tableName, r));
  } else {
    const meta = await resolvePgTableMeta(tableName);
    columns = meta.columns.map((c) => c.name);
    const res = await getPool().query<Record<string, unknown>>(
      `SELECT * FROM ${quoteIdent(meta.name)} LIMIT 10000`,
    );
    rows = res.rows.map((r) => sanitizeRowForBrowser(meta.name, r));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const headerLine = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const bodyLines = rows.map((row) =>
      columns
        .map((c) => {
          const val = row[c];
          const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    return {
      content: `\uFEFF${[headerLine, ...bodyLines].join('\n')}`,
      contentType: 'text/csv; charset=utf-8',
      fileName: `${tableName}-${stamp}.csv`,
    };
  }

  return {
    content: JSON.stringify({ table: tableName, exportedAt: new Date().toISOString(), rows }, null, 2),
    contentType: 'application/json; charset=utf-8',
    fileName: `${tableName}-${stamp}.json`,
  };
}

export async function getCatalogAndSiteIntegrityReport(): Promise<CatalogIntegrityReport> {
  const [products, projects, deals, volumeFiles, s3Keys] = await Promise.all([
    listProducts(),
    listProjectCases(),
    listDeals(),
    listLocalVolumeFiles(),
    isS3Configured() ? listAllS3Keys('uploads/', 2000).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
  ]);

  const zeroPriceProducts = products
    .filter((p) => !p.price || p.price <= 0)
    .slice(0, 50)
    .map((p) => ({ id: p.id, sku: p.sku, title: p.title }));

  const skuCounts = new Map<string, number>();
  for (const p of products) {
    const cleanSku = p.sku.trim();
    if (!cleanSku) continue;
    skuCounts.set(cleanSku, (skuCounts.get(cleanSku) ?? 0) + 1);
  }
  const duplicateSkus = Array.from(skuCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([sku, count]) => ({ sku, count }));

  const volumeNameSet = new Set(volumeFiles.map((f) => f.fileName));
  const publicDir = path.resolve(process.cwd(), 'public');
  const brokenLocalImages: CatalogIntegrityReport['brokenLocalImages'] = [];
  const referencedUploads = new Set<string>();

  const checkImg = (kind: 'product' | 'project', id: string, title: string, img: string) => {
    const cleanImg = (img || '').trim();
    if (!cleanImg) {
      brokenLocalImages.push({ kind, id, title, img: '(порожньо)' });
      return;
    }
    if (/^https?:\/\//i.test(cleanImg)) return;

    if (cleanImg.startsWith('/uploads/')) {
      const fileName = decodeURIComponent(cleanImg.slice('/uploads/'.length).split('?')[0]);
      referencedUploads.add(fileName);
      const inVolume = volumeNameSet.has(fileName);
      const inS3 = s3Keys.has(`uploads/${fileName}`);
      const inPublicUploads = fs.existsSync(path.resolve(publicDir, 'uploads', fileName));
      if (!inVolume && !inS3 && !inPublicUploads) {
        brokenLocalImages.push({ kind, id, title, img: cleanImg });
      }
      return;
    }

    if (cleanImg.startsWith('/assets/')) {
      const rel = cleanImg.replace(/^\/+/, '').split('?')[0];
      const full = path.resolve(publicDir, rel);
      if (!full.startsWith(publicDir + path.sep) || !fs.existsSync(full)) {
        brokenLocalImages.push({ kind, id, title, img: cleanImg });
      }
    }
  };

  for (const p of products) checkImg('product', p.id, p.title, p.img);
  for (const pr of projects) checkImg('project', pr.id, pr.title, pr.img);

  return {
    checkedAt: new Date().toISOString(),
    productsCount: products.length,
    projectsCount: projects.length,
    dealsCount: deals.length,
    zeroPriceProducts,
    duplicateSkus,
    brokenLocalImages: brokenLocalImages.slice(0, 60),
    uploadsReferencedCount: referencedUploads.size,
    uploadsOnVolumeCount: volumeFiles.length,
    uploadsInS3Count: s3Keys.size,
  };
}
