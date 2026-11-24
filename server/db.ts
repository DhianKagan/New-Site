import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { asc, desc, eq, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema.ts';
import { hashPassword } from './auth.ts';
import type {
  Contact,
  ContactSegment,
  CrmNote,
  CrmTask,
  Deal,
  DealItem,
  DealStage,
  DealType,
  Product,
  ProductCategory,
  ProjectCase,
  RecentChangeRecord,
  SocialLinksConfig,
  StaffRole,
  StaffUser,
  StorageDiagnostics,
  TaskPriority,
  TaskStatus,
} from '../src/types.ts';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'energocomfort.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SEED_CATALOG_PATH = path.resolve(process.cwd(), 'server', 'seed', 'catalog.json');

export function getUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      cat TEXT NOT NULL,
      raw_cats_json TEXT NOT NULL DEFAULT '[]',
      brand TEXT NOT NULL,
      is_kit INTEGER NOT NULL DEFAULT 0,
      price INTEGER NOT NULL DEFAULT 0,
      old_price INTEGER NOT NULL DEFAULT 0,
      in_stock INTEGER NOT NULL DEFAULT 1,
      status_label TEXT NOT NULL DEFAULT 'в наявності',
      img TEXT NOT NULL DEFAULT '',
      specs_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Одеса',
      channel TEXT NOT NULL DEFAULT 'Telegram',
      segment TEXT NOT NULL DEFAULT 'b2c',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_number TEXT NOT NULL UNIQUE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'new',
      customer_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Одеса',
      channel TEXT NOT NULL DEFAULT 'Telegram',
      topic TEXT NOT NULL DEFAULT '',
      task_type TEXT NOT NULL DEFAULT '',
      loads_json TEXT NOT NULL DEFAULT '[]',
      items_json TEXT NOT NULL DEFAULT '[]',
      total_usd INTEGER NOT NULL DEFAULT 0,
      assignee TEXT NOT NULL DEFAULT 'Олександр (інженер)',
      notes TEXT NOT NULL DEFAULT '',
      telegram_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT NOT NULL DEFAULT 'Олександр (інженер)',
      due_date TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'Менеджер CRM',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      meta_event TEXT NOT NULL,
      ga4_event TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      seg TEXT NOT NULL DEFAULT 'b2c',
      tag TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      img TEXT NOT NULL DEFAULT '',
      task TEXT NOT NULL DEFAULT '',
      solution TEXT NOT NULL DEFAULT '',
      specs TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT 'Менеджер',
      role TEXT NOT NULL DEFAULT 'manager',
      assignee_label TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      can_login INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Non-destructive migration for existing deals tables created before contact_id
  const dealCols = db.prepare('PRAGMA table_info(deals)').all() as Array<{ name: string }>;
  if (!dealCols.some((c) => c.name === 'contact_id')) {
    db.exec('ALTER TABLE deals ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;');
  }

  seedCatalogIfEmpty(db);
  seedDealsIfEmpty(db);
  backfillContactsAndSeedCrm(db);
  seedStaffIfEmpty(db);
  ensureMasterAdminAccount(db);
  seedProjectsIfEmpty(db);
  dbInstance = db;
  return db;
}

export const drizzleDb = drizzle(
  async (sql, params, method) => {
    const sqlite = getDb();
    const stmt = sqlite.prepare(sql);
    const bindParams = params as Array<string | number | Uint8Array | null>;
    if (method === 'run') {
      stmt.run(...bindParams);
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    if (method === 'get') {
      return { rows: stmt.get(...bindParams) as unknown as unknown[] };
    }
    return { rows: stmt.all(...bindParams) as unknown as unknown[][] };
  },
  { schema },
);

function normalizeContactPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^380\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
  if (/^\d{9}$/.test(digits)) return `+380${digits}`;
  return raw.trim();
}

function upsertContactSync(
  db: DatabaseSync,
  input: {
    name: string;
    phone: string;
    city?: string;
    channel?: string;
    company?: string;
    segment?: ContactSegment;
  },
): number {
  const normalizedPhone = normalizeContactPhone(input.phone);
  const existing = db.prepare('SELECT id, name, city, channel, company, segment FROM contacts WHERE phone = ?').get(normalizedPhone) as
    | { id: number; name: string; city: string; channel: string; company: string; segment: string }
    | undefined;
  const now = new Date().toISOString();

  if (existing) {
    const nextName =
      existing.name === 'Клієнт сайту' || existing.name === 'Клієнт із головної форми'
        ? input.name.trim() || existing.name
        : existing.name;
    const nextCity = !existing.city && input.city?.trim() ? input.city.trim() : existing.city;
    db.prepare('UPDATE contacts SET name = ?, city = ?, updated_at = ? WHERE id = ?').run(
      nextName,
      nextCity,
      now,
      existing.id,
    );
    return Number(existing.id);
  }

  const inferredSegment: ContactSegment =
    input.segment ||
    (/тов|бізнес|сто|готел|завод|ооо/i.test(`${input.name} ${input.company || ''}`) ? 'b2b' : 'b2c');
  const res = db
    .prepare(
      `INSERT INTO contacts (name, company, phone, email, city, channel, segment, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name.trim() || 'Клієнт сайту',
      (input.company ?? '').trim(),
      normalizedPhone,
      (input.city ?? '').trim() || 'Одеса',
      (input.channel ?? '').trim() || 'Telegram',
      inferredSegment,
      now,
      now,
    );
  return Number(res.lastInsertRowid);
}

function backfillContactsAndSeedCrm(db: DatabaseSync): void {
  const unlinkedDeals = db
    .prepare('SELECT id, customer_name, phone, city, channel, task_type, topic FROM deals WHERE contact_id IS NULL')
    .all() as Array<{
    id: number;
    customer_name: string;
    phone: string;
    city: string;
    channel: string;
    task_type: string;
    topic: string;
  }>;

  for (const deal of unlinkedDeals) {
    if (!deal.phone) continue;
    const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${deal.customer_name} ${deal.task_type} ${deal.topic}`)
      ? 'b2b'
      : 'b2c';
    const contactId = upsertContactSync(db, {
      name: deal.customer_name || 'Клієнт сайту',
      phone: deal.phone,
      city: deal.city,
      channel: deal.channel,
      company: /тов/i.test(deal.customer_name) ? deal.customer_name : '',
      segment,
    });
    db.prepare('UPDATE deals SET contact_id = ? WHERE id = ?').run(contactId, deal.id);
  }

  const seededFlag = db.prepare("SELECT value FROM settings WHERE key = 'crm_v2_seeded'").get();
  if (seededFlag) return;

  const taskCount = Number(db.prepare('SELECT COUNT(*) as cnt FROM tasks').get()?.cnt ?? 0);
  const deals = db.prepare('SELECT id, deal_number, contact_id, stage, customer_name, notes FROM deals ORDER BY id DESC').all() as Array<{
    id: number;
    deal_number: string;
    contact_id: number | null;
    stage: string;
    customer_name: string;
    notes: string;
  }>;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  if (taskCount === 0 && deals.length > 0) {
    const insertTask = db.prepare(
      `INSERT INTO tasks (contact_id, deal_id, title, status, priority, assignee, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertNote = db.prepare(
      `INSERT INTO notes (contact_id, deal_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    );

    deals.slice(0, 4).forEach((d, idx) => {
      const taskTitle =
        idx === 0
          ? `Узгодити схему щита і фази (${d.deal_number})`
          : idx === 1
            ? `Перевірити комплектацію захисту AC/DC (${d.deal_number})`
            : idx === 2
              ? `Підтвердити дату виїзду інженера на об’єкт (${d.deal_number})`
              : `Відправити гарантійний талон клієнту (${d.deal_number})`;
      const status: TaskStatus = d.stage === 'done' ? 'done' : idx === 1 ? 'in_progress' : 'todo';
      const priority: TaskPriority = idx === 0 ? 'high' : 'medium';
      insertTask.run(
        d.contact_id,
        d.id,
        taskTitle,
        status,
        priority,
        idx % 2 === 0 ? 'Олександр (інженер)' : 'Дмитро (менеджер)',
        idx === 0 ? todayStr : tomorrowStr,
        nowIso,
        nowIso,
      );
      if (d.notes) {
        insertNote.run(d.contact_id, d.id, 'Система CRM', d.notes, nowIso);
      }
    });
  }

  db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('crm_v2_seeded', 'true', ?)").run(nowIso);
}

function seedCatalogIfEmpty(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
  const count = Number(row?.cnt ?? 0);
  if (count > 0 || !fs.existsSync(SEED_CATALOG_PATH)) return;

  const raw = JSON.parse(fs.readFileSync(SEED_CATALOG_PATH, 'utf-8')) as Product[];
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO products (
      id, sku, title, cat, raw_cats_json, brand, is_kit,
      price, old_price, in_stock, status_label, img,
      specs_json, description, source_url, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN;');
  try {
    for (const p of raw) {
      insert.run(
        p.id,
        p.sku,
        p.title,
        p.cat,
        JSON.stringify(p.rawCats ?? []),
        p.brand,
        p.isKit ? 1 : 0,
        p.price ?? 0,
        p.oldPrice ?? 0,
        p.inStock ? 1 : 0,
        p.statusLabel ?? 'в наявності',
        p.img ?? '',
        JSON.stringify(p.specs ?? []),
        p.description ?? '',
        p.sourceUrl ?? '',
        now,
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function seedDealsIfEmpty(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM deals').get();
  const count = Number(row?.cnt ?? 0);
  if (count > 0) return;

  const now = Date.now();
  const iso = (offsetMins: number) => new Date(now - offsetMins * 60_000).toISOString();

  const initialDeals: Array<{
    dealNumber: string;
    type: DealType;
    stage: DealStage;
    customerName: string;
    phone: string;
    city: string;
    channel: string;
    topic: string;
    taskType: string;
    loads: string[];
    items: DealItem[];
    totalUsd: number;
    assignee: string;
    notes: string;
    createdAt: string;
  }> = [
    {
      dealNumber: 'EC-1041',
      type: 'lead',
      stage: 'new',
      customerName: 'Ігор Мельник',
      phone: '+38 (067) 412-88-19',
      city: 'Одеса, Таїрова',
      channel: 'Telegram',
      topic: 'Готове рішення Deye 8 кВт / 16 кВт·год під ключ',
      taskType: 'Резервне живлення (квартира / дім)',
      loads: ['Газовий котел', 'Холодильник', 'Wi-Fi / Інтернет', 'Освітлення'],
      items: [],
      totalUsd: 3999,
      assignee: 'Олександр (інженер)',
      notes: 'Приватний будинок 140 м², 1 фаза, потрібно перемикання без затримки для котла.',
      createdAt: iso(45),
    },
    {
      dealNumber: 'EC-1040',
      type: 'order',
      stage: 'audit',
      customerName: 'Сергій Кравченко',
      phone: '+38 (050) 934-15-02',
      city: 'Чорноморськ',
      channel: 'Телефон',
      topic: 'Замовлення обладнання з кошика (2 поз.)',
      taskType: 'Замовлення обладнання',
      loads: [],
      items: [
        {
          productId: 'deye-sun-6k-sg06lp1-eu-bm2',
          sku: '10002',
          title: 'Гібридний інвертор Deye SUN-6K-SG06LP1-EU-BM2',
          price: 1150,
          qty: 1,
        },
        {
          productId: 'lifepo4-deye-se-g51-pro-b',
          sku: '10018',
          title: 'Акумуляторна батарея LiFePo4 Deye SE-G5.1 PRO B (5,1 кВт*год 48В)',
          price: 900,
          qty: 1,
        },
      ],
      totalUsd: 2050,
      assignee: 'Дмитро (менеджер)',
      notes: 'Уточнити потребу в комплекті захисту AC/DC та кабелях перемичок.',
      createdAt: iso(180),
    },
    {
      dealNumber: 'EC-1039',
      type: 'lead',
      stage: 'proposal',
      customerName: 'ТОВ «Південь-Автосервіс»',
      phone: '+38 (098) 211-44-70',
      city: 'Одеса, Київський р-н',
      channel: 'Telegram',
      topic: 'СЕС для бізнесу 30 кВт + АКБ 30 кВт·год',
      taskType: 'Рішення для бізнесу / СТО (380 В)',
      loads: ['Компресори 380В', 'Підйомники', 'Освітлення'],
      items: [],
      totalUsd: 24500,
      assignee: 'Олександр (інженер)',
      notes: 'Відправлено 2 варіанти КП на Deye 30 кВт HV та SolaX 30 кВт. Узгоджуємо виїзд на дах.',
      createdAt: iso(640),
    },
    {
      dealNumber: 'EC-1038',
      type: 'order',
      stage: 'fulfillment',
      customerName: 'Олена Савченко',
      phone: '+38 (063) 550-19-83',
      city: 'Одеса, Аркадія',
      channel: 'Viber',
      topic: 'Замовлення обладнання з кошика (1 поз.)',
      taskType: 'Замовлення обладнання',
      loads: [],
      items: [
        {
          productId: 'deye-se-f12-l',
          sku: '50023',
          title: 'Акумуляторна батарея Deye SE-F12-L 51.2V 230Ah (12 кВт*год)',
          price: 1900,
          qty: 1,
        },
      ],
      totalUsd: 1900,
      assignee: 'Дмитро (менеджер)',
      notes: 'Оплачено. Доставка по Одесі узгоджена на завтра 11:00.',
      createdAt: iso(1440),
    },
    {
      dealNumber: 'EC-1037',
      type: 'lead',
      stage: 'done',
      customerName: 'Віталій Бондар',
      phone: '+38 (050) 318-90-12',
      city: 'Овідіополь',
      channel: 'Телефон',
      topic: 'СЕС Deye 6 кВт / 5.1 кВт·год + 10× Trina Bifacial',
      taskType: 'Сонячна електростанція для дому',
      loads: ['Газовий котел', 'Холодильник', 'Свердловинний насос', 'Кондиціонер'],
      items: [],
      totalUsd: 4500,
      assignee: 'Олександр (інженер)',
      notes: 'Змонтовано та запущено. Моніторинг Solarman підключено клієнту.',
      createdAt: iso(4320),
    },
  ];

  const insert = db.prepare(`
    INSERT INTO deals (
      deal_number, type, stage, customer_name, phone, city, channel,
      topic, task_type, loads_json, items_json, total_usd, assignee, notes,
      telegram_sent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const d of initialDeals) {
    insert.run(
      d.dealNumber,
      d.type,
      d.stage,
      d.customerName,
      d.phone,
      d.city,
      d.channel,
      d.topic,
      d.taskType,
      JSON.stringify(d.loads),
      JSON.stringify(d.items),
      d.totalUsd,
      d.assignee,
      d.notes,
      0,
      d.createdAt,
      d.createdAt,
    );
  }
}

function rowToProduct(r: Record<string, unknown>): Product {
  return {
    id: String(r.id),
    sku: String(r.sku),
    title: String(r.title),
    cat: String(r.cat) as ProductCategory,
    rawCats: JSON.parse(String(r.raw_cats_json || '[]')) as string[],
    brand: String(r.brand),
    isKit: Number(r.is_kit) === 1,
    price: Number(r.price),
    oldPrice: Number(r.old_price),
    inStock: Number(r.in_stock) === 1,
    statusLabel: String(r.status_label),
    img: String(r.img),
    specs: JSON.parse(String(r.specs_json || '[]')) as [string, string][],
    description: String(r.description),
    sourceUrl: String(r.source_url),
  };
}

function rowToDeal(r: Record<string, unknown>): Deal {
  return {
    id: Number(r.id),
    dealNumber: String(r.deal_number),
    contactId: r.contact_id != null ? Number(r.contact_id) : null,
    type: String(r.type) as DealType,
    stage: String(r.stage) as DealStage,
    customerName: String(r.customer_name),
    phone: String(r.phone),
    city: String(r.city),
    channel: String(r.channel),
    topic: String(r.topic),
    taskType: String(r.task_type),
    loads: JSON.parse(String(r.loads_json || '[]')) as string[],
    items: JSON.parse(String(r.items_json || '[]')) as DealItem[],
    totalUsd: Number(r.total_usd),
    assignee: String(r.assignee),
    notes: String(r.notes),
    telegramSent: Number(r.telegram_sent) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function listProducts(filters?: {
  cat?: string;
  brand?: string;
  q?: string;
  inStockOnly?: boolean;
  sort?: string;
}): Product[] {
  const db = getDb();
  const where: string[] = [];
  const params: Array<string | number | null> = [];

  if (filters?.cat && filters.cat !== 'all') {
    where.push('cat = ?');
    params.push(filters.cat);
  }
  if (filters?.brand && filters.brand !== 'all') {
    where.push('brand = ?');
    params.push(filters.brand);
  }
  if (filters?.inStockOnly) {
    where.push('in_stock = 1');
  }
  if (filters?.q && filters.q.trim()) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    where.push('(LOWER(title) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(like, like, like, like);
  }

  let orderBy = 'ORDER BY CASE WHEN price > 0 THEN 0 ELSE 1 END, is_kit DESC, in_stock DESC, id ASC';
  if (filters?.sort === 'asc') {
    orderBy = 'ORDER BY CASE WHEN price > 0 THEN 0 ELSE 1 END, price ASC';
  } else if (filters?.sort === 'desc') {
    orderBy = 'ORDER BY price DESC';
  } else if (filters?.sort === 'featured') {
    orderBy = 'ORDER BY CASE WHEN price > 0 THEN 0 ELSE 1 END, in_stock DESC, price DESC';
  }

  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${orderBy}`;
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToProduct);
}

export function getCatalogFacets(): {
  total: number;
  byCategory: Record<string, number>;
  brands: Array<{ brand: string; count: number }>;
} {
  const db = getDb();
  const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
  const catRows = db.prepare('SELECT cat, COUNT(*) as cnt FROM products GROUP BY cat').all();
  const brandRows = db
    .prepare('SELECT brand, COUNT(*) as cnt FROM products GROUP BY brand ORDER BY cnt DESC, brand ASC')
    .all();

  const byCategory: Record<string, number> = {};
  for (const r of catRows) {
    byCategory[String(r.cat)] = Number(r.cnt);
  }
  const brands = brandRows.map((r) => ({
    brand: String(r.brand),
    count: Number(r.cnt),
  }));

  return {
    total: Number(totalRow?.cnt ?? 0),
    byCategory,
    brands,
  };
}

export function getProductById(id: string): Product | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? rowToProduct(row) : null;
}

export function updateProduct(
  id: string,
  patch: {
    title?: string;
    sku?: string;
    cat?: ProductCategory;
    brand?: string;
    isKit?: boolean;
    price?: number;
    oldPrice?: number;
    inStock?: boolean;
    statusLabel?: string;
    img?: string;
    specs?: [string, string][];
    description?: string;
  },
): Product | null {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) return null;

  const title = patch.title !== undefined ? String(patch.title).trim() || existing.title : existing.title;
  const sku = patch.sku !== undefined ? String(patch.sku).trim() : existing.sku;
  const cat = patch.cat !== undefined ? patch.cat : existing.cat;
  const brand = patch.brand !== undefined ? String(patch.brand).trim() || existing.brand : existing.brand;
  const isKit = patch.isKit !== undefined ? patch.isKit : existing.isKit;
  const price = patch.price !== undefined ? Math.max(0, Math.round(Number(patch.price) || 0)) : existing.price;
  const oldPrice =
    patch.oldPrice !== undefined ? Math.max(0, Math.round(Number(patch.oldPrice) || 0)) : existing.oldPrice;
  const inStock = patch.inStock !== undefined ? patch.inStock : existing.inStock;
  const statusLabel =
    patch.statusLabel !== undefined && String(patch.statusLabel).trim()
      ? String(patch.statusLabel).trim()
      : patch.inStock !== undefined
        ? inStock
          ? 'в наявності'
          : 'під замовлення'
        : existing.statusLabel;
  const img = patch.img !== undefined ? String(patch.img).trim() : existing.img;
  const specsJson = patch.specs !== undefined ? JSON.stringify(patch.specs) : JSON.stringify(existing.specs);
  const description = patch.description !== undefined ? String(patch.description).trim() : existing.description;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE products
     SET sku = ?, title = ?, cat = ?, brand = ?, is_kit = ?,
         price = ?, old_price = ?, in_stock = ?, status_label = ?,
         img = ?, specs_json = ?, description = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    sku,
    title,
    cat,
    brand,
    isKit ? 1 : 0,
    price,
    oldPrice,
    inStock ? 1 : 0,
    statusLabel,
    img,
    specsJson,
    description,
    now,
    id,
  );

  return getProductById(id);
}

export function createProduct(input: {
  title: string;
  sku: string;
  cat: ProductCategory;
  brand: string;
  isKit?: boolean;
  price: number;
  oldPrice?: number;
  inStock: boolean;
  statusLabel?: string;
  img?: string;
  specs?: [string, string][];
  description?: string;
}): Product {
  const db = getDb();
  const now = new Date().toISOString();
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const id = `${slugBase || 'item'}-${Date.now().toString(36)}`;
  const isKit = input.isKit ?? input.cat === 'kits';
  const statusLabel =
    input.statusLabel?.trim() || (input.inStock ? 'в наявності' : 'під замовлення');

  db.prepare(`
    INSERT INTO products (
      id, sku, title, cat, raw_cats_json, brand, is_kit,
      price, old_price, in_stock, status_label, img,
      specs_json, description, source_url, updated_at
    ) VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
  `).run(
    id,
    input.sku.trim() || id.slice(0, 8).toUpperCase(),
    input.title.trim(),
    input.cat,
    input.brand.trim() || 'Energo Comfort',
    isKit ? 1 : 0,
    Math.max(0, Math.round(Number(input.price) || 0)),
    Math.max(0, Math.round(Number(input.oldPrice) || 0)),
    input.inStock ? 1 : 0,
    statusLabel,
    (input.img ?? '').trim(),
    JSON.stringify(input.specs ?? []),
    (input.description ?? '').trim(),
    now,
  );

  return getProductById(id)!;
}

export function deleteProduct(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return Number(res.changes) > 0;
}

function nextDealNumber(db: DatabaseSync): string {
  const row = db.prepare('SELECT MAX(id) as max_id FROM deals').get();
  const nextNum = 1042 + Number(row?.max_id ?? 0);
  return `EC-${nextNum}`;
}

export function createDeal(input: {
  type: DealType;
  customerName?: string;
  phone: string;
  city?: string;
  channel?: string;
  topic?: string;
  taskType?: string;
  loads?: string[];
  items?: Array<{ productId: string; qty: number }>;
  notes?: string;
  estimatedTotalUsd?: number;
}): Deal {
  const db = getDb();
  const now = new Date().toISOString();
  const dealNumber = nextDealNumber(db);

  let verifiedItems: DealItem[] = [];
  let totalUsd = 0;

  if (input.items && input.items.length > 0) {
    for (const reqItem of input.items) {
      const prod = getProductById(reqItem.productId);
      if (!prod) continue;
      const qty = Math.max(1, Math.min(99, Math.round(Number(reqItem.qty) || 1)));
      verifiedItems.push({
        productId: prod.id,
        sku: prod.sku,
        title: prod.title,
        price: prod.price,
        qty,
      });
      totalUsd += prod.price * qty;
    }
  } else if (input.estimatedTotalUsd) {
    totalUsd = Math.max(0, Math.round(Number(input.estimatedTotalUsd)));
  }

  const topic =
    input.topic?.trim() ||
    (input.type === 'order'
      ? `Замовлення обладнання з кошика (${verifiedItems.length} поз.)`
      : input.taskType?.trim() || 'Інженерний розрахунок системи');

  const customerName = (input.customerName ?? '').trim() || 'Клієнт сайту';
  const city = (input.city ?? '').trim() || 'Одеса';
  const channel = (input.channel ?? '').trim() || 'Telegram';
  const taskType = (input.taskType ?? '').trim() || (input.type === 'order' ? 'Кошик / Shop' : 'Консультація');
  const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${customerName} ${taskType} ${topic}`)
    ? 'b2b'
    : 'b2c';

  const contactId = upsertContactSync(db, {
    name: customerName,
    phone: input.phone.trim(),
    city,
    channel,
    company: /тов/i.test(customerName) ? customerName : '',
    segment,
  });

  const res = db
    .prepare(`
      INSERT INTO deals (
        deal_number, contact_id, type, stage, customer_name, phone, city, channel,
        topic, task_type, loads_json, items_json, total_usd, assignee, notes,
        telegram_sent, created_at, updated_at
      ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `)
    .run(
      dealNumber,
      contactId,
      input.type,
      customerName,
      normalizeContactPhone(input.phone.trim()),
      city,
      channel,
      topic,
      taskType,
      JSON.stringify(input.loads ?? []),
      JSON.stringify(verifiedItems),
      totalUsd,
      input.type === 'order' ? 'Дмитро (менеджер)' : 'Олександр (інженер)',
      (input.notes ?? '').trim(),
      now,
      now,
    );

  const created = db.prepare('SELECT * FROM deals WHERE id = ?').get(Number(res.lastInsertRowid));
  return rowToDeal(created!);
}

export function markDealTelegramSent(id: number): void {
  const db = getDb();
  db.prepare('UPDATE deals SET telegram_sent = 1 WHERE id = ?').run(id);
}

export function listDeals(): Deal[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM deals ORDER BY id DESC').all();
  return rows.map(rowToDeal);
}

export function updateDeal(
  id: number,
  patch: {
    stage?: DealStage;
    assignee?: string;
    notes?: string;
    totalUsd?: number;
  },
): Deal | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!row) return null;
  const existing = rowToDeal(row);

  const stage = patch.stage ?? existing.stage;
  const assignee = patch.assignee !== undefined ? patch.assignee.trim() : existing.assignee;
  const notes = patch.notes !== undefined ? patch.notes.trim() : existing.notes;
  const totalUsd =
    patch.totalUsd !== undefined ? Math.max(0, Math.round(Number(patch.totalUsd))) : existing.totalUsd;
  const now = new Date().toISOString();

  db.prepare('UPDATE deals SET stage = ?, assignee = ?, notes = ?, total_usd = ?, updated_at = ? WHERE id = ?').run(
    stage,
    assignee,
    notes,
    totalUsd,
    now,
    id,
  );

  const updated = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  return updated ? rowToDeal(updated) : null;
}

export function deleteDeal(id: number): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM deals WHERE id = ?').run(id);
  return Number(res.changes) > 0;
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

export function setSettingIfAbsent(key: string, value: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .run(key, value, now);
  return Number(res.changes) > 0;
}

export function getPublicAnalyticsConfig(): {
  metaPixelId: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  analyticsEnabled: boolean;
} {
  const metaPixelId = (getSetting('meta_pixel_id') ?? process.env.META_PIXEL_ID ?? '').trim();
  const ga4MeasurementId = (getSetting('ga4_measurement_id') ?? process.env.GA4_MEASUREMENT_ID ?? '').trim();
  const gtmContainerId = (getSetting('gtm_container_id') ?? process.env.GTM_CONTAINER_ID ?? '').trim();
  const enabledSetting = getSetting('analytics_enabled');
  const analyticsEnabled = enabledSetting === null ? true : enabledSetting === 'true';

  return {
    metaPixelId,
    ga4MeasurementId,
    gtmContainerId,
    analyticsEnabled,
  };
}

export function saveAnalyticsSettings(input: {
  metaPixelId: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  analyticsEnabled: boolean;
}): void {
  setSetting('meta_pixel_id', input.metaPixelId);
  setSetting('ga4_measurement_id', input.ga4MeasurementId);
  setSetting('gtm_container_id', input.gtmContainerId);
  setSetting('analytics_enabled', input.analyticsEnabled ? 'true' : 'false');
}

export function recordAnalyticsEvent(
  eventName: string,
  metaEvent: string,
  ga4Event: string,
  payload: Record<string, string | number>,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO analytics_events (event_name, meta_event, ga4_event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(eventName, metaEvent, ga4Event, JSON.stringify(payload), now);

  // Keep only last 100 events in SQLite
  db.prepare(
    'DELETE FROM analytics_events WHERE id NOT IN (SELECT id FROM analytics_events ORDER BY id DESC LIMIT 100)',
  ).run();
}

export function listRecentAnalyticsEvents(limit = 35): Array<{
  id: number;
  eventName: string;
  metaEvent: string;
  ga4Event: string;
  payload: Record<string, string | number>;
  createdAt: string;
}> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = db.prepare('SELECT * FROM analytics_events ORDER BY id DESC LIMIT ?').all(safeLimit);
  return rows.map((r) => ({
    id: Number(r.id),
    eventName: String(r.event_name),
    metaEvent: String(r.meta_event),
    ga4Event: String(r.ga4_event),
    payload: JSON.parse(String(r.payload_json || '{}')) as Record<string, string | number>,
    createdAt: String(r.created_at),
  }));
}

function seedProjectsIfEmpty(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM projects').get();
  const count = Number(row?.cnt ?? 0);
  if (count > 0) return;

  const initialProjects: ProjectCase[] = [
    {
      id: 'sto',
      seg: 'b2b',
      tag: 'B2B · Одеса',
      title: 'СТО для вантажного транспорту',
      img: '/assets/energocomfort/sto_110kw.jpg',
      task: 'Забезпечити безперебійну роботу енергоємного обладнання (підйомників, компресорів) в умовах лімітів потужності мережі.',
      solution: 'Змонтовано сонячне поле 110 кВт, встановлено трифазний гібридний інвертор 80 кВт та блок акумуляторів ємністю 160 кВт·год.',
      specs: 'PV 110 кВт · Гібрид 80 кВт · АКБ 160 кВт·год',
      result: 'Денне заміщення власного споживання та тривала автономність сервісу навіть під час тривалих відключень.',
    },
    {
      id: 'factory',
      seg: 'b2b',
      tag: 'B2B · Одеська обл.',
      title: 'Завод з виробництва тротуарної плитки',
      img: '/assets/energocomfort/factory_110kw.png',
      task: 'Зменшити навантаження на електромережу та оптимізувати денні витрати промислового виробництва.',
      solution: 'Промислове покрівельне сонячне поле потужністю 110 кВт із мережевою та гібридною архітектурою 380 В.',
      specs: 'PV 110 кВт · Промислова СЕС · 380 В',
      result: 'Стабільна генерація для виробничої лінії у робочу зміну та швидка окупність обладнання.',
    },
    {
      id: 'school',
      seg: 'b2b',
      tag: 'B2B · Заклад освіти',
      title: 'Навчальний заклад',
      img: '/assets/energocomfort/school_55kw.png',
      task: 'Забезпечити безперервний навчальний процес освітленням та живленням систем безпеки і серверів.',
      solution: 'Монтаж 55 кВт сонячних панелей та балансування критичного навантаження на 3-фазній мережі.',
      specs: 'PV 55 кВт · 3 фази · Проєкт під ключ',
      result: 'Безперебійна робота навчального комплексу під час графіків відключень.',
    },
    {
      id: 'hotel',
      seg: 'b2b',
      tag: 'B2B · Узбережжя',
      title: 'Готельний комплекс',
      img: '/assets/energocomfort/hotel_35kw.png',
      task: 'Провести аудит споживання та організувати автоматичне резервування інженерних систем готелю.',
      solution: 'Сонячне поле 35 кВт, високовольтний гібридний інвертор Deye 30 кВт та блок АКБ 30 кВт·год.',
      specs: 'PV 35 кВт · Deye 30 кВт · АКБ 30 кВт·год',
      result: 'Миттєве перемикання без зупинки сервісу, ліфтів, насосів та систем кондиціонування для гостей.',
    },
    {
      id: 'recreation',
      seg: 'b2b',
      tag: 'B2B · Одеська обл.',
      title: 'База відпочинку',
      img: '/assets/energocomfort/recreation_36kw.jpg',
      task: 'Забезпечити безперебійне енергопостачання та оптимізувати витрати у піковий курортний сезон.',
      solution: 'Встановлено 60 сонячних панелей (36 кВт), трифазний інвертор Deye 30 кВт та акумуляторний блок 30,6 кВт·год.',
      specs: 'PV 36 кВт · Deye 30 кВт · АКБ 30,6 кВт·год',
      result: 'Повна автономність ключової інфраструктури комплексу та зниження рахунків за електроенергію.',
    },
    {
      id: 'office',
      seg: 'b2b',
      tag: 'B2B · Центр Одеси',
      title: 'Офісний центр',
      img: '/assets/energocomfort/office_16kw.png',
      task: 'Живлення робочих місць, серверної групи, зв’язку та клімат-контролю без простоїв.',
      solution: 'СЕС 16 кВт, гібридний інвертор 12 кВт та запас енергії в АКБ LiFePO4 20 кВт·год.',
      specs: 'PV 16 кВт · Інвертор 12 кВт · АКБ 20 кВт·год',
      result: 'Команда працює у штатному режимі за будь-яких мережевих обмежень.',
    },
    {
      id: 'houseSolar',
      seg: 'b2c',
      tag: 'B2C · Одеський р-н',
      title: 'Приватний будинок із СЕС',
      img: '/assets/energocomfort/house_6kw.png',
      task: 'Власна денна генерація та надійний нічний резерв для родини.',
      solution: 'Сонячне поле 6 кВт, гібридний інвертор 10 кВт і акумуляторна система 15 кВт·год.',
      specs: 'PV 6 кВт · Інвертор 10 кВт · АКБ 15 кВт·год',
      result: 'Стабільне живлення будинку незалежно від зовнішньої мережі та економія на тарифі.',
    },
    {
      id: 'houseBackup',
      seg: 'b2c',
      tag: 'B2C · Одеса',
      title: 'Резервне живлення квартири та дому',
      img: '/assets/energocomfort/backup_deye_8kw.jpg',
      task: 'Тихий автопідхват опалення, освітлення та побутової техніки без втрати простору в кімнатах.',
      solution: 'Однофазний гібридний інвертор Deye 6–8 кВт та компактний LiFePO4 блок Deye 12 кВт·год із захистом AC/DC.',
      specs: 'Без СЕС · Deye 6–8 кВт (1ф) · АКБ 12 кВт·год',
      result: 'Повністю автоматизована тиха система резервного живлення з можливістю подальшого підключення панелей.',
    },
  ];

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO projects (
      id, seg, tag, title, img, task, solution, specs, result, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialProjects.forEach((p, idx) => {
    insert.run(p.id, p.seg, p.tag, p.title, p.img, p.task, p.solution, p.specs, p.result, idx + 1, now, now);
  });
}

function rowToProjectCase(r: Record<string, unknown>): ProjectCase {
  return {
    id: String(r.id),
    seg: String(r.seg) === 'b2b' ? 'b2b' : 'b2c',
    tag: String(r.tag),
    title: String(r.title),
    img: String(r.img),
    task: String(r.task),
    solution: String(r.solution),
    specs: String(r.specs),
    result: String(r.result),
  };
}

export function listProjectCases(): ProjectCase[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC').all();
  return rows.map(rowToProjectCase);
}

export function getProjectCaseById(id: string): ProjectCase | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? rowToProjectCase(row) : null;
}

export function createProjectCase(input: {
  seg: 'b2b' | 'b2c';
  tag: string;
  title: string;
  img: string;
  task: string;
  solution: string;
  specs: string;
  result: string;
}): ProjectCase {
  const db = getDb();
  const now = new Date().toISOString();
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  const id = `${slugBase || 'case'}-${Date.now().toString(36)}`;
  const minSortRow = db.prepare('SELECT MIN(sort_order) as min_sort FROM projects').get();
  const nextSort = Number(minSortRow?.min_sort ?? 1) - 1;

  db.prepare(`
    INSERT INTO projects (
      id, seg, tag, title, img, task, solution, specs, result, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.seg === 'b2b' ? 'b2b' : 'b2c',
    input.tag.trim() || (input.seg === 'b2b' ? 'B2B · Одеса' : 'B2C · Одеса'),
    input.title.trim(),
    input.img.trim() || '/assets/energocomfort/house_6kw.png',
    input.task.trim(),
    input.solution.trim(),
    input.specs.trim(),
    input.result.trim(),
    nextSort,
    now,
    now,
  );

  return getProjectCaseById(id)!;
}

export function updateProjectCase(
  id: string,
  patch: Partial<{
    seg: 'b2b' | 'b2c';
    tag: string;
    title: string;
    img: string;
    task: string;
    solution: string;
    specs: string;
    result: string;
  }>,
): ProjectCase | null {
  const db = getDb();
  const existing = getProjectCaseById(id);
  if (!existing) return null;

  const seg = patch.seg === 'b2b' || patch.seg === 'b2c' ? patch.seg : existing.seg;
  const tag = patch.tag !== undefined ? patch.tag.trim() : existing.tag;
  const title = patch.title !== undefined ? patch.title.trim() : existing.title;
  const img = patch.img !== undefined ? patch.img.trim() : existing.img;
  const task = patch.task !== undefined ? patch.task.trim() : existing.task;
  const solution = patch.solution !== undefined ? patch.solution.trim() : existing.solution;
  const specs = patch.specs !== undefined ? patch.specs.trim() : existing.specs;
  const result = patch.result !== undefined ? patch.result.trim() : existing.result;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE projects
    SET seg = ?, tag = ?, title = ?, img = ?, task = ?, solution = ?, specs = ?, result = ?, updated_at = ?
    WHERE id = ?
  `).run(seg, tag, title, img, task, solution, specs, result, now, id);

  return getProjectCaseById(id);
}

export function deleteProjectCase(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return Number(res.changes) > 0;
}

const DEFAULT_SOCIAL_LINKS: SocialLinksConfig = {
  telegram: 'https://t.me/+380507777172',
  instagram: '',
  facebook: 'https://www.facebook.com/energocomfort.shop',
  youtube: '',
  viber: '',
  tiktok: '',
};

export function getSocialLinks(): SocialLinksConfig {
  const raw = getSetting('social_links_json');
  if (!raw) return { ...DEFAULT_SOCIAL_LINKS };
  try {
    const parsed = JSON.parse(raw) as Partial<SocialLinksConfig>;
    return {
      telegram: typeof parsed.telegram === 'string' ? parsed.telegram : DEFAULT_SOCIAL_LINKS.telegram,
      instagram: typeof parsed.instagram === 'string' ? parsed.instagram : '',
      facebook: typeof parsed.facebook === 'string' ? parsed.facebook : DEFAULT_SOCIAL_LINKS.facebook,
      youtube: typeof parsed.youtube === 'string' ? parsed.youtube : '',
      viber: typeof parsed.viber === 'string' ? parsed.viber : '',
      tiktok: typeof parsed.tiktok === 'string' ? parsed.tiktok : '',
    };
  } catch {
    return { ...DEFAULT_SOCIAL_LINKS };
  }
}

export function saveSocialLinks(links: SocialLinksConfig): void {
  setSetting('social_links_json', JSON.stringify(links));
}

export function listSitemapProductEntries(): Array<{ id: string; updatedAt: string }> {
  const db = getDb();
  const rows = db.prepare('SELECT id, updated_at FROM products ORDER BY id ASC').all();
  return rows.map((r) => ({
    id: String(r.id),
    updatedAt: String(r.updated_at || new Date().toISOString()),
  }));
}

export function getRecentCatalogAndProjectChanges(limit = 12): RecentChangeRecord[] {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(30, Math.round(limit)));
  const rows = db
    .prepare(
      `SELECT kind, id, title, updated_at FROM (
         SELECT 'product' AS kind, id, title, updated_at FROM products
         UNION ALL
         SELECT 'project' AS kind, id, title, updated_at FROM projects
       )
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(safeLimit);

  return rows.map((r) => ({
    kind: String(r.kind) === 'project' ? 'project' : 'product',
    id: String(r.id),
    title: String(r.title),
    updatedAt: String(r.updated_at),
  }));
}

export function getStorageDiagnostics(): StorageDiagnostics {
  const db = getDb();
  const uploadsDir = getUploadsDir();
  let dbSizeBytes = 0;
  try {
    dbSizeBytes = fs.statSync(DB_PATH).size;
  } catch {
    dbSizeBytes = 0;
  }
  let uploadsCount = 0;
  try {
    uploadsCount = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.')).length;
  } catch {
    uploadsCount = 0;
  }
  const prodCnt = Number(db.prepare('SELECT COUNT(*) as cnt FROM products').get()?.cnt ?? 0);
  const projCnt = Number(db.prepare('SELECT COUNT(*) as cnt FROM projects').get()?.cnt ?? 0);
  const dealCnt = Number(db.prepare('SELECT COUNT(*) as cnt FROM deals').get()?.cnt ?? 0);

  return {
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    dbSizeBytes,
    uploadsDir,
    uploadsCount,
    productsCount: prodCnt,
    projectsCount: projCnt,
    dealsCount: dealCnt,
    isCustomVolume: Boolean(process.env.DATA_DIR?.trim()),
  };
}

export function createSqliteBackupCopy(): string {
  const db = getDb();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const filename = `energocomfort-backup-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.db`;
  const targetPath = path.resolve(DATA_DIR, filename);
  if (!targetPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid backup path');
  }
  db.prepare('VACUUM INTO ?').run(targetPath);
  return targetPath;
}

// =====================================================================
// Drizzle ORM Relational CRM: Contacts, Tasks, Notes (with FK relations)
// =====================================================================

export async function listContacts(): Promise<Contact[]> {
  const [contactRows, dealRows, taskRows] = await Promise.all([
    drizzleDb.select().from(schema.contactsTable).orderBy(desc(schema.contactsTable.updatedAt)),
    drizzleDb
      .select({
        contactId: schema.dealsTable.contactId,
        totalUsd: schema.dealsTable.totalUsd,
      })
      .from(schema.dealsTable),
    drizzleDb
      .select({
        contactId: schema.tasksTable.contactId,
        status: schema.tasksTable.status,
      })
      .from(schema.tasksTable),
  ]);

  const dealStats = new Map<number, { count: number; totalUsd: number }>();
  for (const d of dealRows) {
    if (!d.contactId) continue;
    const prev = dealStats.get(d.contactId) ?? { count: 0, totalUsd: 0 };
    prev.count += 1;
    prev.totalUsd += Number(d.totalUsd || 0);
    dealStats.set(d.contactId, prev);
  }

  const openTasks = new Map<number, number>();
  for (const t of taskRows) {
    if (!t.contactId || t.status === 'done') continue;
    openTasks.set(t.contactId, (openTasks.get(t.contactId) ?? 0) + 1);
  }

  return contactRows.map((c) => {
    const ds = dealStats.get(c.id);
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      phone: c.phone,
      email: c.email,
      city: c.city,
      channel: c.channel,
      segment: c.segment === 'b2b' ? 'b2b' : 'b2c',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      dealsCount: ds?.count ?? 0,
      totalUsd: ds?.totalUsd ?? 0,
      openTasksCount: openTasks.get(c.id) ?? 0,
    };
  });
}

export async function getContactDetail(id: number): Promise<{
  contact: Contact;
  deals: Deal[];
  tasks: CrmTask[];
  notes: CrmNote[];
} | null> {
  const row = await drizzleDb.select().from(schema.contactsTable).where(eq(schema.contactsTable.id, id)).get();
  if (!row) return null;

  const dealRows = await drizzleDb
    .select()
    .from(schema.dealsTable)
    .where(eq(schema.dealsTable.contactId, id))
    .orderBy(desc(schema.dealsTable.id));
  const taskRows = await listTasks({ contactId: id });
  const noteRows = await listNotes({ contactId: id });

  return {
    contact: {
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
      city: row.city,
      channel: row.channel,
      segment: row.segment === 'b2b' ? 'b2b' : 'b2c',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dealsCount: dealRows.length,
      totalUsd: dealRows.reduce((s, d) => s + Number(d.totalUsd || 0), 0),
      openTasksCount: taskRows.filter((t) => t.status !== 'done').length,
    },
    deals: dealRows.map((d) => ({
      id: d.id,
      dealNumber: d.dealNumber,
      contactId: d.contactId,
      type: d.type as DealType,
      stage: d.stage as DealStage,
      customerName: d.customerName,
      phone: d.phone,
      city: d.city,
      channel: d.channel,
      topic: d.topic,
      taskType: d.taskType,
      loads: JSON.parse(d.loadsJson || '[]') as string[],
      items: JSON.parse(d.itemsJson || '[]') as DealItem[],
      totalUsd: d.totalUsd,
      assignee: d.assignee,
      notes: d.notes,
      telegramSent: d.telegramSent === 1,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    tasks: taskRows,
    notes: noteRows,
  };
}

export async function createContact(input: {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  city?: string;
  channel?: string;
  segment?: ContactSegment;
}): Promise<Contact> {
  const normalizedPhone = normalizeContactPhone(input.phone);
  const existing = await drizzleDb
    .select()
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.phone, normalizedPhone))
    .get();
  if (existing) {
    throw new Error('Контакт із таким номером телефону вже існує');
  }

  const now = new Date().toISOString();
  const [inserted] = await drizzleDb
    .insert(schema.contactsTable)
    .values({
      name: input.name.trim(),
      company: (input.company ?? '').trim(),
      phone: normalizedPhone,
      email: (input.email ?? '').trim(),
      city: (input.city ?? '').trim() || 'Одеса',
      channel: (input.channel ?? '').trim() || 'Telegram',
      segment: input.segment === 'b2b' ? 'b2b' : 'b2c',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    id: inserted.id,
    name: inserted.name,
    company: inserted.company,
    phone: inserted.phone,
    email: inserted.email,
    city: inserted.city,
    channel: inserted.channel,
    segment: inserted.segment === 'b2b' ? 'b2b' : 'b2c',
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
    dealsCount: 0,
    totalUsd: 0,
    openTasksCount: 0,
  };
}

export async function updateContact(
  id: number,
  patch: Partial<{
    name: string;
    company: string;
    phone: string;
    email: string;
    city: string;
    channel: string;
    segment: ContactSegment;
  }>,
): Promise<Contact | null> {
  const existing = await drizzleDb.select().from(schema.contactsTable).where(eq(schema.contactsTable.id, id)).get();
  if (!existing) return null;

  const nextPhone = patch.phone !== undefined ? normalizeContactPhone(patch.phone) : existing.phone;
  if (nextPhone !== existing.phone) {
    const dup = await drizzleDb
      .select({ id: schema.contactsTable.id })
      .from(schema.contactsTable)
      .where(eq(schema.contactsTable.phone, nextPhone))
      .get();
    if (dup && dup.id !== id) {
      throw new Error('Інший контакт із таким номером телефону вже існує');
    }
  }

  const now = new Date().toISOString();
  const [updated] = await drizzleDb
    .update(schema.contactsTable)
    .set({
      name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
      company: patch.company !== undefined ? patch.company.trim() : existing.company,
      phone: nextPhone,
      email: patch.email !== undefined ? patch.email.trim() : existing.email,
      city: patch.city !== undefined ? patch.city.trim() : existing.city,
      channel: patch.channel !== undefined ? patch.channel.trim() : existing.channel,
      segment: patch.segment === 'b2b' || patch.segment === 'b2c' ? patch.segment : existing.segment,
      updatedAt: now,
    })
    .where(eq(schema.contactsTable.id, id))
    .returning();

  return {
    id: updated.id,
    name: updated.name,
    company: updated.company,
    phone: updated.phone,
    email: updated.email,
    city: updated.city,
    channel: updated.channel,
    segment: updated.segment === 'b2b' ? 'b2b' : 'b2c',
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteContact(id: number): Promise<boolean> {
  const existing = await drizzleDb
    .select({ id: schema.contactsTable.id })
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.id, id))
    .get();
  if (!existing) return false;
  await drizzleDb.delete(schema.contactsTable).where(eq(schema.contactsTable.id, id));
  return true;
}

export async function listTasks(filters?: { contactId?: number; dealId?: number }): Promise<CrmTask[]> {
  let rows = await drizzleDb.select().from(schema.tasksTable).orderBy(desc(schema.tasksTable.id));
  if (filters?.contactId) {
    rows = rows.filter((t) => t.contactId === filters.contactId);
  }
  if (filters?.dealId) {
    rows = rows.filter((t) => t.dealId === filters.dealId);
  }

  const [contacts, deals] = await Promise.all([
    drizzleDb
      .select({ id: schema.contactsTable.id, name: schema.contactsTable.name, phone: schema.contactsTable.phone })
      .from(schema.contactsTable),
    drizzleDb
      .select({ id: schema.dealsTable.id, dealNumber: schema.dealsTable.dealNumber })
      .from(schema.dealsTable),
  ]);

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const dealMap = new Map(deals.map((d) => [d.id, d.dealNumber]));

  return rows.map((t) => {
    const contact = t.contactId ? contactMap.get(t.contactId) : undefined;
    return {
      id: t.id,
      contactId: t.contactId,
      dealId: t.dealId,
      title: t.title,
      status: (t.status as TaskStatus) || 'todo',
      priority: (t.priority as TaskPriority) || 'medium',
      assignee: t.assignee,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      dealNumber: t.dealId ? dealMap.get(t.dealId) : undefined,
    };
  });
}

export async function createTask(input: {
  contactId?: number | null;
  dealId?: number | null;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
}): Promise<CrmTask> {
  let resolvedContactId = input.contactId ?? null;
  if (!resolvedContactId && input.dealId) {
    const dealRow = await drizzleDb
      .select({ contactId: schema.dealsTable.contactId })
      .from(schema.dealsTable)
      .where(eq(schema.dealsTable.id, input.dealId))
      .get();
    if (dealRow?.contactId) resolvedContactId = dealRow.contactId;
  }

  const now = new Date().toISOString();
  const [inserted] = await drizzleDb
    .insert(schema.tasksTable)
    .values({
      contactId: resolvedContactId,
      dealId: input.dealId ?? null,
      title: input.title.trim(),
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      assignee: (input.assignee ?? '').trim() || 'Олександр (інженер)',
      dueDate: (input.dueDate ?? '').trim(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const all = await listTasks();
  return all.find((item) => item.id === inserted.id) ?? {
    id: inserted.id,
    contactId: inserted.contactId,
    dealId: inserted.dealId,
    title: inserted.title,
    status: inserted.status as TaskStatus,
    priority: inserted.priority as TaskPriority,
    assignee: inserted.assignee,
    dueDate: inserted.dueDate,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}

export async function updateTask(
  id: number,
  patch: Partial<{
    contactId: number | null;
    dealId: number | null;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string;
    dueDate: string;
  }>,
): Promise<CrmTask | null> {
  const existing = await drizzleDb.select().from(schema.tasksTable).where(eq(schema.tasksTable.id, id)).get();
  if (!existing) return null;

  const now = new Date().toISOString();
  await drizzleDb
    .update(schema.tasksTable)
    .set({
      contactId: patch.contactId !== undefined ? patch.contactId : existing.contactId,
      dealId: patch.dealId !== undefined ? patch.dealId : existing.dealId,
      title: patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
      status: patch.status ?? existing.status,
      priority: patch.priority ?? existing.priority,
      assignee: patch.assignee !== undefined ? patch.assignee.trim() : existing.assignee,
      dueDate: patch.dueDate !== undefined ? patch.dueDate.trim() : existing.dueDate,
      updatedAt: now,
    })
    .where(eq(schema.tasksTable.id, id));

  const all = await listTasks();
  return all.find((item) => item.id === id) ?? null;
}

export async function deleteTask(id: number): Promise<boolean> {
  const existing = await drizzleDb
    .select({ id: schema.tasksTable.id })
    .from(schema.tasksTable)
    .where(eq(schema.tasksTable.id, id))
    .get();
  if (!existing) return false;
  await drizzleDb.delete(schema.tasksTable).where(eq(schema.tasksTable.id, id));
  return true;
}

export async function listNotes(filters?: { contactId?: number; dealId?: number }): Promise<CrmNote[]> {
  const whereClause =
    filters?.contactId && filters?.dealId
      ? or(eq(schema.notesTable.contactId, filters.contactId), eq(schema.notesTable.dealId, filters.dealId))
      : filters?.contactId
        ? eq(schema.notesTable.contactId, filters.contactId)
        : filters?.dealId
          ? eq(schema.notesTable.dealId, filters.dealId)
          : undefined;

  const rows = whereClause
    ? await drizzleDb.select().from(schema.notesTable).where(whereClause).orderBy(desc(schema.notesTable.id))
    : await drizzleDb.select().from(schema.notesTable).orderBy(desc(schema.notesTable.id));

  return rows.map((n) => ({
    id: n.id,
    contactId: n.contactId,
    dealId: n.dealId,
    author: n.author,
    body: n.body,
    createdAt: n.createdAt,
  }));
}

export async function createNote(input: {
  contactId?: number | null;
  dealId?: number | null;
  author?: string;
  body: string;
}): Promise<CrmNote> {
  let resolvedContactId = input.contactId ?? null;
  if (!resolvedContactId && input.dealId) {
    const dealRow = await drizzleDb
      .select({ contactId: schema.dealsTable.contactId })
      .from(schema.dealsTable)
      .where(eq(schema.dealsTable.id, input.dealId))
      .get();
    if (dealRow?.contactId) resolvedContactId = dealRow.contactId;
  }

  const now = new Date().toISOString();
  const [inserted] = await drizzleDb
    .insert(schema.notesTable)
    .values({
      contactId: resolvedContactId,
      dealId: input.dealId ?? null,
      author: (input.author ?? '').trim() || 'Менеджер CRM',
      body: input.body.trim(),
      createdAt: now,
    })
    .returning();

  return {
    id: inserted.id,
    contactId: inserted.contactId,
    dealId: inserted.dealId,
    author: inserted.author,
    body: inserted.body,
    createdAt: inserted.createdAt,
  };
}

export async function deleteNote(id: number): Promise<boolean> {
  const existing = await drizzleDb
    .select({ id: schema.notesTable.id })
    .from(schema.notesTable)
    .where(eq(schema.notesTable.id, id))
    .get();
  if (!existing) return false;
  await drizzleDb.delete(schema.notesTable).where(eq(schema.notesTable.id, id));
  return true;
}

function seedStaffIfEmpty(db: DatabaseSync): void {
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'staff_seeded'").get() as
    | { value?: string }
    | undefined;
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM staff_users').get() as { cnt?: number } | undefined;
  if (seeded || Number(countRow?.cnt ?? 0) > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO staff_users (
      name, login, email, phone, position, role, assignee_label,
      password_hash, can_login, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, 1, ?, ?)
  `);

  const defaults: Array<[string, string, string, string, StaffRole, string]> = [
    ['Олександр', 'alex', '', 'Інженер', 'engineer', 'Олександр (інженер)'],
    ['Дмитро', 'dmytro', '', 'Менеджер', 'manager', 'Дмитро (менеджер)'],
    ['Ірина', 'iryna', '', 'Координатор', 'manager', 'Ірина (координатор)'],
    ['Монтажна бригада №1', 'brigade1', '', 'Монтажна бригада', 'installer', 'Монтажна бригада №1'],
  ];

  db.exec('BEGIN;');
  try {
    for (const [name, login, phone, position, role, assigneeLabel] of defaults) {
      insert.run(name, login, '', phone, position, role, assigneeLabel, now, now);
    }
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('staff_seeded', '1', ?)",
    ).run(now);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function ensureMasterAdminAccount(db: DatabaseSync): void {
  const existing = db
    .prepare("SELECT id, role, can_login, active, password_hash FROM staff_users WHERE login = 'admin'")
    .get() as
    | { id: number; role: string; can_login: number; active: number; password_hash: string }
    | undefined;

  const settingsHashRow = db
    .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
    .get() as { value?: string } | undefined;
  const legacyHash = settingsHashRow?.value?.trim() || '';
  const now = new Date().toISOString();

  if (!existing) {
    db.prepare(`
      INSERT INTO staff_users (
        name, login, email, phone, position, role, assignee_label,
        password_hash, can_login, active, created_at, updated_at
      ) VALUES (?, 'admin', '', '', ?, 'admin', ?, ?, 1, 1, ?, ?)
    `).run('Головний адміністратор', 'Мастер-адміністратор', 'Адміністратор', legacyHash, now, now);
    return;
  }

  const nextHash = existing.password_hash || legacyHash;
  if (
    existing.role !== 'admin' ||
    existing.can_login !== 1 ||
    existing.active !== 1 ||
    (!existing.password_hash && legacyHash)
  ) {
    db.prepare(
      "UPDATE staff_users SET role = 'admin', can_login = 1, active = 1, password_hash = ?, updated_at = ? WHERE id = ?",
    ).run(nextHash, now, existing.id);
  }
}

function mapStaffRow(r: typeof schema.staffUsersTable.$inferSelect): StaffUser {
  const role: StaffRole =
    r.role === 'admin' || r.role === 'manager' || r.role === 'engineer' || r.role === 'installer'
      ? r.role
      : 'manager';
  return {
    id: r.id,
    name: r.name,
    login: r.login,
    email: r.email,
    phone: r.phone,
    position: r.position,
    role,
    assigneeLabel: r.assigneeLabel,
    canLogin: Boolean(r.canLogin),
    active: Boolean(r.active),
    hasPassword: Boolean(r.passwordHash),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function getStaffAuthStateSync(userId: number): {
  active: boolean;
  canLogin: boolean;
  role: StaffRole;
  name: string;
  login: string;
  email: string;
  assigneeLabel: string;
} | null {
  const db = getDb();
  const row = db
    .prepare('SELECT name, login, email, role, assignee_label, can_login, active FROM staff_users WHERE id = ?')
    .get(userId) as
    | {
        name: string;
        login: string;
        email: string;
        role: string;
        assignee_label: string;
        can_login: number;
        active: number;
      }
    | undefined;
  if (!row) return null;
  const role: StaffRole =
    row.role === 'admin' || row.role === 'manager' || row.role === 'engineer' || row.role === 'installer'
      ? row.role
      : 'manager';
  return {
    active: Boolean(row.active),
    canLogin: Boolean(row.can_login),
    role,
    name: row.name,
    login: row.login,
    email: row.email,
    assigneeLabel: row.assignee_label,
  };
}

export function getMasterAdminRecordSync(): {
  id: number;
  name: string;
  login: string;
  email: string;
  role: 'admin';
  assigneeLabel: string;
  passwordHash: string;
} {
  const db = getDb();
  ensureMasterAdminAccount(db);
  const row = db
    .prepare("SELECT id, name, login, email, assignee_label, password_hash FROM staff_users WHERE login = 'admin'")
    .get() as {
    id: number;
    name: string;
    login: string;
    email: string;
    assignee_label: string;
    password_hash: string;
  };
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email,
    role: 'admin',
    assigneeLabel: row.assignee_label,
    passwordHash: row.password_hash,
  };
}

export function claimMasterAdminAccount(input: {
  passwordHash: string;
  name?: string;
  email?: string;
}): ReturnType<typeof getMasterAdminRecordSync> {
  const db = getDb();
  ensureMasterAdminAccount(db);
  const current = getMasterAdminRecordSync();
  const now = new Date().toISOString();
  const nextName = input.name?.trim() || current.name;
  const nextEmail = input.email?.trim().toLowerCase() ?? current.email;
  db.prepare(
    "UPDATE staff_users SET name = ?, email = ?, password_hash = ?, role = 'admin', can_login = 1, active = 1, updated_at = ? WHERE id = ?",
  ).run(nextName, nextEmail, input.passwordHash, now, current.id);
  return getMasterAdminRecordSync();
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  const rows = await drizzleDb
    .select()
    .from(schema.staffUsersTable)
    .orderBy(desc(schema.staffUsersTable.active), asc(schema.staffUsersTable.id));
  const mapped = rows.map(mapStaffRow);
  return mapped.sort((a, b) => {
    if (a.login === 'admin' && b.login !== 'admin') return -1;
    if (b.login === 'admin' && a.login !== 'admin') return 1;
    return 0;
  });
}

export async function findStaffForPasswordLogin(identifier: string): Promise<{
  user: StaffUser;
  passwordHash: string;
} | null> {
  const norm = identifier.trim().toLowerCase();
  if (!norm) return null;
  const rows = await drizzleDb
    .select()
    .from(schema.staffUsersTable)
    .where(or(eq(schema.staffUsersTable.login, norm), eq(schema.staffUsersTable.email, norm)));
  const match = rows[0];
  if (!match) return null;
  return {
    user: mapStaffRow(match),
    passwordHash: match.passwordHash,
  };
}

export async function findStaffForGoogleLogin(email: string): Promise<StaffUser | null> {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const row = await drizzleDb
    .select()
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.email, norm))
    .get();
  if (!row) return null;
  return mapStaffRow(row);
}

function defaultAssigneeLabel(name: string, position: string): string {
  const cleanName = name.trim();
  const cleanPos = position.trim();
  if (!cleanPos) return cleanName;
  if (cleanName.toLowerCase().includes(cleanPos.toLowerCase())) return cleanName;
  return `${cleanName} (${cleanPos.toLowerCase()})`;
}

export async function createStaffUser(input: {
  name: string;
  login: string;
  email?: string;
  phone?: string;
  position: string;
  role?: StaffRole;
  assigneeLabel?: string;
  password?: string;
  canLogin?: boolean;
  active?: boolean;
}): Promise<StaffUser> {
  const loginNorm = input.login.trim().toLowerCase();
  const emailNorm = (input.email ?? '').trim().toLowerCase();

  const existingLogin = await drizzleDb
    .select({ id: schema.staffUsersTable.id })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.login, loginNorm))
    .get();
  if (existingLogin) {
    throw new Error('Співробітник із таким логіном вже існує');
  }

  if (emailNorm) {
    const existingEmail = await drizzleDb
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.email, emailNorm))
      .get();
    if (existingEmail) {
      throw new Error('Цей Email вже закріплено за іншим співробітником');
    }
  }

  const now = new Date().toISOString();
  const label = (input.assigneeLabel ?? '').trim() || defaultAssigneeLabel(input.name, input.position);
  const passwordHash = input.password ? hashPassword(input.password) : '';

  const [inserted] = await drizzleDb
    .insert(schema.staffUsersTable)
    .values({
      name: input.name.trim(),
      login: loginNorm,
      email: emailNorm,
      phone: (input.phone ?? '').trim(),
      position: input.position.trim(),
      role: input.role ?? 'manager',
      assigneeLabel: label,
      passwordHash,
      canLogin: input.canLogin === false ? 0 : 1,
      active: input.active === false ? 0 : 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapStaffRow(inserted);
}

export async function updateStaffUser(
  id: number,
  patch: Partial<{
    name: string;
    login: string;
    email: string;
    phone: string;
    position: string;
    role: StaffRole;
    assigneeLabel: string;
    password: string;
    clearPassword: boolean;
    canLogin: boolean;
    active: boolean;
  }>,
): Promise<StaffUser | null> {
  const existing = await drizzleDb
    .select()
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.id, id))
    .get();
  if (!existing) return null;

  const isMaster = existing.login === 'admin';
  if (isMaster) {
    if (patch.login !== undefined && patch.login.trim().toLowerCase() !== 'admin') {
      throw new Error('Логін мастер-акаунту (admin) змінити неможливо');
    }
    if (patch.role !== undefined && patch.role !== 'admin') {
      throw new Error('Мастер-акаунт завжди має роль адміністратора');
    }
    if (patch.active === false || patch.canLogin === false) {
      throw new Error('Мастер-акаунт адміністратора не може бути вимкнений');
    }
  }

  const nextLogin = isMaster ? 'admin' : patch.login !== undefined ? patch.login.trim().toLowerCase() : existing.login;
  const nextEmail = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;

  if (nextLogin !== existing.login) {
    const dupLogin = await drizzleDb
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.login, nextLogin))
      .get();
    if (dupLogin && dupLogin.id !== id) {
      throw new Error('Інший співробітник уже використовує цей логін');
    }
  }

  if (nextEmail && nextEmail !== existing.email) {
    const dupEmail = await drizzleDb
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.email, nextEmail))
      .get();
    if (dupEmail && dupEmail.id !== id) {
      throw new Error('Цей Email вже закріплено за іншим співробітником');
    }
  }

  const nextName = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
  const nextPos = patch.position !== undefined ? patch.position.trim() || existing.position : existing.position;
  const nextLabel =
    patch.assigneeLabel !== undefined
      ? patch.assigneeLabel.trim() || defaultAssigneeLabel(nextName, nextPos)
      : existing.assigneeLabel;

  let nextPasswordHash = existing.passwordHash;
  if (patch.clearPassword) {
    if (isMaster && !nextEmail) {
      throw new Error('Для мастер-акаунту без Google Email не можна прибирати пароль');
    }
    nextPasswordHash = '';
  } else if (patch.password && patch.password.length >= 6) {
    nextPasswordHash = hashPassword(patch.password);
  }

  const now = new Date().toISOString();
  const [updated] = await drizzleDb
    .update(schema.staffUsersTable)
    .set({
      name: nextName,
      login: nextLogin,
      email: nextEmail,
      phone: patch.phone !== undefined ? patch.phone.trim() : existing.phone,
      position: nextPos,
      role: isMaster ? 'admin' : (patch.role ?? existing.role),
      assigneeLabel: nextLabel,
      passwordHash: nextPasswordHash,
      canLogin: isMaster ? 1 : patch.canLogin !== undefined ? (patch.canLogin ? 1 : 0) : existing.canLogin,
      active: isMaster ? 1 : patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active,
      updatedAt: now,
    })
    .where(eq(schema.staffUsersTable.id, id))
    .returning();

  // Keep settings.admin_password_hash synced when master admin updates password
  if (isMaster && nextPasswordHash !== existing.passwordHash) {
    const db = getDb();
    if (nextPasswordHash) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('admin_password_hash', ?, ?)").run(
        nextPasswordHash,
        now,
      );
    } else {
      db.prepare("DELETE FROM settings WHERE key = 'admin_password_hash'").run();
    }
  }

  // Propagate renamed assigneeLabel to existing deals and tasks so links stay cohesive
  if (nextLabel !== existing.assigneeLabel) {
    const db = getDb();
    db.prepare('UPDATE deals SET assignee = ? WHERE assignee = ?').run(nextLabel, existing.assigneeLabel);
    db.prepare('UPDATE tasks SET assignee = ? WHERE assignee = ?').run(nextLabel, existing.assigneeLabel);
  }

  return mapStaffRow(updated);
}

export async function deleteStaffUser(id: number): Promise<boolean> {
  const existing = await drizzleDb
    .select({ id: schema.staffUsersTable.id, login: schema.staffUsersTable.login })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.id, id))
    .get();
  if (!existing) return false;
  if (existing.login === 'admin') {
    throw new Error('Мастер-акаунт адміністратора не можна видалити');
  }
  await drizzleDb.delete(schema.staffUsersTable).where(eq(schema.staffUsersTable.id, id));
  return true;
}



