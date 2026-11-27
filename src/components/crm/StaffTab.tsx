import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNotification } from '@refinedev/core';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import {
  Crown,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { CrmSessionUser, CrmTask, Deal, StaffRole, StaffUser } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { SortDirectionIcon, TablePagination } from './TablePagination.tsx';

interface StaffTabProps {
  staff: StaffUser[];
  currentUser: CrmSessionUser | null;
  deals: Deal[];
  tasks: CrmTask[];
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefreshStaff: () => Promise<void>;
  onRefreshProfile?: () => Promise<void>;
  onRefreshDeals: () => Promise<void>;
  onRefreshTasks: () => Promise<void>;
}

const staffTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
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
  onRefreshProfile,
  onRefreshDeals,
  onRefreshTasks,
}: StaffTabProps) {
  const { open: notify } = useNotification();
  const isAdmin = currentUser?.role === 'admin';
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [actionMsg, setActionMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffUser | null>(null);
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fPosition, setFPosition] = useState('Менеджер');
  const [fRole, setFRole] = useState<StaffRole>('manager');
  const [fAssigneeLabel, setFAssigneeLabel] = useState('');
  const [fCanLogin, setFCanLogin] = useState(true);
  const [fActive, setFActive] = useState(true);
  const [fPassword, setFPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [query, roleFilter]);

  const selfMember = useMemo(
    () => (currentUser?.userId ? staff.find((m) => m.id === currentUser.userId) ?? null : null),
    [staff, currentUser?.userId],
  );

  const editingIsMaster = editingMember?.login === 'admin';
  const editingIsSelfOnly = Boolean(editingMember && !isAdmin && currentUser?.userId === editingMember.id);

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
    if (!isAdmin) return;
    setEditingMember(null);
    setFName('');
    setFEmail('');
    setFPhone('');
    setFPosition('Менеджер');
    setFRole('manager');
    setFAssigneeLabel('');
    setFCanLogin(true);
    setFActive(true);
    setFPassword('');
    setFormErr('');
    setModalOpen(true);
  }

  function openEditModal(m: StaffUser) {
    const isSelf = currentUser?.userId === m.id;
    if (!isAdmin && !isSelf) return;

    setEditingMember(m);
    setFName(m.name);
    setFEmail(m.email);
    setFPhone(m.phone);
    setFPosition(m.position);
    setFRole(m.role);
    setFAssigneeLabel(m.assigneeLabel);
    setFCanLogin(m.canLogin);
    setFActive(m.active);
    setFPassword('');
    setFormErr('');
    setModalOpen(true);
  }

  async function handleSaveMember(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    setActionMsg('');

    if (!editingMember && !isAdmin) {
      setFormErr(tr('Створювати нових користувачів може лише адміністратор', 'Создавать новых пользователей может только администратор'));
      return;
    }

    if (!editingIsSelfOnly && !editingIsMaster && fCanLogin && !fEmail.trim()) {
      setFormErr(
        tr(
          'Щоб користувач міг увійти в CRM, вкажіть його Email',
          'Чтобы пользователь мог войти в CRM, укажите его Email',
        ),
      );
      return;
    }

    if (!editingIsSelfOnly && fPassword.trim() && fPassword.trim().length < 6) {
      setFormErr(tr('Пароль має містити щонайменше 6 символів', 'Пароль должен содержать минимум 6 символов'));
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = editingIsSelfOnly
        ? {
            name: fName.trim(),
            phone: fPhone.trim(),
            position: fPosition.trim(),
            assigneeLabel: fAssigneeLabel.trim(),
          }
        : {
            name: fName.trim(),
            email: fEmail.trim().toLowerCase(),
            phone: fPhone.trim(),
            position: fPosition.trim(),
            role: editingIsMaster ? 'admin' : fRole,
            assigneeLabel: fAssigneeLabel.trim(),
            canLogin: editingIsMaster ? true : fCanLogin,
            active: editingIsMaster ? true : fActive,
            ...(fPassword.trim() ? { password: fPassword.trim() } : {}),
          };

      const url = editingMember ? `/api/crm/staff/${editingMember.id}` : '/api/crm/staff';
      const resp = await authFetch(url, {
        method: editingMember ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { member?: StaffUser; error?: string };
      if (!resp.ok || !data.member) {
        setFormErr(data.error || tr('Не вдалося зберегти користувача', 'Не удалось сохранить пользователя'));
        return;
      }

      setModalOpen(false);
      await Promise.all([
        onRefreshStaff(),
        onRefreshProfile ? onRefreshProfile() : Promise.resolve(),
        onRefreshDeals(),
        onRefreshTasks(),
      ]);
      const successText = editingMember
        ? tr(`Профіль «${data.member.name}» оновлено`, `Профиль «${data.member.name}» обновлён`)
        : tr(`Додано користувача «${data.member.name}» (${data.member.email || data.member.login})`, `Добавлен пользователь «${data.member.name}»`);
      setActionMsg(successText);
      notify?.({ type: 'success', message: successText });
    } catch {
      setFormErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(m: StaffUser) {
    if (!isAdmin) return;
    setActionMsg('');
    try {
      const resp = await authFetch(`/api/crm/staff/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !m.active }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        const errText = data.error || tr('Не вдалося змінити статус', 'Не удалось изменить статус');
        setActionMsg(errText);
        notify?.({ type: 'error', message: errText });
        return;
      }
      await onRefreshStaff();
      notify?.({
        type: 'success',
        message: m.active
          ? tr(`Співробітника «${m.name}» вимкнено`, `Сотрудник «${m.name}» отключён`)
          : tr(`Співробітника «${m.name}» активовано`, `Сотрудник «${m.name}» активирован`),
      });
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  async function handleDeleteMember(m: StaffUser) {
    if (!isAdmin) return;
    setActionMsg('');
    try {
      const resp = await authFetch(`/api/crm/staff/${m.id}`, { method: 'DELETE' });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        const errText = data.error || tr('Не вдалося видалити користувача', 'Не удалось удалить пользователя');
        setActionMsg(errText);
        notify?.({ type: 'error', message: errText });
        return;
      }
      setConfirmDeleteId(null);
      await onRefreshStaff();
      const msgText = tr(`Користувача «${m.name}» видалено`, `Пользователь «${m.name}» удалён`);
      setActionMsg(msgText);
      notify?.({ type: 'success', message: msgText });
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: () => <span>{tr('Співробітник / Посада', 'Сотрудник / Должность')}</span>,
          cell: (info) => {
            const m = info.row.original;
            const isSelf = currentUser?.userId === m.id;
            const isMaster = m.login === 'admin';
            return (
              <div>
                <div className="font-bold text-[15px] text-[#0d1f33] flex flex-wrap items-center gap-2">
                  <span>{m.name}</span>
                  {isMaster && (
                    <Badge variant="dark" className="gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      {tr('Майстер', 'Мастер')}
                    </Badge>
                  )}
                  {isSelf && <Badge variant="info">{tr('Ви', 'Вы')}</Badge>}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {m.position} · <span className="font-mono text-slate-600">{m.assigneeLabel}</span>
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('email', {
          header: () => <span>{tr('Email (Google) і телефон', 'Email (Google) и телефон')}</span>,
          cell: (info) => {
            const m = info.row.original;
            return (
              <div className="space-y-1 text-sm">
                {m.email ? (
                  <div className="font-semibold text-[#0d1f33] inline-flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#1769aa]" />
                    {m.email}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">
                    {m.login === 'admin'
                      ? tr('Майстер-вхід: admin + пароль', 'Мастер-вход: admin + пароль')
                      : tr('Email не прив’язано', 'Email не привязан')}
                  </div>
                )}
                {m.phone && (
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400" />
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
          header: () => <span>{tr('Авторизація в CRM', 'Авторизация в CRM')}</span>,
          cell: (info) => {
            const m = info.row.original;
            if (!m.active) {
              return <Badge variant="danger">{tr('Вимкнено', 'Отключён')}</Badge>;
            }
            if (m.login === 'admin') {
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="dark" className="gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    {tr('Майстер-вхід (admin)', 'Мастер-вход (admin)')}
                  </Badge>
                  {m.email && <Badge variant="info">Google</Badge>}
                </div>
              );
            }
            if (!m.canLogin) {
              return <Badge variant="default">{tr('Без входу (лише виконавець)', 'Без входа (только исполнитель)')}</Badge>;
            }
            return m.email ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="success" className="gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Google
                </Badge>
                {m.hasPassword && (
                  <Badge variant="info" className="gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    {tr('Пароль', 'Пароль')}
                  </Badge>
                )}
              </div>
            ) : (
              <Badge variant="warning">{tr('Потрібен Email', 'Нужен Email')}</Badge>
            );
          },
        }),
        columnHelper.display({
          id: 'workload',
          header: () => <span>{tr('Навантаження', 'Нагрузка')}</span>,
          cell: (info) => {
            const w = workloadByLabel.get(info.row.original.assigneeLabel) ?? { deals: 0, openTasks: 0 };
            return (
              <div className="text-sm font-mono tabular-nums text-slate-600">
                <span>
                  {tr('Угод', 'Сделок')}: <strong className="text-[#0d1f33]">{w.deals}</strong>
                </span>
                <span className="mx-1.5">·</span>
                <span>
                  {tr('Задач', 'Задач')}: <strong className="text-[#1769aa]">{w.openTasks}</strong>
                </span>
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
            const isMaster = m.login === 'admin';
            const canEditThisRow = isAdmin || isSelf;
            if (!canEditThisRow) {
              return (
                <div className="text-right text-sm text-slate-400">
                  {tr('Тільки перегляд', 'Только просмотр')}
                </div>
              );
            }
            return (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(m)}
                  title={
                    isSelf && !isAdmin
                      ? tr('Редагувати свій профіль', 'Редактировать свой профиль')
                      : tr('Редагувати профіль і Email', 'Редактировать профиль и Email')
                  }
                >
                  <Pencil className="w-3.5 h-3.5 text-[#1769aa]" />
                  {isSelf && !isAdmin
                    ? tr('Мій профіль', 'Мой профиль')
                    : !m.email && !isMaster
                      ? tr('Прив’язати Email', 'Привязать Email')
                      : tr('Змінити', 'Изменить')}
                </Button>
                {isAdmin && !isSelf && !isMaster && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleActive(m)}
                      title={m.active ? tr('Деактивувати', 'Деактивировать') : tr('Активувати', 'Активировать')}
                      aria-label={m.active ? tr('Деактивувати користувача') : tr('Активувати користувача')}
                    >
                      {m.active ? <UserX className="w-4 h-4 text-amber-600" /> : <UserCheck className="w-4 h-4 text-[#169374]" />}
                    </Button>
                    {confirmDeleteId === m.id ? (
                      <div className="inline-flex items-center gap-1">
                        <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteMember(m)}>
                          {tr('Так', 'Да')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          {tr('Ні', 'Нет')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDeleteId(m.id)}
                        title={tr('Видалити', 'Удалить')}
                        aria-label={`${tr('Видалити', 'Удалить')} ${m.name}`}
                        className="hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          },
        }),
      ]),
    [currentUser?.userId, isAdmin, workloadByLabel, confirmDeleteId],
  );

  const table = useTable({
    features: staffTableFeatures,
    data: filteredStaff,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const activeGoogleLoginCount = staff.filter((m) => m.active && m.canLogin && Boolean(m.email)).length;
  const activeCount = staff.filter((m) => m.active).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-500">{tr('Усього користувачів', 'Всего пользователей')}</div>
          <div className="font-mono text-3xl font-extrabold text-[#0d1f33] mt-1.5 tabular-nums leading-none">{staff.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-500">{tr('Активні виконавці', 'Активные исполнители')}</div>
          <div className="font-mono text-3xl font-extrabold text-[#169374] mt-1.5 tabular-nums leading-none">{activeCount}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-500">{tr('Прив’язані до Google Email', 'Привязаны к Google Email')}</div>
          <div className="font-mono text-3xl font-extrabold text-[#1769aa] mt-1.5 tabular-nums leading-none">{activeGoogleLoginCount}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-bold text-slate-500">{tr('Адміністратори', 'Администраторы')}</div>
          <div className="font-mono text-3xl font-extrabold text-[#0d1f33] mt-1.5 tabular-nums leading-none">
            {staff.filter((m) => m.role === 'admin' && m.active).length}
          </div>
        </Card>
      </div>

      <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Пошук за ім’ям, Email, посадою...', 'Поиск по имени, Email, должности...')}
              className="pl-10 w-80"
              aria-label={tr('Пошук користувачів', 'Поиск пользователей')}
            />
          </div>
          <div className="inline-flex flex-wrap p-1 bg-slate-100 border border-slate-200 rounded-lg">
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
                className={`px-3.5 py-2 rounded-md text-sm font-bold cursor-pointer transition-colors ${
                  roleFilter === r ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selfMember && (
            <Button type="button" variant="outline" onClick={() => openEditModal(selfMember)}>
              <Pencil className="w-4 h-4 text-[#1769aa]" />
              {tr('Мій профіль', 'Мой профиль')}
            </Button>
          )}
          {isAdmin && (
            <Button type="button" variant="primary" onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              {tr('Додати користувача', 'Добавить пользователя')}
            </Button>
          )}
        </div>
      </Card>

      {actionMsg && (
        <div className="px-5 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[15px] font-semibold text-[#169374]">
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
                        className="inline-flex items-center gap-1.5 hover:text-[#0d1f33] cursor-pointer"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortDirectionIcon sorted={header.column.getIsSorted()} />
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
          <div className="p-12 text-center text-[15px] text-slate-400">
            {tr('Користувачів за вибраним фільтром не знайдено', 'Пользователи по выбранному фильтру не найдены')}
          </div>
        )}
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageCount={table.getPageCount()}
          totalRows={table.getRowCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPreviousPage={() => table.previousPage()}
          onNextPage={() => table.nextPage()}
          onPageIndexChange={(idx) => table.setPageIndex(idx)}
          onPageSizeChange={(size) => table.setPageSize(size)}
          pageSizeOptions={[15, 25, 50]}
        />
      </Card>

      <div className="px-5 py-4 rounded-xl bg-white/95 border border-slate-200 text-sm text-slate-600 flex items-start gap-3">
        <Shield className="w-4.5 h-4.5 text-[#1769aa] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0d1f33]">{tr('Як працює вхід за Email:', 'Как работает вход по Email:')}</strong>{' '}
          {isAdmin
            ? tr(
                'Створюйте користувачів із прив’язкою до Email — вони можуть входити через Google або за Email та паролем (якщо задасте пароль у профілі співробітника). Майстер-акаунт admin налаштовується при першому вході.',
                'Создавайте пользователей с привязкой к Email — они могут входить через Google или по Email и паролю (если зададите пароль в профиле сотрудника). Мастер-аккаунт admin настраивается при первом входе.',
              )
            : tr(
                'Ви входите у CRM за своїм Email і можете редагувати лише власний профіль (ім’я, посаду, телефон). Додавання користувачів і зміна прав доступні тільки адміністратору.',
                'Вы входите в CRM по своему Email и можете редактировать только собственный профиль (имя, должность, телефон). Добавление пользователей и смена прав доступны только администратору.',
              )}
        </div>
      </div>

      {/* Create / Edit Staff Account Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingMember
                ? editingIsSelfOnly
                  ? tr(`Мій профіль: ${editingMember.name}`, `Мой профиль: ${editingMember.name}`)
                  : tr(`Профіль: ${editingMember.name}`, `Профиль: ${editingMember.name}`)
                : tr('Новий користувач CRM', 'Новый пользователь CRM')}
            </DialogTitle>
            <DialogDescription>
              {editingIsSelfOnly
                ? tr(
                    'Ви можете оновити свої контактні дані та відображення у задачах',
                    'Вы можете обновить свои контактные данные и отображение в задачах',
                  )
                : tr(
                    'Прив’яжіть Google Email для входу в CRM та вкажіть роль користувача',
                    'Привяжите Google Email для входа в CRM и выберите роль пользователя',
                  )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMember} className="p-7 space-y-5 text-[15px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="staff-name" className="block text-sm font-bold text-[#0d1f33] mb-2">
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
                <label htmlFor="staff-position" className="block text-sm font-bold text-[#0d1f33] mb-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="staff-email" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Email (Google акаунт)', 'Email (Google аккаунт)')}
                  {fCanLogin && !editingIsMaster ? ' *' : ''}
                </label>
                <Input
                  id="staff-email"
                  type="email"
                  required={fCanLogin && !editingIsMaster && isAdmin}
                  disabled={!isAdmin}
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="staff-phone" className="block text-sm font-bold text-[#0d1f33] mb-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="staff-role" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Роль доступу', 'Роль доступа')}
                </label>
                <select
                  id="staff-role"
                  value={fRole}
                  disabled={!isAdmin || editingIsMaster}
                  onChange={(e) => setFRole(e.target.value as StaffRole)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="admin">{tr('Адміністратор (повний доступ)', 'Администратор (полный доступ)')}</option>
                  <option value="manager">{tr('Менеджер (угоди, задачі, каталог)', 'Менеджер (сделки, задачи, каталог)')}</option>
                  <option value="engineer">{tr('Інженер (угоди, контакти, задачі)', 'Инженер (сделки, контакты, задачи)')}</option>
                  <option value="installer">{tr('Монтаж (угоди та задачі)', 'Монтаж (сделки и задачи)')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="staff-label" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Мітка в задачах і воронці', 'Метка в задачах и воронке')}
                </label>
                <Input
                  id="staff-label"
                  value={fAssigneeLabel}
                  onChange={(e) => setFAssigneeLabel(e.target.value)}
                  placeholder={
                    fName ? `${fName.trim()} (${fPosition.trim().toLowerCase()})` : tr('Автоматично з імені й посади', 'Автоматически из имени и должности')
                  }
                />
              </div>
            </div>

            {isAdmin && !editingIsMaster && (
              <div>
                <label htmlFor="staff-password" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {editingMember?.hasPassword
                    ? tr('Новий пароль (опціонально, залиште порожнім щоб не змінювати)', 'Новый пароль (опционально, оставьте пустым чтобы не менять)')
                    : tr('Пароль для входу по Email (опціонально, мін. 6 символів)', 'Пароль для входа по Email (опционально, мин. 6 символов)')}
                </label>
                <Input
                  id="staff-password"
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  value={fPassword}
                  onChange={(e) => setFPassword(e.target.value)}
                  placeholder={tr('Необов’язково, якщо співробітник входить через Google', 'Необязательно, если сотрудник входит через Google')}
                />
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-[15px]">
              {isAdmin && !editingIsMaster ? (
                <div className="flex flex-wrap items-center gap-5">
                  <label className="inline-flex items-center gap-2 font-bold text-[#0d1f33] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fActive}
                      onChange={(e) => setFActive(e.target.checked)}
                      className="w-4.5 h-4.5 accent-[#169374]"
                    />
                    {tr('Активний у списках відповідальних', 'Активен в списках ответственных')}
                  </label>
                  <label className="inline-flex items-center gap-2 font-bold text-[#0d1f33] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fCanLogin}
                      onChange={(e) => setFCanLogin(e.target.checked)}
                      className="w-4.5 h-4.5 accent-[#1769aa]"
                    />
                    {tr('Дозволити вхід у CRM за Email', 'Разрешить вход в CRM по Email')}
                  </label>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  {editingIsMaster
                    ? tr(
                        'Майстер-акаунт admin може входити за паролем, заданим при налаштуванні, або за прив’язаним Google Email.',
                        'Мастер-аккаунт admin может входить по паролю, заданному при настройке, или по привязанному Google Email.',
                      )
                    : tr(
                        'Email для входу, роль і права доступу може змінювати лише адміністратор.',
                        'Email для входа, роль и права доступа может изменять только администратор.',
                      )}
                </div>
              )}
            </div>

            {formErr && (
              <div className="text-[15px] font-bold text-red-600" role="alert">
                {formErr}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
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
