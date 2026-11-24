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
import {
  ArrowUpDown,
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
  const isAdmin = currentUser?.role === 'admin';
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [actionMsg, setActionMsg] = useState('');

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
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

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
          'Щоб користувач міг увійти через Google, вкажіть його Email',
          'Чтобы пользователь мог войти через Google, укажите его Email',
        ),
      );
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
      setActionMsg(
        editingMember
          ? tr(`Профіль «${data.member.name}» оновлено`, `Профиль «${data.member.name}» обновлён`)
          : tr(`Додано користувача «${data.member.name}» (${data.member.email || data.member.login})`, `Добавлен пользователь «${data.member.name}»`),
      );
    } catch {
      setFormErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(m: StaffUser) {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setActionMsg('');
    const resp = await authFetch(`/api/crm/staff/${m.id}`, { method: 'DELETE' });
    const data = (await resp.json()) as { error?: string };
    if (!resp.ok) {
      setActionMsg(data.error || tr('Не вдалося видалити користувача', 'Не удалось удалить пользователя'));
      return;
    }
    await onRefreshStaff();
    setActionMsg(tr(`Користувача «${m.name}» видалено`, `Пользователь «${m.name}» удалён`));
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
                <div className="font-bold text-[#0d1f33] flex flex-wrap items-center gap-1.5">
                  <span>{m.name}</span>
                  {isMaster && (
                    <Badge variant="dark" className="gap-1">
                      <Crown className="w-3 h-3 text-amber-400" />
                      {tr('Майстер', 'Мастер')}
                    </Badge>
                  )}
                  {isSelf && <Badge variant="info">{tr('Ви', 'Вы')}</Badge>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
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
              <div className="space-y-0.5 text-[11px]">
                {m.email ? (
                  <div className="font-semibold text-[#0d1f33] inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#1769aa]" />
                    {m.email}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">
                    {m.login === 'admin'
                      ? tr('Вхід через ADMIN_LOGIN + ADMIN_PASSWORD', 'Вход через ADMIN_LOGIN + ADMIN_PASSWORD')
                      : tr('Email не прив’язано', 'Email не привязан')}
                  </div>
                )}
                {m.phone && (
                  <div className="text-slate-500 flex items-center gap-1">
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
          header: () => <span>{tr('Авторизація в CRM', 'Авторизация в CRM')}</span>,
          cell: (info) => {
            const m = info.row.original;
            if (!m.active) {
              return <Badge variant="danger">{tr('Вимкнено', 'Отключён')}</Badge>;
            }
            if (m.login === 'admin') {
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="dark" className="gap-1">
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    {tr('Майстер-вхід (ENV)', 'Мастер-вход (ENV)')}
                  </Badge>
                  {m.email && <Badge variant="info">Google</Badge>}
                </div>
              );
            }
            if (!m.canLogin) {
              return <Badge variant="default">{tr('Без входу (лише виконавець)', 'Без входа (только исполнитель)')}</Badge>;
            }
            return m.email ? (
              <Badge variant="success" className="gap-1">
                <Mail className="w-3 h-3" />
                {tr('Google за Email', 'Google по Email')}
              </Badge>
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
              <div className="text-[11px] font-mono tabular-nums text-slate-600">
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
                <div className="text-right text-[11px] text-slate-400">
                  {tr('Тільки перегляд', 'Только просмотр')}
                </div>
              );
            }
            return (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditModal(m)}
                  title={
                    isSelf && !isAdmin
                      ? tr('Редагувати свій профіль', 'Редактировать свой профиль')
                      : tr('Редагувати профіль і Email', 'Редактировать профиль и Email')
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-[#1769aa]" />
                  {isSelf && !isAdmin
                    ? tr('Мій профіль', 'Мой профиль')
                    : !m.email && !isMaster
                      ? tr('Прив’язати Email', 'Привязать Email')
                      : tr('Змінити', 'Изменить')}
                </button>
                {isAdmin && !isSelf && !isMaster && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(m)}
                      title={m.active ? tr('Деактивувати', 'Деактивировать') : tr('Активувати', 'Активировать')}
                      aria-label={m.active ? tr('Деактивувати користувача') : tr('Активувати користувача')}
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

  const activeGoogleLoginCount = staff.filter((m) => m.active && m.canLogin && Boolean(m.email)).length;
  const activeCount = staff.filter((m) => m.active).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Усього користувачів', 'Всего пользователей')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#0d1f33] mt-1 tabular-nums">{staff.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Активні виконавці', 'Активные исполнители')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#169374] mt-1 tabular-nums">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold text-slate-500">{tr('Прив’язані до Google Email', 'Привязаны к Google Email')}</div>
          <div className="font-mono text-2xl font-extrabold text-[#1769aa] mt-1 tabular-nums">{activeGoogleLoginCount}</div>
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
              placeholder={tr('Пошук за ім’ям, Email, посадою...', 'Поиск по имени, Email, должности...')}
              className="pl-8 w-64"
              aria-label={tr('Пошук користувачів', 'Поиск пользователей')}
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

        <div className="flex flex-wrap items-center gap-2">
          {selfMember && (
            <Button type="button" variant="outline" onClick={() => openEditModal(selfMember)}>
              <Pencil className="w-3.5 h-3.5 text-[#1769aa]" />
              {tr('Мій профіль', 'Мой профиль')}
            </Button>
          )}
          {isAdmin && (
            <Button type="button" variant="primary" onClick={openCreateModal}>
              <Plus className="w-3.5 h-3.5" />
              {tr('Додати користувача', 'Добавить пользователя')}
            </Button>
          )}
        </div>
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
            {tr('Користувачів за вибраним фільтром не знайдено', 'Пользователи по выбранному фильтру не найдены')}
          </div>
        )}
      </Card>

      <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
        <Shield className="w-4 h-4 text-[#1769aa] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0d1f33]">{tr('Як працює вхід за Email:', 'Как работает вход по Email:')}</strong>{' '}
          {isAdmin
            ? tr(
                'Ви маєте повний доступ адміністратора: створюйте користувачів і прив’язуйте їхній Google Email — після цього вони входять у CRM через кнопку Google без окремих паролів. Майстер-логін та пароль адміністратора беруться з налаштувань оточення (ADMIN_LOGIN, ADMIN_PASSWORD).',
                'У вас полный доступ администратора: создавайте пользователей и привязывайте их Google Email — после этого они входят в CRM через кнопку Google без отдельных паролей. Мастер-логин и пароль администратора задаются через переменные окружения (ADMIN_LOGIN, ADMIN_PASSWORD).',
              )
            : tr(
                'Користувачі входять у CRM через Google за своїм Email та можуть редагувати лише власний профіль (ім’я, посаду, телефон). Додавання користувачів і зміна прав доступні тільки адміністратору.',
                'Пользователи входят в CRM через Google по своему Email и могут редактировать только собственный профиль (имя, должность, телефон). Добавление пользователей и смена прав доступны только администратору.',
              )}
        </div>
      </div>

      {/* Create / Edit Staff Account Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
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
                <label htmlFor="staff-email" className="block font-bold text-[#0d1f33] mb-1">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="staff-role" className="block font-bold text-[#0d1f33] mb-1">
                  {tr('Роль доступу', 'Роль доступа')}
                </label>
                <select
                  id="staff-role"
                  value={fRole}
                  disabled={!isAdmin || editingIsMaster}
                  onChange={(e) => setFRole(e.target.value as StaffRole)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
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
                  placeholder={
                    fName ? `${fName.trim()} (${fPosition.trim().toLowerCase()})` : tr('Автоматично з імені й посади', 'Автоматически из имени и должности')
                  }
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              {isAdmin && !editingIsMaster ? (
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
                    {tr('Дозволити вхід через Google за Email', 'Разрешить вход через Google по Email')}
                  </label>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  {editingIsMaster
                    ? tr(
                        'Майстер-логін та пароль адміністратора задаються у змінних оточення ADMIN_LOGIN та ADMIN_PASSWORD.',
                        'Мастер-логин и пароль администратора задаются в переменных окружения ADMIN_LOGIN и ADMIN_PASSWORD.',
                      )
                    : tr(
                        'Email для входу через Google, роль і права доступу може змінювати лише адміністратор.',
                        'Email для входа через Google, роль и права доступа может изменять только администратор.',
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
