import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Minus, PackagePlus, Plus, Search, ShoppingBag, Sparkles, Trash2, UserCheck, X } from 'lucide-react';
import type { Contact, CrmCustomer, Deal, DealStage, DealType, Product } from '../../types.ts';
import { formatUaPhone, isValidUaPhone } from '../../lib/leadForm.ts';
import { localizeCatalogText, tr } from '../../lib/i18n.ts';

interface CreateDealModalProps {
  open: boolean;
  initialType: DealType;
  initialStage?: DealStage;
  stages: Array<{ id: DealStage; label: string; colorClass: string }>;
  products: Product[];
  contacts: Contact[];
  customers: CrmCustomer[];
  assignees: string[];
  defaultAssignee?: string;
  telegramConfigured: boolean;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onCreated: (deal: Deal) => Promise<void> | void;
}

interface ClientPickerOption {
  key: string;
  label: string;
  name: string;
  phone: string;
  city: string;
  email: string;
  contactId: number | null;
  customerId: number | null;
}

const LEAD_TASK_PRESETS = [
  { uk: 'Резервне живлення (квартира / дім)', ru: 'Резервное питание (квартира / дом)' },
  { uk: 'Сонячна електростанція (СЕС)', ru: 'Солнечная электростанция (СЭС)' },
  { uk: 'Рішення для бізнесу / СТО (380 В)', ru: 'Решение для бизнеса / СТО (380 В)' },
  { uk: 'Монтаж та інженерний аудит', ru: 'Монтаж и инженерный аудит' },
  { uk: 'Консультація по обладнанню', ru: 'Консультация по оборудованию' },
];

const CHANNEL_OPTIONS = [
  { value: 'CRM (вручну)', uk: 'CRM (вручну)', ru: 'CRM (вручную)' },
  { value: 'Телефон', uk: 'Телефон / Дзвінок', ru: 'Телефон / Звонок' },
  { value: 'Офіс (Одеса)', uk: 'Офіс (Одеса)', ru: 'Офис (Одесса)' },
  { value: 'Telegram', uk: 'Telegram', ru: 'Telegram' },
  { value: 'Viber / WhatsApp', uk: 'Viber / WhatsApp', ru: 'Viber / WhatsApp' },
  { value: 'Instagram / Facebook', uk: 'Instagram / Facebook', ru: 'Instagram / Facebook' },
  { value: 'Рекомендація', uk: 'Рекомендація клієнта', ru: 'Рекомендация клиента' },
];

export function CreateDealModal({
  open,
  initialType,
  initialStage,
  stages,
  products,
  contacts,
  customers,
  assignees,
  defaultAssignee,
  telegramConfigured,
  authFetch,
  onClose,
  onCreated,
}: CreateDealModalProps) {
  const [dealType, setDealType] = useState<DealType>(initialType);
  const [stage, setStage] = useState<DealStage>('new');
  const [assignee, setAssignee] = useState('');

  const [selectedClientKey, setSelectedClientKey] = useState('');
  const [linkedContactId, setLinkedContactId] = useState<number | null>(null);
  const [linkedCustomerId, setLinkedCustomerId] = useState<number | null>(null);
  const [linkedCustomerEmail, setLinkedCustomerEmail] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Одеса');
  const [channel, setChannel] = useState('CRM (вручну)');

  const [topic, setTopic] = useState('');
  const [taskType, setTaskType] = useState(LEAD_TASK_PRESETS[0].uk);
  const [notes, setNotes] = useState('');

  const [orderItems, setOrderItems] = useState<Array<{ product: Product; qty: number }>>([]);
  const [productQuery, setProductQuery] = useState('');
  const [showProductCatalog, setShowProductCatalog] = useState(false);

  const [manualTotal, setManualTotal] = useState('');
  const [totalEditedManually, setTotalEditedManually] = useState(false);

  const [sendTelegram, setSendTelegram] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const creatableStages = useMemo(() => stages.filter((s) => s.id !== 'archived'), [stages]);

  useEffect(() => {
    if (!open) return;
    setDealType(initialType);
    const validStage =
      initialStage && initialStage !== 'archived' && creatableStages.some((s) => s.id === initialStage)
        ? initialStage
        : 'new';
    setStage(validStage);
    const fallbackAssignee =
      (defaultAssignee && assignees.includes(defaultAssignee) ? defaultAssignee : '') ||
      assignees[0] ||
      (initialType === 'order' ? 'Дмитро (менеджер)' : 'Олександр (інженер)');
    setAssignee(fallbackAssignee);

    setSelectedClientKey('');
    setLinkedContactId(null);
    setLinkedCustomerId(null);
    setLinkedCustomerEmail('');
    setCustomerName('');
    setPhone('');
    setCity('Одеса');
    setChannel('CRM (вручну)');
    setTopic('');
    setTaskType(LEAD_TASK_PRESETS[0].uk);
    setNotes('');
    setOrderItems([]);
    setProductQuery('');
    setShowProductCatalog(false);
    setManualTotal('');
    setTotalEditedManually(false);
    setSendTelegram(false);
    setSaving(false);
    setErr('');
  }, [open, initialType, initialStage, creatableStages, assignees, defaultAssignee]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  const clientOptions = useMemo<ClientPickerOption[]>(() => {
    const options: ClientPickerOption[] = [];
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    for (const c of customers) {
      const cleanPhone = c.phone.replace(/\D/g, '').slice(-9);
      const cleanEmail = c.email.trim().toLowerCase();
      if (cleanPhone.length === 9) seenPhones.add(cleanPhone);
      if (cleanEmail) seenEmails.add(cleanEmail);
      options.push({
        key: `cust-${c.id}`,
        label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}${c.email ? ` (${c.email})` : ''}`,
        name: c.name,
        phone: c.phone,
        city: c.city || 'Одеса',
        email: cleanEmail,
        contactId: null,
        customerId: c.id,
      });
    }

    for (const ct of contacts) {
      const cleanPhone = ct.phone.replace(/\D/g, '').slice(-9);
      const cleanEmail = ct.email.trim().toLowerCase();
      if ((cleanPhone.length === 9 && seenPhones.has(cleanPhone)) || (cleanEmail && seenEmails.has(cleanEmail))) {
        continue;
      }
      options.push({
        key: `cont-${ct.id}`,
        label: `${ct.name} · ${ct.phone}${ct.city ? ` (${ct.city})` : ''}`,
        name: ct.name,
        phone: ct.phone,
        city: ct.city || 'Одеса',
        email: cleanEmail,
        contactId: ct.id,
        customerId: null,
      });
    }

    return options;
  }, [customers, contacts]);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = q
      ? products.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q),
        )
      : products.filter((p) => p.inStock && p.price > 0);
    return list.slice(0, 8);
  }, [products, productQuery]);

  const catalogSubtotalUsd = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.product.price * item.qty, 0),
    [orderItems],
  );

  useEffect(() => {
    if (dealType === 'order' && !totalEditedManually) {
      setManualTotal(catalogSubtotalUsd > 0 ? String(catalogSubtotalUsd) : '');
    }
  }, [dealType, catalogSubtotalUsd, totalEditedManually]);

  function handleSelectExistingClient(key: string) {
    setSelectedClientKey(key);
    if (!key) {
      setLinkedContactId(null);
      setLinkedCustomerId(null);
      setLinkedCustomerEmail('');
      return;
    }
    const found = clientOptions.find((o) => o.key === key);
    if (!found) return;
    setCustomerName(found.name);
    setPhone(found.phone ? formatUaPhone(found.phone) : '');
    setCity(found.city || 'Одеса');
    setLinkedContactId(found.contactId);
    setLinkedCustomerId(found.customerId);
    setLinkedCustomerEmail(found.email);
    setErr('');
  }

  function addProductToOrder(prod: Product) {
    setOrderItems((prev) => {
      const existing = prev.find((it) => it.product.id === prod.id);
      if (existing) {
        return prev.map((it) => (it.product.id === prod.id ? { ...it, qty: Math.min(99, it.qty + 1) } : it));
      }
      return [...prev, { product: prod, qty: 1 }];
    });
    setProductQuery('');
    setShowProductCatalog(false);
    setErr('');
  }

  function updateOrderItemQty(productId: string, nextQty: number) {
    if (nextQty <= 0) {
      setOrderItems((prev) => prev.filter((it) => it.product.id !== productId));
      return;
    }
    const clamped = Math.max(1, Math.min(99, Math.round(nextQty)));
    setOrderItems((prev) => prev.map((it) => (it.product.id === productId ? { ...it, qty: clamped } : it)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');

    const trimmedName = customerName.trim();
    if (trimmedName.length < 2) {
      setErr(tr('Вкажіть ім’я клієнта або назву компанії (мінімум 2 символи)', 'Укажите имя клиента или название компании (минимум 2 символа)'));
      return;
    }

    if (!isValidUaPhone(phone)) {
      setErr(tr('Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX', 'Укажите корректный номер телефона в формате +380 XX XXX XX XX'));
      return;
    }

    if (dealType === 'lead' && !topic.trim() && !taskType.trim()) {
      setErr(tr('Вкажіть тему угоди або тип задачі', 'Укажите тему сделки или тип задачи'));
      return;
    }

    if (dealType === 'order' && orderItems.length === 0 && !topic.trim()) {
      setErr(tr('Додайте хоча б один товар із каталогу або вкажіть назву замовлення', 'Добавьте хотя бы один товар из каталога или укажите название заказа'));
      return;
    }

    const parsedTotal = manualTotal.trim() !== '' ? Math.max(0, Math.round(Number(manualTotal) || 0)) : undefined;

    setSaving(true);
    try {
      const resp = await authFetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dealType,
          stage,
          assignee: assignee.trim(),
          customerName: trimmedName,
          phone: phone.trim(),
          city: city.trim() || 'Одеса',
          channel: channel.trim() || 'CRM (вручну)',
          topic: topic.trim(),
          taskType: dealType === 'lead' ? taskType.trim() : tr('Замовлення CRM', 'Заказ CRM'),
          notes: notes.trim(),
          totalUsd: parsedTotal,
          items: dealType === 'order' ? orderItems.map((it) => ({ productId: it.product.id, qty: it.qty })) : [],
          contactId: linkedContactId,
          customerId: linkedCustomerId,
          customerEmail: linkedCustomerEmail,
          sendTelegram,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setErr(data.error || tr('Не вдалося зберегти запис у CRM', 'Не удалось сохранить запись в CRM'));
        return;
      }
      await onCreated(data.deal);
      onClose();
    } catch {
      setErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-deal-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div>
            <div className="font-mono text-[11px] font-bold text-[#1769aa]">
              {tr('Новий запис у CRM · Energo Comfort', 'Новая запись в CRM · Energo Comfort')}
            </div>
            <h3 id="create-deal-modal-title" className="text-base font-extrabold text-[#0d1f33]">
              {dealType === 'order'
                ? tr('Створити замовлення обладнання', 'Создать заказ оборудования')
                : tr('Створити нову угоду (лід)', 'Создать новую сделку (лид)')}
            </h3>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label={tr('Закрити', 'Закрыть')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-[#0d1f33] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDealType('lead');
                setErr('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-extrabold transition-all cursor-pointer ${
                dealType === 'lead'
                  ? 'bg-white text-[#1769aa] shadow-xs border border-sky-200'
                  : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{tr('Угода / Інженерний лід', 'Сделка / Инженерный лид')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDealType('order');
                setErr('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-extrabold transition-all cursor-pointer ${
                dealType === 'order'
                  ? 'bg-white text-[#0d1f33] shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-[#0d1f33]'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>{tr('Замовлення обладнання', 'Заказ оборудования')}</span>
            </button>
          </div>

          {/* Existing Client Quick Picker */}
          {clientOptions.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="crm-existing-client" className="font-bold text-slate-700 inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#1769aa]" />
                  {tr('Обрати існуючого клієнта з бази (необов’язково)', 'Выбрать существующего клиента из базы (необязательно)')}
                </label>
                {selectedClientKey && (
                  <button
                    type="button"
                    onClick={() => handleSelectExistingClient('')}
                    className="text-[11px] font-bold text-[#1769aa] hover:underline cursor-pointer"
                  >
                    {tr('Очистити вибір', 'Сбросить выбор')}
                  </button>
                )}
              </div>
              <select
                id="crm-existing-client"
                value={selectedClientKey}
                onChange={(e) => handleSelectExistingClient(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-[#0d1f33]"
              >
                <option value="">
                  {tr('— Новий клієнт (ввести вручну нижче) —', '— Новый клиент (ввести вручную ниже) —')}
                </option>
                {clientOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="crm-deal-customer-name" className="block font-bold text-slate-600 mb-1">
                {tr('Ім’я клієнта / Компанія *', 'Имя клиента / Компания *')}
              </label>
              <input
                id="crm-deal-customer-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={tr('Наприклад, Ігор Мельник або ТОВ «Енерго»', 'Например, Игорь Мельник или ООО «Энерго»')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-[#0d1f33]"
              />
            </div>

            <div>
              <label htmlFor="crm-deal-phone" className="block font-bold text-slate-600 mb-1">
                {tr('Телефон *', 'Телефон *')}
              </label>
              <input
                id="crm-deal-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                placeholder="+380 50 777 71 72"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-semibold text-[#0d1f33]"
              />
            </div>

            <div>
              <label htmlFor="crm-deal-city" className="block font-bold text-slate-600 mb-1">
                {tr('Місто / Об’єкт', 'Город / Объект')}
              </label>
              <input
                id="crm-deal-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={tr('Одеса, Таїрова', 'Одесса, Таирова')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label htmlFor="crm-deal-channel" className="block font-bold text-slate-600 mb-1">
                {tr('Канал звернення', 'Канал обращения')}
              </label>
              <select
                id="crm-deal-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {tr(ch.uk, ch.ru)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pipeline Stage & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="crm-deal-stage" className="block font-bold text-slate-600 mb-1">
                {tr('Етап воронки', 'Этап воронки')}
              </label>
              <select
                id="crm-deal-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-[#0d1f33]"
              >
                {creatableStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {tr(s.label)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="crm-deal-assignee" className="block font-bold text-slate-600 mb-1">
                {tr('Відповідальний менеджер / інженер', 'Ответственный менеджер / инженер')}
              </label>
              <select
                id="crm-deal-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-[#0d1f33]"
              >
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                {!assignees.includes(assignee) && assignee && <option value={assignee}>{assignee}</option>}
              </select>
            </div>
          </div>

          {/* Mode-specific section */}
          {dealType === 'lead' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label htmlFor="crm-lead-topic" className="block font-bold text-slate-600 mb-1">
                  {tr('Назва / Тема угоди *', 'Название / Тема сделки *')}
                </label>
                <input
                  id="crm-lead-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={tr('Наприклад, Гібридна СЕС 8 кВт + АКБ 10 кВт·год під ключ', 'Например, Гибридная СЭС 8 кВт + АКБ 10 кВт·ч под ключ')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-[#0d1f33]"
                />
              </div>

              <div>
                <label htmlFor="crm-lead-task-type" className="block font-bold text-slate-600 mb-1">
                  {tr('Тип задачі', 'Тип задачи')}
                </label>
                <select
                  id="crm-lead-task-type"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  {LEAD_TASK_PRESETS.map((preset) => (
                    <option key={preset.uk} value={preset.uk}>
                      {tr(preset.uk, preset.ru)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="crm-deal-total" className="block font-bold text-slate-600 mb-1">
                  {tr('Орієнтовний бюджет (USD)', 'Ориентировочный бюджет (USD)')}
                </label>
                <input
                  id="crm-deal-total"
                  type="number"
                  min="0"
                  step="1"
                  value={manualTotal}
                  onChange={(e) => {
                    setTotalEditedManually(true);
                    setManualTotal(e.target.value);
                  }}
                  placeholder="3500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-[#0d1f33]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Catalog Product Picker */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#0d1f33] inline-flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-[#1769aa]" />
                    {tr('Товари з каталогу', 'Товары из каталога')} ({products.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProductCatalog((v) => !v)}
                    className="text-[11px] font-bold text-[#1769aa] hover:underline cursor-pointer"
                  >
                    {showProductCatalog
                      ? tr('Приховати підбір', 'Скрыть подбор')
                      : tr('Показати позиції в наявності', 'Показать позиции в наличии')}
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={productQuery}
                    onFocus={() => setShowProductCatalog(true)}
                    onChange={(e) => {
                      setProductQuery(e.target.value);
                      setShowProductCatalog(true);
                    }}
                    placeholder={tr('Пошук за моделлю, потужністю або SKU (напр. Deye, 10018)...', 'Поиск по модели, мощности или SKU (напр. Deye, 10018)...')}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>

                {(showProductCatalog || productQuery.trim().length > 0) && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {matchingProducts.length === 0 ? (
                      <div className="p-3 text-center text-slate-500">
                        {tr('Нічого не знайдено за цим запитом', 'Ничего не найдено по этому запросу')}
                      </div>
                    ) : (
                      matchingProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProductToOrder(p)}
                          className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-sky-50/70 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0d1f33] truncate">
                              {localizeCatalogText(p.title)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              SKU {p.sku} · {p.brand} ·{' '}
                              <span className={p.inStock ? 'text-[#169374] font-semibold' : 'text-amber-700'}>
                                {p.inStock ? tr('в наявності', 'в наличии') : tr('під замовлення', 'под заказ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
                              {p.price > 0 ? `$${p.price.toLocaleString('uk-UA')}` : tr('За запитом', 'По запросу')}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-[#1769aa] text-white text-[11px] font-bold">
                              <Plus className="w-3 h-3" />
                              {tr('Додати', 'Добавить')}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Order Items */}
                {orderItems.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {orderItems.map(({ product, qty }) => (
                      <div key={product.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[#0d1f33] truncate">
                            {localizeCatalogText(product.title)}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            SKU {product.sku} · ${product.price.toLocaleString('uk-UA')} / {tr('шт.', 'шт.')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => updateOrderItemQty(product.id, qty - 1)}
                              aria-label={tr('Зменшити кількість', 'Уменьшить количество')}
                              className="p-1.5 text-slate-600 hover:text-[#0d1f33] cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={qty}
                              onChange={(e) => updateOrderItemQty(product.id, Number(e.target.value) || 1)}
                              className="w-10 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                              aria-label={tr('Кількість товару', 'Количество товара')}
                            />
                            <button
                              type="button"
                              onClick={() => updateOrderItemQty(product.id, qty + 1)}
                              aria-label={tr('Збільшити кількість', 'Увеличить количество')}
                              className="p-1.5 text-slate-600 hover:text-[#0d1f33] cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="font-mono font-bold text-[#0d1f33] w-16 text-right tabular-nums">
                            ${(product.price * qty).toLocaleString('uk-UA')}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateOrderItemQty(product.id, 0)}
                            aria-label={tr('Видалити позицію', 'Удалить позицию')}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">
                        {tr('Сума обраних товарів', 'Сумма выбранных товаров')} ({orderItems.length}{' '}
                        {tr('поз.', 'поз.')})
                      </span>
                      <span className="font-mono text-[#169374] tabular-nums">
                        ${catalogSubtotalUsd.toLocaleString('uk-UA')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="crm-order-topic" className="block font-bold text-slate-600 mb-1">
                    {tr('Назва замовлення (необов’язково)', 'Название заказа (необязательно)')}
                  </label>
                  <input
                    id="crm-order-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={
                      orderItems.length > 0
                        ? tr(`Замовлення обладнання (${orderItems.length} поз.)`, `Заказ оборудования (${orderItems.length} поз.)`)
                        : tr('Наприклад, Комплект інвертор + АКБ зі складу', 'Например, Комплект инвертор + АКБ со склада')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-[#0d1f33]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="crm-order-total" className="font-bold text-slate-600">
                      {tr('Підсумкова сума (USD)', 'Итоговая сумма (USD)')}
                    </label>
                    {totalEditedManually && catalogSubtotalUsd > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTotalEditedManually(false);
                          setManualTotal(String(catalogSubtotalUsd));
                        }}
                        className="text-[10.5px] font-bold text-[#1769aa] hover:underline cursor-pointer"
                      >
                        {tr(`За каталогом ($${catalogSubtotalUsd})`, `По каталогу ($${catalogSubtotalUsd})`)}
                      </button>
                    )}
                  </div>
                  <input
                    id="crm-order-total"
                    type="number"
                    min="0"
                    step="1"
                    value={manualTotal}
                    onChange={(e) => {
                      setTotalEditedManually(true);
                      setManualTotal(e.target.value);
                    }}
                    placeholder={String(catalogSubtotalUsd || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-[#0d1f33]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes + Telegram */}
          <div className="space-y-3">
            <div>
              <label htmlFor="crm-deal-notes" className="block font-bold text-slate-600 mb-1">
                {tr('Нотатка інженера / менеджера', 'Заметка инженера / менеджера')}
              </label>
              <textarea
                id="crm-deal-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr('Деталі по об’єкту, умови доставки чи оплати, домовленості...', 'Детали по объекту, условия доставки или оплаты, договорённости...')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            {telegramConfigured && (
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendTelegram}
                  onChange={(e) => setSendTelegram(e.target.checked)}
                />
                {tr('Надіслати сповіщення про новий запис у Telegram', 'Отправить уведомление о новой записи в Telegram')}
              </label>
            )}
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {err}
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {tr('Скасувати', 'Отмена')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving
                ? tr('Зберігаємо...', 'Сохраняем...')
                : dealType === 'order'
                  ? tr('Створити замовлення', 'Создать заказ')
                  : tr('Створити угоду', 'Создать сделку')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
