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
import {
  Building2,
  CheckSquare,
  Eye,
  KeyRound,
  Mail,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import type {
  Contact,
  ContactSegment,
  CrmCustomer,
  CrmNote,
  CrmSessionUser,
  CrmTask,
  Deal,
  TaskPriority,
} from '../../types.ts';
import { formatUaPhone } from '../../lib/leadForm.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { SortDirectionIcon, TablePagination } from './TablePagination.tsx';

interface ClientsUnifiedTabProps {
  customers: CrmCustomer[];
  contacts: Contact[];
  currentUser: CrmSessionUser | null;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefreshCustomers: () => Promise<void>;
  onRefreshContacts: () => Promise<void>;
  onRefreshTasks: () => Promise<void>;
  onOpenDeal: (deal: Deal) => void;
  onCreateDealForClient?: (prefill: {
    customerName: string;
    phone: string;
    city: string;
    customerEmail: string;
  }) => void;
}

type UnifiedFilter = 'all' | 'with_account' | 'crm_only' | 'b2b' | 'b2c' | 'blocked';

interface UnifiedClientRow {
  rowKey: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  segment: ContactSegment | null;
  customer: CrmCustomer | null;
  contact: Contact | null;
  dealsCount: number;
  activeDealsCount: number;
  totalUsd: number;
  openTasksCount: number;
  updatedAt: string;
}

interface ContactDetailPayload {
  contact: Contact;
  deals: Deal[];
  tasks: CrmTask[];
  notes: CrmNote[];
}

const unifiedTableFeatures = tableFeatures({
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

const columnHelper = createColumnHelper<typeof unifiedTableFeatures, UnifiedClientRow>();

const PROVIDER_META: Record<
  CrmCustomer['authProvider'],
  { uk: string; ru: string; variant: 'info' | 'default' | 'success' }
> = {
  google: { uk: 'Google кабінет', ru: 'Google кабинет', variant: 'info' },
  password: { uk: 'Email / Пароль', ru: 'Email / Пароль', variant: 'default' },
  both: { uk: 'Google + Пароль', ru: 'Google + Пароль', variant: 'success' },
};

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

export function ClientsUnifiedTab({
  customers,
  contacts,
  currentUser,
  authFetch,
  onRefreshCustomers,
  onRefreshContacts,
  onRefreshTasks,
  onOpenDeal,
  onCreateDealForClient,
}: ClientsUnifiedTabProps) {
  const { open: notify } = useNotification();
  const isAdmin = currentUser?.role === 'admin';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UnifiedFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  // Account Create / Edit modal (Admin)
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(null);
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aCity, setACity] = useState('Одеса');
  const [aPassword, setAPassword] = useState('');
  const [aActive, setAActive] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountErr, setAccountErr] = useState('');
  const [confirmDeleteCustId, setConfirmDeleteCustId] = useState<number | null>(null);

  // CRM Contact Create / Edit modal (Staff & Admin)
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [cName, setCName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCity, setCCity] = useState('Одеса');
  const [cChannel, setCChannel] = useState('Telegram');
  const [cSegment, setCSegment] = useState<ContactSegment>('b2c');
  const [savingContact, setSavingContact] = useState(false);
  const [contactErr, setContactErr] = useState('');

  // Unified 360 Detail Dialog
  const [detailRow, setDetailRow] = useState<UnifiedClientRow | null>(null);
  const [detailDeals, setDetailDeals] = useState<Deal[]>([]);
  const [detailTasks, setDetailTasks] = useState<CrmTask[]>([]);
  const [detailNotes, setDetailNotes] = useState<CrmNote[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailErr, setDetailErr] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [query, filter]);

  // Merge Contacts + Customer Accounts into one unified list (deduping by email or phone)
  const unifiedRows = useMemo<UnifiedClientRow[]>(() => {
    const usedContactIds = new Set<number>();
    const rows: UnifiedClientRow[] = [];

    for (const cust of customers) {
      const custEmail = cust.email.trim().toLowerCase();
      const custPhoneTail = normalizeDigits(cust.phone);
      const matchedContact = contacts.find((ct) => {
        if (usedContactIds.has(ct.id)) return false;
        const ctEmail = ct.email.trim().toLowerCase();
        const ctPhoneTail = normalizeDigits(ct.phone);
        return (custEmail && ctEmail === custEmail) || (custPhoneTail.length === 9 && ctPhoneTail === custPhoneTail);
      });

      if (matchedContact) {
        usedContactIds.add(matchedContact.id);
      }

      const updatedAt =
        matchedContact && matchedContact.updatedAt > cust.updatedAt ? matchedContact.updatedAt : cust.updatedAt;

      rows.push({
        rowKey: `cust-${cust.id}`,
        name: cust.name || matchedContact?.name || cust.email,
        company: matchedContact?.company || '',
        phone: cust.phone || matchedContact?.phone || '',
        email: cust.email || matchedContact?.email || '',
        city: cust.city || matchedContact?.city || 'Одеса',
        segment: matchedContact?.segment ?? null,
        customer: cust,
        contact: matchedContact ?? null,
        dealsCount: Math.max(cust.dealsCount, matchedContact?.dealsCount ?? 0),
        activeDealsCount: cust.activeDealsCount,
        totalUsd: Math.max(cust.totalUsd, matchedContact?.totalUsd ?? 0),
        openTasksCount: matchedContact?.openTasksCount ?? 0,
        updatedAt,
      });
    }

    for (const ct of contacts) {
      if (usedContactIds.has(ct.id)) continue;
      rows.push({
        rowKey: `contact-${ct.id}`,
        name: ct.name,
        company: ct.company,
        phone: ct.phone,
        email: ct.email,
        city: ct.city || 'Одеса',
        segment: ct.segment,
        customer: null,
        contact: ct,
        dealsCount: ct.dealsCount ?? 0,
        activeDealsCount: 0,
        totalUsd: ct.totalUsd ?? 0,
        openTasksCount: ct.openTasksCount ?? 0,
        updatedAt: ct.updatedAt,
      });
    }

    return rows;
  }, [customers, contacts]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unifiedRows.filter((row) => {
      if (filter === 'with_account' && !row.customer) return false;
      if (filter === 'crm_only' && row.customer) return false;
      if (filter === 'b2b' && row.segment !== 'b2b') return false;
      if (filter === 'b2c' && row.segment !== 'b2c') return false;
      if (filter === 'blocked' && (!row.customer || row.customer.active)) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.company.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q)
      );
    });
  }, [unifiedRows, query, filter]);

  const stats = useMemo(
    () => ({
      total: unifiedRows.length,
      accounts: customers.length,
      b2b: unifiedRows.filter((r) => r.segment === 'b2b').length,
      openTasks: unifiedRows.reduce((s, r) => s + r.openTasksCount, 0),
    }),
    [unifiedRows, customers.length],
  );

  async function refreshAll() {
    await Promise.all([onRefreshCustomers(), onRefreshContacts(), onRefreshTasks()]);
  }

  async function openUnifiedDetail(row: UnifiedClientRow) {
    setDetailRow(row);
    setDetailDeals([]);
    setDetailTasks([]);
    setDetailNotes([]);
    setDetailErr('');
    setLoadingDetail(true);

    try {
      const requests: Promise<Response>[] = [];
      if (row.customer) requests.push(authFetch(`/api/crm/customers/${row.customer.id}`));
      if (row.contact) requests.push(authFetch(`/api/crm/contacts/${row.contact.id}`));

      const responses = await Promise.all(requests);
      const nextDeals: Deal[] = [];
      let nextTasks: CrmTask[] = [];
      let nextNotes: CrmNote[] = [];
      const seenDealIds = new Set<number>();

      let idx = 0;
      if (row.customer) {
        const custResp = responses[idx++];
        if (custResp.ok) {
          const data = (await custResp.json()) as { customer?: CrmCustomer; deals?: Deal[] };
          for (const d of data.deals ?? []) {
            if (!seenDealIds.has(d.id)) {
              seenDealIds.add(d.id);
              nextDeals.push(d);
            }
          }
        }
      }
      if (row.contact) {
        const ctResp = responses[idx];
        if (ctResp.ok) {
          const data = (await ctResp.json()) as ContactDetailPayload;
          nextTasks = data.tasks ?? [];
          nextNotes = data.notes ?? [];
          for (const d of data.deals ?? []) {
            if (!seenDealIds.has(d.id)) {
              seenDealIds.add(d.id);
              nextDeals.push(d);
            }
          }
        }
      }

      setDetailDeals(nextDeals);
      setDetailTasks(nextTasks);
      setDetailNotes(nextNotes);
    } catch {
      setDetailErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setLoadingDetail(false);
    }
  }

  function openCreateAccountModal(prefill?: UnifiedClientRow) {
    if (!isAdmin) return;
    setEditingCustomer(null);
    setAName(prefill?.name || '');
    setAEmail(prefill?.email || '');
    setAPhone(prefill?.phone ? formatUaPhone(prefill.phone) : '');
    setACity(prefill?.city || 'Одеса');
    setAPassword('');
    setAActive(true);
    setAccountErr('');
    setAccountModalOpen(true);
  }

  function openEditAccountModal(cust: CrmCustomer) {
    if (!isAdmin) return;
    setEditingCustomer(cust);
    setAName(cust.name);
    setAEmail(cust.email);
    setAPhone(cust.phone ? formatUaPhone(cust.phone) : '');
    setACity(cust.city || 'Одеса');
    setAPassword('');
    setAActive(cust.active);
    setAccountErr('');
    setAccountModalOpen(true);
  }

  async function handleSaveAccount(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setAccountErr('');
    setActionMsg('');
    setActionErr('');

    if (aName.trim().length < 2) {
      setAccountErr(tr('Вкажіть ім’я клієнта (мінімум 2 символи)', 'Укажите имя клиента (минимум 2 символа)'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aEmail.trim())) {
      setAccountErr(tr('Вкажіть коректний Email', 'Укажите корректный Email'));
      return;
    }
    if (aPassword.trim() && aPassword.trim().length < 6) {
      setAccountErr(tr('Пароль має містити щонайменше 6 символів', 'Пароль должен содержать минимум 6 символов'));
      return;
    }

    setSavingAccount(true);
    try {
      const payload: {
        name: string;
        email: string;
        phone: string;
        city: string;
        active: boolean;
        password?: string;
      } = {
        name: aName.trim(),
        email: aEmail.trim().toLowerCase(),
        phone: aPhone.trim() ? `+${aPhone.replace(/\D/g, '')}` : '',
        city: aCity.trim() || 'Одеса',
        active: aActive,
      };
      if (aPassword.trim()) payload.password = aPassword.trim();

      const url = editingCustomer ? `/api/crm/customers/${editingCustomer.id}` : '/api/crm/customers';
      const resp = await authFetch(url, {
        method: editingCustomer ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { customer?: CrmCustomer; error?: string };
      if (!resp.ok || !data.customer) {
        setAccountErr(data.error || tr('Не вдалося зберегти акаунт клієнта', 'Не удалось сохранить аккаунт клиента'));
        return;
      }
      setAccountModalOpen(false);
      await refreshAll();
      const msgText = editingCustomer
        ? tr(`Акаунт «${data.customer.name}» оновлено`, `Аккаунт «${data.customer.name}» обновлён`)
        : tr(`Створено акаунт кабінету «${data.customer.name}»`, `Создан аккаунт кабинета «${data.customer.name}»`);
      setActionMsg(msgText);
      notify?.({ type: 'success', message: msgText });
    } catch {
      setAccountErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleToggleAccountActive(cust: CrmCustomer) {
    if (!isAdmin) return;
    setActionMsg('');
    setActionErr('');
    try {
      const resp = await authFetch(`/api/crm/customers/${cust.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !cust.active }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        const errText = data.error || tr('Не вдалося змінити статус', 'Не удалось изменить статус');
        setActionErr(errText);
        notify?.({ type: 'error', message: errText });
        return;
      }
      await refreshAll();
      const msgText = cust.active
        ? tr(`Доступ «${cust.name}» заблоковано`, `Доступ «${cust.name}» заблокирован`)
        : tr(`Доступ «${cust.name}» розблоковано`, `Доступ «${cust.name}» разблокирован`);
      setActionMsg(msgText);
      notify?.({ type: 'success', message: msgText });
    } catch {
      const errText = tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером');
      setActionErr(errText);
      notify?.({ type: 'error', message: errText });
    }
  }

  async function handleDeleteCustomer(cust: CrmCustomer) {
    if (!isAdmin) return;
    setActionMsg('');
    setActionErr('');
    try {
      const resp = await authFetch(`/api/crm/customers/${cust.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        const errText = data.error || tr('Не вдалося видалити акаунт', 'Не удалось удалить аккаунт');
        setActionErr(errText);
        notify?.({ type: 'error', message: errText });
        return;
      }
      setConfirmDeleteCustId(null);
      if (detailRow?.customer?.id === cust.id) setDetailRow(null);
      await refreshAll();
      const msgText = tr(`Акаунт «${cust.name}» видалено`, `Аккаунт «${cust.name}» удалён`);
      setActionMsg(msgText);
      notify?.({ type: 'success', message: msgText });
    } catch {
      const errText = tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером');
      setActionErr(errText);
      notify?.({ type: 'error', message: errText });
    }
  }

  function openNewContactModal(prefill?: UnifiedClientRow) {
    setEditingContact(null);
    setCName(prefill?.name || '');
    setCCompany('');
    setCPhone(prefill?.phone ? formatUaPhone(prefill.phone) : '');
    setCEmail(prefill?.email || '');
    setCCity(prefill?.city || 'Одеса');
    setCChannel('Telegram');
    setCSegment('b2c');
    setContactErr('');
    setContactModalOpen(true);
  }

  function openEditContactModal(ct: Contact) {
    setEditingContact(ct);
    setCName(ct.name);
    setCCompany(ct.company);
    setCPhone(ct.phone ? formatUaPhone(ct.phone) : '');
    setCEmail(ct.email);
    setCCity(ct.city || 'Одеса');
    setCChannel(ct.channel || 'Telegram');
    setCSegment(ct.segment);
    setContactErr('');
    setContactModalOpen(true);
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    setContactErr('');
    setSavingContact(true);
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
      const url = editingContact ? `/api/crm/contacts/${editingContact.id}` : '/api/crm/contacts';
      const resp = await authFetch(url, {
        method: editingContact ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { contact?: Contact; error?: string };
      if (!resp.ok || !data.contact) {
        setContactErr(data.error || tr('Помилка збереження контакту', 'Ошибка сохранения контакта'));
        return;
      }
      setContactModalOpen(false);
      await refreshAll();
      const msgText = editingContact
        ? tr(`Контакт «${data.contact.name}» оновлено`, `Контакт «${data.contact.name}» обновлён`)
        : tr(`Додано контакт «${data.contact.name}»`, `Добавлен контакт «${data.contact.name}»`);
      setActionMsg(msgText);
      notify?.({ type: 'success', message: msgText });
    } catch {
      setContactErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSavingContact(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!detailRow?.contact || !newNoteBody.trim()) return;
    try {
      const resp = await authFetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: detailRow.contact.id, body: newNoteBody.trim() }),
      });
      if (!resp.ok) {
        notify?.({ type: 'error', message: tr('Не вдалося додати нотатку', 'Не удалось добавить заметку') });
        return;
      }
      setNewNoteBody('');
      await openUnifiedDetail(detailRow);
      notify?.({ type: 'success', message: tr('Нотатку додано', 'Заметка добавлена') });
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!detailRow?.contact) return;
    try {
      const resp = await authFetch(`/api/crm/notes/${noteId}`, { method: 'DELETE' });
      if (!resp.ok) {
        notify?.({ type: 'error', message: tr('Не вдалося видалити нотатку', 'Не удалось удалить заметку') });
        return;
      }
      await openUnifiedDetail(detailRow);
      notify?.({ type: 'success', message: tr('Нотатку видалено', 'Заметка удалена') });
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!detailRow?.contact || !newTaskTitle.trim()) return;
    try {
      const resp = await authFetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: detailRow.contact.id,
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          dueDate: newTaskDue,
        }),
      });
      if (!resp.ok) {
        notify?.({ type: 'error', message: tr('Не вдалося створити задачу', 'Не удалось создать задачу') });
        return;
      }
      setNewTaskTitle('');
      setNewTaskDue('');
      await Promise.all([openUnifiedDetail(detailRow), onRefreshTasks(), onRefreshContacts()]);
      notify?.({ type: 'success', message: tr('Задачу по клієнту створено', 'Задача по клиенту создана') });
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  async function handleToggleTaskDone(task: CrmTask) {
    if (!detailRow) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const resp = await authFetch(`/api/crm/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!resp.ok) {
        notify?.({ type: 'error', message: tr('Не вдалося оновити задачу', 'Не удалось обновить задачу') });
        return;
      }
      await Promise.all([openUnifiedDetail(detailRow), onRefreshTasks(), onRefreshContacts()]);
    } catch {
      notify?.({ type: 'error', message: tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером') });
    }
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: () => <span>{tr('Клієнт / Контакт', 'Клиент / Контакт')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-[140px]">
                <div className="font-bold text-sm text-[#0d1f33] flex flex-wrap items-center gap-1.5">
                  <span>{row.name}</span>
                  {row.segment && (
                    <Badge variant={row.segment === 'b2b' ? 'dark' : 'info'}>{row.segment.toUpperCase()}</Badge>
                  )}
                  {row.customer && (
                    <Badge variant={row.customer.active ? PROVIDER_META[row.customer.authProvider].variant : 'danger'}>
                      {row.customer.active
                        ? tr(PROVIDER_META[row.customer.authProvider].uk, PROVIDER_META[row.customer.authProvider].ru)
                        : tr('Заблокований', 'Заблокирован')}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-600 mt-1">
                  {row.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{row.company}</span>
                    </span>
                  )}
                  {row.email && (
                    <span className="inline-flex items-center gap-1 break-all">
                      <Mail className="w-3.5 h-3.5 text-[#1769aa] shrink-0" />
                      <span>{row.email}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('phone', {
          header: () => <span>{tr('Телефон і місто', 'Телефон и город')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="space-y-0.5 text-xs sm:text-sm">
                {row.phone ? (
                  <div className="font-mono font-semibold text-[#0d1f33] inline-flex items-center gap-1 whitespace-nowrap">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {row.phone}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">{tr('Телефон не вказано', 'Телефон не указан')}</div>
                )}
                <div className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{row.city || 'Одеса'}</span>
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('dealsCount', {
          header: () => <span>{tr('Угоди / Сума', 'Сделки / Сумма')}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="text-xs sm:text-sm space-y-0.5 whitespace-nowrap">
                <div className="font-mono font-bold text-[#0d1f33] tabular-nums">
                  {row.dealsCount} {tr('угод', 'сделок')}
                </div>
                <div className="font-mono font-bold text-[#169374] tabular-nums">
                  {row.totalUsd > 0 ? `$${row.totalUsd.toLocaleString('uk-UA')}` : '—'}
                </div>
                <div className="2xl:hidden text-[11px] text-slate-400 tabular-nums">
                  {new Date(row.updatedAt).toLocaleDateString('uk-UA')}
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor('openTasksCount', {
          header: () => <span>{tr('Задачі', 'Задачи')}</span>,
          cell: (info) => {
            const val = info.getValue();
            return val > 0 ? <Badge variant="warning">{val}</Badge> : <span className="text-slate-400 text-sm">0</span>;
          },
        }),
        columnHelper.accessor('updatedAt', {
          header: () => <span>{tr('Оновлено', 'Обновлено')}</span>,
          cell: (info) => (
            <span className="text-slate-500 text-sm whitespace-nowrap tabular-nums">
              {new Date(info.getValue()).toLocaleDateString('uk-UA')}
            </span>
          ),
        }),
      ]),
    [],
  );

  const table = useTable({
    features: unifiedTableFeatures,
    data: filteredRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="text-xs sm:text-sm font-bold text-slate-500">{tr('Усього в базі', 'Всего в базе')}</div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#0d1f33] mt-1 tabular-nums leading-none">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs sm:text-sm font-bold text-slate-500">{tr('З акаунтом кабінету', 'С аккаунтом кабинета')}</div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#1769aa] mt-1 tabular-nums leading-none">{stats.accounts}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs sm:text-sm font-bold text-slate-500">{tr('Бізнес-клієнти (B2B)', 'Бизнес-клиенты (B2B)')}</div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#169374] mt-1 tabular-nums leading-none">{stats.b2b}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs sm:text-sm font-bold text-slate-500">{tr('Відкритих задач', 'Открытых задач')}</div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1 tabular-nums leading-none">{stats.openTasks}</div>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Пошук за ім’ям, Email, телефоном, компанією...', 'Поиск по имени, Email, телефону, компании…')}
              className="pl-9"
            />
          </div>

          <div className="inline-flex flex-wrap rounded-lg border border-slate-200 p-1 bg-slate-100">
            {(
              [
                ['all', tr('Усі', 'Все')],
                ['with_account', tr('Кабінет', 'Кабинет')],
                ['crm_only', tr('Ліди CRM', 'Лиды CRM')],
                ['b2c', 'B2C'],
                ['b2b', 'B2B'],
                ['blocked', tr('Вимкнені', 'Отключённые')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  filter === key ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openNewContactModal()}>
            <Plus className="w-4 h-4" />
            {tr('Контакт CRM', 'Контакт CRM')}
          </Button>
          {isAdmin && (
            <Button type="button" variant="primary" size="sm" onClick={() => openCreateAccountModal()}>
              <UserCheck className="w-4 h-4" />
              {tr('Акаунт кабінету', 'Аккаунт кабинета')}
            </Button>
          )}
        </div>
      </Card>

      {actionMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800">
          {actionMsg}
        </div>
      )}
      {actionErr && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700" role="alert">
          {actionErr}
        </div>
      )}

      {/* Unified Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.id === 'updatedAt' ? 'hidden 2xl:table-cell' : undefined}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1.5 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortDirectionIcon sorted={header.column.getIsSorted()} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="text-right">{tr('Дії')}</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const item = row.original;
              const cust = item.customer;
              const ct = item.contact;
              const isConfirmingDelete = cust ? confirmDeleteCustId === cust.id : false;

              return (
                <TableRow
                  key={row.id}
                  onClick={() => void openUnifiedDetail(item)}
                  className="cursor-pointer"
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === 'updatedAt' ? 'hidden 2xl:table-cell' : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openUnifiedDetail(item)}
                        title={tr('Картка клієнта 360', 'Карточка клиента 360')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        360°
                      </Button>

                      {onCreateDealForClient && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onCreateDealForClient({
                              customerName: item.name,
                              phone: item.phone,
                              city: item.city,
                              customerEmail: item.email,
                            })
                          }
                          title={tr('Створити угоду для клієнта', 'Создать сделку для клиента')}
                        >
                          <Plus className="w-3.5 h-3.5 text-[#1769aa]" />
                        </Button>
                      )}

                      {ct && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditContactModal(ct)}
                          title={tr('Редагувати контакт CRM', 'Редактировать контакт CRM')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {isAdmin && cust && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAccountModal(cust)}
                            title={tr('Керування акаунтом кабінету', 'Управление аккаунтом кабинета')}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#1769aa]" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleToggleAccountActive(cust)}
                            title={
                              cust.active
                                ? tr('Заблокувати доступ у кабінет', 'Заблокировать доступ в кабинет')
                                : tr('Розблокувати доступ у кабінет', 'Разблокировать доступ в кабинет')
                            }
                          >
                            {cust.active ? (
                              <UserX className="w-4 h-4 text-amber-600" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-[#169374]" />
                            )}
                          </Button>
                          {isConfirmingDelete ? (
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleDeleteCustomer(cust)}
                              >
                                {tr('Так', 'Да')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDeleteCustId(null)}
                              >
                                {tr('Ні', 'Нет')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDeleteCustId(cust.id)}
                              title={tr('Видалити акаунт кабінету', 'Удалить аккаунт кабинета')}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredRows.length === 0 && (
          <div className="p-12 text-center text-[15px] text-slate-400">
            {tr('Клієнтів і контактів за вибраним фільтром не знайдено', 'Клиенты и контакты по выбранному фильтру не найдены')}
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

      <div className="px-5 py-4 rounded-xl bg-white/95 border border-slate-200 text-sm text-slate-600 flex items-start gap-3">
        <Shield className="w-4.5 h-4.5 text-[#1769aa] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0d1f33]">{tr('Єдина база клієнтів і контактів:', 'Единая база клиентов и контактов:')}</strong>{' '}
          {isAdmin
            ? tr(
                'Усі ліди, контакти та зареєстровані акаунти кабінету об’єднані автоматично за Email або телефоном. Персонал CRM бачить усю базу, нотатки й задачі; адміністратор додатково керує акаунтами входу.',
                'Все лиды, контакты и зарегистрированные аккаунты кабинета объединены автоматически по Email или телефону. Персонал CRM видит всю базу, заметки и задачи; администратор дополнительно управляет аккаунтами входа.',
              )
            : tr(
                'Усі контакти та акаунти кабінету об’єднані в одній базі: ви бачите угоди, задачі та нотатки по кожному клієнту.',
                'Все контакты и аккаунты кабинета объединены в одной базе: вы видите сделки, задачи и заметки по каждому клиенту.',
              )}
        </div>
      </div>

      {/* Create / Edit Cabinet Account Dialog (Admin) */}
      <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer
                ? tr(`Акаунт клієнта: ${editingCustomer.name}`, `Аккаунт клиента: ${editingCustomer.name}`)
                : tr('Новий акаунт клієнта', 'Новый аккаунт клиента')}
            </DialogTitle>
            <DialogDescription>
              {tr('Доступ до особистого кабінету клієнта (Email / пароль або Google)', 'Доступ в личный кабинет клиента (Email / пароль или Google)')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccount} className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="acc-name" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Ім’я *', 'Имя *')}
                </label>
                <Input id="acc-name" required value={aName} onChange={(e) => setAName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="acc-email" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  Email *
                </label>
                <Input id="acc-email" type="email" required value={aEmail} onChange={(e) => setAEmail(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="acc-phone" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Телефон')}
                </label>
                <Input
                  id="acc-phone"
                  type="tel"
                  value={aPhone}
                  onChange={(e) => setAPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 50 000 00 00"
                  className="font-mono"
                />
              </div>
              <div>
                <label htmlFor="acc-city" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Місто')}
                </label>
                <Input id="acc-city" value={aCity} onChange={(e) => setACity(e.target.value)} />
              </div>
            </div>

            <div>
              <label htmlFor="acc-pass" className="block text-sm font-bold text-[#0d1f33] mb-1.5 inline-flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#1769aa]" />
                {editingCustomer
                  ? tr('Новий пароль (необов’язково)', 'Новый пароль (необязательно)')
                  : tr('Пароль (необов’язково, якщо вхід через Google)', 'Пароль (необязательно, если вход через Google)')}
              </label>
              <Input
                id="acc-pass"
                type="password"
                value={aPassword}
                onChange={(e) => setAPassword(e.target.value)}
                placeholder={tr('Мінімум 6 символів', 'Минимум 6 символов')}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="inline-flex items-center gap-2 font-bold text-[#0d1f33] cursor-pointer">
                <input
                  type="checkbox"
                  checked={aActive}
                  onChange={(e) => setAActive(e.target.checked)}
                  className="w-4 h-4 accent-[#169374]"
                />
                {tr('Акаунт активний (дозволено вхід у кабінет)', 'Аккаунт активен (разрешён вход в кабинет)')}
              </label>
            </div>

            {accountErr && (
              <div className="text-sm font-bold text-red-600" role="alert">
                {accountErr}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setAccountModalOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={savingAccount}>
                {savingAccount ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create / Edit CRM Contact Dialog */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? tr('Редагувати контакт', 'Редактировать контакт') : tr('Додати контакт CRM', 'Добавить контакт CRM')}
            </DialogTitle>
            <DialogDescription>
              {tr('Клієнт прив’язується до угод і задач за номером телефону', 'Клиент связывается со сделками и задачами по телефону')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveContact} className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="uc-name" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Ім’я *', 'Имя *')}
                </label>
                <Input id="uc-name" required value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="uc-phone" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Телефон *', 'Телефон *')}
                </label>
                <Input
                  id="uc-phone"
                  required
                  value={cPhone}
                  onChange={(e) => setCPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 XX XXX XX XX"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="uc-company" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Компанія / Об’єкт', 'Компания / Объект')}
                </label>
                <Input id="uc-company" value={cCompany} onChange={(e) => setCCompany(e.target.value)} />
              </div>
              <div>
                <label htmlFor="uc-email" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  Email
                </label>
                <Input id="uc-email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="uc-city" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Місто')}
                </label>
                <Input id="uc-city" value={cCity} onChange={(e) => setCCity(e.target.value)} />
              </div>
              <div>
                <label htmlFor="uc-channel" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Канал зв’язку')}
                </label>
                <select
                  id="uc-channel"
                  value={cChannel}
                  onChange={(e) => setCChannel(e.target.value)}
                  className="h-9 sm:h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="Viber">Viber</option>
                  <option value="Телефон">{tr('Дзвінок')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="uc-segment" className="block text-sm font-bold text-[#0d1f33] mb-1.5">
                  {tr('Сегмент', 'Сегмент')}
                </label>
                <select
                  id="uc-segment"
                  value={cSegment}
                  onChange={(e) => setCSegment(e.target.value as ContactSegment)}
                  className="h-9 sm:h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold"
                >
                  <option value="b2c">B2C ({tr('Дім')})</option>
                  <option value="b2b">B2B ({tr('Бізнес')})</option>
                </select>
              </div>
            </div>

            {contactErr && (
              <div className="text-sm font-bold text-red-600" role="alert">
                {contactErr}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setContactModalOpen(false)}>
                {tr('Скасувати')}
              </Button>
              <Button type="submit" variant="primary" disabled={savingContact}>
                {savingContact ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unified Client 360 Detail Dialog */}
      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-4xl">
          {detailRow && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#1769aa]" />
                  <DialogTitle>{detailRow.name}</DialogTitle>
                  {detailRow.segment && (
                    <Badge variant={detailRow.segment === 'b2b' ? 'dark' : 'info'}>
                      {detailRow.segment.toUpperCase()}
                    </Badge>
                  )}
                  {detailRow.customer && (
                    <Badge variant={detailRow.customer.active ? 'success' : 'danger'}>
                      {detailRow.customer.active ? tr('Кабінет активний', 'Кабинет активен') : tr('Заблокований', 'Заблокирован')}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                  {detailRow.phone && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[#0d1f33] font-semibold">
                      <Phone className="w-4 h-4 text-[#1769aa]" />
                      {detailRow.phone}
                    </span>
                  )}
                  {detailRow.email && (
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <Mail className="w-4 h-4 shrink-0" />
                      {detailRow.email}
                    </span>
                  )}
                  <span>{detailRow.city}</span>
                  {detailRow.company && <span>{detailRow.company}</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 sm:p-6 space-y-5 text-sm max-h-[78vh] overflow-y-auto">
                {detailErr && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                    {detailErr}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap gap-5">
                    <span>
                      {tr('Угод', 'Сделок')}: <strong className="font-mono">{detailDeals.length}</strong>
                    </span>
                    <span>
                      {tr('Сума')}:{' '}
                      <strong className="font-mono text-[#169374]">
                        ${detailDeals.reduce((s, d) => s + d.totalUsd, 0).toLocaleString('uk-UA')}
                      </strong>
                    </span>
                    <span>
                      {tr('Відкритих задач', 'Открытых задач')}:{' '}
                      <strong className="font-mono">{detailTasks.filter((t) => t.status !== 'done').length}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onCreateDealForClient && (
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        onClick={() => {
                          const r = detailRow;
                          setDetailRow(null);
                          onCreateDealForClient({
                            customerName: r.name,
                            phone: r.phone,
                            city: r.city,
                            customerEmail: r.email,
                          });
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {tr('Нова угода', 'Новая сделка')}
                      </Button>
                    )}

                    {detailRow.contact ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ct = detailRow.contact!;
                          setDetailRow(null);
                          openEditContactModal(ct);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {tr('Контакт CRM', 'Контакт CRM')}
                      </Button>
                    ) : (
                      detailRow.phone && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const r = detailRow;
                            setDetailRow(null);
                            openNewContactModal(r);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {tr('Додати у CRM-контакти', 'Добавить в CRM-контакты')}
                        </Button>
                      )
                    )}

                    {isAdmin &&
                      (detailRow.customer ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            const cust = detailRow.customer!;
                            setDetailRow(null);
                            openEditAccountModal(cust);
                          }}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {tr('Акаунт кабінету', 'Аккаунт кабинета')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            const r = detailRow;
                            setDetailRow(null);
                            openCreateAccountModal(r);
                          }}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {tr('Створити акаунт кабінету', 'Создать аккаунт кабинета')}
                        </Button>
                      ))}
                  </div>
                </div>

                {/* Linked Deals */}
                <div>
                  <h4 className="font-extrabold text-[#0d1f33] mb-2.5 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#1769aa]" />
                    {tr('Історія угод та замовлень', 'История сделок и заказов')}
                  </h4>
                  {loadingDetail ? (
                    <div className="py-4 text-center text-slate-400">{tr('Завантаження...', 'Загрузка…')}</div>
                  ) : detailDeals.length === 0 ? (
                    <div className="text-slate-400">{tr('Поки немає пов’язаних угод', 'Связанных сделок пока нет')}</div>
                  ) : (
                    <div className="space-y-2">
                      {detailDeals.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setDetailRow(null);
                            onOpenDeal(d);
                          }}
                          className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 hover:border-[#1769aa] bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#0d1f33] mr-2">{d.dealNumber}</span>
                            <span className="text-slate-700 truncate">{d.topic}</span>
                          </div>
                          <span className="font-mono font-bold text-[#1769aa] shrink-0 tabular-nums">
                            {d.totalUsd > 0 ? `$${d.totalUsd.toLocaleString('uk-UA')}` : d.stage}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks & Notes (when CRM contact exists) */}
                {detailRow.contact && (
                  <>
                    <div>
                      <h4 className="font-extrabold text-[#0d1f33] mb-2.5 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#1769aa]" />
                        {tr('Задачі по клієнту', 'Задачи по клиенту')}
                      </h4>
                      <form onSubmit={handleAddTask} className="flex flex-wrap gap-2 mb-3">
                        <Input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder={tr('Нова задача (напр. Надіслати КП)...', 'Новая задача…')}
                          className="flex-1 min-w-[160px]"
                        />
                        <Input
                          type="date"
                          value={newTaskDue}
                          onChange={(e) => setNewTaskDue(e.target.value)}
                          className="w-36 sm:w-40"
                        />
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                          className="h-9 sm:h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
                        >
                          <option value="low">{tr('Низький', 'Низкий')}</option>
                          <option value="medium">{tr('Середній', 'Средний')}</option>
                          <option value="high">{tr('Терміново', 'Срочно')}</option>
                        </select>
                        <Button type="submit" size="default" variant="primary">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </form>
                      <div className="space-y-2.5">
                        {detailTasks.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-slate-200 bg-white"
                          >
                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={t.status === 'done'}
                                onChange={() => void handleToggleTaskDone(t)}
                                className="w-4.5 h-4.5 accent-[#169374]"
                              />
                              <span className={t.status === 'done' ? 'line-through text-slate-400' : 'font-semibold text-[#0d1f33]'}>
                                {t.title}
                              </span>
                            </label>
                            <div className="flex items-center gap-2 shrink-0">
                              {t.dueDate && <span className="font-mono text-sm text-slate-500">{t.dueDate}</span>}
                              <Badge variant={t.priority === 'high' ? 'danger' : 'default'}>{t.priority}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-[#0d1f33] mb-3 flex items-center gap-2">
                        <MessageSquarePlus className="w-4.5 h-4.5 text-[#1769aa]" />
                        {tr('Нотатки та історія спілкування', 'Заметки и история общения')}
                      </h4>
                      <form onSubmit={handleAddNote} className="flex gap-2.5 mb-3">
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
                      <div className="space-y-2.5 max-h-56 overflow-y-auto">
                        {detailNotes.length === 0 ? (
                          <div className="text-slate-400">{tr('Нотаток ще немає', 'Заметок пока нет')}</div>
                        ) : (
                          detailNotes.map((n) => (
                            <div
                              key={n.id}
                              className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
                            >
                              <div>
                                <div className="text-sm text-slate-500 mb-1">
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
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
