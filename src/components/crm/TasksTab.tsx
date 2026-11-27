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
  sortFn_datetime,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Calendar, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Contact, CrmTask, Deal, TaskPriority, TaskStatus } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { SortDirectionIcon, TablePagination } from './TablePagination.tsx';

interface TasksTabProps {
  tasks: CrmTask[];
  contacts: Contact[];
  deals: Deal[];
  assignees: string[];
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefreshTasks: () => Promise<void>;
  onRefreshContacts: () => Promise<void>;
}

const tasksTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

const columnHelper = createColumnHelper<typeof tasksTableFeatures, CrmTask>();

export function TasksTab({
  tasks,
  contacts,
  deals,
  assignees,
  authFetch,
  onRefreshTasks,
  onRefreshContacts,
}: TasksTabProps) {
  const { open: notify } = useNotification();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | TaskStatus>('open');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tStatus, setTStatus] = useState<TaskStatus>('todo');
  const [tContactId, setTContactId] = useState<string>('');
  const [tDealId, setTDealId] = useState<string>('');
  const [tPriority, setTPriority] = useState<TaskPriority>('medium');
  const [tAssignee, setTAssignee] = useState(assignees[0] || 'Олександр (інженер)');
  const [tDueDate, setTDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!editingTask && assignees.length > 0 && (!tAssignee || !assignees.includes(tAssignee))) {
      setTAssignee(assignees[0]);
    }
  }, [assignees, tAssignee, editingTask]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [query, statusFilter, assigneeFilter]);

  const today = new Date().toISOString().slice(0, 10);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
      if (statusFilter === 'open' && t.status === 'done') return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.contactName || '').toLowerCase().includes(q) ||
        (t.dealNumber || '').toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, statusFilter, assigneeFilter]);

  function openCreateModal() {
    setEditingTask(null);
    setTTitle('');
    setTStatus('todo');
    setTContactId('');
    setTDealId('');
    setTPriority('medium');
    setTAssignee(assignees[0] || 'Олександр (інженер)');
    setTDueDate(new Date().toISOString().slice(0, 10));
    setErr('');
    setModalOpen(true);
  }

  function openEditModal(task: CrmTask) {
    setEditingTask(task);
    setTTitle(task.title);
    setTStatus(task.status);
    setTContactId(task.contactId ? String(task.contactId) : '');
    setTDealId(task.dealId ? String(task.dealId) : '');
    setTPriority(task.priority);
    setTAssignee(task.assignee || assignees[0] || 'Олександр (інженер)');
    setTDueDate(task.dueDate || '');
    setErr('');
    setModalOpen(true);
  }

  async function handleStatusChange(task: CrmTask, nextStatus: TaskStatus) {
    try {
      const resp = await authFetch(`/api/crm/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        notify?.({
          type: 'error',
          message: tr('Не вдалося оновити статус задачі', 'Не удалось обновить статус задачи'),
          description: data.error,
        });
        return;
      }
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
      notify?.({
        type: 'success',
        message: tr('Статус задачі оновлено', 'Статус задачи обновлён'),
      });
    } catch {
      notify?.({
        type: 'error',
        message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'),
      });
    }
  }

  async function handleDeleteTask(task: CrmTask) {
    try {
      const resp = await authFetch(`/api/crm/tasks/${task.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        notify?.({
          type: 'error',
          message: tr('Не вдалося видалити задачу', 'Не удалось удалить задачу'),
          description: data.error,
        });
        return;
      }
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
      notify?.({
        type: 'success',
        message: tr(`Задачу «${task.title}» видалено`, `Задача «${task.title}» удалена`),
      });
    } catch {
      notify?.({
        type: 'error',
        message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'),
      });
    }
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('status', {
          header: () => <span>{tr('Статус', 'Статус')}</span>,
          cell: (info) => {
            const task = info.row.original;
            return (
              <select
                value={task.status}
                aria-label={`${tr('Статус задачі', 'Статус задачи')}: ${task.title}`}
                onChange={(e) => void handleStatusChange(task, e.target.value as TaskStatus)}
                className={`h-10 rounded-lg border px-3 text-sm font-bold cursor-pointer ${
                  task.status === 'done'
                    ? 'border-emerald-200 bg-emerald-50 text-[#169374]'
                    : task.status === 'in_progress'
                      ? 'border-sky-200 bg-sky-50 text-[#1769aa]'
                      : 'border-slate-200 bg-white text-[#0d1f33]'
                }`}
              >
                <option value="todo">{tr('До виконання', 'К выполнению')}</option>
                <option value="in_progress">{tr('У роботі', 'В работе')}</option>
                <option value="done">{tr('Виконано')}</option>
              </select>
            );
          },
        }),
        columnHelper.accessor('title', {
          header: () => <span>{tr('Задача', 'Задача')}</span>,
          cell: (info) => {
            const task = info.row.original;
            return (
              <div>
                <div
                  className={
                    task.status === 'done'
                      ? 'line-through text-slate-400 font-semibold text-[15px]'
                      : 'font-bold text-[#0d1f33] text-[15px]'
                  }
                >
                  {task.title}
                </div>
                {(task.contactName || task.dealNumber) && (
                  <div className="text-sm text-slate-500 mt-0.5 flex flex-wrap gap-2">
                    {task.contactName && <span>{task.contactName}</span>}
                    {task.dealNumber && <span className="font-mono text-[#1769aa]">{task.dealNumber}</span>}
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('priority', {
          header: () => <span>{tr('Пріоритет', 'Приоритет')}</span>,
          cell: (info) => {
            const p = info.getValue();
            return (
              <Badge variant={p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'default'}>
                {p === 'high' ? tr('Терміново', 'Срочно') : p === 'medium' ? tr('Середній', 'Средний') : tr('Низький', 'Низкий')}
              </Badge>
            );
          },
        }),
        columnHelper.accessor('dueDate', {
          header: () => <span>{tr('Термін', 'Срок')}</span>,
          cell: (info) => {
            const due = info.getValue();
            const done = info.row.original.status === 'done';
            if (!due) return <span className="text-slate-400">—</span>;
            const isOverdue = !done && due < today;
            const isToday = !done && due === today;
            return (
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${
                  isOverdue ? 'text-red-600' : isToday ? 'text-amber-700' : 'text-slate-600'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {due}
                {isOverdue && ` (${tr('прострочено', 'просрочено')})`}
                {isToday && ` (${tr('сьогодні', 'сегодня')})`}
              </span>
            );
          },
        }),
        columnHelper.accessor('assignee', {
          header: () => <span>{tr('Відповідальний')}</span>,
          cell: (info) => <span className="text-[15px] text-slate-700">{info.getValue()}</span>,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">{tr('Дії')}</span>,
          cell: (info) => {
            const task = info.row.original;
            return (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(task)}
                  aria-label={`${tr('Редагувати задачу', 'Редактировать задачу')}: ${task.title}`}
                >
                  <Pencil className="w-3.5 h-3.5 text-[#1769aa]" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDeleteTask(task)}
                  aria-label={`${tr('Видалити задачу', 'Удалить задачу')}: ${task.title}`}
                  className="hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [today],
  );

  const table = useTable({
    features: tasksTableFeatures,
    data: filteredTasks,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  async function handleSaveTask(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!tTitle.trim()) {
      setErr(tr('Вкажіть назву задачі', 'Укажите название задачи'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: tTitle.trim(),
        status: tStatus,
        contactId: tContactId ? Number(tContactId) : null,
        dealId: tDealId ? Number(tDealId) : null,
        priority: tPriority,
        assignee: tAssignee,
        dueDate: tDueDate,
      };
      const url = editingTask ? `/api/crm/tasks/${editingTask.id}` : '/api/crm/tasks';
      const resp = await authFetch(url, {
        method: editingTask ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setErr(data.error || tr('Не вдалося зберегти задачу', 'Не удалось сохранить задачу'));
        return;
      }
      setModalOpen(false);
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
      notify?.({
        type: 'success',
        message: editingTask
          ? tr('Задачу оновлено', 'Задача обновлена')
          : tr('Нову задачу створено', 'Новая задача создана'),
      });
    } catch {
      setErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Пошук задачі, клієнта, угоди...', 'Поиск задачи, клиента, сделки...')}
              className="pl-10 w-full"
              aria-label={tr('Пошук задач', 'Поиск задач')}
            />
          </div>

          <div className="inline-flex flex-wrap p-1 bg-slate-100 border border-slate-200 rounded-lg">
            {(
              [
                ['open', `${tr('Активні', 'Активные')} (${tasks.filter((t) => t.status !== 'done').length})`],
                ['todo', tr('До виконання', 'К выполнению')],
                ['in_progress', tr('У роботі', 'В работе')],
                ['done', tr('Виконано')],
                ['all', tr('Усі')],
              ] as const
            ).map(([st, label]) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-2 rounded-md text-sm font-bold cursor-pointer transition-colors ${
                  statusFilter === st ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label={tr('Фільтр за відповідальним', 'Фильтр по ответственному')}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] font-semibold text-[#0d1f33]"
          >
            <option value="all">{tr('Усі відповідальні', 'Все ответственные')}</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <Button type="button" variant="primary" onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          {tr('Нова задача', 'Новая задача')}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.id === 'actions' ? null : (
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
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredTasks.length === 0 && (
          <div className="p-12 text-center text-[15px] text-slate-400">
            {tr('Задач за вибраним статусом немає', 'Задач по выбранному статусу нет')}
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
          pageSizeOptions={[15, 25, 50, 100]}
        />
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? tr('Редагувати задачу', 'Редактировать задачу') : tr('Створити задачу', 'Создать задачу')}
            </DialogTitle>
            <DialogDescription>
              {tr('Прив’яжіть нагадування до контакту або угоди', 'Привяжите задачу к контакту или сделке')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTask} className="p-7 space-y-5 text-[15px]">
            <div>
              <label htmlFor="task-title" className="block text-sm font-bold text-[#0d1f33] mb-2">
                {tr('Що потрібно зробити *', 'Что нужно сделать *')}
              </label>
              <Input
                id="task-title"
                required
                value={tTitle}
                onChange={(e) => setTTitle(e.target.value)}
                placeholder={tr('Передзвонити клієнту щодо щита 380 В...', 'Перезвонить клиенту...')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="task-contact" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Контакт', 'Контакт')}
                </label>
                <select
                  id="task-contact"
                  value={tContactId}
                  onChange={(e) => setTContactId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px]"
                >
                  <option value="">—</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-deal" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Угода', 'Сделка')}
                </label>
                <select
                  id="task-deal"
                  value={tDealId}
                  onChange={(e) => setTDealId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px]"
                >
                  <option value="">—</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dealNumber} · {d.customerName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="task-due" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Термін', 'Срок')}
                </label>
                <Input id="task-due" type="date" value={tDueDate} onChange={(e) => setTDueDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="task-prio" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Пріоритет', 'Приоритет')}
                </label>
                <select
                  id="task-prio"
                  value={tPriority}
                  onChange={(e) => setTPriority(e.target.value as TaskPriority)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] font-semibold"
                >
                  <option value="low">{tr('Низький', 'Низкий')}</option>
                  <option value="medium">{tr('Середній', 'Средний')}</option>
                  <option value="high">{tr('Терміново', 'Срочно')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-assignee" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Відповідальний')}
                </label>
                <select
                  id="task-assignee"
                  value={tAssignee}
                  onChange={(e) => setTAssignee(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px]"
                >
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editingTask && (
              <div>
                <label htmlFor="task-status" className="block text-sm font-bold text-[#0d1f33] mb-2">
                  {tr('Статус')}
                </label>
                <select
                  id="task-status"
                  value={tStatus}
                  onChange={(e) => setTStatus(e.target.value as TaskStatus)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] font-semibold"
                >
                  <option value="todo">{tr('До виконання', 'К выполнению')}</option>
                  <option value="in_progress">{tr('У роботі', 'В работе')}</option>
                  <option value="done">{tr('Виконано')}</option>
                </select>
              </div>
            )}
            {err && <div className="text-[15px] font-bold text-red-600">{err}</div>}
            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? tr('Зберігаємо...', 'Сохраняем...')
                  : editingTask
                    ? tr('Зберегти зміни', 'Сохранить изменения')
                    : tr('Створити')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
