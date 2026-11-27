import { desc, eq } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type {
  Contact,
  ContactSegment,
  CrmNote,
  CrmTask,
  Deal,
  DealItem,
  DealStage,
  DealType,
  TaskPriority,
  TaskStatus,
} from '../../src/types.ts';
import { getDb, isDatabaseConfigured } from './client.ts';
import {
  memCreateContact,
  memDeleteContact,
  memGetContactDetail,
  memListContacts,
  memUpdateContact,
  memUpsertContact,
} from './memoryStore.ts';
import { normalizeContactPhone, safeJsonParse } from './utils.ts';

export async function upsertContact(input: {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  channel?: string;
  company?: string;
  segment?: ContactSegment;
}): Promise<number> {
  if (!isDatabaseConfigured()) {
    return memUpsertContact(input);
  }
  const db = getDb();
  const normalizedPhone = normalizeContactPhone(input.phone);
  const emailNorm = (input.email ?? '').trim().toLowerCase();
  const now = new Date().toISOString();

  const updateExisting = async (existing: typeof schema.contactsTable.$inferSelect): Promise<number> => {
    const nextName =
      existing.name === 'Клієнт сайту' || existing.name === 'Клієнт із головної форми'
        ? input.name.trim() || existing.name
        : existing.name;
    const nextCity = !existing.city && input.city?.trim() ? input.city.trim() : existing.city;
    const nextEmail = !existing.email && emailNorm ? emailNorm : existing.email;
    await db
      .update(schema.contactsTable)
      .set({ name: nextName, email: nextEmail, city: nextCity, updatedAt: now })
      .where(eq(schema.contactsTable.id, existing.id));
    return existing.id;
  };

  const [existing] = await db
    .select()
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.phone, normalizedPhone))
    .limit(1);

  if (existing) {
    return updateExisting(existing);
  }

  const inferredSegment: ContactSegment =
    input.segment ||
    (/тов|бізнес|сто|готел|завод|ооо/i.test(`${input.name} ${input.company || ''}`) ? 'b2b' : 'b2c');

  const inserted = await db
    .insert(schema.contactsTable)
    .values({
      name: input.name.trim() || 'Клієнт сайту',
      company: (input.company ?? '').trim(),
      phone: normalizedPhone,
      email: emailNorm,
      city: (input.city ?? '').trim() || 'Одеса',
      channel: (input.channel ?? '').trim() || 'Telegram',
      segment: inferredSegment,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: schema.contactsTable.phone })
    .returning({ id: schema.contactsTable.id });

  if (inserted[0]) {
    return inserted[0].id;
  }

  // Concurrent insert won the race — fetch and update existing contact
  const [raceRow] = await db
    .select()
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.phone, normalizedPhone))
    .limit(1);
  if (!raceRow) {
    throw new Error('Failed to upsert contact');
  }
  return updateExisting(raceRow);
}

export async function listContacts(): Promise<Contact[]> {
  if (!isDatabaseConfigured()) {
    return memListContacts();
  }
  const db = getDb();
  const [contactRows, dealRows, taskRows] = await Promise.all([
    db.select().from(schema.contactsTable).orderBy(desc(schema.contactsTable.updatedAt)),
    db
      .select({
        contactId: schema.dealsTable.contactId,
        totalUsd: schema.dealsTable.totalUsd,
      })
      .from(schema.dealsTable),
    db
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
  if (!isDatabaseConfigured()) {
    return memGetContactDetail(id);
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.id, id))
    .limit(1);
  if (!row) return null;

  const [dealRows, taskDbRows, noteDbRows] = await Promise.all([
    db
      .select()
      .from(schema.dealsTable)
      .where(eq(schema.dealsTable.contactId, id))
      .orderBy(desc(schema.dealsTable.id)),
    db
      .select()
      .from(schema.tasksTable)
      .where(eq(schema.tasksTable.contactId, id))
      .orderBy(desc(schema.tasksTable.id)),
    db
      .select()
      .from(schema.notesTable)
      .where(eq(schema.notesTable.contactId, id))
      .orderBy(desc(schema.notesTable.id)),
  ]);

  const dealNumberMap = new Map(dealRows.map((d) => [d.id, d.dealNumber]));
  const tasks: CrmTask[] = taskDbRows.map((t) => ({
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
    contactName: row.name,
    contactPhone: row.phone,
    dealNumber: t.dealId ? dealNumberMap.get(t.dealId) : undefined,
  }));

  const notes: CrmNote[] = noteDbRows.map((n) => ({
    id: n.id,
    contactId: n.contactId,
    dealId: n.dealId,
    author: n.author,
    body: n.body,
    createdAt: n.createdAt,
  }));

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
      openTasksCount: tasks.filter((t) => t.status !== 'done').length,
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
      loads: safeJsonParse<string[]>(d.loadsJson, []),
      items: safeJsonParse<DealItem[]>(d.itemsJson, []),
      totalUsd: d.totalUsd,
      assignee: d.assignee,
      notes: d.notes,
      telegramSent: d.telegramSent === 1,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    tasks,
    notes,
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
  if (!isDatabaseConfigured()) {
    return memCreateContact(input);
  }
  const db = getDb();
  const normalizedPhone = normalizeContactPhone(input.phone);
  const [existing] = await db
    .select({ id: schema.contactsTable.id })
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.phone, normalizedPhone))
    .limit(1);
  if (existing) {
    throw new Error('Контакт із таким номером телефону вже існує');
  }

  const now = new Date().toISOString();
  const [inserted] = await db
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
  if (!isDatabaseConfigured()) {
    return memUpdateContact(id, patch);
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.contactsTable)
    .where(eq(schema.contactsTable.id, id))
    .limit(1);
  if (!existing) return null;

  const nextPhone = patch.phone !== undefined ? normalizeContactPhone(patch.phone) : existing.phone;
  if (nextPhone !== existing.phone) {
    const [dup] = await db
      .select({ id: schema.contactsTable.id })
      .from(schema.contactsTable)
      .where(eq(schema.contactsTable.phone, nextPhone))
      .limit(1);
    if (dup && dup.id !== id) {
      throw new Error('Інший контакт із таким номером телефону вже існує');
    }
  }

  const now = new Date().toISOString();
  const [updated] = await db
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
  if (!isDatabaseConfigured()) {
    return memDeleteContact(id);
  }
  const db = getDb();
  const deleted = await db
    .delete(schema.contactsTable)
    .where(eq(schema.contactsTable.id, id))
    .returning({ id: schema.contactsTable.id });
  return deleted.length > 0;
}
