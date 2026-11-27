import { asc, count, desc, eq, or } from 'drizzle-orm';
import * as schema from '../schema.ts';
import { hashPassword } from '../auth.ts';
import type { StaffRole, StaffUser } from '../../src/types.ts';
import { getDb, isDatabaseConfigured } from './client.ts';
import {
  memClaimMasterAdminAccount,
  memCreateStaffUser,
  memDeleteStaffUser,
  memFindStaffForGoogleLogin,
  memFindStaffForPasswordLogin,
  memGetMasterAdminRecord,
  memGetStaffAuthState,
  memListStaffUsers,
  memUpdateStaffUser,
} from './memoryStore.ts';
import { deleteSetting, getSetting, setSetting, setSettingIfAbsent } from './settings.ts';

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

function defaultAssigneeLabel(name: string, position: string): string {
  const cleanName = name.trim();
  const cleanPos = position.trim();
  if (!cleanPos) return cleanName;
  if (cleanName.toLowerCase().includes(cleanPos.toLowerCase())) return cleanName;
  return `${cleanName} (${cleanPos.toLowerCase()})`;
}

export async function seedStaffIfEmpty(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [seeded, cntRows] = await Promise.all([
    getSetting('staff_seeded'),
    db.select({ cnt: count() }).from(schema.staffUsersTable),
  ]);
  if (seeded || Number(cntRows[0]?.cnt ?? 0) > 0) return;

  const now = new Date().toISOString();
  const defaults: Array<[string, string, string, string, StaffRole, string]> = [
    ['Олександр', 'alex', '', 'Інженер', 'engineer', 'Олександр (інженер)'],
    ['Дмитро', 'dmytro', '', 'Менеджер', 'manager', 'Дмитро (менеджер)'],
    ['Ірина', 'iryna', '', 'Координатор', 'manager', 'Ірина (координатор)'],
    ['Монтажна бригада №1', 'brigade1', '', 'Монтажна бригада', 'installer', 'Монтажна бригада №1'],
  ];

  await db.transaction(async (tx) => {
    for (const [name, login, phone, position, role, assigneeLabel] of defaults) {
      await tx
        .insert(schema.staffUsersTable)
        .values({
          name,
          login,
          email: '',
          phone,
          position,
          role,
          assigneeLabel,
          passwordHash: '',
          canLogin: 0,
          active: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: schema.staffUsersTable.login });
    }
  });
  await setSettingIfAbsent('staff_seeded', '1');
}

export async function ensureMasterAdminAccount(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.staffUsersTable.id,
      role: schema.staffUsersTable.role,
      canLogin: schema.staffUsersTable.canLogin,
      active: schema.staffUsersTable.active,
      passwordHash: schema.staffUsersTable.passwordHash,
    })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.login, 'admin'))
    .limit(1);

  const legacyHash = (await getSetting('admin_password_hash'))?.trim() || '';
  const now = new Date().toISOString();

  if (!existing) {
    await db
      .insert(schema.staffUsersTable)
      .values({
        name: 'Головний адміністратор',
        login: 'admin',
        email: '',
        phone: '',
        position: 'Мастер-адміністратор',
        role: 'admin',
        assigneeLabel: 'Адміністратор',
        passwordHash: legacyHash,
        canLogin: 1,
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: schema.staffUsersTable.login });
    return;
  }

  const nextHash = existing.passwordHash || legacyHash;
  if (
    existing.role !== 'admin' ||
    existing.canLogin !== 1 ||
    existing.active !== 1 ||
    (!existing.passwordHash && Boolean(legacyHash))
  ) {
    await db
      .update(schema.staffUsersTable)
      .set({
        role: 'admin',
        canLogin: 1,
        active: 1,
        passwordHash: nextHash,
        updatedAt: now,
      })
      .where(eq(schema.staffUsersTable.id, existing.id));
  }
}

export async function getStaffAuthStateSync(userId: number): Promise<{
  active: boolean;
  canLogin: boolean;
  role: StaffRole;
  name: string;
  login: string;
  email: string;
  assigneeLabel: string;
} | null> {
  if (!isDatabaseConfigured()) {
    return memGetStaffAuthState(userId);
  }
  const db = getDb();
  const [row] = await db
    .select({
      name: schema.staffUsersTable.name,
      login: schema.staffUsersTable.login,
      email: schema.staffUsersTable.email,
      role: schema.staffUsersTable.role,
      assigneeLabel: schema.staffUsersTable.assigneeLabel,
      canLogin: schema.staffUsersTable.canLogin,
      active: schema.staffUsersTable.active,
    })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.id, userId))
    .limit(1);

  if (!row) return null;
  const role: StaffRole =
    row.role === 'admin' || row.role === 'manager' || row.role === 'engineer' || row.role === 'installer'
      ? row.role
      : 'manager';
  return {
    active: Boolean(row.active),
    canLogin: Boolean(row.canLogin),
    role,
    name: row.name,
    login: row.login,
    email: row.email,
    assigneeLabel: row.assigneeLabel,
  };
}

export async function getMasterAdminRecordSync(): Promise<{
  id: number;
  name: string;
  login: string;
  email: string;
  role: 'admin';
  assigneeLabel: string;
  passwordHash: string;
}> {
  if (!isDatabaseConfigured()) {
    return memGetMasterAdminRecord();
  }
  const db = getDb();
  await ensureMasterAdminAccount();
  const [row] = await db
    .select({
      id: schema.staffUsersTable.id,
      name: schema.staffUsersTable.name,
      login: schema.staffUsersTable.login,
      email: schema.staffUsersTable.email,
      assigneeLabel: schema.staffUsersTable.assigneeLabel,
      passwordHash: schema.staffUsersTable.passwordHash,
    })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.login, 'admin'))
    .limit(1);

  if (!row) {
    throw new Error('Master admin account missing after ensureMasterAdminAccount');
  }
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email,
    role: 'admin',
    assigneeLabel: row.assigneeLabel,
    passwordHash: row.passwordHash,
  };
}

export async function claimMasterAdminAccount(input: {
  passwordHash: string;
  name?: string;
  email?: string;
}): Promise<{
  id: number;
  name: string;
  login: string;
  email: string;
  role: 'admin';
  assigneeLabel: string;
  passwordHash: string;
}> {
  if (!isDatabaseConfigured()) {
    return memClaimMasterAdminAccount(input);
  }
  const db = getDb();
  const current = await getMasterAdminRecordSync();
  const now = new Date().toISOString();
  const nextName = input.name?.trim() || current.name;
  const nextEmail = input.email?.trim().toLowerCase() ?? current.email;
  await db
    .update(schema.staffUsersTable)
    .set({
      name: nextName,
      email: nextEmail,
      passwordHash: input.passwordHash,
      role: 'admin',
      canLogin: 1,
      active: 1,
      updatedAt: now,
    })
    .where(eq(schema.staffUsersTable.id, current.id));
  return getMasterAdminRecordSync();
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  if (!isDatabaseConfigured()) {
    return memListStaffUsers();
  }
  const db = getDb();
  const rows = await db
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
  if (!isDatabaseConfigured()) {
    return memFindStaffForPasswordLogin(identifier);
  }
  const db = getDb();
  const norm = identifier.trim().toLowerCase();
  if (!norm) return null;
  const rows = await db
    .select()
    .from(schema.staffUsersTable)
    .where(or(eq(schema.staffUsersTable.login, norm), eq(schema.staffUsersTable.email, norm)))
    .limit(1);
  const match = rows[0];
  if (!match) return null;
  return {
    user: mapStaffRow(match),
    passwordHash: match.passwordHash,
  };
}

export async function findStaffForGoogleLogin(email: string): Promise<StaffUser | null> {
  if (!isDatabaseConfigured()) {
    return memFindStaffForGoogleLogin(email);
  }
  const db = getDb();
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const [row] = await db
    .select()
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.email, norm))
    .limit(1);
  if (!row) return null;
  return mapStaffRow(row);
}

export async function createStaffUser(input: {
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
}): Promise<StaffUser> {
  if (!isDatabaseConfigured()) {
    return memCreateStaffUser(input);
  }
  const db = getDb();
  const emailNorm = (input.email ?? '').trim().toLowerCase();
  const explicitLogin = (input.login ?? '').trim().toLowerCase();

  if (emailNorm) {
    const [existingEmail] = await db
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.email, emailNorm))
      .limit(1);
    if (existingEmail) {
      throw new Error('Цей Email вже закріплено за іншим користувачем');
    }
  }

  let loginNorm = explicitLogin;
  if (loginNorm) {
    const [existingLogin] = await db
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.login, loginNorm))
      .limit(1);
    if (existingLogin) {
      throw new Error('Користувач із таким логіном вже існує');
    }
  } else {
    const baseRaw = (emailNorm.split('@')[0] || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '')
      .slice(0, 28);
    const base = baseRaw && baseRaw !== 'admin' && baseRaw.length >= 2 ? baseRaw : `user_${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 2;
    while (candidate === 'admin') {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    while (true) {
      const [found] = await db
        .select({ id: schema.staffUsersTable.id })
        .from(schema.staffUsersTable)
        .where(eq(schema.staffUsersTable.login, candidate))
        .limit(1);
      if (!found) break;
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    loginNorm = candidate;
  }

  const now = new Date().toISOString();
  const label = (input.assigneeLabel ?? '').trim() || defaultAssigneeLabel(input.name, input.position);
  const passwordHash = input.password ? hashPassword(input.password) : '';

  const [inserted] = await db
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
  if (!isDatabaseConfigured()) {
    return memUpdateStaffUser(id, patch);
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.id, id))
    .limit(1);
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
    const [dupLogin] = await db
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.login, nextLogin))
      .limit(1);
    if (dupLogin && dupLogin.id !== id) {
      throw new Error('Інший співробітник уже використовує цей логін');
    }
  }

  if (nextEmail && nextEmail !== existing.email) {
    const [dupEmail] = await db
      .select({ id: schema.staffUsersTable.id })
      .from(schema.staffUsersTable)
      .where(eq(schema.staffUsersTable.email, nextEmail))
      .limit(1);
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
  const [updated] = await db
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
    if (nextPasswordHash) {
      await setSetting('admin_password_hash', nextPasswordHash);
    } else {
      await deleteSetting('admin_password_hash');
    }
  }

  // Propagate renamed assigneeLabel to existing deals and tasks so links stay cohesive
  if (nextLabel !== existing.assigneeLabel) {
    await Promise.all([
      db
        .update(schema.dealsTable)
        .set({ assignee: nextLabel })
        .where(eq(schema.dealsTable.assignee, existing.assigneeLabel)),
      db
        .update(schema.tasksTable)
        .set({ assignee: nextLabel })
        .where(eq(schema.tasksTable.assignee, existing.assigneeLabel)),
    ]);
  }

  return mapStaffRow(updated);
}

export async function deleteStaffUser(id: number): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return memDeleteStaffUser(id);
  }
  const db = getDb();
  const [existing] = await db
    .select({ id: schema.staffUsersTable.id, login: schema.staffUsersTable.login })
    .from(schema.staffUsersTable)
    .where(eq(schema.staffUsersTable.id, id))
    .limit(1);
  if (!existing) return false;
  if (existing.login === 'admin') {
    throw new Error('Мастер-акаунт адміністратора не можна видалити');
  }
  await db.delete(schema.staffUsersTable).where(eq(schema.staffUsersTable.id, id));
  return true;
}
