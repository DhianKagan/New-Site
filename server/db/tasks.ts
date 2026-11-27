import { count, desc, eq, isNull, or } from 'drizzle-orm';
import * as schema from '../schema.ts';
import type { ContactSegment, CrmNote, CrmTask, TaskPriority, TaskStatus } from '../../src/types.ts';
import { getDb } from './client.ts';
import { upsertContact } from './contacts.ts';
import { getSetting, setSettingIfAbsent } from './settings.ts';

export async function backfillContactsAndSeedCrm(): Promise<void> {
  const db = getDb();
  const unlinkedDeals = await db
    .select({
      id: schema.dealsTable.id,
      customerName: schema.dealsTable.customerName,
      phone: schema.dealsTable.phone,
      city: schema.dealsTable.city,
      channel: schema.dealsTable.channel,
      taskType: schema.dealsTable.taskType,
      topic: schema.dealsTable.topic,
    })
    .from(schema.dealsTable)
    .where(isNull(schema.dealsTable.contactId));

  for (const deal of unlinkedDeals) {
    if (!deal.phone) continue;
    const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(
      `${deal.customerName} ${deal.taskType} ${deal.topic}`,
    )
      ? 'b2b'
      : 'b2c';
    const contactId = await upsertContact({
      name: deal.customerName || 'Клієнт сайту',
      phone: deal.phone,
      city: deal.city,
      channel: deal.channel,
      company: /тов/i.test(deal.customerName) ? deal.customerName : '',
      segment,
    });
    await db.update(schema.dealsTable).set({ contactId }).where(eq(schema.dealsTable.id, deal.id));
  }

  const seededFlag = await getSetting('crm_v2_seeded');
  if (seededFlag) return;

  const [taskCntRow] = await db.select({ cnt: count() }).from(schema.tasksTable);
  const taskCount = Number(taskCntRow?.cnt ?? 0);
  const deals = await db
    .select({
      id: schema.dealsTable.id,
      dealNumber: schema.dealsTable.dealNumber,
      contactId: schema.dealsTable.contactId,
      stage: schema.dealsTable.stage,
      notes: schema.dealsTable.notes,
    })
    .from(schema.dealsTable)
    .orderBy(desc(schema.dealsTable.id));

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  if (taskCount === 0 && deals.length > 0) {
    const sampleDeals = deals.slice(0, 4);
    for (let idx = 0; idx < sampleDeals.length; idx++) {
      const d = sampleDeals[idx];
      const taskTitle =
        idx === 0
          ? `Узгодити схему щита і фази (${d.dealNumber})`
          : idx === 1
            ? `Перевірити комплектацію захисту AC/DC (${d.dealNumber})`
            : idx === 2
              ? `Підтвердити дату виїзду інженера на об’єкт (${d.dealNumber})`
              : `Відправити гарантійний талон клієнту (${d.dealNumber})`;
      const status: TaskStatus = d.stage === 'done' ? 'done' : idx === 1 ? 'in_progress' : 'todo';
      const priority: TaskPriority = idx === 0 ? 'high' : 'medium';

      await db.insert(schema.tasksTable).values({
        contactId: d.contactId,
        dealId: d.id,
        title: taskTitle,
        status,
        priority,
        assignee: idx % 2 === 0 ? 'Олександр (інженер)' : 'Дмитро (менеджер)',
        dueDate: idx === 0 ? todayStr : tomorrowStr,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (d.notes) {
        await db.insert(schema.notesTable).values({
          contactId: d.contactId,
          dealId: d.id,
          author: 'Система CRM',
          body: d.notes,
          createdAt: nowIso,
        });
      }
    }
  }

  await setSettingIfAbsent('crm_v2_seeded', 'true');
}

export async function listTasks(filters?: { contactId?: number; dealId?: number }): Promise<CrmTask[]> {
  const db = getDb();
  let rows = await db.select().from(schema.tasksTable).orderBy(desc(schema.tasksTable.id));
  if (filters?.contactId) {
    rows = rows.filter((t) => t.contactId === filters.contactId);
  }
  if (filters?.dealId) {
    rows = rows.filter((t) => t.dealId === filters.dealId);
  }

  const [contacts, deals] = await Promise.all([
    db
      .select({ id: schema.contactsTable.id, name: schema.contactsTable.name, phone: schema.contactsTable.phone })
      .from(schema.contactsTable),
    db
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

async function getTaskById(id: number): Promise<CrmTask | null> {
  const db = getDb();
  const [t] = await db.select().from(schema.tasksTable).where(eq(schema.tasksTable.id, id)).limit(1);
  if (!t) return null;

  const [contactRows, dealRows] = await Promise.all([
    t.contactId
      ? db
          .select({ name: schema.contactsTable.name, phone: schema.contactsTable.phone })
          .from(schema.contactsTable)
          .where(eq(schema.contactsTable.id, t.contactId))
          .limit(1)
      : Promise.resolve([]),
    t.dealId
      ? db
          .select({ dealNumber: schema.dealsTable.dealNumber })
          .from(schema.dealsTable)
          .where(eq(schema.dealsTable.id, t.dealId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const contact = contactRows[0];
  const deal = dealRows[0];

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
    dealNumber: deal?.dealNumber,
  };
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
  const db = getDb();
  let resolvedContactId = input.contactId ?? null;
  if (!resolvedContactId && input.dealId) {
    const [dealRow] = await db
      .select({ contactId: schema.dealsTable.contactId })
      .from(schema.dealsTable)
      .where(eq(schema.dealsTable.id, input.dealId))
      .limit(1);
    if (dealRow?.contactId) resolvedContactId = dealRow.contactId;
  }

  const now = new Date().toISOString();
  const [inserted] = await db
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

  return (
    (await getTaskById(inserted.id)) ?? {
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
    }
  );
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
  const db = getDb();
  const [existing] = await db.select().from(schema.tasksTable).where(eq(schema.tasksTable.id, id)).limit(1);
  if (!existing) return null;

  const now = new Date().toISOString();
  await db
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

  return getTaskById(id);
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.tasksTable)
    .where(eq(schema.tasksTable.id, id))
    .returning({ id: schema.tasksTable.id });
  return deleted.length > 0;
}

export async function listNotes(filters?: { contactId?: number; dealId?: number }): Promise<CrmNote[]> {
  const db = getDb();
  const whereClause =
    filters?.contactId && filters?.dealId
      ? or(eq(schema.notesTable.contactId, filters.contactId), eq(schema.notesTable.dealId, filters.dealId))
      : filters?.contactId
        ? eq(schema.notesTable.contactId, filters.contactId)
        : filters?.dealId
          ? eq(schema.notesTable.dealId, filters.dealId)
          : undefined;

  const rows = whereClause
    ? await db.select().from(schema.notesTable).where(whereClause).orderBy(desc(schema.notesTable.id))
    : await db.select().from(schema.notesTable).orderBy(desc(schema.notesTable.id));

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
  const db = getDb();
  let resolvedContactId = input.contactId ?? null;
  if (!resolvedContactId && input.dealId) {
    const [dealRow] = await db
      .select({ contactId: schema.dealsTable.contactId })
      .from(schema.dealsTable)
      .where(eq(schema.dealsTable.id, input.dealId))
      .limit(1);
    if (dealRow?.contactId) resolvedContactId = dealRow.contactId;
  }

  const now = new Date().toISOString();
  const [inserted] = await db
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
  const db = getDb();
  const deleted = await db
    .delete(schema.notesTable)
    .where(eq(schema.notesTable.id, id))
    .returning({ id: schema.notesTable.id });
  return deleted.length > 0;
}
