import { useMemo, useState, type FormEvent } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, KeyRound, Mail, Pencil, Phone, Plus, Search, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import type { CrmSessionUser, CrmTask, Deal, StaffRole, StaffUser } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';

interface StaffTabProps {
  staff: StaffUser[];
  currentUser: CrmSessionUser | null;
  deals: Deal[];
  tasks: CrmTask[];
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefreshStaff: () => Promise<void>;
  onRefreshDeals: () => Promise<void>;
  onRefreshTasks: () => Promise<void>;
}

const staffTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

const columnHelper = createColumnHelper<typeof staffTableFeatures, StaffUser>();

const ROLE_LABELS: Record<StaffRole, { uk: string; ru: string; variant: 'dark' | 'info' | 'success' | 'warning' }> = {
  admin: { uk: 'Адміністратор', ru: 'Администратор', variant: 'dark' },
  manager: { uk: 'Менеджер', ru: 'Менеджер', variant: 'info' },
  engineer: { uk: 'Інженер', ru: 'Инженер', variant: 'success' },
  installer: { uk: 'Монтаж', ru: 'Монтаж', variant: 'warning' },
};

export function StaffTab({
  staff,
  currentUser,
  deals,
  tasks,
  authFetch,
  onRefreshStaff,
  onRefreshDeals,
  onRefreshTasks,
}: StaffTabProps) {
  const isAdmin = !currentUser || currentUser.role === 'admin';
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [actionMsg, setActionMsg] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffUser | null>(null);
  const [fName, setFName] = useState('');
  const [fLogin, setFLogin] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fPosition, setFPosition] = useState('Менеджер');
  const [fRole, setFRole] = useState<StaffRole>('manager');
  const [fAssigneeLabel, setFAssigneeLabel] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fClearPassword, setFClearPassword] = useState(false);
  const [fCanLogin, setFCanLogin] = useState(true);
  const [fActive, setFActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const workloadByLabel = useMemo(() => {
    const map = new Map<string, { deals: number; openTasks: number }>();
    for (const d of deals) {
      if (d.stage === 'archived' || d.stage === 'done') continue;
      const cur = map.get(d.assignee) ?? { deals: 0, openTasks: 0 };
      cur.deals += 1;
      map.set(d.assignee, cur);
    }
    for (const t of tasks) {
      if (t.status === 'done') continue;
      const cur = map.get(t.assignee) ?? { deals: 0, openTasks: 0 };
      cur.openTasks += 1;
      map.set(t.assignee, cur);
    }
    return map;
  }, [deals, tasks]);

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.login.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.position.toLowerCase().includes(q) ||
        m.assigneeLabel.toLowerCase().includes(q)
      );
    });
  }, [staff, query, roleFilter]);

  function openCreateModal() {
    setEditingMember(null);
    setFName('');
    setFLogin('');
    setFEmail('');
    setFPhone('');
    setFPosition('Менеджер');
    setFRole('manager');
    setFAssigneeLabel('');
    setFPassword('');
    setFClearPassword(false);
    setFCanLogin(true);
    setFActive(true);
    setFormErr('');
    setModalOpen(true);
  }

  function openEditModal(m: StaffUser) {
    setEditingMember(m);
    setFName(m.name);
    setFLogin(m.login);
    setFEmail(m.email);
    setFPhone(m.phone);
    setFPosition(m.position);
    setFRole(m.role);
    setFAssigneeLabel(m.assigneeLabel);
    setFPassword('');
    setFClearPassword(false);
    setFCanLogin(m.canLogin);
    setFActive(m.active);
    setFormErr('');
    setModalOpen(true);
  }

  async function handleSaveMember(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    setActionMsg('');

    if (fCanLogin && !fPassword && !fEmail.trim() && !(editingMember?.hasPassword && !fClearPassword)) {
      setFormErr(
        tr(
          'Щоб дозволити вхід у CRM, задайте пароль (мін. 6 символів) або вкажіть Google Email',
          'Чтобы разрешить вход в CRM, задайте пароль (мин. 6 символов) или укажите Google Email',
        ),
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: fName.trim(),
        login: fLogin.trim().toLowerCase(),
        email: fEmail.trim().toLowerCase(),
        phone: fPhone.trim(),
        position: fPosition.trim(),
        role: fRole,
        assigneeLabel: fAssigneeLabel.trim(),
        canLogin: fCanLogin,
        active: fActive,
      };
      if (fPassword.trim()) {
        payload.password = fPassword;
      }
      if (editingMember && fClearPassword) {
        payload.clearPassword = true;
      }

      const url = editingMember ? `/api/crm/staff/${editingMember.id}` : '/api/crm/staff';
      const resp = await authFetch(url, {
        method: editingMember ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { member?: StaffUser; error?: string };
      if (!resp.ok || !data.member) {
        setFormErr(data.error || tr('Не вдалося зберегти обліковий запис', 'Не удалось сохранить учётную запись'));
        return;
      }

      setModalOpen(false);
      await Promise.all([onRefreshStaff(), onRefreshDeals(), onRefreshTasks()]);
      setActionMsg(
        editingMember
          ? tr(`Профіль «${data.member.name}» оновлено`, `Профиль «${data.member.name}» обновлён`)
          : tr(`Створено обліковий запис для «${data.member.name}»`, `Создана учётная запись для «${data.member.name}»`),
      );
    } catch {
      setFormErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(m: StaffUser) {
    setActionMsg('');
    const resp = await authFetch(`/api/crm/staff/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    });
    const data = (await resp.json()) as { error?: string };
    if (!resp.ok) {
      setActionMsg(data.error || tr('Не вдалося змінити статус', 'Не удалось изменить статус'));
      return;
    }
    await onRefreshStaff();
  }

  async function handleDeleteMember(m: StaffUser) {
    setActionMsg('');
    const resp = await authFetch(`/api/crm/staff/${m.id}`, { method: 'DELETE' });
    const data = (await resp.json()) as { error?: string };
    if (!resp.ok) {
      setActionMsg(data.error || tr('Не вдалося видалити співробітника', 'Не удалось удалить сотрудника'));
      return;
    }
    await onRefreshStaff();
    setActionMsg(tr(`Співробітника «${m.name}» видалено`, `Сотрудник «${m.name}» удалён`));
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: () => <span>{tr('Співробітник / Посада', 'Сотрудник / Должность')}</span>,
          cell: (info) => {
            const m = info.row.original;
            const isSelf = currentUser?.userId === m.id;
            return (
              <div>
                <div className="font-bold text-[#0d1f33] flex items-center gap-1.5">
                  <span>{m.name}</span>
                  {isSelf && <Badge variant="info">{tr('Ви', 'Вы')}</Badge>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {m.position} · <span className="font-mono text-slate-600">{m.assigneeLabel}</span>
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('login', {
          header: () => <span>{tr('Логін і контакти', 'Логин и контакты')}</span>,
          cell: (info) => {
            const m = info.row.original;
            return (
              <div className="space-y-0.5 text-[11px]">
                <div className="font-mono font-bold text-[#0d1f33]">@{m.login}</div>
                {m.email && (
                  <div className="text-slate-600 inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {m.email}
                  </div>
                )}
                {m.phone && (
                  <div className="text-slate-500 inline-flex items-center gap-1 ml-2">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {m.phone}
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('role', {
          header: () => <span>{tr('Роль доступу', 'Роль доступа')}</span>,
          cell: (info) => {
            const meta = ROLE_LABELS[info.getValue()];
            return <Badge variant={meta.variant}>{tr(meta.uk, meta.ru)}</Badge>;
          },
        }),
        columnHelper.accessor('canLogin', {
          header: () => <span>{tr('Вхід у CRM', 'Вход в CRM')}</span>,
          cell: (info) => {
            const m = info.row.original;
            if (!m.active) {
              return <Badge variant="danger">{tr('Вимкнено', 'Отключён')}</Badge>;
            }
            if (!m.canLogin) {
              return <Badge variant="default">{tr('Лише виконавець', 'Только исполнитель')}</Badge>;
            }
            return (
              <div className="flex flex-wrap items-center gap-1">
                {m.hasPassword && (
                  <Badge variant="success" className="gap-1">
                    <KeyRound className="w-3 h-3" />
                    {tr('Пароль', 'Пароль')}
                  </Badge>
                )}
                {m.email && <Badge variant="info">Google</Badge>}
                {!m.hasPassword && !m.email && <Badge variant="warning">{tr('Без пароля', 'Без пароля')}</Badge>}
              </div>
            );
          },
        }),
        columnHelper.display({
          id: 'workload',
          header: () => <span>{tr('Навантаження', 'Нагрузка')}</span>,
          cell: (info) => {
            const w = workloadByLabel.get(info.row.original.assigneeLabel) ?? { deals: 0, openTasks: 0 };
            return (
              <div className="text-[11px] font-mono tabular-nums text-slate-600">
                <span>{tr('Угод', 'Сделок')}: <strong className="text-[#0d1f33]">{w.deals}</strong></span>
                <span className="mx-1.5">·</span>
                <span>{tr('Задач', 'Задач')}: <strong className="text-[#1769aa]">{w.openTasks}</strong></span>
              </div>
            );
          },
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">{tr('Дії')}</span>,
          cell: (info) => {
            const m = info.row.original;
            const isSelf = currentUser?.userId === m.id;
            if (!isAdmin) return null;
            return (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditModal(m)}
                  title={tr('Редагувати профіль і пароль', 'Редактировать профиль и пароль')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-[#1769aa]" />
                  {tr('Змінити', 'Изменить')}
                </button>
                {!isSelf && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(m)}
                      title={m.active ? tr('Деактивувати', 'Деактивировать') : tr('Активувати', 'Активировать')}
                      aria-label={m.active ? tr('Деактивувати співробітника') : tr('Активувати співробітника')}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {m.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5 text-[#169374]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMember(m)}
                      title={tr('Видалити', 'Удалить')}
                      aria-label={`${tr('Видалити', 'Удалить')} ${m.name}`}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          },
        }),
      ]),
    [currentUser?.userId, isAdmin, workloadByLabel],
  );

  const table = useTable({
    features: staffTableFeatures,
    data: filteredStaff,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const activeLoginCount = staff.filter((m) => m.active && m.canLogin).length;
  const activeCount = staff.filter((m) => m.active).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Усього в команді', 'Всего в команде')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#0d1f33] mt-1 tabular-nums">{staff.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Активні виконавці', 'Активные исполнители')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#169374] mt-1 tabular-nums">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Із входом до CRM', 'Со входом в CRM')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#1769aa] mt-1 tabular-nums">{activeLoginCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Адміністратори', 'Администраторы')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#0d1f33] mt-1 tabular-nums">
            {staff.filter((m) => m.role === 'admin' && m.active).length}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Пошук за ім’ям, логіном, посадою...', 'Поиск по имени, логину, должности...')}
              className="pl-8 w-64"
              aria-label={tr('Пошук персоналу', 'Поиск персонала')}
            />
          </div>
          <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                ['all', tr('Усі')],
                ['admin', tr('Адмін', 'Админ')],
                ['manager', tr('Менеджер')],
                ['engineer', tr('Інженер', 'Инженер')],
                ['installer', tr('Монтаж')],
              ] as const
            ).map(([r, label]) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  roleFilter === r ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <Button type="button" variant="primary" onClick={openCreateModal}>
            <Plus className="w-3.5 h-3.5" />
            {tr('Додати співробітника', 'Добавить сотрудника')}
          </Button>
        )}
      </div>

      {actionMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#169374]">
          {actionMsg}
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.id === 'actions' || header.id === 'workload' ? (
                      flexRender(header.column.columnDef.header, header.getContext())
                    ) : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-[#0d1f33] cursor-pointer"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={!row.original.active ? 'opacity-60' : undefined}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredStaff.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            {tr('Співробітників за вибраним фільтром не знайдено', 'Сотрудники по выбранному фильтру не найдены')}
          </div>
        )}
      </Card>

      <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
        <Shield className="w-4 h-4 text-[#1769aa] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0d1f33]">{tr('Як працюють облікові записи та ролі:', 'Как работают учётные записи и роли:')}</strong>{' '}
          {tr(
            'Усі активні співробітники автоматично з’являються у списку відповідальних в угодах і задачах. Якщо увімкнено вхід у CRM, співробітник може авторизуватися за своїм логіном і паролем (або через прив’язаний Google Email). Роль «Адміністратор» відкриває управління персоналом, бекапи БД, Telegram та аналітику.',
            'Все активные сотрудники автоматически появляются в списке ответственных в сделках и задачах. Если включён вход в CRM, сотрудник может входить по личному логину и паролю (или через привязанный Google Email). Роль «Администратор» открывает управление персоналом, бэкапы БД, Telegram и аналитику.',
          )}
        </div>
      </div>

      {/* Create / Edit Staff Account Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMember
                ? tr(`Профіль: ${editingMember.name}`, `Профиль: ${editingMember.name}`)
                : tr('Новий співробітник / акаунт CRM', 'Новый сотрудник / аккаунт CRM')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'Налаштуйте відображення у списку відповідальних, роль та облікові дані для входу',
                'Настройте отображение в списке ответственных, роль и данные для входа',
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMember} className="p-5 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="staff-name" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Ім’я та прізвище *', 'Имя и фамилия *')}
                </label>
                <Input
                  id="staff-name"
                  required
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder={tr('Напр. Андрій Коваленко', 'Напр. Андрей Коваленко')}
                />
              </div>
              <div>
                <label htmlFor="staff-position" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Посада *', 'Должность *')}
                </label>
                <Input
                  id="staff-position"
                  required
                  value={fPosition}
                  onChange={(e) => setFPosition(e.target.value)}
                  placeholder={tr('Менеджер / Інженер / Монтажник', 'Менеджер / Инженер / Монтажник')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="staff-role" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Роль доступу', 'Роль доступа')}
                </label>
                <select
                  id="staff-role"
                  value={fRole}
                  onChange={(e) => setFRole(e.target.value as StaffRole)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                >
                  <option value="admin">{tr('Адміністратор (повний доступ)', 'Администратор (полный доступ)')}</option>
                  <option value="manager">{tr('Менеджер (угоди, задачі, каталог)', 'Менеджер (сделки, задачи, каталог)')}</option>
                  <option value="engineer">{tr('Інженер (угоди, контакти, задачі)', 'Инженер (сделки, контакты, задачи)')}</option>
                  <option value="installer">{tr('Монтаж (угоди та задачі)', 'Монтаж (сделки и задачи)')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="staff-label" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Мітка в задачах і воронці', 'Метка в задачах и воронке')}
                </label>
                <Input
                  id="staff-label"
                  value={fAssigneeLabel}
                  onChange={(e) => setFAssigneeLabel(e.target.value)}
                  placeholder={fName ? `${fName.trim()} (${fPosition.trim().toLowerCase()})` : tr('Автоматично з імені й посади', 'Автоматически из имени и должности')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="staff-login" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Логін для входу *', 'Логин для входа *')}
                </label>
                <Input
                  id="staff-login"
                  required
                  value={fLogin}
                  onChange={(e) => setFLogin(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="andrii"
                  className="font-mono"
                />
              </div>
              <div>
                <label htmlFor="staff-email" className="block font-bold text-[#0d1f33] mb-1">
                  Google / Email
                </label>
                <Input
                  id="staff-email"
                  type="email"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  placeholder="name@gmail.com"
                />
              </div>
              <div>
                <label htmlFor="staff-phone" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Телефон')}
                </label>
                <Input
                  id="staff-phone"
                  value={fPhone}
                  onChange={(e) => setFPhone(e.target.value)}
                  placeholder="+380 50 ..."
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 font-bold text-[#0d1f33] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fActive}
                    onChange={(e) => setFActive(e.target.checked)}
                    className="accent-[#169374]"
                  />
                  {tr('Активний у списках відповідальних', 'Активен в списках ответственных')}
                </label>
                <label className="inline-flex items-center gap-2 font-bold text-[#0d1f33] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fCanLogin}
                    onChange={(e) => setFCanLogin(e.target.checked)}
                    className="accent-[#1769aa]"
                  />
                  {tr('Дозволити вхід до CRM', 'Разрешить вход в CRM')}
                </label>
              </div>

              {fCanLogin && (
                <div>
                  <label htmlFor="staff-password" className="block font-bold text-[#0d1f33] mb-1">
                    {editingMember?.hasPassword
                      ? tr('Новий пароль (залиште порожнім, щоб не змінювати)', 'Новый пароль (оставьте пустым, чтобы не менять)')
                      : tr('Пароль для входу (мін. 6 символів)', 'Пароль для входа (мин. 6 символов)')}
                  </label>
                  <Input
                    id="staff-password"
                    type="password"
                    minLength={fPassword ? 6 : undefined}
                    autoComplete="new-password"
                    value={fPassword}
                    onChange={(e) => {
                      setFPassword(e.target.value);
                      if (e.target.value) setFClearPassword(false);
                    }}
                    placeholder={
                      editingMember?.hasPassword
                        ? '••••••••'
                        : tr('Задайте пароль або залиште порожнім для входу через Google', 'Задайте пароль или оставьте пустым для входа через Google')
                    }
                  />
                  {editingMember?.hasPassword && (
                    <label className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fClearPassword}
                        onChange={(e) => {
                          setFClearPassword(e.target.checked);
                          if (e.target.checked) setFPassword('');
                        }}
                      />
                      {tr('Прибрати вхід за паролем (залишити лише Google Email)', 'Убрать вход по паролю (оставить только Google Email)')}
                    </label>
                  )}
                </div>
              )}
            </div>

            {formErr && (
              <div className="text-xs font-bold text-red-600" role="alert">
                {formErr}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
