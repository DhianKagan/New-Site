import crypto from 'node:crypto';
import type {
  Contact,
  ContactSegment,
  CrmCustomer,
  CrmNote,
  CrmTask,
  CustomerProfile,
  Deal,
  DealItem,
  DealPatchPayload,
  DealStage,
  DealType,
  ProductReview,
  ProductReviewStatus,
  StaffRole,
  StaffUser,
  TaskPriority,
  TaskStatus,
} from '../../src/types.ts';
import { hashPassword } from '../auth.ts';
import { getProductById } from './catalog.ts';
import { deleteSetting, getSetting, setSetting } from './settings.ts';
import { normalizeContactPhone } from './utils.ts';

interface MemContact {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  channel: string;
  segment: ContactSegment;
  createdAt: string;
  updatedAt: string;
}

interface MemDeal extends Deal {
  customerId: number | null;
  customerEmail: string;
}

interface MemStaff extends StaffUser {
  passwordHash: string;
}

interface MemCustomer extends CustomerProfile {
  firebaseUid: string;
  passwordHash: string;
}

let seeded = false;
let nextContactId = 1;
let nextDealId = 1;
let nextDealNum = 1042;
let nextTaskId = 1;
let nextNoteId = 1;
let nextStaffId = 1;
let nextCustomerId = 1;

const contacts: MemContact[] = [];
const deals: MemDeal[] = [];
const tasks: CrmTask[] = [];
const notes: CrmNote[] = [];
const staffUsers: MemStaff[] = [];
const customers: MemCustomer[] = [];
const wishlists = new Map<number, string[]>();
const reviews: ProductReview[] = [];

function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;

  const now = Date.now();
  const iso = (offsetMins: number) => new Date(now - offsetMins * 60_000).toISOString();

  // Master admin + initial staff
  staffUsers.push(
    {
      id: nextStaffId++,
      name: 'Головний адміністратор',
      login: 'admin',
      email: '',
      phone: '',
      position: 'Мастер-адміністратор',
      role: 'admin',
      assigneeLabel: 'Адміністратор',
      passwordHash: '',
      canLogin: true,
      active: true,
      hasPassword: false,
      createdAt: iso(10000),
      updatedAt: iso(10000),
    },
    {
      id: nextStaffId++,
      name: 'Олександр',
      login: 'alex',
      email: '',
      phone: '',
      position: 'Інженер',
      role: 'engineer',
      assigneeLabel: 'Олександр (інженер)',
      passwordHash: '',
      canLogin: false,
      active: true,
      hasPassword: false,
      createdAt: iso(9000),
      updatedAt: iso(9000),
    },
    {
      id: nextStaffId++,
      name: 'Дмитро',
      login: 'dmytro',
      email: '',
      phone: '',
      position: 'Менеджер',
      role: 'manager',
      assigneeLabel: 'Дмитро (менеджер)',
      passwordHash: '',
      canLogin: false,
      active: true,
      hasPassword: false,
      createdAt: iso(9000),
      updatedAt: iso(9000),
    },
    {
      id: nextStaffId++,
      name: 'Ірина',
      login: 'iryna',
      email: '',
      phone: '',
      position: 'Координатор',
      role: 'manager',
      assigneeLabel: 'Ірина (координатор)',
      passwordHash: '',
      canLogin: false,
      active: true,
      hasPassword: false,
      createdAt: iso(9000),
      updatedAt: iso(9000),
    },
    {
      id: nextStaffId++,
      name: 'Монтажна бригада №1',
      login: 'brigade1',
      email: '',
      phone: '',
      position: 'Монтажна бригада',
      role: 'installer',
      assigneeLabel: 'Монтажна бригада №1',
      passwordHash: '',
      canLogin: false,
      active: true,
      hasPassword: false,
      createdAt: iso(9000),
      updatedAt: iso(9000),
    },
  );

  const seedDeals: Array<{
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
    offsetMins: number;
  }> = [
    {
      dealNumber: 'EC-1041',
      type: 'lead',
      stage: 'new',
      customerName: 'Ігор Мельник',
      phone: '+380674128819',
      city: 'Одеса, Таїрова',
      channel: 'Telegram',
      topic: 'Готове рішення Deye 8 кВт / 16 кВт·год під ключ',
      taskType: 'Резервне живлення (квартира / дім)',
      loads: ['Газовий котел', 'Холодильник', 'Wi-Fi / Інтернет', 'Освітлення'],
      items: [],
      totalUsd: 3999,
      assignee: 'Олександр (інженер)',
      notes: 'Приватний будинок 140 м², 1 фаза, потрібно перемикання без затримки для котла.',
      offsetMins: 45,
    },
    {
      dealNumber: 'EC-1040',
      type: 'order',
      stage: 'audit',
      customerName: 'Сергій Кравченко',
      phone: '+380509341502',
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
      offsetMins: 180,
    },
    {
      dealNumber: 'EC-1039',
      type: 'lead',
      stage: 'proposal',
      customerName: 'ТОВ «Південь-Автосервіс»',
      phone: '+380982114470',
      city: 'Одеса, Київський р-н',
      channel: 'Telegram',
      topic: 'СЕС для бізнесу 30 кВт + АКБ 30 кВт·год',
      taskType: 'Рішення для бізнесу / СТО (380 В)',
      loads: ['Компресори 380В', 'Підйомники', 'Освітлення'],
      items: [],
      totalUsd: 24500,
      assignee: 'Олександр (інженер)',
      notes: 'Відправлено 2 варіанти КП на Deye 30 кВт HV та SolaX 30 кВт. Узгоджуємо виїзд на дах.',
      offsetMins: 640,
    },
  ];

  for (const d of seedDeals) {
    const contactId = nextContactId++;
    const ts = iso(d.offsetMins);
    contacts.push({
      id: contactId,
      name: d.customerName,
      company: /тов/i.test(d.customerName) ? d.customerName : '',
      phone: d.phone,
      email: '',
      city: d.city,
      channel: d.channel,
      segment: /тов|бізнес/i.test(d.customerName) ? 'b2b' : 'b2c',
      createdAt: ts,
      updatedAt: ts,
    });
    deals.push({
      id: nextDealId++,
      dealNumber: d.dealNumber,
      contactId,
      customerId: null,
      customerEmail: '',
      type: d.type,
      stage: d.stage,
      customerName: d.customerName,
      phone: d.phone,
      city: d.city,
      channel: d.channel,
      topic: d.topic,
      taskType: d.taskType,
      loads: d.loads,
      items: d.items,
      totalUsd: d.totalUsd,
      assignee: d.assignee,
      notes: d.notes,
      telegramSent: false,
      createdAt: ts,
      updatedAt: ts,
    });
  }
}

function toPublicDeal(d: MemDeal): Deal {
  const { customerId: _cid, ...rest } = d;
  return { ...rest, loads: [...rest.loads], items: rest.items.map((i) => ({ ...i })) };
}

function toPublicStaff(s: MemStaff): StaffUser {
  const { passwordHash: _pw, ...rest } = s;
  return { ...rest };
}

function toPublicCustomer(c: MemCustomer): CustomerProfile {
  const { firebaseUid: _fb, passwordHash: _pw, ...rest } = c;
  return { ...rest };
}

export function memUpsertContact(input: {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  channel?: string;
  company?: string;
  segment?: ContactSegment;
}): number {
  ensureSeeded();
  const normalizedPhone = normalizeContactPhone(input.phone);
  const emailNorm = (input.email ?? '').trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = contacts.find((c) => c.phone === normalizedPhone);
  if (existing) {
    if (existing.name === 'Клієнт сайту' || existing.name === 'Клієнт із головної форми') {
      existing.name = input.name.trim() || existing.name;
    }
    if (!existing.city && input.city?.trim()) existing.city = input.city.trim();
    if (!existing.email && emailNorm) existing.email = emailNorm;
    existing.updatedAt = now;
    return existing.id;
  }

  const inferredSegment: ContactSegment =
    input.segment ||
    (/тов|бізнес|сто|готел|завод|ооо/i.test(`${input.name} ${input.company || ''}`) ? 'b2b' : 'b2c');
  const created: MemContact = {
    id: nextContactId++,
    name: input.name.trim() || 'Клієнт сайту',
    company: (input.company ?? '').trim(),
    phone: normalizedPhone,
    email: emailNorm,
    city: (input.city ?? '').trim() || 'Одеса',
    channel: (input.channel ?? '').trim() || 'Telegram',
    segment: inferredSegment,
    createdAt: now,
    updatedAt: now,
  };
  contacts.unshift(created);
  return created.id;
}

export function memListContacts(): Contact[] {
  ensureSeeded();
  return contacts.map((c) => {
    const cDeals = deals.filter((d) => d.contactId === c.id);
    const openTasksCount = tasks.filter((t) => t.contactId === c.id && t.status !== 'done').length;
    return {
      ...c,
      dealsCount: cDeals.length,
      totalUsd: cDeals.reduce((sum, d) => sum + d.totalUsd, 0),
      openTasksCount,
    };
  });
}

export function memGetContactDetail(id: number): {
  contact: Contact;
  deals: Deal[];
  tasks: CrmTask[];
  notes: CrmNote[];
} | null {
  ensureSeeded();
  const c = contacts.find((item) => item.id === id);
  if (!c) return null;
  const cDeals = deals.filter((d) => d.contactId === id).map(toPublicDeal);
  const cTasks = tasks.filter((t) => t.contactId === id).map((t) => ({ ...t }));
  const cNotes = notes.filter((n) => n.contactId === id).map((n) => ({ ...n }));
  return {
    contact: {
      ...c,
      dealsCount: cDeals.length,
      totalUsd: cDeals.reduce((s, d) => s + d.totalUsd, 0),
      openTasksCount: cTasks.filter((t) => t.status !== 'done').length,
    },
    deals: cDeals,
    tasks: cTasks,
    notes: cNotes,
  };
}

export function memCreateContact(input: {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  city?: string;
  channel?: string;
  segment?: ContactSegment;
}): Contact {
  ensureSeeded();
  const normalizedPhone = normalizeContactPhone(input.phone);
  if (contacts.some((c) => c.phone === normalizedPhone)) {
    throw new Error('Контакт із таким номером телефону вже існує');
  }
  const now = new Date().toISOString();
  const created: MemContact = {
    id: nextContactId++,
    name: input.name.trim(),
    company: (input.company ?? '').trim(),
    phone: normalizedPhone,
    email: (input.email ?? '').trim(),
    city: (input.city ?? '').trim() || 'Одеса',
    channel: (input.channel ?? '').trim() || 'Telegram',
    segment: input.segment === 'b2b' ? 'b2b' : 'b2c',
    createdAt: now,
    updatedAt: now,
  };
  contacts.unshift(created);
  return { ...created, dealsCount: 0, totalUsd: 0, openTasksCount: 0 };
}

export function memUpdateContact(
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
): Contact | null {
  ensureSeeded();
  const existing = contacts.find((c) => c.id === id);
  if (!existing) return null;
  const nextPhone = patch.phone !== undefined ? normalizeContactPhone(patch.phone) : existing.phone;
  if (nextPhone !== existing.phone && contacts.some((c) => c.id !== id && c.phone === nextPhone)) {
    throw new Error('Інший контакт із таким номером телефону вже існує');
  }
  existing.name = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
  existing.company = patch.company !== undefined ? patch.company.trim() : existing.company;
  existing.phone = nextPhone;
  existing.email = patch.email !== undefined ? patch.email.trim() : existing.email;
  existing.city = patch.city !== undefined ? patch.city.trim() : existing.city;
  existing.channel = patch.channel !== undefined ? patch.channel.trim() : existing.channel;
  existing.segment = patch.segment === 'b2b' || patch.segment === 'b2c' ? patch.segment : existing.segment;
  existing.updatedAt = new Date().toISOString();
  return { ...existing };
}

export function memDeleteContact(id: number): boolean {
  ensureSeeded();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  contacts.splice(idx, 1);
  return true;
}

export async function memCreateDeal(input: {
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
  ensureSeeded();
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
  const customerEmailNorm = (input.customerEmail ?? '').trim().toLowerCase();
  const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${customerName} ${taskType} ${topic}`)
    ? 'b2b'
    : 'b2c';

  const contactId = memUpsertContact({
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

  const deal: MemDeal = {
    id: nextDealId++,
    dealNumber: `EC-${nextDealNum++}`,
    contactId,
    customerId: input.customerId ?? null,
    customerEmail: customerEmailNorm,
    type: input.type,
    stage,
    customerName,
    phone: normalizeContactPhone(input.phone.trim()),
    city,
    channel,
    topic,
    taskType,
    loads: input.loads ?? [],
    items: verifiedItems,
    totalUsd,
    assignee,
    notes: (input.notes ?? '').trim(),
    telegramSent: false,
    createdAt: now,
    updatedAt: now,
  };
  deals.unshift(deal);
  return toPublicDeal(deal);
}

export function memMarkDealTelegramSent(id: number): void {
  ensureSeeded();
  const deal = deals.find((d) => d.id === id);
  if (deal) deal.telegramSent = true;
}

export function memListDeals(): Deal[] {
  ensureSeeded();
  return deals.map(toPublicDeal);
}

export async function memUpdateDeal(
  id: number,
  patch: DealPatchPayload,
): Promise<Deal | null> {
  ensureSeeded();
  const deal = deals.find((d) => d.id === id);
  if (!deal) return null;
  if (patch.type !== undefined) deal.type = patch.type;
  if (patch.stage !== undefined) deal.stage = patch.stage;
  if (patch.assignee !== undefined) deal.assignee = patch.assignee.trim();
  if (patch.customerName !== undefined) {
    deal.customerName = patch.customerName.trim() || deal.customerName;
  }
  if (patch.phone !== undefined) {
    deal.phone = normalizeContactPhone(patch.phone.trim()) || deal.phone;
  }
  if (patch.customerEmail !== undefined) {
    deal.customerEmail = patch.customerEmail.trim().toLowerCase();
  }
  if (patch.city !== undefined) deal.city = patch.city.trim() || 'Одеса';
  if (patch.channel !== undefined) deal.channel = patch.channel.trim() || deal.channel;
  if (patch.topic !== undefined) deal.topic = patch.topic.trim() || deal.topic;
  if (patch.taskType !== undefined) deal.taskType = patch.taskType.trim();
  if (patch.loads !== undefined) {
    deal.loads = patch.loads.map((item) => item.trim()).filter(Boolean);
  }
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
    deal.items = verifiedItems;
  }
  if (patch.notes !== undefined) deal.notes = patch.notes.trim();
  if (patch.totalUsd !== undefined) deal.totalUsd = Math.max(0, Math.round(Number(patch.totalUsd)));
  deal.updatedAt = new Date().toISOString();

  if (
    patch.customerName !== undefined ||
    patch.phone !== undefined ||
    patch.customerEmail !== undefined ||
    patch.city !== undefined ||
    patch.channel !== undefined
  ) {
    const segment: ContactSegment = /бізнес|сто|380\s*в|тов/i.test(`${deal.customerName} ${deal.taskType} ${deal.topic}`)
      ? 'b2b'
      : 'b2c';
    memUpsertContact({
      name: deal.customerName,
      phone: deal.phone,
      email: deal.customerEmail,
      city: deal.city,
      channel: deal.channel,
      company: /тов/i.test(deal.customerName) ? deal.customerName : '',
      segment,
    });
  }

  return toPublicDeal(deal);
}

export function memDeleteDeal(id: number): boolean {
  ensureSeeded();
  const idx = deals.findIndex((d) => d.id === id);
  if (idx < 0) return false;
  deals.splice(idx, 1);
  return true;
}

export function memListCustomerDeals(customer: { id: number; email: string; phone: string }): Deal[] {
  ensureSeeded();
  const emailNorm = customer.email.trim().toLowerCase();
  const phoneNorm = customer.phone.trim() ? normalizeContactPhone(customer.phone.trim()) : '';
  return deals
    .filter((d) => {
      if (d.customerId === customer.id) return true;
      if (emailNorm && d.customerEmail.toLowerCase() === emailNorm) return true;
      if (phoneNorm && d.phone === phoneNorm) return true;
      return false;
    })
    .map(toPublicDeal);
}

export function memBackfillCustomerDeals(customerId: number, emailNorm: string, phoneNorm: string): void {
  ensureSeeded();
  for (const d of deals) {
    if (d.customerId !== null) continue;
    if ((emailNorm && d.customerEmail.toLowerCase() === emailNorm) || (phoneNorm && d.phone === phoneNorm)) {
      d.customerId = customerId;
      if (!d.customerEmail && emailNorm) d.customerEmail = emailNorm;
    }
  }
}

export function memListTasks(filters?: { contactId?: number; dealId?: number }): CrmTask[] {
  ensureSeeded();
  return tasks
    .filter((t) => {
      if (filters?.contactId && t.contactId !== filters.contactId) return false;
      if (filters?.dealId && t.dealId !== filters.dealId) return false;
      return true;
    })
    .map((t) => ({ ...t }));
}

export function memCreateTask(input: {
  contactId?: number | null;
  dealId?: number | null;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
}): CrmTask {
  ensureSeeded();
  let resolvedContactId = input.contactId ?? null;
  const linkedDeal = input.dealId ? deals.find((d) => d.id === input.dealId) : undefined;
  if (!resolvedContactId && linkedDeal?.contactId) {
    resolvedContactId = linkedDeal.contactId;
  }
  const contact = resolvedContactId ? contacts.find((c) => c.id === resolvedContactId) : undefined;
  const now = new Date().toISOString();
  const created: CrmTask = {
    id: nextTaskId++,
    contactId: resolvedContactId,
    dealId: input.dealId ?? null,
    title: input.title.trim(),
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assignee: (input.assignee ?? '').trim() || 'Олександр (інженер)',
    dueDate: (input.dueDate ?? '').trim(),
    createdAt: now,
    updatedAt: now,
    contactName: contact?.name,
    contactPhone: contact?.phone,
    dealNumber: linkedDeal?.dealNumber,
  };
  tasks.unshift(created);
  return { ...created };
}

export function memUpdateTask(
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
): CrmTask | null {
  ensureSeeded();
  const existing = tasks.find((t) => t.id === id);
  if (!existing) return null;
  if (patch.contactId !== undefined) existing.contactId = patch.contactId;
  if (patch.dealId !== undefined) existing.dealId = patch.dealId;
  if (patch.title !== undefined) existing.title = patch.title.trim() || existing.title;
  if (patch.status !== undefined) existing.status = patch.status;
  if (patch.priority !== undefined) existing.priority = patch.priority;
  if (patch.assignee !== undefined) existing.assignee = patch.assignee.trim();
  if (patch.dueDate !== undefined) existing.dueDate = patch.dueDate.trim();
  existing.updatedAt = new Date().toISOString();
  return { ...existing };
}

export function memDeleteTask(id: number): boolean {
  ensureSeeded();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  tasks.splice(idx, 1);
  return true;
}

export function memListNotes(filters?: { contactId?: number; dealId?: number }): CrmNote[] {
  ensureSeeded();
  return notes
    .filter((n) => {
      if (filters?.contactId && filters?.dealId) {
        return n.contactId === filters.contactId || n.dealId === filters.dealId;
      }
      if (filters?.contactId) return n.contactId === filters.contactId;
      if (filters?.dealId) return n.dealId === filters.dealId;
      return true;
    })
    .map((n) => ({ ...n }));
}

export function memCreateNote(input: {
  contactId?: number | null;
  dealId?: number | null;
  author?: string;
  body: string;
}): CrmNote {
  ensureSeeded();
  let resolvedContactId = input.contactId ?? null;
  if (!resolvedContactId && input.dealId) {
    const deal = deals.find((d) => d.id === input.dealId);
    if (deal?.contactId) resolvedContactId = deal.contactId;
  }
  const created: CrmNote = {
    id: nextNoteId++,
    contactId: resolvedContactId,
    dealId: input.dealId ?? null,
    author: (input.author ?? '').trim() || 'Менеджер CRM',
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };
  notes.unshift(created);
  return { ...created };
}

export function memDeleteNote(id: number): boolean {
  ensureSeeded();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  notes.splice(idx, 1);
  return true;
}

export async function memGetMasterAdminRecord() {
  ensureSeeded();
  const admin = staffUsers.find((s) => s.login === 'admin')!;
  const legacyHash = (await getSetting('admin_password_hash'))?.trim() || '';
  if (!admin.passwordHash && legacyHash) {
    admin.passwordHash = legacyHash;
    admin.hasPassword = true;
  }
  return {
    id: admin.id,
    name: admin.name,
    login: admin.login,
    email: admin.email,
    role: 'admin' as const,
    assigneeLabel: admin.assigneeLabel,
    passwordHash: admin.passwordHash,
  };
}

export async function memClaimMasterAdminAccount(input: {
  passwordHash: string;
  name?: string;
  email?: string;
}) {
  ensureSeeded();
  const admin = staffUsers.find((s) => s.login === 'admin')!;
  admin.name = input.name?.trim() || admin.name;
  admin.email = input.email?.trim().toLowerCase() ?? admin.email;
  admin.passwordHash = input.passwordHash;
  admin.hasPassword = Boolean(input.passwordHash);
  admin.updatedAt = new Date().toISOString();
  return memGetMasterAdminRecord();
}

export function memGetStaffAuthState(userId: number) {
  ensureSeeded();
  const s = staffUsers.find((item) => item.id === userId);
  if (!s) return null;
  return {
    active: s.active,
    canLogin: s.canLogin,
    role: s.role,
    name: s.name,
    login: s.login,
    email: s.email,
    assigneeLabel: s.assigneeLabel,
  };
}

export function memListStaffUsers(): StaffUser[] {
  ensureSeeded();
  return staffUsers.map(toPublicStaff);
}

export function memFindStaffForPasswordLogin(identifier: string) {
  ensureSeeded();
  const norm = identifier.trim().toLowerCase();
  if (!norm) return null;
  const match = staffUsers.find((s) => s.login === norm || s.email === norm);
  if (!match) return null;
  return { user: toPublicStaff(match), passwordHash: match.passwordHash };
}

export function memFindStaffForGoogleLogin(email: string): StaffUser | null {
  ensureSeeded();
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const match = staffUsers.find((s) => s.email === norm);
  return match ? toPublicStaff(match) : null;
}

export function memCreateStaffUser(input: {
  name: string;
  login?: string;
  email?: string;
  phone?: string;
  position: string;
  role?: StaffRole;
  assigneeLabel?: string;
  password?: string;
  canLogin?: boolean;
  active?: boolean;
}): StaffUser {
  ensureSeeded();
  const emailNorm = (input.email ?? '').trim().toLowerCase();
  const explicitLogin = (input.login ?? '').trim().toLowerCase();
  if (emailNorm && staffUsers.some((s) => s.email === emailNorm)) {
    throw new Error('Цей Email вже закріплено за іншим користувачем');
  }
  let loginNorm = explicitLogin;
  if (loginNorm) {
    if (staffUsers.some((s) => s.login === loginNorm)) {
      throw new Error('Користувач із таким логіном вже існує');
    }
  } else {
    loginNorm = `user_${Date.now().toString(36)}`;
  }
  const now = new Date().toISOString();
  const created: MemStaff = {
    id: nextStaffId++,
    name: input.name.trim(),
    login: loginNorm,
    email: emailNorm,
    phone: (input.phone ?? '').trim(),
    position: input.position.trim(),
    role: input.role ?? 'manager',
    assigneeLabel: (input.assigneeLabel ?? '').trim() || `${input.name.trim()} (${input.position.trim().toLowerCase()})`,
    passwordHash: input.password ? hashPassword(input.password) : '',
    hasPassword: Boolean(input.password),
    canLogin: input.canLogin !== false,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
  };
  staffUsers.push(created);
  return toPublicStaff(created);
}

export async function memUpdateStaffUser(
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
  ensureSeeded();
  const existing = staffUsers.find((s) => s.id === id);
  if (!existing) return null;
  const isMaster = existing.login === 'admin';
  if (patch.name !== undefined) existing.name = patch.name.trim() || existing.name;
  if (!isMaster && patch.login !== undefined) existing.login = patch.login.trim().toLowerCase();
  if (patch.email !== undefined) existing.email = patch.email.trim().toLowerCase();
  if (patch.phone !== undefined) existing.phone = patch.phone.trim();
  if (patch.position !== undefined) existing.position = patch.position.trim() || existing.position;
  if (!isMaster && patch.role !== undefined) existing.role = patch.role;
  if (patch.assigneeLabel !== undefined) existing.assigneeLabel = patch.assigneeLabel.trim() || existing.assigneeLabel;
  if (patch.clearPassword) {
    existing.passwordHash = '';
    existing.hasPassword = false;
  } else if (patch.password && patch.password.length >= 6) {
    existing.passwordHash = hashPassword(patch.password);
    existing.hasPassword = true;
  }
  if (!isMaster && patch.canLogin !== undefined) existing.canLogin = patch.canLogin;
  if (!isMaster && patch.active !== undefined) existing.active = patch.active;
  existing.updatedAt = new Date().toISOString();

  if (isMaster) {
    if (existing.passwordHash) {
      await setSetting('admin_password_hash', existing.passwordHash);
    } else {
      await deleteSetting('admin_password_hash');
    }
  }
  return toPublicStaff(existing);
}

export function memDeleteStaffUser(id: number): boolean {
  ensureSeeded();
  const idx = staffUsers.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  if (staffUsers[idx].login === 'admin') {
    throw new Error('Мастер-акаунт адміністратора не можна видалити');
  }
  staffUsers.splice(idx, 1);
  return true;
}

export function memGetCustomerAuthState(customerId: number) {
  ensureSeeded();
  const c = customers.find((item) => item.id === customerId);
  if (!c) return null;
  return {
    id: c.id,
    active: c.active,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    firebaseUid: c.firebaseUid,
  };
}

export function memGetCustomerProfileById(customerId: number): CustomerProfile | null {
  ensureSeeded();
  const c = customers.find((item) => item.id === customerId);
  return c ? toPublicCustomer(c) : null;
}

export function memFindCustomerForPasswordLogin(email: string) {
  ensureSeeded();
  const norm = email.trim().toLowerCase();
  const c = customers.find((item) => item.email === norm);
  if (!c) return null;
  return { customer: toPublicCustomer(c), passwordHash: c.passwordHash };
}

export function memRegisterCustomerWithPassword(input: {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  password: string;
}): CustomerProfile {
  ensureSeeded();
  const emailNorm = input.email.trim().toLowerCase();
  if (staffUsers.some((s) => s.email === emailNorm)) {
    throw new Error('Цей Email закріплено за обліковим записом співробітника. Використайте вхід через Google.');
  }
  if (customers.some((c) => c.email === emailNorm)) {
    throw new Error('Акаунт із таким Email вже існує. Увійдіть за паролем або через Google.');
  }
  const now = new Date().toISOString();
  const cleanPhone = input.phone?.trim() ? normalizeContactPhone(input.phone.trim()) : '';
  const created: MemCustomer = {
    id: nextCustomerId++,
    name: input.name.trim(),
    email: emailNorm,
    phone: cleanPhone,
    city: (input.city ?? '').trim() || 'Одеса',
    firebaseUid: '',
    passwordHash: hashPassword(input.password),
    authProvider: 'password',
    active: true,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  customers.unshift(created);
  return toPublicCustomer(created);
}

export function memUpsertGoogleCustomerAccount(input: {
  email: string;
  name: string;
  firebaseUid: string;
}): CustomerProfile {
  ensureSeeded();
  const emailNorm = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = customers.find((c) => c.email === emailNorm);
  if (existing) {
    if (!existing.active) throw new Error('Акаунт клієнта тимчасово вимкнено');
    existing.name = existing.name.trim() || input.name.trim() || emailNorm.split('@')[0];
    if (!existing.firebaseUid) existing.firebaseUid = input.firebaseUid;
    existing.authProvider = existing.passwordHash ? 'both' : 'google';
    existing.lastLoginAt = now;
    existing.updatedAt = now;
    return toPublicCustomer(existing);
  }
  const created: MemCustomer = {
    id: nextCustomerId++,
    name: input.name.trim() || emailNorm.split('@')[0],
    email: emailNorm,
    phone: '',
    city: 'Одеса',
    firebaseUid: input.firebaseUid,
    passwordHash: '',
    authProvider: 'google',
    active: true,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  customers.unshift(created);
  return toPublicCustomer(created);
}

export function memUpdateCustomerProfile(
  customerId: number,
  patch: { name?: string; phone?: string; city?: string },
): CustomerProfile | null {
  ensureSeeded();
  const existing = customers.find((c) => c.id === customerId);
  if (!existing) return null;
  if (patch.name !== undefined) existing.name = patch.name.trim() || existing.name;
  if (patch.phone !== undefined) {
    existing.phone = patch.phone.trim() ? normalizeContactPhone(patch.phone.trim()) : '';
  }
  if (patch.city !== undefined) existing.city = patch.city.trim() || existing.city;
  existing.updatedAt = new Date().toISOString();
  memBackfillCustomerDeals(customerId, existing.email.toLowerCase(), existing.phone);
  return toPublicCustomer(existing);
}

export function memDeleteCustomerAccount(customerId: number): boolean {
  ensureSeeded();
  const idx = customers.findIndex((c) => c.id === customerId);
  if (idx < 0) return false;
  customers.splice(idx, 1);
  return true;
}

function enrichCustomer(c: MemCustomer): CrmCustomer {
  const profile = toPublicCustomer(c);
  const cDeals = memListCustomerDeals({ id: profile.id, email: profile.email, phone: profile.phone });
  return {
    ...profile,
    dealsCount: cDeals.length,
    activeDealsCount: cDeals.filter((d) => d.stage !== 'done' && d.stage !== 'archived').length,
    totalUsd: cDeals.reduce((sum, d) => sum + d.totalUsd, 0),
  };
}

export function memListCustomerAccounts(): CrmCustomer[] {
  ensureSeeded();
  return customers.map(enrichCustomer);
}

export function memGetCustomerAccountDetail(customerId: number): { customer: CrmCustomer; deals: Deal[] } | null {
  ensureSeeded();
  const c = customers.find((item) => item.id === customerId);
  if (!c) return null;
  const profile = toPublicCustomer(c);
  const cDeals = memListCustomerDeals({ id: profile.id, email: profile.email, phone: profile.phone });
  return {
    customer: enrichCustomer(c),
    deals: cDeals,
  };
}

export function memCreateCustomerAccountByCrm(input: {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  password?: string;
  active?: boolean;
}): CrmCustomer {
  ensureSeeded();
  const emailNorm = input.email.trim().toLowerCase();
  if (staffUsers.some((s) => s.email === emailNorm)) {
    throw new Error('Цей Email вже використовується співробітником CRM');
  }
  if (customers.some((c) => c.email === emailNorm)) {
    throw new Error('Клієнт із таким Email вже зареєстрований');
  }
  const now = new Date().toISOString();
  const cleanPhone = input.phone?.trim() ? normalizeContactPhone(input.phone.trim()) : '';
  const pwd = (input.password ?? '').trim();
  const created: MemCustomer = {
    id: nextCustomerId++,
    name: input.name.trim(),
    email: emailNorm,
    phone: cleanPhone,
    city: (input.city ?? '').trim() || 'Одеса',
    firebaseUid: '',
    passwordHash: pwd ? hashPassword(pwd) : '',
    authProvider: pwd ? 'password' : 'google',
    active: input.active !== false,
    lastLoginAt: '',
    createdAt: now,
    updatedAt: now,
  };
  customers.unshift(created);
  memBackfillCustomerDeals(created.id, emailNorm, cleanPhone);
  return enrichCustomer(created);
}

export function memUpdateCustomerAccountByCrm(
  customerId: number,
  patch: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    password?: string;
    clearPassword?: boolean;
    active?: boolean;
  },
): CrmCustomer | null {
  ensureSeeded();
  const existing = customers.find((c) => c.id === customerId);
  if (!existing) return null;
  const nextEmail = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;
  if (nextEmail !== existing.email) {
    if (staffUsers.some((s) => s.email === nextEmail)) {
      throw new Error('Цей Email вже закріплено за співробітником CRM');
    }
    if (customers.some((c) => c.id !== customerId && c.email === nextEmail)) {
      throw new Error('Інший клієнт вже використовує цей Email');
    }
  }
  if (patch.name !== undefined) existing.name = patch.name.trim() || existing.name;
  existing.email = nextEmail;
  if (patch.phone !== undefined) {
    existing.phone = patch.phone.trim() ? normalizeContactPhone(patch.phone.trim()) : '';
  }
  if (patch.city !== undefined) existing.city = patch.city.trim() || existing.city;
  if (patch.active !== undefined) existing.active = patch.active;
  if (patch.clearPassword) {
    existing.passwordHash = '';
  } else if (patch.password && patch.password.trim()) {
    existing.passwordHash = hashPassword(patch.password.trim());
  }
  existing.authProvider = existing.firebaseUid && existing.passwordHash
    ? 'both'
    : existing.passwordHash
      ? 'password'
      : 'google';
  existing.updatedAt = new Date().toISOString();
  memBackfillCustomerDeals(customerId, existing.email, existing.phone);
  return enrichCustomer(existing);
}

export function memGetCustomerWishlistIds(customerId: number): string[] {
  return [...(wishlists.get(customerId) ?? [])];
}

export function memSetCustomerWishlistIds(customerId: number, productIds: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of productIds) {
    const clean = String(raw).trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    deduped.push(clean);
    if (deduped.length >= 200) break;
  }
  wishlists.set(customerId, deduped);
  return [...deduped];
}

export function memListPublishedProductReviews(productId: string, limitCount = 100): ProductReview[] {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limitCount)));
  return reviews
    .filter((r) => r.productId === productId && r.status === 'published')
    .slice(0, safeLimit)
    .map((r) => ({ ...r }));
}

export function memGetProductReviewById(reviewId: string): ProductReview | null {
  const r = reviews.find((item) => item.id === reviewId);
  return r ? { ...r } : null;
}

export function memCreateProductReviewRecord(input: {
  id?: string;
  productId: string;
  authorUid: string;
  authorName: string;
  rating: number;
  comment: string;
  status?: ProductReviewStatus;
}): ProductReview {
  const nowMs = Date.now();
  const created: ProductReview = {
    id: input.id?.trim() || `rev_${crypto.randomBytes(12).toString('hex')}`,
    productId: input.productId.trim(),
    authorUid: input.authorUid.trim(),
    authorName: input.authorName.trim(),
    rating: Math.trunc(input.rating),
    comment: input.comment.trim(),
    status: input.status === 'hidden' ? 'hidden' : 'published',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  reviews.unshift(created);
  return { ...created };
}

export function memUpdateProductReviewRecord(
  reviewId: string,
  patch: { authorName: string; rating: number; comment: string },
): ProductReview | null {
  const existing = reviews.find((r) => r.id === reviewId);
  if (!existing) return null;
  existing.authorName = patch.authorName.trim();
  existing.rating = Math.trunc(patch.rating);
  existing.comment = patch.comment.trim();
  existing.updatedAtMs = Date.now();
  return { ...existing };
}

export function memDeleteProductReviewRecord(reviewId: string): boolean {
  const idx = reviews.findIndex((r) => r.id === reviewId);
  if (idx < 0) return false;
  reviews.splice(idx, 1);
  return true;
}
