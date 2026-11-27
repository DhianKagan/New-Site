import { desc, eq } from 'drizzle-orm';
import * as schema from '../schema.ts';
import { hashPassword } from '../auth.ts';
import type { CrmCustomer, CustomerProfile, Deal } from '../../src/types.ts';
import { getDb } from './client.ts';
import { backfillCustomerDeals, listCustomerDeals } from './deals.ts';
import { normalizeContactPhone } from './utils.ts';

function mapCustomerRow(r: typeof schema.customerAccountsTable.$inferSelect): CustomerProfile {
  const provider = r.authProvider === 'password' || r.authProvider === 'both' ? r.authProvider : 'google';
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    authProvider: provider,
    active: Boolean(r.active),
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function getCustomerAuthStateSync(customerId: number): Promise<{
  id: number;
  active: boolean;
  name: string;
  email: string;
  phone: string;
  city: string;
  firebaseUid: string;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: schema.customerAccountsTable.id,
      active: schema.customerAccountsTable.active,
      name: schema.customerAccountsTable.name,
      email: schema.customerAccountsTable.email,
      phone: schema.customerAccountsTable.phone,
      city: schema.customerAccountsTable.city,
      firebaseUid: schema.customerAccountsTable.firebaseUid,
    })
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    active: Boolean(row.active),
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    firebaseUid: String(row.firebaseUid || ''),
  };
}

export async function getCustomerProfileById(customerId: number): Promise<CustomerProfile | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .limit(1);
  return row ? mapCustomerRow(row) : null;
}

export async function findCustomerForPasswordLogin(email: string): Promise<{
  customer: CustomerProfile;
  passwordHash: string;
} | null> {
  const db = getDb();
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const [row] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.email, norm))
    .limit(1);
  if (!row) return null;
  return {
    customer: mapCustomerRow(row),
    passwordHash: row.passwordHash,
  };
}

export async function registerCustomerWithPassword(input: {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  password: string;
}): Promise<CustomerProfile> {
  const db = getDb();
  const emailNorm = input.email.trim().toLowerCase();
  const [existingStaff] = await db
    .select({ id: schema.staffUsersTable.id })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.email, emailNorm))
    .limit(1);
  if (existingStaff) {
    throw new Error('Цей Email закріплено за обліковим записом співробітника. Використайте вхід через Google.');
  }

  const [existing] = await db
    .select({ id: schema.customerAccountsTable.id })
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.email, emailNorm))
    .limit(1);
  if (existing) {
    throw new Error('Акаунт із таким Email вже існує. Увійдіть за паролем або через Google.');
  }

  const now = new Date().toISOString();
  const cleanPhone = input.phone?.trim() ? normalizeContactPhone(input.phone.trim()) : '';
  const [inserted] = await db
    .insert(schema.customerAccountsTable)
    .values({
      name: input.name.trim(),
      email: emailNorm,
      phone: cleanPhone,
      city: (input.city ?? '').trim() || 'Одеса',
      firebaseUid: '',
      passwordHash: hashPassword(input.password),
      authProvider: 'password',
      active: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapCustomerRow(inserted);
}

export async function upsertGoogleCustomerAccount(input: {
  email: string;
  name: string;
  firebaseUid: string;
}): Promise<CustomerProfile> {
  const db = getDb();
  const emailNorm = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.email, emailNorm))
    .limit(1);

  if (existing) {
    if (!existing.active) {
      throw new Error('Акаунт клієнта тимчасово вимкнено');
    }
    const nextProvider =
      existing.authProvider === 'password' || existing.passwordHash ? 'both' : existing.authProvider || 'google';
    const nextName = existing.name?.trim() || input.name.trim() || emailNorm.split('@')[0];
    const [updated] = await db
      .update(schema.customerAccountsTable)
      .set({
        name: nextName,
        firebaseUid: existing.firebaseUid || input.firebaseUid,
        authProvider: nextProvider,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(schema.customerAccountsTable.id, existing.id))
      .returning();
    return mapCustomerRow(updated);
  }

  const [inserted] = await db
    .insert(schema.customerAccountsTable)
    .values({
      name: input.name.trim() || emailNorm.split('@')[0],
      email: emailNorm,
      phone: '',
      city: 'Одеса',
      firebaseUid: input.firebaseUid,
      passwordHash: '',
      authProvider: 'google',
      active: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapCustomerRow(inserted);
}

export async function updateCustomerProfile(
  customerId: number,
  patch: { name?: string; phone?: string; city?: string },
): Promise<CustomerProfile | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .limit(1);
  if (!existing) return null;

  const nextName = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
  const nextPhone =
    patch.phone !== undefined ? (patch.phone.trim() ? normalizeContactPhone(patch.phone.trim()) : '') : existing.phone;
  const nextCity = patch.city !== undefined ? patch.city.trim() || existing.city : existing.city;
  const now = new Date().toISOString();

  const [updated] = await db
    .update(schema.customerAccountsTable)
    .set({
      name: nextName,
      phone: nextPhone,
      city: nextCity,
      updatedAt: now,
    })
    .where(eq(schema.customerAccountsTable.id, customerId))
    .returning();

  await backfillCustomerDeals(customerId, existing.email.toLowerCase(), nextPhone);

  return mapCustomerRow(updated);
}

export async function deleteCustomerAccount(customerId: number): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .returning({ id: schema.customerAccountsTable.id });
  return deleted.length > 0;
}

async function enrichCrmCustomer(row: typeof schema.customerAccountsTable.$inferSelect): Promise<CrmCustomer> {
  const profile = mapCustomerRow(row);
  const deals = await listCustomerDeals({ id: profile.id, email: profile.email, phone: profile.phone });
  const activeDealsCount = deals.filter((d) => d.stage !== 'done' && d.stage !== 'archived').length;
  const totalUsd = deals.reduce((sum, d) => sum + (Number(d.totalUsd) || 0), 0);
  return {
    ...profile,
    dealsCount: deals.length,
    activeDealsCount,
    totalUsd,
  };
}

export async function listCustomerAccounts(): Promise<CrmCustomer[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.customerAccountsTable)
    .orderBy(desc(schema.customerAccountsTable.id));
  return Promise.all(rows.map(enrichCrmCustomer));
}

export async function getCustomerAccountDetail(customerId: number): Promise<{
  customer: CrmCustomer;
  deals: Deal[];
} | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .limit(1);
  if (!row) return null;
  const profile = mapCustomerRow(row);
  const deals = await listCustomerDeals({ id: profile.id, email: profile.email, phone: profile.phone });
  return {
    customer: {
      ...profile,
      dealsCount: deals.length,
      activeDealsCount: deals.filter((d) => d.stage !== 'done' && d.stage !== 'archived').length,
      totalUsd: deals.reduce((sum, d) => sum + (Number(d.totalUsd) || 0), 0),
    },
    deals,
  };
}

export async function createCustomerAccountByCrm(input: {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  password?: string;
  active?: boolean;
}): Promise<CrmCustomer> {
  const db = getDb();
  const emailNorm = input.email.trim().toLowerCase();
  const [existingStaff] = await db
    .select({ id: schema.staffUsersTable.id })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.email, emailNorm))
    .limit(1);
  if (existingStaff) {
    throw new Error('Цей Email вже використовується співробітником CRM');
  }

  const [existing] = await db
    .select({ id: schema.customerAccountsTable.id })
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.email, emailNorm))
    .limit(1);
  if (existing) {
    throw new Error('Клієнт із таким Email вже зареєстрований');
  }

  const now = new Date().toISOString();
  const cleanPhone = input.phone?.trim() ? normalizeContactPhone(input.phone.trim()) : '';
  const pwd = (input.password ?? '').trim();

  const [inserted] = await db
    .insert(schema.customerAccountsTable)
    .values({
      name: input.name.trim(),
      email: emailNorm,
      phone: cleanPhone,
      city: (input.city ?? '').trim() || 'Одеса',
      firebaseUid: '',
      passwordHash: pwd ? hashPassword(pwd) : '',
      authProvider: pwd ? 'password' : 'google',
      active: input.active === false ? 0 : 1,
      lastLoginAt: '',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await backfillCustomerDeals(inserted.id, emailNorm, cleanPhone);

  return enrichCrmCustomer(inserted);
}

export async function updateCustomerAccountByCrm(
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
): Promise<CrmCustomer | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.customerAccountsTable)
    .where(eq(schema.customerAccountsTable.id, customerId))
    .limit(1);
  if (!existing) return null;

  const nextEmail = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;
  if (nextEmail !== existing.email) {
    const [conflictStaff] = await db
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.email, nextEmail))
      .limit(1);
    if (conflictStaff) {
      throw new Error('Цей Email вже закріплено за співробітником CRM');
    }
    const [conflictCustomer] = await db
      .select({ id: schema.customerAccountsTable.id })
      .from(schema.customerAccountsTable)
      .where(eq(schema.customerAccountsTable.email, nextEmail))
      .limit(1);
    if (conflictCustomer && conflictCustomer.id !== customerId) {
      throw new Error('Інший клієнт вже використовує цей Email');
    }
  }

  const nextName = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
  const nextPhone =
    patch.phone !== undefined ? (patch.phone.trim() ? normalizeContactPhone(patch.phone.trim()) : '') : existing.phone;
  const nextCity = patch.city !== undefined ? patch.city.trim() || existing.city : existing.city;
  const nextActive = patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active;

  let nextPasswordHash = existing.passwordHash;
  if (patch.clearPassword) {
    nextPasswordHash = '';
  } else if (patch.password && patch.password.trim()) {
    nextPasswordHash = hashPassword(patch.password.trim());
  }

  const hasGoogle = Boolean(existing.firebaseUid) || existing.authProvider === 'google' || existing.authProvider === 'both';
  const hasPwd = Boolean(nextPasswordHash);
  const nextProvider = hasGoogle && hasPwd ? 'both' : hasPwd ? 'password' : 'google';
  const now = new Date().toISOString();

  const [updated] = await db
    .update(schema.customerAccountsTable)
    .set({
      name: nextName,
      email: nextEmail,
      phone: nextPhone,
      city: nextCity,
      passwordHash: nextPasswordHash,
      authProvider: nextProvider,
      active: nextActive,
      updatedAt: now,
    })
    .where(eq(schema.customerAccountsTable.id, customerId))
    .returning();

  await backfillCustomerDeals(customerId, nextEmail, nextPhone);

  return enrichCrmCustomer(updated);
}

export async function getCustomerWishlistIds(customerId: number): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ productId: schema.customerWishlistTable.productId })
    .from(schema.customerWishlistTable)
    .where(eq(schema.customerWishlistTable.customerId, customerId))
    .orderBy(desc(schema.customerWishlistTable.createdAt));
  return rows.map((r) => String(r.productId));
}

export async function setCustomerWishlistIds(customerId: number, productIds: string[]): Promise<string[]> {
  const db = getDb();
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of productIds) {
    const clean = String(raw).trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    deduped.push(clean);
    if (deduped.length >= 200) break;
  }

  const baseMs = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(schema.customerWishlistTable).where(eq(schema.customerWishlistTable.customerId, customerId));
    for (let i = 0; i < deduped.length; i++) {
      const ts = new Date(baseMs - i).toISOString();
      await tx.insert(schema.customerWishlistTable).values({
        customerId,
        productId: deduped[i],
        createdAt: ts,
      });
    }
  });

  return getCustomerWishlistIds(customerId);
}
