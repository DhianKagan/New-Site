import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
} from 'drizzle-orm/pg-core';

export const productsTable = pgTable('products', {
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

export const contactsTable = pgTable('contacts', {
  id: serial('id').primaryKey(),
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

export const customerAccountsTable = pgTable('customer_accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().default(''),
  city: text('city').notNull().default('Одеса'),
  firebaseUid: text('firebase_uid').notNull().default(''),
  passwordHash: text('password_hash').notNull().default(''),
  authProvider: text('auth_provider').notNull().default('google'),
  active: integer('active').notNull().default(1),
  lastLoginAt: text('last_login_at').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const dealsTable = pgTable('deals', {
  id: serial('id').primaryKey(),
  dealNumber: text('deal_number').notNull().unique(),
  contactId: integer('contact_id').references(() => contactsTable.id, { onDelete: 'set null' }),
  customerId: integer('customer_id').references(() => customerAccountsTable.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email').notNull().default(''),
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

export const tasksTable = pgTable('tasks', {
  id: serial('id').primaryKey(),
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

export const notesTable = pgTable('notes', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contactsTable.id, { onDelete: 'cascade' }),
  dealId: integer('deal_id').references(() => dealsTable.id, { onDelete: 'cascade' }),
  author: text('author').notNull().default('Менеджер CRM'),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
});

export const settingsTable = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const analyticsEventsTable = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  eventName: text('event_name').notNull(),
  metaEvent: text('meta_event').notNull(),
  ga4Event: text('ga4_event').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const projectsTable = pgTable('projects', {
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

export const staffUsersTable = pgTable('staff_users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  login: text('login').notNull().unique(),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  position: text('position').notNull().default('Менеджер'),
  role: text('role').notNull().default('manager'),
  assigneeLabel: text('assignee_label').notNull(),
  passwordHash: text('password_hash').notNull().default(''),
  canLogin: integer('can_login').notNull().default(0),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const clientErrorLogsTable = pgTable('client_error_logs', {
  id: serial('id').primaryKey(),
  errorId: text('error_id').notNull(),
  kind: text('kind').notNull().default('react_boundary'),
  name: text('name').notNull().default('Error'),
  message: text('message').notNull(),
  stack: text('stack').notNull().default(''),
  componentStack: text('component_stack').notNull().default(''),
  route: text('route').notNull().default('/'),
  locale: text('locale').notNull().default('uk'),
  createdAt: text('created_at').notNull(),
});

export const productReviewsTable = pgTable(
  'product_reviews',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    authorUid: text('author_uid').notNull(),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    status: text('status').notNull().default('published'),
    createdAtMs: bigint('created_at_ms', { mode: 'number' }).notNull(),
    updatedAtMs: bigint('updated_at_ms', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_product_reviews_product_status').on(table.productId, table.status, table.createdAtMs),
  ],
);

export const customerWishlistTable = pgTable(
  'customer_wishlist',
  {
    customerId: integer('customer_id')
      .notNull()
      .references(() => customerAccountsTable.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.customerId, table.productId] })],
);
