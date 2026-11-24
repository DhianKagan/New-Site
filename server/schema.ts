import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const productsTable = sqliteTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull(),
  title: text('title').notNull(),
  cat: text('cat').notNull(),
  rawCatsJson: text('raw_cats_json').notNull().default('[]'),
  brand: text('brand').notNull(),
  isKit: integer('is_kit').notNull().default(0),
  price: integer('price').notNull().default(0),
  oldPrice: integer('old_price').notNull().default(0),
  inStock: integer('in_stock').notNull().default(1),
  statusLabel: text('status_label').notNull().default('в наявності'),
  img: text('img').notNull().default(''),
  specsJson: text('specs_json').notNull().default('[]'),
  description: text('description').notNull().default(''),
  sourceUrl: text('source_url').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
});

export const contactsTable = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  company: text('company').notNull().default(''),
  phone: text('phone').notNull().unique(),
  email: text('email').notNull().default(''),
  city: text('city').notNull().default('Одеса'),
  channel: text('channel').notNull().default('Telegram'),
  segment: text('segment').notNull().default('b2c'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const dealsTable = sqliteTable('deals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dealNumber: text('deal_number').notNull().unique(),
  contactId: integer('contact_id').references(() => contactsTable.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  stage: text('stage').notNull().default('new'),
  customerName: text('customer_name').notNull().default(''),
  phone: text('phone').notNull(),
  city: text('city').notNull().default('Одеса'),
  channel: text('channel').notNull().default('Telegram'),
  topic: text('topic').notNull().default(''),
  taskType: text('task_type').notNull().default(''),
  loadsJson: text('loads_json').notNull().default('[]'),
  itemsJson: text('items_json').notNull().default('[]'),
  totalUsd: integer('total_usd').notNull().default(0),
  assignee: text('assignee').notNull().default('Олександр (інженер)'),
  notes: text('notes').notNull().default(''),
  telegramSent: integer('telegram_sent').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tasksTable = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').references(() => contactsTable.id, { onDelete: 'cascade' }),
  dealId: integer('deal_id').references(() => dealsTable.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  status: text('status').notNull().default('todo'),
  priority: text('priority').notNull().default('medium'),
  assignee: text('assignee').notNull().default('Олександр (інженер)'),
  dueDate: text('due_date').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const notesTable = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').references(() => contactsTable.id, { onDelete: 'cascade' }),
  dealId: integer('deal_id').references(() => dealsTable.id, { onDelete: 'cascade' }),
  author: text('author').notNull().default('Менеджер CRM'),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
});

export const settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const analyticsEventsTable = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventName: text('event_name').notNull(),
  metaEvent: text('meta_event').notNull(),
  ga4Event: text('ga4_event').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const projectsTable = sqliteTable('projects', {
  id: text('id').primaryKey(),
  seg: text('seg').notNull().default('b2c'),
  tag: text('tag').notNull().default(''),
  title: text('title').notNull(),
  img: text('img').notNull().default(''),
  task: text('task').notNull().default(''),
  solution: text('solution').notNull().default(''),
  specs: text('specs').notNull().default(''),
  result: text('result').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
