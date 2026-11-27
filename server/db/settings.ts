import fs from 'node:fs';
import { count, desc, eq, notInArray, sql } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type {
  ClientErrorKind,
  ClientErrorRecord,
  SocialLinksConfig,
  StorageDiagnostics,
} from '../../src/types.ts';
import { getDb, getPool, isDatabaseConfigured } from './client.ts';
import { DATA_DIR, getUploadsDir, safeJsonParse } from './utils.ts';

let analyticsInsertCounter = 0;
let errorLogInsertCounter = 0;
const inMemorySettings = new Map<string, string>();
const inMemoryAnalyticsEvents: Array<{
  id: number;
  eventName: string;
  metaEvent: string;
  ga4Event: string;
  payload: Record<string, string | number>;
  createdAt: string;
}> = [];
const inMemoryErrorLogs: ClientErrorRecord[] = [];
let inMemoryAnalyticsSeq = 1;
let inMemoryErrorSeq = 1;

export async function getSetting(key: string): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return inMemorySettings.get(key) ?? null;
  }
  const db = getDb();
  const [row] = await db
    .select({ value: schema.settingsTable.value })
    .from(schema.settingsTable)
    .where(eq(schema.settingsTable.key, key))
    .limit(1);
  return row ? String(row.value) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    inMemorySettings.set(key, value);
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(schema.settingsTable)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.settingsTable.key,
      set: { value, updatedAt: now },
    });
}

export async function setSettingIfAbsent(key: string, value: string): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    if (inMemorySettings.has(key)) return false;
    inMemorySettings.set(key, value);
    return true;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.settingsTable)
    .values({ key, value, updatedAt: now })
    .onConflictDoNothing({ target: schema.settingsTable.key })
    .returning({ key: schema.settingsTable.key });
  return inserted.length > 0;
}

export async function deleteSetting(key: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    inMemorySettings.delete(key);
    return;
  }
  const db = getDb();
  await db.delete(schema.settingsTable).where(eq(schema.settingsTable.key, key));
}

export async function getPublicAnalyticsConfig(): Promise<{
  metaPixelId: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  analyticsEnabled: boolean;
}> {
  const [metaSetting, ga4Setting, gtmSetting, enabledSetting] = await Promise.all([
    getSetting('meta_pixel_id'),
    getSetting('ga4_measurement_id'),
    getSetting('gtm_container_id'),
    getSetting('analytics_enabled'),
  ]);
  const metaPixelId = (metaSetting ?? process.env.META_PIXEL_ID ?? '').trim();
  const ga4MeasurementId = (ga4Setting ?? process.env.GA4_MEASUREMENT_ID ?? '').trim();
  const gtmContainerId = (gtmSetting ?? process.env.GTM_CONTAINER_ID ?? '').trim();
  const analyticsEnabled = enabledSetting === null ? true : enabledSetting === 'true';

  return {
    metaPixelId,
    ga4MeasurementId,
    gtmContainerId,
    analyticsEnabled,
  };
}

export async function saveAnalyticsSettings(input: {
  metaPixelId: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  analyticsEnabled: boolean;
}): Promise<void> {
  await Promise.all([
    setSetting('meta_pixel_id', input.metaPixelId),
    setSetting('ga4_measurement_id', input.ga4MeasurementId),
    setSetting('gtm_container_id', input.gtmContainerId),
    setSetting('analytics_enabled', input.analyticsEnabled ? 'true' : 'false'),
  ]);
}

export async function recordAnalyticsEvent(
  eventName: string,
  metaEvent: string,
  ga4Event: string,
  payload: Record<string, string | number>,
): Promise<void> {
  if (!isDatabaseConfigured()) {
    inMemoryAnalyticsEvents.unshift({
      id: inMemoryAnalyticsSeq++,
      eventName,
      metaEvent,
      ga4Event,
      payload,
      createdAt: new Date().toISOString(),
    });
    if (inMemoryAnalyticsEvents.length > 100) {
      inMemoryAnalyticsEvents.length = 100;
    }
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(schema.analyticsEventsTable).values({
    eventName,
    metaEvent,
    ga4Event,
    payloadJson: JSON.stringify(payload),
    createdAt: now,
  });

  // Keep only last 100 events (pruned periodically to avoid write amplification)
  analyticsInsertCounter += 1;
  if (analyticsInsertCounter % 25 === 0) {
    const keepRows = await db
      .select({ id: schema.analyticsEventsTable.id })
      .from(schema.analyticsEventsTable)
      .orderBy(desc(schema.analyticsEventsTable.id))
      .limit(100);
    const keepIds = keepRows.map((r) => r.id);
    if (keepIds.length >= 100) {
      await db
        .delete(schema.analyticsEventsTable)
        .where(notInArray(schema.analyticsEventsTable.id, keepIds));
    }
  }
}

export async function listRecentAnalyticsEvents(limit = 35): Promise<
  Array<{
    id: number;
    eventName: string;
    metaEvent: string;
    ga4Event: string;
    payload: Record<string, string | number>;
    createdAt: string;
  }>
> {
  if (!isDatabaseConfigured()) {
    const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
    return inMemoryAnalyticsEvents.slice(0, safeLimit);
  }
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await db
    .select()
    .from(schema.analyticsEventsTable)
    .orderBy(desc(schema.analyticsEventsTable.id))
    .limit(safeLimit);

  return rows.map((r) => ({
    id: r.id,
    eventName: r.eventName,
    metaEvent: r.metaEvent,
    ga4Event: r.ga4Event,
    payload: safeJsonParse<Record<string, string | number>>(r.payloadJson, {}),
    createdAt: r.createdAt,
  }));
}

export async function recordClientErrorLog(input: {
  errorId: string;
  kind: ClientErrorKind;
  name: string;
  message: string;
  stack: string;
  componentStack: string;
  route: string;
  locale: 'uk' | 'ru';
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    inMemoryErrorLogs.unshift({
      id: inMemoryErrorSeq++,
      errorId: input.errorId,
      kind: input.kind,
      name: input.name,
      message: input.message,
      stack: input.stack,
      componentStack: input.componentStack,
      route: input.route,
      locale: input.locale,
      createdAt: new Date().toISOString(),
    });
    if (inMemoryErrorLogs.length > 200) {
      inMemoryErrorLogs.length = 200;
    }
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(schema.clientErrorLogsTable).values({
    errorId: input.errorId,
    kind: input.kind,
    name: input.name,
    message: input.message,
    stack: input.stack,
    componentStack: input.componentStack,
    route: input.route,
    locale: input.locale,
    createdAt: now,
  });

  // Bound stored client error records to latest 200 entries
  errorLogInsertCounter += 1;
  if (errorLogInsertCounter % 20 === 0) {
    const keepRows = await db
      .select({ id: schema.clientErrorLogsTable.id })
      .from(schema.clientErrorLogsTable)
      .orderBy(desc(schema.clientErrorLogsTable.id))
      .limit(200);
    const keepIds = keepRows.map((r) => r.id);
    if (keepIds.length >= 200) {
      await db
        .delete(schema.clientErrorLogsTable)
        .where(notInArray(schema.clientErrorLogsTable.id, keepIds));
    }
  }
}

export async function listRecentClientErrorLogs(limit = 30): Promise<ClientErrorRecord[]> {
  if (!isDatabaseConfigured()) {
    const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
    return inMemoryErrorLogs.slice(0, safeLimit);
  }
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await db
    .select()
    .from(schema.clientErrorLogsTable)
    .orderBy(desc(schema.clientErrorLogsTable.id))
    .limit(safeLimit);

  return rows.map((r) => {
    const rawKind = String(r.kind || 'react_boundary');
    const kind: ClientErrorKind =
      rawKind === 'window_error' || rawKind === 'unhandled_rejection' ? rawKind : 'react_boundary';
    return {
      id: r.id,
      errorId: r.errorId,
      kind,
      name: r.name,
      message: r.message,
      stack: r.stack || '',
      componentStack: r.componentStack || '',
      route: r.route || '/',
      locale: r.locale || 'uk',
      createdAt: r.createdAt,
    };
  });
}

export async function clearClientErrorLogs(): Promise<void> {
  if (!isDatabaseConfigured()) {
    inMemoryErrorLogs.length = 0;
    return;
  }
  const db = getDb();
  await db.delete(schema.clientErrorLogsTable);
}

const DEFAULT_SOCIAL_LINKS: SocialLinksConfig = {
  telegram: 'https://t.me/+380507777172',
  instagram: '',
  facebook: 'https://www.facebook.com/energocomfort.shop',
  youtube: '',
  viber: '',
  tiktok: '',
};

export async function getSocialLinks(): Promise<SocialLinksConfig> {
  const raw = await getSetting('social_links_json');
  if (!raw) return { ...DEFAULT_SOCIAL_LINKS };
  const parsed = safeJsonParse<Partial<SocialLinksConfig>>(raw, {});
  return {
    telegram: typeof parsed.telegram === 'string' ? parsed.telegram : DEFAULT_SOCIAL_LINKS.telegram,
    instagram: typeof parsed.instagram === 'string' ? parsed.instagram : '',
    facebook: typeof parsed.facebook === 'string' ? parsed.facebook : DEFAULT_SOCIAL_LINKS.facebook,
    youtube: typeof parsed.youtube === 'string' ? parsed.youtube : '',
    viber: typeof parsed.viber === 'string' ? parsed.viber : '',
    tiktok: typeof parsed.tiktok === 'string' ? parsed.tiktok : '',
  };
}

export async function saveSocialLinks(links: SocialLinksConfig): Promise<void> {
  await setSetting('social_links_json', JSON.stringify(links));
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  const uploadsDir = getUploadsDir();
  if (!isDatabaseConfigured()) {
    let uploadsCount = 0;
    try {
      uploadsCount = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.')).length;
    } catch {
      uploadsCount = 0;
    }
    return {
      dataDir: DATA_DIR,
      dbPath: 'in-memory (mock)',
      dbSizeBytes: 0,
      uploadsDir,
      uploadsCount,
      productsCount: 0,
      projectsCount: 0,
      dealsCount: 0,
      isCustomVolume: Boolean(process.env.S3_BUCKET?.trim() || process.env.DATA_DIR?.trim()),
    };
  }
  const db = getDb();
  const pool = getPool();

  let dbSizeBytes = 0;
  try {
    const res = await pool.query<{ size: string | number }>(
      'SELECT pg_database_size(current_database()) AS size',
    );
    dbSizeBytes = Number(res.rows[0]?.size ?? 0) || 0;
  } catch {
    dbSizeBytes = 0;
  }

  let uploadsCount = 0;
  try {
    uploadsCount = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.')).length;
  } catch {
    uploadsCount = 0;
  }

  const [[prodCnt], [projCnt], [dealCnt]] = await Promise.all([
    db.select({ cnt: count() }).from(schema.productsTable),
    db.select({ cnt: count() }).from(schema.projectsTable),
    db.select({ cnt: count() }).from(schema.dealsTable),
  ]);

  let safeDbLabel = 'PostgreSQL';
  try {
    const rawUrl = process.env.DATABASE_URL?.trim();
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      safeDbLabel = `postgres://${parsed.hostname}/${parsed.pathname.replace(/^\/+/, '')}`;
    }
  } catch {
    safeDbLabel = 'PostgreSQL';
  }

  return {
    dataDir: DATA_DIR,
    dbPath: safeDbLabel,
    dbSizeBytes,
    uploadsDir,
    uploadsCount,
    productsCount: Number(prodCnt?.cnt ?? 0),
    projectsCount: Number(projCnt?.cnt ?? 0),
    dealsCount: Number(dealCnt?.cnt ?? 0),
    isCustomVolume: Boolean(process.env.S3_BUCKET?.trim() || process.env.DATA_DIR?.trim()),
  };
}

export async function exportDatabaseBackupJson(): Promise<Record<string, unknown>> {
  if (!isDatabaseConfigured()) {
    const settings: Array<{ key: string; value: string }> = [];
    for (const [key, value] of inMemorySettings.entries()) {
      if (key !== 'admin_password_hash') settings.push({ key, value });
    }
    return {
      exportedAt: new Date().toISOString(),
      engine: 'in-memory',
      data: { settings },
    };
  }
  const db = getDb();
  const [
    products,
    projects,
    contacts,
    deals,
    tasks,
    notes,
    settings,
    staff,
    customers,
    reviews,
    wishlist,
  ] = await Promise.all([
    db.select().from(schema.productsTable),
    db.select().from(schema.projectsTable),
    db.select().from(schema.contactsTable),
    db.select().from(schema.dealsTable),
    db.select().from(schema.tasksTable),
    db.select().from(schema.notesTable),
    db
      .select()
      .from(schema.settingsTable)
      .where(sql`${schema.settingsTable.key} != 'admin_password_hash'`),
    db
      .select({
        id: schema.staffUsersTable.id,
        name: schema.staffUsersTable.name,
        login: schema.staffUsersTable.login,
        email: schema.staffUsersTable.email,
        phone: schema.staffUsersTable.phone,
        position: schema.staffUsersTable.position,
        role: schema.staffUsersTable.role,
        assigneeLabel: schema.staffUsersTable.assigneeLabel,
        canLogin: schema.staffUsersTable.canLogin,
        active: schema.staffUsersTable.active,
        createdAt: schema.staffUsersTable.createdAt,
        updatedAt: schema.staffUsersTable.updatedAt,
      })
      .from(schema.staffUsersTable),
    db
      .select({
        id: schema.customerAccountsTable.id,
        name: schema.customerAccountsTable.name,
        email: schema.customerAccountsTable.email,
        phone: schema.customerAccountsTable.phone,
        city: schema.customerAccountsTable.city,
        authProvider: schema.customerAccountsTable.authProvider,
        active: schema.customerAccountsTable.active,
        lastLoginAt: schema.customerAccountsTable.lastLoginAt,
        createdAt: schema.customerAccountsTable.createdAt,
        updatedAt: schema.customerAccountsTable.updatedAt,
      })
      .from(schema.customerAccountsTable),
    db.select().from(schema.productReviewsTable),
    db.select().from(schema.customerWishlistTable),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    engine: 'postgresql',
    data: {
      products,
      projects,
      contacts,
      deals,
      tasks,
      notes,
      settings,
      staffUsers: staff,
      customerAccounts: customers,
      productReviews: reviews,
      customerWishlist: wishlist,
    },
  };
}
