import { z } from 'zod';

export function normalizePhoneInput(raw: string): string | null {
  const cleaned = raw.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  if (/^380\d{9}$/.test(digits)) {
    return `+${digits}`;
  }
  if (/^0\d{9}$/.test(digits)) {
    return `+38${digits}`;
  }
  if (/^\d{9}$/.test(digits)) {
    return `+380${digits}`;
  }
  return null;
}

export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const DEAL_STAGES = ['new', 'audit', 'proposal', 'fulfillment', 'done', 'archived'] as const;
export const PRODUCT_CATEGORIES = ['kits', 'inverters', 'batteries', 'panels', 'parts'] as const;
export const CONTACT_SEGMENTS = ['b2c', 'b2b'] as const;
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export const leadCreateSchema = z.object({
  customerName: z.string().max(120).optional().default(''),
  phone: z.string().min(1, 'Вкажіть номер телефону'),
  city: z.string().max(120).optional().default('Одеса'),
  channel: z.string().max(40).optional().default('Telegram'),
  topic: z.string().max(180).optional().default(''),
  taskType: z.string().max(120).optional().default(''),
  loads: z.array(z.string().max(80)).max(15).optional().default([]),
  notes: z.string().max(1500).optional().default(''),
  estimatedTotalUsd: z.coerce.number().min(0).max(5_000_000).optional().default(0),
  website: z.string().optional().default(''),
});

export const orderCreateSchema = z.object({
  customerName: z.string().max(120).optional().default(''),
  phone: z.string().min(1, 'Вкажіть номер телефону'),
  city: z.string().max(120).optional().default('Одеса'),
  channel: z.string().max(40).optional().default('Телефон'),
  notes: z.string().max(1500).optional().default(''),
  website: z.string().optional().default(''),
  acceptedOffer: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        qty: z.coerce.number().int().min(1).max(99).optional().default(1),
      }),
    )
    .min(1, 'Кошик порожній')
    .max(50),
});

export const dealPatchSchema = z.object({
  stage: z.enum(DEAL_STAGES).optional(),
  assignee: z.string().max(120).optional(),
  notes: z.string().max(3000).optional(),
  totalUsd: z.coerce.number().min(0).max(10_000_000).optional(),
});

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, 'Вкажіть ім’я контакту').max(120),
  company: z.string().max(160).optional().default(''),
  phone: z.string().trim().min(1, 'Вкажіть номер телефону'),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Некоректний Email')
    .optional()
    .default(''),
  city: z.string().max(120).optional().default('Одеса'),
  channel: z.string().max(40).optional().default('Telegram'),
  segment: z.enum(CONTACT_SEGMENTS).optional().default('b2c'),
});

export const contactPatchSchema = contactCreateSchema.partial();

export const taskCreateSchema = z.object({
  contactId: z.coerce.number().int().positive().nullable().optional().default(null),
  dealId: z.coerce.number().int().positive().nullable().optional().default(null),
  title: z.string().trim().min(1, 'Вкажіть назву задачі').max(240),
  status: z.enum(TASK_STATUSES).optional().default('todo'),
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
  assignee: z.string().max(120).optional().default('Олександр (інженер)'),
  dueDate: z.string().max(32).optional().default(''),
});

export const taskPatchSchema = taskCreateSchema.partial();

export const STAFF_ROLES = ['admin', 'manager', 'engineer', 'installer'] as const;

export const noteCreateSchema = z.object({
  contactId: z.coerce.number().int().positive().nullable().optional().default(null),
  dealId: z.coerce.number().int().positive().nullable().optional().default(null),
  author: z.string().max(80).optional().default('Менеджер CRM'),
  body: z.string().trim().min(1, 'Введіть текст нотатки').max(2000),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, 'Вкажіть ім’я співробітника').max(100),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .max(40)
    .refine(
      (v) => !v || (/^[a-z0-9._-]+$/.test(v) && v.length >= 2),
      'Логін може містити лише латиницю, цифри, крапку, дефіс або _ (мін. 2 символи)',
    )
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Некоректний Email')
    .optional()
    .default(''),
  phone: z.string().trim().max(40).optional().default(''),
  position: z.string().trim().min(1, 'Вкажіть посаду').max(80),
  role: z.enum(STAFF_ROLES).optional().default('manager'),
  assigneeLabel: z.string().trim().max(120).optional().default(''),
  password: z
    .string()
    .max(128)
    .refine((v) => !v || v.length >= 6, 'Пароль має містити щонайменше 6 символів')
    .optional()
    .default(''),
  canLogin: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

export const staffPatchSchema = staffCreateSchema.partial().extend({
  clearPassword: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  identifier: z.string().trim().max(160).optional().default(''),
  password: z.string().min(1, 'Введіть пароль').max(128),
});

export const adminSetupSchema = z.object({
  name: z.string().trim().max(100).optional().default('Головний адміністратор'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Некоректний Email')
    .optional()
    .default(''),
  password: z.string().min(6, 'Пароль має містити від 6 до 128 символів').max(128),
});

export const productCreateSchema = z.object({
  title: z.string().trim().min(1, 'Вкажіть назву товару').max(220),
  sku: z.string().max(64).optional().default(''),
  cat: z.enum(PRODUCT_CATEGORIES).optional().default('parts'),
  brand: z.string().max(80).optional().default('Energo Comfort'),
  isKit: z.boolean().optional(),
  price: z.coerce.number().min(0).max(5_000_000).optional().default(0),
  oldPrice: z.coerce.number().min(0).max(5_000_000).optional().default(0),
  inStock: z.boolean().optional().default(true),
  statusLabel: z.string().max(80).optional(),
  img: z
    .string()
    .max(600)
    .refine(isSafeImageUrl, 'Некоректне посилання на зображення (дозволено /... або https://)')
    .optional()
    .default(''),
  specs: z.unknown().optional(),
  description: z.string().max(6000).optional().default(''),
});

export const productPatchSchema = productCreateSchema.partial();

export const projectCreateSchema = z.object({
  seg: z.enum(['b2b', 'b2c']).optional().default('b2c'),
  tag: z.string().max(80).optional().default(''),
  title: z.string().trim().min(1, 'Вкажіть назву об’єкта').max(180),
  img: z
    .string()
    .max(600)
    .refine(isSafeImageUrl, 'Некоректне посилання на зображення')
    .optional()
    .default(''),
  task: z.string().max(1000).optional().default(''),
  solution: z.string().max(1000).optional().default(''),
  specs: z.string().max(240).optional().default(''),
  result: z.string().max(1000).optional().default(''),
});

export const projectPatchSchema = projectCreateSchema.partial();

export const analyticsPutSchema = z.object({
  metaPixelId: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{8,20}$/.test(v), 'Некоректний Meta Pixel ID (очікуються лише цифри, 8–20 символів)')
    .optional()
    .default(''),
  ga4MeasurementId: z
    .string()
    .trim()
    .refine((v) => !v || /^G-[A-Z0-9]{4,20}$/i.test(v), 'Некоректний GA4 Measurement ID (формат G-XXXXXXXXXX)')
    .optional()
    .default(''),
  gtmContainerId: z
    .string()
    .trim()
    .refine((v) => !v || /^GTM-[A-Z0-9]{4,20}$/i.test(v), 'Некоректний GTM Container ID (формат GTM-XXXXXXX)')
    .optional()
    .default(''),
  analyticsEnabled: z.boolean().optional().default(true),
});

export const socialPutSchema = z.object({
  telegram: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для telegram').optional().default(''),
  instagram: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для instagram').optional().default(''),
  facebook: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для facebook').optional().default(''),
  youtube: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для youtube').optional().default(''),
  viber: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для viber').optional().default(''),
  tiktok: z.string().trim().refine(isSafeExternalUrl, 'Некоректне посилання для tiktok').optional().default(''),
});

export const clientRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Вкажіть ваше ім’я (мінімум 2 символи)').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Вкажіть коректний Email'),
  phone: z.string().trim().max(40).optional().default(''),
  city: z.string().trim().max(80).optional().default('Одеса'),
  password: z.string().min(6, 'Пароль має містити щонайменше 6 символів').max(128),
});

export const clientProfilePatchSchema = z.object({
  name: z.string().trim().min(2, 'Ім’я має містити щонайменше 2 символи').max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().min(1, 'Вкажіть місто').max(80).optional(),
});

export const crmCustomerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Вкажіть ім’я клієнта (мінімум 2 символи)').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Вкажіть коректний Email'),
  phone: z.string().trim().max(40).optional().default(''),
  city: z.string().trim().max(80).optional().default('Одеса'),
  password: z
    .string()
    .max(128)
    .refine((v) => !v || v.length >= 6, 'Пароль має містити щонайменше 6 символів')
    .optional()
    .default(''),
  active: z.boolean().optional().default(true),
});

export const crmCustomerPatchSchema = crmCustomerCreateSchema.partial().extend({
  clearPassword: z.boolean().optional(),
});
