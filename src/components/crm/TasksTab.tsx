import { useMemo, useState, type FormEvent } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Calendar, Plus, Trash2 } from 'lucide-react';
import type { Contact, CrmTask, Deal, TaskPriority, TaskStatus } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | TaskStatus>('open');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const [createOpen, setCreateOpen] = useState(false);

  const [tTitle, setTTitle] = useState('');
  const [tContactId, setTContactId] = useState<string>('');
  const [tDealId, setTDealId] = useState<string>('');
  const [tPriority, setTPriority] = useState<TaskPriority>('medium');
  const [tAssignee, setTAssignee] = useState(assignees[0] || 'Олександр (інженер)');
  const [tDueDate, setTDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'open') return t.status !== 'done';
      if (statusFilter !== 'all') return t.status === statusFilter;
      return true;
    });
  }, [tasks, statusFilter]);

  async function handleStatusChange(task: CrmTask, nextStatus: TaskStatus) {
    const resp = await authFetch(`/api/crm/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (resp.ok) {
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
    }
  }

  async function handleDeleteTask(taskId: number) {
    const resp = await authFetch(`/api/crm/tasks/${taskId}`, { method: 'DELETE' });
    if (resp.ok) {
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
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
                className={`h-7 rounded-md border px-2 text-[11px] font-bold cursor-pointer ${
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
                <div className={task.status === 'done' ? 'line-through text-slate-400 font-semibold' : 'font-bold text-[#0d1f33]'}>
                  {task.title}
                </div>
                {(task.contactName || task.dealNumber) && (
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-2">
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
                className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${
                  isOverdue ? 'text-red-600' : isToday ? 'text-amber-700' : 'text-slate-600'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {due}
                {isOverdue && ` (${tr('прострочено', 'просрочено')})`}
                {isToday && ` (${tr('сьогодні', 'сегодня')})`}
              </span>
            );
          },
        }),
        columnHelper.accessor('assignee', {
          header: () => <span>{tr('Відповідальний')}</span>,
          cell: (info) => <span className="text-slate-600">{info.getValue()}</span>,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">{tr('Дії')}</span>,
          cell: (info) => (
            <button
              type="button"
              onClick={() => void handleDeleteTask(info.row.original.id)}
              aria-label={tr('Видалити задачу', 'Удалить задачу')}
              className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ),
        }),
      ]),
    [today],
  );

  const table = useTable({
    features: tasksTableFeatures,
    data: filteredTasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!tTitle.trim()) {
      setErr(tr('Вкажіть назву задачі', 'Укажите название задачи'));
      return;
    }
    setSaving(true);
    try {
      const resp = await authFetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tTitle.trim(),
          contactId: tContactId ? Number(tContactId) : null,
          dealId: tDealId ? Number(tDealId) : null,
          priority: tPriority,
          assignee: tAssignee,
          dueDate: tDueDate,
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setErr(data.error || tr('Не вдалося створити задачу', 'Не удалось создать задачу'));
        return;
      }
      setTTitle('');
      setCreateOpen(false);
      await Promise.all([onRefreshTasks(), onRefreshContacts()]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-lg">
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
              className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                statusFilter === st ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          {tr('Нова задача', 'Новая задача')}
        </Button>
      </div>

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
          <div className="p-8 text-center text-xs text-slate-400">
            {tr('Задач за вибраним статусом немає', 'Задач по выбранному статусу нет')}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('Створити задачу', 'Создать задачу')}</DialogTitle>
            <DialogDescription>
              {tr('Прив’яжіть нагадування до контакту або угоди', 'Привяжите задачу к контакту или сделке')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="p-5 space-y-3">
            <div>
              <label htmlFor="task-title" className="block text-xs font-bold text-[#0d1f33] mb-1">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-contact" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Контакт', 'Контакт')}
                </label>
                <select
                  id="task-contact"
                  value={tContactId}
                  onChange={(e) => setTContactId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
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
                <label htmlFor="task-deal" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Угода', 'Сделка')}
                </label>
                <select
                  id="task-deal"
                  value={tDealId}
                  onChange={(e) => setTDealId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="task-due" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Термін', 'Срок')}
                </label>
                <Input id="task-due" type="date" value={tDueDate} onChange={(e) => setTDueDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="task-prio" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Пріоритет', 'Приоритет')}
                </label>
                <select
                  id="task-prio"
                  value={tPriority}
                  onChange={(e) => setTPriority(e.target.value as TaskPriority)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                >
                  <option value="low">{tr('Низький', 'Низкий')}</option>
                  <option value="medium">{tr('Середній', 'Средний')}</option>
                  <option value="high">{tr('Терміново', 'Срочно')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-assignee" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Відповідальний')}
                </label>
                <select
                  id="task-assignee"
                  value={tAssignee}
                  onChange={(e) => setTAssignee(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                >
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {err && <div className="text-xs font-bold text-red-600">{err}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? tr('Створюємо...', 'Создаём...') : tr('Створити')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
