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
import { ArrowUpDown, Building2, CheckSquare, Mail, MessageSquarePlus, Phone, Plus, Search, Trash2, User } from 'lucide-react';
import type { Contact, ContactSegment, CrmNote, CrmTask, Deal, TaskPriority } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { formatUaPhone } from '../../lib/leadForm.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';

interface ContactsTabProps {
  contacts: Contact[];
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefreshContacts: () => Promise<void>;
  onRefreshTasks: () => Promise<void>;
  onOpenDeal: (deal: Deal) => void;
}

interface ContactDetailState {
  contact: Contact;
  deals: Deal[];
  tasks: CrmTask[];
  notes: CrmNote[];
}

const contactsTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

const columnHelper = createColumnHelper<typeof contactsTableFeatures, Contact>();

export function ContactsTab({
  contacts,
  authFetch,
  onRefreshContacts,
  onRefreshTasks,
  onOpenDeal,
}: ContactsTabProps) {
  const [query, setQuery] = useState('');
  const [segFilter, setSegFilter] = useState<'all' | ContactSegment>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [cName, setCName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCity, setCCity] = useState('Одеса');
  const [cChannel, setCChannel] = useState('Telegram');
  const [cSegment, setCSegment] = useState<ContactSegment>('b2c');
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<ContactDetailState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (segFilter !== 'all' && c.segment !== segFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [contacts, query, segFilter]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: () => <span>{tr('Контакт / Компанія', 'Контакт / Компания')}</span>,
          cell: (info) => {
            const c = info.row.original;
            return (
              <div>
                <div className="font-bold text-[#0d1f33]">{c.name}</div>
                {c.company && (
                  <div className="text-[11px] text-slate-500 inline-flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" />
                    {c.company}
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('phone', {
          header: () => <span>{tr('Телефон')}</span>,
          cell: (info) => <span className="font-mono font-semibold text-[#0d1f33]">{info.getValue()}</span>,
        }),
        columnHelper.accessor('segment', {
          header: () => <span>{tr('Сегмент', 'Сегмент')}</span>,
          cell: (info) =>
            info.getValue() === 'b2b' ? (
              <Badge variant="dark">B2B</Badge>
            ) : (
              <Badge variant="info">B2C</Badge>
            ),
        }),
        columnHelper.accessor('city', {
          header: () => <span>{tr('Місто')}</span>,
          cell: (info) => <span className="text-slate-600">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => row.dealsCount ?? 0, {
          id: 'dealsCount',
          header: () => <span>{tr('Угоди', 'Сделки')}</span>,
          cell: (info) => <span className="font-mono font-bold tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => row.totalUsd ?? 0, {
          id: 'totalUsd',
          header: () => <span>{tr('Сума')}</span>,
          cell: (info) => (
            <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
              {info.getValue() > 0 ? `$${info.getValue().toLocaleString('uk-UA')}` : '—'}
            </span>
          ),
        }),
        columnHelper.accessor((row) => row.openTasksCount ?? 0, {
          id: 'openTasksCount',
          header: () => <span>{tr('Задачі', 'Задачи')}</span>,
          cell: (info) => {
            const val = info.getValue();
            return val > 0 ? (
              <Badge variant="warning">{val}</Badge>
            ) : (
              <span className="text-slate-400">0</span>
            );
          },
        }),
        columnHelper.accessor('updatedAt', {
          header: () => <span>{tr('Оновлено', 'Обновлено')}</span>,
          cell: (info) => (
            <span className="text-slate-500 whitespace-nowrap">
              {new Date(info.getValue()).toLocaleDateString('uk-UA')}
            </span>
          ),
        }),
      ]),
    [],
  );

  const table = useTable({
    features: contactsTableFeatures,
    data: filteredContacts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  function openNewContact() {
    setEditingContactId(null);
    setCName('');
    setCCompany('');
    setCPhone('');
    setCEmail('');
    setCCity('Одеса');
    setCChannel('Telegram');
    setCSegment('b2c');
    setFormErr('');
    setFormOpen(true);
  }

  function openEditContact(c: Contact) {
    setEditingContactId(c.id);
    setCName(c.name);
    setCCompany(c.company);
    setCPhone(c.phone);
    setCEmail(c.email);
    setCCity(c.city);
    setCChannel(c.channel);
    setCSegment(c.segment);
    setFormErr('');
    setFormOpen(true);
  }

  async function openContactDetail(id: number) {
    setLoadingDetail(true);
    try {
      const resp = await authFetch(`/api/crm/contacts/${id}`);
      if (resp.ok) {
        const data = (await resp.json()) as ContactDetailState;
        setDetail(data);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    setSaving(true);
    try {
      const payload = {
        name: cName.trim(),
        company: cCompany.trim(),
        phone: cPhone.trim(),
        email: cEmail.trim(),
        city: cCity.trim(),
        channel: cChannel.trim(),
        segment: cSegment,
      };
      const url = editingContactId ? `/api/crm/contacts/${editingContactId}` : '/api/crm/contacts';
      const resp = await authFetch(url, {
        method: editingContactId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { contact?: Contact; error?: string };
      if (!resp.ok || !data.contact) {
        setFormErr(data.error || tr('Помилка збереження контакту', 'Ошибка сохранения контакта'));
        return;
      }
      setFormOpen(false);
      await onRefreshContacts();
      if (detail && detail.contact.id === data.contact.id) {
        await openContactDetail(data.contact.id);
      }
    } catch {
      setFormErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!detail || !newNoteBody.trim()) return;
    const resp = await authFetch('/api/crm/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: detail.contact.id, body: newNoteBody.trim() }),
    });
    if (resp.ok) {
      setNewNoteBody('');
      await openContactDetail(detail.contact.id);
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!detail) return;
    const resp = await authFetch(`/api/crm/notes/${noteId}`, { method: 'DELETE' });
    if (resp.ok) {
      await openContactDetail(detail.contact.id);
    }
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!detail || !newTaskTitle.trim()) return;
    const resp = await authFetch('/api/crm/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: detail.contact.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        dueDate: newTaskDue,
      }),
    });
    if (resp.ok) {
      setNewTaskTitle('');
      setNewTaskDue('');
      await Promise.all([openContactDetail(detail.contact.id), onRefreshTasks(), onRefreshContacts()]);
    }
  }

  async function handleToggleTaskDone(task: CrmTask) {
    if (!detail) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    const resp = await authFetch(`/api/crm/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (resp.ok) {
      await Promise.all([openContactDetail(detail.contact.id), onRefreshTasks(), onRefreshContacts()]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Пошук за ім’ям, телефоном, компанією...', 'Поиск по имени, телефону, компании…')}
              className="pl-8 w-64"
              aria-label={tr('Пошук контактів', 'Поиск контактов')}
            />
          </div>
          <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                ['all', `${tr('Усі')} (${contacts.length})`],
                ['b2c', 'B2C'],
                ['b2b', 'B2B'],
              ] as const
            ).map(([seg, label]) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegFilter(seg)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  segFilter === seg ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button type="button" variant="primary" onClick={openNewContact}>
          <Plus className="w-3.5 h-3.5" />
          {tr('Новий контакт', 'Новый контакт')}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => void openContactDetail(row.original.id)}
                className="cursor-pointer"
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredContacts.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            {tr('Контактів за вибраним фільтром не знайдено', 'Контакты по фильтру не найдены')}
          </div>
        )}
      </Card>

      {/* Contact Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingContactId ? tr('Редагувати контакт', 'Редактировать контакт') : tr('Додати контакт', 'Добавить контакт')}
            </DialogTitle>
            <DialogDescription>
              {tr('Клієнт прив’язується до угод і задач за номером телефону', 'Клиент связывается со сделками и задачами по телефону')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveContact} className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Ім’я *', 'Имя *')}
                </label>
                <Input id="contact-name" required value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="contact-phone" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Телефон *', 'Телефон *')}
                </label>
                <Input
                  id="contact-phone"
                  required
                  value={cPhone}
                  onChange={(e) => setCPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 XX XXX XX XX"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="contact-company" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Компанія / Об’єкт', 'Компания / Объект')}
                </label>
                <Input id="contact-company" value={cCompany} onChange={(e) => setCCompany(e.target.value)} />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  Email
                </label>
                <Input id="contact-email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="contact-city" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Місто')}
                </label>
                <Input id="contact-city" value={cCity} onChange={(e) => setCCity(e.target.value)} />
              </div>
              <div>
                <label htmlFor="contact-channel" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Канал зв’язку')}
                </label>
                <select
                  id="contact-channel"
                  value={cChannel}
                  onChange={(e) => setCChannel(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="Viber">Viber</option>
                  <option value="Телефон">{tr('Дзвінок')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-segment" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Сегмент', 'Сегмент')}
                </label>
                <select
                  id="contact-segment"
                  value={cSegment}
                  onChange={(e) => setCSegment(e.target.value as ContactSegment)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold"
                >
                  <option value="b2c">B2C ({tr('Дім')})</option>
                  <option value="b2b">B2B ({tr('Бізнес')})</option>
                </select>
              </div>
            </div>

            {formErr && (
              <div className="text-xs font-bold text-red-600" role="alert">
                {formErr}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact 360 Detail Dialog */}
      <Dialog open={Boolean(detail) || loadingDetail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <User className="w-4 h-4 text-[#1769aa]" />
                  <DialogTitle>{detail.contact.name}</DialogTitle>
                  <Badge variant={detail.contact.segment === 'b2b' ? 'dark' : 'info'}>
                    {detail.contact.segment.toUpperCase()}
                  </Badge>
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span className="inline-flex items-center gap-1 font-mono text-[#0d1f33] font-semibold">
                    <Phone className="w-3 h-3 text-[#1769aa]" />
                    {detail.contact.phone}
                  </span>
                  {detail.contact.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {detail.contact.email}
                    </span>
                  )}
                  <span>{detail.contact.city}</span>
                  {detail.contact.company && <span>{detail.contact.company}</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>
                      {tr('Угод', 'Сделок')}: <strong className="font-mono">{detail.deals.length}</strong>
                    </span>
                    <span>
                      {tr('Сума')}:{' '}
                      <strong className="font-mono">
                        ${detail.deals.reduce((s, d) => s + d.totalUsd, 0).toLocaleString('uk-UA')}
                      </strong>
                    </span>
                    <span>
                      {tr('Відкритих задач', 'Открытых задач')}:{' '}
                      <strong className="font-mono">
                        {detail.tasks.filter((t) => t.status !== 'done').length}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditContact(detail.contact)}>
                      {tr('Редагувати профіль', 'Редактировать профиль')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const resp = await authFetch(`/api/crm/contacts/${detail.contact.id}`, { method: 'DELETE' });
                        if (resp.ok) {
                          setDetail(null);
                          await Promise.all([onRefreshContacts(), onRefreshTasks()]);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Linked Deals */}
                <div>
                  <h4 className="text-xs font-extrabold text-[#0d1f33] mb-2">
                    {tr('Історія угод клієнта', 'История сделок клиента')}
                  </h4>
                  {detail.deals.length === 0 ? (
                    <div className="text-xs text-slate-400">{tr('Поки немає пов’язаних угод', 'Связанных сделок пока нет')}</div>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.deals.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setDetail(null);
                            onOpenDeal(d);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-[#1769aa] bg-slate-50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#0d1f33] mr-2">{d.dealNumber}</span>
                            <span className="text-slate-700 truncate">{d.topic}</span>
                          </div>
                          <span className="font-mono font-bold text-[#1769aa] shrink-0">
                            {d.totalUsd > 0 ? `$${d.totalUsd.toLocaleString('uk-UA')}` : d.stage}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contact Tasks */}
                <div>
                  <h4 className="text-xs font-extrabold text-[#0d1f33] mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-[#1769aa]" />
                    {tr('Задачі по контакту', 'Задачи по контакту')}
                  </h4>
                  <form onSubmit={handleAddTask} className="flex flex-wrap gap-2 mb-2.5">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder={tr('Нова задача (напр. Надіслати КП)...', 'Новая задача…')}
                      className="flex-1 min-w-[180px]"
                    />
                    <Input
                      type="date"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="w-36"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                    >
                      <option value="low">{tr('Низький', 'Низкий')}</option>
                      <option value="medium">{tr('Середній', 'Средний')}</option>
                      <option value="high">{tr('Терміново', 'Срочно')}</option>
                    </select>
                    <Button type="submit" size="default" variant="primary">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </form>
                  <div className="space-y-1.5">
                    {detail.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={() => void handleToggleTaskDone(t)}
                            className="accent-[#169374]"
                          />
                          <span className={t.status === 'done' ? 'line-through text-slate-400' : 'font-semibold text-[#0d1f33]'}>
                            {t.title}
                          </span>
                        </label>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.dueDate && <span className="font-mono text-[11px] text-slate-500">{t.dueDate}</span>}
                          <Badge variant={t.priority === 'high' ? 'danger' : 'default'}>{t.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Notes History */}
                <div>
                  <h4 className="text-xs font-extrabold text-[#0d1f33] mb-2 flex items-center gap-1.5">
                    <MessageSquarePlus className="w-3.5 h-3.5 text-[#1769aa]" />
                    {tr('Нотатки та історія спілкування', 'Заметки и история общения')}
                  </h4>
                  <form onSubmit={handleAddNote} className="flex gap-2 mb-3">
                    <Input
                      value={newNoteBody}
                      onChange={(e) => setNewNoteBody(e.target.value)}
                      placeholder={tr('Додати коментар або домовленість...', 'Добавить заметку…')}
                      className="flex-1"
                    />
                    <Button type="submit" variant="default">
                      {tr('Додати', 'Добавить')}
                    </Button>
                  </form>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {detail.notes.length === 0 ? (
                      <div className="text-xs text-slate-400">{tr('Нотаток ще немає', 'Заметок пока нет')}</div>
                    ) : (
                      detail.notes.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="text-[11px] text-slate-500 mb-0.5">
                              <strong className="text-[#0d1f33]">{n.author}</strong> ·{' '}
                              {new Date(n.createdAt).toLocaleString('uk-UA')}
                            </div>
                            <div className="text-slate-700 whitespace-pre-wrap">{n.body}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(n.id)}
                            aria-label={tr('Видалити нотатку', 'Удалить заметку')}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
