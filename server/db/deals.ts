import { count, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type { ContactSegment, Deal, DealItem, DealPatchPayload, DealStage, DealType } from '../../src/types.ts';
import { getProductById } from './catalog.ts';
import { getDb, isDatabaseConfigured } from './client.ts';
import { upsertContact } from './contacts.ts';
import {
  memBackfillCustomerDeals,
  memCreateDeal,
  memDeleteDeal,
  memListCustomerDeals,
  memListDeals,
  memMarkDealTelegramSent,
  memUpdateDeal,
} from './memoryStore.ts';
import { normalizeContactPhone, safeJsonParse } from './utils.ts';

function rowToDeal(r: typeof schema.dealsTable.$inferSelect): Deal {
  return {
    id: r.id,
    dealNumber: r.dealNumber,
    contactId: r.contactId ?? null,
    customerEmail: r.customerEmail || '',
    type: r.type as DealType,
    stage: r.stage as DealStage,
    customerName: r.customerName,
    phone: r.phone,
    city: r.city,
    channel: r.channel,
    topic: r.topic,
    taskType: r.taskType,
    loads: safeJsonParse<string[]>(r.loadsJson, []),
    items: safeJsonParse<DealItem[]>(r.itemsJson, []),
    totalUsd: Number(r.totalUsd),
    assignee: r.assignee,
    notes: r.notes,
    telegramSent: Number(r.telegramSent) === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function computeNextDealNumericId(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      maxId: sql<number>`COALESCE(MAX(${schema.dealsTable.id}), 0)`,
      maxNum: sql<number>`COALESCE(MAX(CASE WHEN ${schema.dealsTable.dealNumber} ~ '^EC-[0-9]+$' THEN CAST(SUBSTRING(${schema.dealsTable.dealNumber} FROM 4) AS INTEGER) ELSE 1041 END), 1041)`,
    })
    .from(schema.dealsTable);

  const maxId = Number(row?.maxId ?? 0);
  const maxNum = Number(row?.maxNum ?? 1041);
  return Math.max(1042 + maxId, maxNum + 1);
}

export async function seedDealsIfEmpty(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [cntRow] = await db.select({ cnt: count() }).from(schema.dealsTable);
  if (Number(cntRow?.cnt ?? 0) > 0) return;

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

  await db.transaction(async (tx) => {
    for (const d of initialDeals) {
      await tx
        .insert(schema.dealsTable)
        .values({
          dealNumber: d.dealNumber,
          type: d.type,
          stage: d.stage,
          customerName: d.customerName,
          phone: d.phone,
          city: d.city,
          channel: d.channel,
          topic: d.topic,
          taskType: d.taskType,
          loadsJson: JSON.stringify(d.loads),
          itemsJson: JSON.stringify(d.items),
          totalUsd: d.totalUsd,
          assignee: d.assignee,
          notes: d.notes,
          telegramSent: 0,
          createdAt: d.createdAt,
          updatedAt: d.createdAt,
        })
        .onConflictDoNothing({ target: schema.dealsTable.dealNumber });
    }
  });
}

export async function createDeal(input: {
  type: DealType;
  stage?: DealStage;
  assignee?: string;
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
  totalUsd?: number;
  contactId?: number | null;
  customerId?: number | null;
  customerEmail?: string;
}): Promise<Deal> {
  if (!isDatabaseConfigured()) {
    return memCreateDeal(input);
  }
  const db = getDb();
  const now = new Date().toISOString();

  const verifiedItems: DealItem[] = [];
  let catalogTotalUsd = 0;

  if (input.items && input.items.length > 0) {
    for (const reqItem of input.items) {
      const prod = await getProductById(reqItem.productId);
      if (!prod) continue;
      const qty = Math.max(1, Math.min(99, Math.round(Number(reqItem.qty) || 1)));
      verifiedItems.push({
        productId: prod.id,
        sku: prod.sku,
        title: prod.title,
        price: prod.price,
        qty,
      });
      catalogTotalUsd += prod.price * qty;
    }
  }

  let totalUsd = 0;
  if (typeof input.totalUsd === 'number' && Number.isFinite(input.totalUsd)) {
    totalUsd = Math.max(0, Math.round(input.totalUsd));
  } else if (verifiedItems.length > 0) {
    totalUsd = catalogTotalUsd;
  } else if (input.estimatedTotalUsd) {
    totalUsd = Math.max(0, Math.round(Number(input.estimatedTotalUsd)));
  }

  const topic =
    input.topic?.trim() ||
    (input.type === 'order'
      ? verifiedItems.length > 0
        ? `Замовлення обладнання (${verifiedItems.length} поз.)`
        : 'Замовлення обладнання'
      : input.taskType?.trim() || 'Інженерний розрахунок системи');

  const customerName = (input.customerName ?? '').trim() || 'Клієнт сайту';
  const city = (input.city ?? '').trim() || 'Одеса';
  const channel = (input.channel ?? '').trim() || 'Telegram';
  const taskType = (input.taskType ?? '').trim() || (input.type === 'order' ? 'Замовлення обладнання' : 'Консультація');

  let resolvedCustomerId: number | null = null;
  let customerEmailNorm = (input.customerEmail ?? '').trim().toLowerCase();
  if (input.customerId) {
    const [custRow] = await db
      .select({ id: schema.customerAccountsTable.id, email: schema.customerAccountsTable.email })
      .from(schema.customerAccountsTable)
      .where(eq(schema.customerAccountsTable.id, input.customerId))
      .limit(1);
    if (custRow) {
      resolvedCustomerId = custRow.id;
      if (!customerEmailNorm && custRow.email) {
        customerEmailNorm = custRow.email.trim().toLowerCase();
      }
    }
  }

  if (!customerEmailNorm && input.contactId) {
    const [existingContact] = await db
      .select({ email: schema.contactsTable.email })
      .from(schema.contactsTable)
      .where(eq(schema.contactsTable.id, input.contactId))
      .limit(1);
    if (existingContact?.email) {
      customerEmailNorm = existingContact.email.trim().toLowerCase();
    }
  }

  const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${customerName} ${taskType} ${topic}`)
    ? 'b2b'
    : 'b2c';

  const contactId = await upsertContact({
    name: customerName,
    phone: input.phone.trim(),
    email: customerEmailNorm,
    city,
    channel,
    company: /тов/i.test(customerName) ? customerName : '',
    segment,
  });

  const validStages: DealStage[] = ['new', 'audit', 'proposal', 'fulfillment', 'done', 'archived'];
  const stage: DealStage = input.stage && validStages.includes(input.stage) ? input.stage : 'new';
  const assignee =
    (input.assignee ?? '').trim() ||
    (input.type === 'order' ? 'Дмитро (менеджер)' : 'Олександр (інженер)');

  let nextNumeric = await computeNextDealNumericId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const dealNumber = `EC-${nextNumeric + attempt}`;
    try {
      const [inserted] = await db
        .insert(schema.dealsTable)
        .values({
          dealNumber,
          contactId,
          customerId: resolvedCustomerId,
          customerEmail: customerEmailNorm,
          type: input.type,
          stage,
          customerName,
          phone: normalizeContactPhone(input.phone.trim()),
          city,
          channel,
          topic,
          taskType,
          loadsJson: JSON.stringify(input.loads ?? []),
          itemsJson: JSON.stringify(verifiedItems),
          totalUsd,
          assignee,
          notes: (input.notes ?? '').trim(),
          telegramSent: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rowToDeal(inserted);
    } catch (err) {
      const pgCode = (err as { code?: string } | null)?.code;
      if (pgCode === '23505' && attempt < 4) {
        nextNumeric = await computeNextDealNumericId();
        continue;
      }
      throw err;
    }
  }

  throw new Error('Не вдалося згенерувати унікальний номер угоди');
}

export async function markDealTelegramSent(id: number): Promise<void> {
  if (!isDatabaseConfigured()) {
    memMarkDealTelegramSent(id);
    return;
  }
  const db = getDb();
  await db.update(schema.dealsTable).set({ telegramSent: 1 }).where(eq(schema.dealsTable.id, id));
}

export async function listDeals(): Promise<Deal[]> {
  if (!isDatabaseConfigured()) {
    return memListDeals();
  }
  const db = getDb();
  const rows = await db.select().from(schema.dealsTable).orderBy(desc(schema.dealsTable.id));
  return rows.map(rowToDeal);
}

export async function updateDeal(
  id: number,
  patch: DealPatchPayload,
): Promise<Deal | null> {
  if (!isDatabaseConfigured()) {
    return memUpdateDeal(id, patch);
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.dealsTable)
    .where(eq(schema.dealsTable.id, id))
    .limit(1);
  if (!existing) return null;

  const type = patch.type ?? (existing.type as DealType);
  const stage = patch.stage ?? (existing.stage as DealStage);
  const assignee = patch.assignee !== undefined ? patch.assignee.trim() : existing.assignee;
  const customerName =
    patch.customerName !== undefined ? patch.customerName.trim() || existing.customerName : existing.customerName;
  const phone =
    patch.phone !== undefined ? normalizeContactPhone(patch.phone.trim()) || existing.phone : existing.phone;
  const customerEmail =
    patch.customerEmail !== undefined ? patch.customerEmail.trim().toLowerCase() : existing.customerEmail;
  const city = patch.city !== undefined ? patch.city.trim() || 'Одеса' : existing.city;
  const channel = patch.channel !== undefined ? patch.channel.trim() || existing.channel : existing.channel;
  const topic = patch.topic !== undefined ? patch.topic.trim() || existing.topic : existing.topic;
  const taskType = patch.taskType !== undefined ? patch.taskType.trim() : existing.taskType;
  const loadsJson =
    patch.loads !== undefined
      ? JSON.stringify(patch.loads.map((item) => item.trim()).filter(Boolean))
      : existing.loadsJson;

  let itemsJson = existing.itemsJson;
  if (patch.items !== undefined) {
    const verifiedItems: DealItem[] = [];
    for (const reqItem of patch.items) {
      const prod = await getProductById(reqItem.productId);
      if (!prod) continue;
      const qty = Math.max(1, Math.min(99, Math.round(Number(reqItem.qty) || 1)));
      verifiedItems.push({
        productId: prod.id,
        sku: prod.sku,
        title: prod.title,
        price: prod.price,
        qty,
      });
    }
    itemsJson = JSON.stringify(verifiedItems);
  }

  const notes = patch.notes !== undefined ? patch.notes.trim() : existing.notes;
  const totalUsd =
    patch.totalUsd !== undefined ? Math.max(0, Math.round(Number(patch.totalUsd))) : existing.totalUsd;
  const now = new Date().toISOString();

  const [updated] = await db
    .update(schema.dealsTable)
    .set({
      type,
      stage,
      assignee,
      customerName,
      phone,
      customerEmail,
      city,
      channel,
      topic,
      taskType,
      loadsJson,
      itemsJson,
      notes,
      totalUsd,
      updatedAt: now,
    })
    .where(eq(schema.dealsTable.id, id))
    .returning();

  if (
    updated &&
    (patch.customerName !== undefined ||
      patch.phone !== undefined ||
      patch.customerEmail !== undefined ||
      patch.city !== undefined ||
      patch.channel !== undefined)
  ) {
    const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${customerName} ${taskType} ${topic}`)
      ? 'b2b'
      : 'b2c';
    await upsertContact({
      name: customerName,
      phone,
      email: customerEmail,
      city,
      channel,
      company: /тов/i.test(customerName) ? customerName : '',
      segment,
    });
  }

  return updated ? rowToDeal(updated) : null;
}

export async function deleteDeal(id: number): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return memDeleteDeal(id);
  }
  const db = getDb();
  const deleted = await db
    .delete(schema.dealsTable)
    .where(eq(schema.dealsTable.id, id))
    .returning({ id: schema.dealsTable.id });
  return deleted.length > 0;
}

export async function listCustomerDeals(customer: { id: number; email: string; phone: string }): Promise<Deal[]> {
  if (!isDatabaseConfigured()) {
    return memListCustomerDeals(customer);
  }
  const db = getDb();
  const emailNorm = customer.email.trim().toLowerCase();
  const phoneNorm = customer.phone.trim() ? normalizeContactPhone(customer.phone.trim()) : '';

  const rows = await db
    .selectDistinct({
      deal: schema.dealsTable,
    })
    .from(schema.dealsTable)
    .leftJoin(schema.contactsTable, eq(schema.contactsTable.id, schema.dealsTable.contactId))
    .where(
      sql`${schema.dealsTable.customerId} = ${customer.id}
        OR (${emailNorm} != '' AND LOWER(${schema.dealsTable.customerEmail}) = ${emailNorm})
        OR (${emailNorm} != '' AND LOWER(${schema.contactsTable.email}) = ${emailNorm})
        OR (${phoneNorm} != '' AND ${schema.dealsTable.phone} = ${phoneNorm})`,
    )
    .orderBy(desc(schema.dealsTable.id));

  return rows.map((r) => rowToDeal(r.deal));
}

export async function backfillCustomerDeals(
  customerId: number,
  emailNorm: string,
  phoneNorm: string,
): Promise<void> {
  if (!isDatabaseConfigured()) {
    memBackfillCustomerDeals(customerId, emailNorm, phoneNorm);
    return;
  }
  const db = getDb();
  if (emailNorm) {
    await db
      .update(schema.dealsTable)
      .set({
        customerId,
        customerEmail: sql`CASE WHEN ${schema.dealsTable.customerEmail} = '' THEN ${emailNorm} ELSE ${schema.dealsTable.customerEmail} END`,
      })
      .where(
        sql`${schema.dealsTable.customerId} IS NULL AND LOWER(${schema.dealsTable.customerEmail}) = ${emailNorm}`,
      );
  }
  if (phoneNorm) {
    await db
      .update(schema.dealsTable)
      .set({
        customerId,
        customerEmail: sql`CASE WHEN ${schema.dealsTable.customerEmail} = '' THEN ${emailNorm} ELSE ${schema.dealsTable.customerEmail} END`,
      })
      .where(sql`${schema.dealsTable.customerId} IS NULL AND ${schema.dealsTable.phone} = ${phoneNorm}`);
  }
}
