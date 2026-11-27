import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import type {
  Contact,
  CrmCustomer,
  CrmTask,
  Deal,
  DealPatchPayload,
  DealStage,
  DealType,
  Product,
} from '../../types.ts';
import { formatUaPhone, isValidUaPhone } from '../../lib/leadForm.ts';
import { localizeCatalogText, tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';
import { CRITICAL_LOAD_PRESETS, DEAL_CHANNEL_OPTIONS, DEAL_TASK_PRESETS } from './dealFormShared.ts';

interface DealOrderDetailsModalProps {
  deal: Deal | null;
  stages: Array<{ id: DealStage; label: string; colorClass: string }>;
  products: Product[];
  contacts: Contact[];
  customers: CrmCustomer[];
  tasks: CrmTask[];
  assignees: string[];
  saving: boolean;
  onClose: () => void;
  onPatchDeal: (dealId: number, patch: DealPatchPayload) => Promise<void>;
  onDeleteDeal: (dealId: number) => Promise<void>;
}

function phoneTail(raw: string): string {
  return raw.replace(/\D/g, '').slice(-9);
}

function normalizeEditableItems(items: Array<{ productId: string; qty: number }>): string {
  return JSON.stringify(items.map((it) => `${it.productId}:${it.qty}`));
}

export function DealOrderDetailsModal({
  deal,
  stages,
  products,
  contacts,
  customers,
  tasks,
  assignees,
  saving,
  onClose,
  onPatchDeal,
  onDeleteDeal,
}: DealOrderDetailsModalProps) {
  const [editingMeta, setEditingMeta] = useState(false);
  const [dealTypeInput, setDealTypeInput] = useState<DealType>('lead');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [taskTypeInput, setTaskTypeInput] = useState('');

  const [loadsInput, setLoadsInput] = useState<string[]>([]);
  const [customLoadInput, setCustomLoadInput] = useState('');
  const [editingLoads, setEditingLoads] = useState(false);

  const [itemsInput, setItemsInput] = useState<Array<{ productId: string; sku: string; title: string; price: number; qty: number }>>([]);
  const [editingItems, setEditingItems] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [showProductCatalog, setShowProductCatalog] = useState(false);

  const [totalInput, setTotalInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'deal' | 'phone' | null>(null);
  const [validationErr, setValidationErr] = useState('');

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const linkedContact = useMemo(() => {
    if (!deal) return null;
    if (deal.contactId) {
      const byId = contacts.find((c) => c.id === deal.contactId);
      if (byId) return byId;
    }
    const tail = phoneTail(deal.phone);
    if (tail.length === 9) {
      return contacts.find((c) => phoneTail(c.phone) === tail) ?? null;
    }
    return null;
  }, [deal, contacts]);

  const linkedCustomer = useMemo(() => {
    if (!deal) return null;
    const tail = phoneTail(deal.phone);
    const contactEmail = (deal.customerEmail || linkedContact?.email || '').trim().toLowerCase();
    return (
      customers.find((cust) => {
        if (contactEmail && cust.email.trim().toLowerCase() === contactEmail) return true;
        if (tail.length === 9 && phoneTail(cust.phone) === tail) return true;
        return false;
      }) ?? null
    );
  }, [deal, customers, linkedContact]);

  const resolvedEmail = (deal?.customerEmail || linkedContact?.email || linkedCustomer?.email || '').trim().toLowerCase();

  useEffect(() => {
    if (!deal) return;
    setEditingMeta(false);
    setDealTypeInput(deal.type);
    setCustomerNameInput(deal.customerName || '');
    setPhoneInput(deal.phone ? formatUaPhone(deal.phone) : '');
    setEmailInput(resolvedEmail);
    setCityInput(deal.city || 'Одеса');
    setChannelInput(deal.channel || 'Telegram');
    setTopicInput(deal.topic || '');
    setTaskTypeInput(deal.taskType || '');
    setLoadsInput([...deal.loads]);
    setCustomLoadInput('');
    setEditingLoads(false);
    setItemsInput(deal.items.map((item) => ({ ...item })));
    setEditingItems(false);
    setProductQuery('');
    setShowProductCatalog(false);
    setTotalInput(String(deal.totalUsd ?? 0));
    setNotesInput(deal.notes ?? '');
    setConfirmDelete(false);
    setCopiedKey(null);
    setValidationErr('');
  }, [
    deal?.id,
    deal?.type,
    deal?.customerName,
    deal?.phone,
    resolvedEmail,
    deal?.city,
    deal?.channel,
    deal?.topic,
    deal?.taskType,
    deal?.totalUsd,
    deal?.notes,
    deal?.updatedAt,
  ]);

  useEffect(() => {
    if (!deal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deal, saving, onClose]);

  const dealTasks = useMemo(() => {
    if (!deal) return [];
    return tasks.filter((t) => t.dealId === deal.id);
  }, [deal, tasks]);

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

  if (!deal || typeof document === 'undefined') return null;

  const stageInfo = stages.find((s) => s.id === deal.stage);
  const contactCompany = linkedContact?.company || '';
  const totalUnits = itemsInput.reduce((sum, item) => sum + item.qty, 0);
  const itemsSubtotalUsd = itemsInput.reduce((sum, item) => sum + item.price * item.qty, 0);
  const parsedTotal = Math.max(0, Math.round(Number(totalInput) || 0));

  const metaChanged =
    dealTypeInput !== deal.type ||
    customerNameInput.trim() !== deal.customerName.trim() ||
    phoneInput.replace(/\D/g, '') !== deal.phone.replace(/\D/g, '') ||
    emailInput.trim().toLowerCase() !== resolvedEmail ||
    cityInput.trim() !== (deal.city || 'Одеса').trim() ||
    channelInput.trim() !== deal.channel.trim() ||
    topicInput.trim() !== deal.topic.trim() ||
    taskTypeInput.trim() !== deal.taskType.trim();

  const loadsChanged = JSON.stringify(loadsInput) !== JSON.stringify(deal.loads);
  const itemsChanged = normalizeEditableItems(itemsInput) !== normalizeEditableItems(deal.items);
  const detailsChanged = parsedTotal !== deal.totalUsd || notesInput !== deal.notes;
  const hasUnsavedChanges = metaChanged || loadsChanged || itemsChanged || detailsChanged;

  async function handleCopy(text: string, key: 'deal' | 'phone') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      setCopiedKey(null);
    }
  }

  function toggleLoad(val: string) {
    setLoadsInput((prev) => (prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]));
  }

  function handleAddCustomLoad() {
    const clean = customLoadInput.trim();
    if (!clean) return;
    if (!loadsInput.some((l) => l.toLowerCase() === clean.toLowerCase())) {
      setLoadsInput((prev) => [...prev, clean].slice(0, 15));
    }
    setCustomLoadInput('');
  }

  function addCatalogItem(prod: Product) {
    setItemsInput((prev) => {
      const existing = prev.find((it) => it.productId === prod.id);
      if (existing) {
        return prev.map((it) => (it.productId === prod.id ? { ...it, qty: Math.min(99, it.qty + 1) } : it));
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          title: prod.title,
          price: prod.price,
          qty: 1,
        },
      ];
    });
    setProductQuery('');
    setShowProductCatalog(false);
  }

  function updateItemQty(productId: string, nextQty: number) {
    if (nextQty <= 0) {
      setItemsInput((prev) => prev.filter((it) => it.productId !== productId));
      return;
    }
    const clamped = Math.max(1, Math.min(99, Math.round(nextQty)));
    setItemsInput((prev) => prev.map((it) => (it.productId === productId ? { ...it, qty: clamped } : it)));
  }

  async function handleSaveDetails() {
    if (!deal || !hasUnsavedChanges) return;
    setValidationErr('');

    if (customerNameInput.trim().length < 2) {
      setValidationErr(tr('Вкажіть ім’я клієнта (мінімум 2 символи)', 'Укажите имя клиента (минимум 2 символа)'));
      return;
    }
    if (!isValidUaPhone(phoneInput)) {
      setValidationErr(tr('Вкажіть коректний номер телефону у форматі +380 XX XXX XX XX', 'Укажите корректный номер телефона в формате +380 XX XXX XX XX'));
      return;
    }
    const cleanEmail = emailInput.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setValidationErr(tr('Вкажіть коректний Email або залиште поле порожнім', 'Укажите корректный Email или оставьте поле пустым'));
      return;
    }
    if (!topicInput.trim()) {
      setValidationErr(tr('Вкажіть назву / тему запису', 'Укажите название / тему записи'));
      return;
    }

    const patch: DealPatchPayload = {};
    if (dealTypeInput !== deal.type) patch.type = dealTypeInput;
    if (customerNameInput.trim() !== deal.customerName.trim()) patch.customerName = customerNameInput.trim();
    if (phoneInput.replace(/\D/g, '') !== deal.phone.replace(/\D/g, '')) patch.phone = phoneInput.trim();
    if (cleanEmail !== resolvedEmail) patch.customerEmail = cleanEmail;
    if (cityInput.trim() !== (deal.city || 'Одеса').trim()) patch.city = cityInput.trim() || 'Одеса';
    if (channelInput.trim() !== deal.channel.trim()) patch.channel = channelInput.trim();
    if (topicInput.trim() !== deal.topic.trim()) patch.topic = topicInput.trim();
    if (taskTypeInput.trim() !== deal.taskType.trim()) patch.taskType = taskTypeInput.trim();
    if (loadsChanged) patch.loads = loadsInput;
    if (itemsChanged) {
      patch.items = itemsInput.map((it) => ({ productId: it.productId, qty: it.qty }));
    }
    if (parsedTotal !== deal.totalUsd) patch.totalUsd = parsedTotal;
    if (notesInput !== deal.notes) patch.notes = notesInput;

    await onPatchDeal(deal.id, patch);
    setEditingMeta(false);
    setEditingLoads(false);
    setEditingItems(false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-order-details-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 sticky top-0 z-10">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy(deal.dealNumber, 'deal')}
                title={tr('Скопіювати номер', 'Скопировать номер')}
                className="inline-flex items-center gap-1.5 font-mono text-sm sm:text-[15px] font-extrabold text-[#1769aa] hover:text-[#12568c] cursor-pointer"
              >
                <span>{deal.dealNumber}</span>
                {copiedKey === 'deal' ? <Check className="w-4 h-4 text-[#169374]" /> : <Copy className="w-4 h-4 opacity-60" />}
              </button>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-bold ${
                  dealTypeInput === 'order' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-[#1769aa]'
                }`}
              >
                {dealTypeInput === 'order' ? <ShoppingBag className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {dealTypeInput === 'order' ? tr('Замовлення', 'Заказ') : tr('Угода / Лід', 'Сделка / Лид')}
              </span>

              {stageInfo && (
                <span className={`px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-bold bg-white border border-slate-200 ${stageInfo.colorClass}`}>
                  {tr(stageInfo.label)}
                </span>
              )}

              {deal.telegramSent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-bold bg-emerald-50 border border-emerald-200 text-[#169374]">
                  <Send className="w-3.5 h-3.5" />
                  Telegram
                </span>
              )}
            </div>

            <h3 id="deal-order-details-title" className="text-lg sm:text-xl font-extrabold text-[#0d1f33] leading-snug break-words">
              {topicInput || deal.topic}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Calendar className="w-3.5 h-3.5" />
                {tr('Створено:', 'Создано:')} {new Date(deal.createdAt).toLocaleString('uk-UA')}
              </span>
              {deal.updatedAt !== deal.createdAt && (
                <span className="tabular-nums">
                  {tr('Оновлено:', 'Обновлено:')} {new Date(deal.updatedAt).toLocaleString('uk-UA')}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label={tr('Закрити', 'Закрыть')}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-[#0d1f33] shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-sm sm:text-[15px]">
          {/* Customer Contact & Main Info Card */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-extrabold text-[#0d1f33] inline-flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1769aa]" />
                {tr('Контактні дані клієнта та параметри', 'Контактные данные клиента и параметры')}
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {linkedContact && (
                  <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-xs font-bold text-slate-700">
                    {linkedContact.segment}
                  </span>
                )}
                {linkedCustomer && (
                  <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#169374]">
                    {tr('Кабінет клієнта', 'Кабинет клиента')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingMeta((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-sm font-bold text-[#1769aa] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingMeta ? tr('Згорнути поля', 'Свернуть поля') : tr('Редагувати', 'Редактировать')}
                </button>
              </div>
            </div>

            {editingMeta ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="sm:col-span-2 grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-slate-200/60 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDealTypeInput('lead')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-extrabold cursor-pointer ${
                      dealTypeInput === 'lead'
                        ? 'bg-white text-[#1769aa] shadow-xs border border-sky-200'
                        : 'text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{tr('Угода / Лід', 'Сделка / Лид')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealTypeInput('order')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-extrabold cursor-pointer ${
                      dealTypeInput === 'order'
                        ? 'bg-white text-[#0d1f33] shadow-xs border border-amber-300'
                        : 'text-slate-600'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-600" />
                    <span>{tr('Замовлення обладнання', 'Заказ оборудования')}</span>
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="detail-deal-topic" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Назва / Тема *', 'Название / Тема *')}
                  </label>
                  <input
                    id="detail-deal-topic"
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px] text-[#0d1f33]"
                  />
                </div>

                <div>
                  <label htmlFor="detail-deal-name" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Ім’я клієнта / Компанія *', 'Имя клиента / Компания *')}
                  </label>
                  <input
                    id="detail-deal-name"
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px] text-[#0d1f33]"
                  />
                </div>

                <div>
                  <label htmlFor="detail-deal-phone" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Телефон *', 'Телефон *')}
                  </label>
                  <input
                    id="detail-deal-phone"
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(formatUaPhone(e.target.value))}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-[15px] text-[#0d1f33]"
                  />
                </div>

                <div>
                  <label htmlFor="detail-deal-email" className="block text-sm font-bold text-slate-600 mb-1.5">
                    Email
                  </label>
                  <input
                    id="detail-deal-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-[15px] text-[#0d1f33]"
                  />
                </div>

                <div>
                  <label htmlFor="detail-deal-city" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Місто / Об’єкт', 'Город / Объект')}
                  </label>
                  <input
                    id="detail-deal-city"
                    type="text"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-[15px]"
                  />
                </div>

                <div>
                  <label htmlFor="detail-deal-channel" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Канал звернення', 'Канал обращения')}
                  </label>
                  <select
                    id="detail-deal-channel"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px]"
                  >
                    {DEAL_CHANNEL_OPTIONS.map((ch) => (
                      <option key={ch.value} value={ch.value}>
                        {tr(ch.uk, ch.ru)}
                      </option>
                    ))}
                    {!DEAL_CHANNEL_OPTIONS.some((c) => c.value === channelInput) && channelInput && (
                      <option value={channelInput}>{channelInput}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="detail-deal-task-type" className="block text-sm font-bold text-slate-600 mb-1.5">
                    {tr('Тип задачі / напрямок', 'Тип задачи / направление')}
                  </label>
                  <select
                    id="detail-deal-task-type"
                    value={taskTypeInput}
                    onChange={(e) => setTaskTypeInput(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px]"
                  >
                    {DEAL_TASK_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {tr(preset.uk, preset.ru)}
                      </option>
                    ))}
                    {!DEAL_TASK_PRESETS.some((p) => p.value === taskTypeInput) && taskTypeInput && (
                      <option value={taskTypeInput}>{taskTypeInput}</option>
                    )}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-slate-200/80 p-4 space-y-1.5">
                  <div className="text-sm text-slate-500">{tr('Клієнт')}</div>
                  <div className="font-extrabold text-[#0d1f33] text-base">{customerNameInput}</div>
                  {contactCompany && contactCompany !== customerNameInput && (
                    <div className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {contactCompany}
                    </div>
                  )}
                  {typeof linkedContact?.dealsCount === 'number' && linkedContact.dealsCount > 1 && (
                    <div className="text-sm text-[#1769aa] font-semibold">
                      {tr('Усього угод з клієнтом:', 'Всего сделок с клиентом:')} {linkedContact.dealsCount}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-slate-200/80 p-4 space-y-2">
                  <div className="text-sm text-slate-500">{tr('Телефон та Email', 'Телефон и Email')}</div>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`tel:${phoneInput.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 font-mono font-bold text-[#1769aa] hover:underline"
                    >
                      <Phone className="w-4 h-4" />
                      {phoneInput || deal.phone}
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy(phoneInput || deal.phone, 'phone')}
                      title={tr('Скопіювати телефон', 'Скопировать телефон')}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0d1f33] cursor-pointer"
                    >
                      {copiedKey === 'phone' ? <Check className="w-4 h-4 text-[#169374]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {emailInput ? (
                    <a
                      href={`mailto:${emailInput}`}
                      className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#1769aa] hover:underline break-all"
                    >
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      {emailInput}
                    </a>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                      <Mail className="w-4 h-4 shrink-0" />
                      {tr('Email не вказано', 'Email не указан')}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-slate-200/80 p-4 flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-sm text-slate-500">{tr('Місто / Об’єкт')}</div>
                    <div className="font-semibold text-[#0d1f33]">{cityInput || 'Одеса'}</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200/80 p-4 flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-sm text-slate-500">{tr('Канал зв’язку та тип', 'Канал связи и тип')}</div>
                    <div className="font-semibold text-[#0d1f33]">
                      {channelInput}
                      {taskTypeInput ? ` · ${taskTypeInput}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Ordered Items Breakdown & Editor (unified for orders and leads) */}
          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-extrabold text-[#0d1f33] inline-flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1769aa]" />
                {dealTypeInput === 'order'
                  ? tr('Склад замовлення та розбивка товарів', 'Состав заказа и разбивка товаров')
                  : tr('Обладнання з каталогу по угоді', 'Оборудование из каталога по сделке')}
              </h4>
              <div className="flex items-center gap-3">
                {itemsInput.length > 0 && (
                  <span className="font-mono text-sm font-bold text-slate-600 tabular-nums">
                    {itemsInput.length} {tr('поз.', 'поз.')} · {totalUnits} {tr('шт.', 'шт.')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingItems((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-sm font-bold text-[#1769aa] cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  {editingItems ? tr('Готово', 'Готово') : tr('Змінити склад', 'Изменить состав')}
                </button>
              </div>
            </div>

            {editingItems && (
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={productQuery}
                      onFocus={() => setShowProductCatalog(true)}
                      onChange={(e) => {
                        setProductQuery(e.target.value);
                        setShowProductCatalog(true);
                      }}
                      placeholder={tr('Додати товар за назвою, брендом або SKU...', 'Добавить товар по названию, бренду или SKU...')}
                      className="w-full h-9 sm:h-10 pl-10 pr-4 rounded-lg border border-slate-300 bg-white text-[15px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProductCatalog((v) => !v)}
                    className="text-sm font-bold text-[#1769aa] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    {showProductCatalog ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                    {' '}
                    {showProductCatalog ? tr('Сховати', 'Скрыть') : tr('Каталог', 'Каталог')}
                  </button>
                </div>

                {(showProductCatalog || productQuery.trim().length > 0) && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {matchingProducts.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        {tr('Нічого не знайдено за цим запитом', 'Ничего не найдено по этому запросу')}
                      </div>
                    ) : (
                      matchingProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addCatalogItem(p)}
                          className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-sky-50/70 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0d1f33] truncate">{localizeCatalogText(p.title)}</div>
                            <div className="text-sm text-slate-500">
                              SKU {p.sku} · {p.brand}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-[#1769aa] shrink-0 tabular-nums">
                            +${p.price.toLocaleString('uk-UA')}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {itemsInput.length === 0 ? (
              <div className="p-5 text-slate-500 text-center bg-white">
                {tr(
                  'Позиції з каталогу не додані (розрахунок ведеться за погодженою сумою).',
                  'Позиции из каталога не добавлены (расчёт ведётся по согласованной сумме).',
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100 bg-white">
                  {itemsInput.map((item) => {
                    const prod = productMap.get(item.productId);
                    const lineTotal = item.price * item.qty;
                    return (
                      <div key={item.productId} className="p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod?.img ? (
                              <SmartImage
                                src={prod.img}
                                alt={item.title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#0d1f33] leading-snug">
                              {localizeCatalogText(item.title)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                              <span className="font-mono">SKU {item.sku}</span>
                              {prod?.brand && <span>· {prod.brand}</span>}
                              {prod && (
                                <span className={prod.inStock ? 'text-[#169374] font-semibold' : 'text-amber-700'}>
                                  · {prod.inStock ? tr('в наявності', 'в наличии') : tr('під замовлення', 'под заказ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {editingItems ? (
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.productId, item.qty - 1)}
                                className="p-2 text-slate-600 hover:text-[#0d1f33] cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={item.qty}
                                onChange={(e) => updateItemQty(item.productId, Number(e.target.value) || 1)}
                                className="w-11 text-center font-mono font-bold text-sm bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.productId, item.qty + 1)}
                                className="p-2 text-slate-600 hover:text-[#0d1f33] cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="font-mono font-bold text-[#0d1f33] w-16 sm:w-20 text-right tabular-nums">
                              ${lineTotal.toLocaleString('uk-UA')}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.productId, 0)}
                              aria-label={tr('Видалити позицію', 'Удалить позицию')}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-right shrink-0 space-y-0.5">
                            <div className="font-mono font-extrabold text-[#0d1f33] tabular-nums">
                              ${lineTotal.toLocaleString('uk-UA')}
                            </div>
                            <div className="font-mono text-sm text-slate-500 tabular-nums">
                              {item.qty} × ${item.price.toLocaleString('uk-UA')}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{tr('Сума за позиціями каталогу', 'Сумма по позициям каталога')}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold tabular-nums">
                        ${itemsSubtotalUsd.toLocaleString('uk-UA')}
                      </span>
                      {parsedTotal !== itemsSubtotalUsd && (
                        <button
                          type="button"
                          onClick={() => setTotalInput(String(itemsSubtotalUsd))}
                          className="text-sm font-bold text-[#1769aa] hover:underline cursor-pointer"
                        >
                          {tr('Застосувати до суми', 'Применить к сумме')}
                        </button>
                      )}
                    </div>
                  </div>
                  {parsedTotal !== itemsSubtotalUsd && (
                    <div className="flex items-center justify-between text-[#1769aa] font-semibold">
                      <span>{tr('Коригування / знижка / монтаж', 'Корректировка / скидка / монтаж')}</span>
                      <span className="font-mono font-bold tabular-nums">
                        {parsedTotal > itemsSubtotalUsd ? '+' : '−'}$
                        {Math.abs(parsedTotal - itemsSubtotalUsd).toLocaleString('uk-UA')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-extrabold text-[#0d1f33] pt-2 border-t border-slate-200/70">
                    <span>{tr('Разом до оплати', 'Итого к оплате')}</span>
                    <span className="font-mono text-[#169374] tabular-nums">
                      ${parsedTotal.toLocaleString('uk-UA')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Critical Loads (unified view & edit) */}
          <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-[#0d1f33] inline-flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#1769aa]" />
                {tr('Критичні прилади')}
              </div>
              <button
                type="button"
                onClick={() => setEditingLoads((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-sm font-bold text-[#1769aa] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                {editingLoads ? tr('Готово', 'Готово') : tr('Змінити', 'Изменить')}
              </button>
            </div>

            {editingLoads ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CRITICAL_LOAD_PRESETS.map((preset) => {
                    const selected = loadsInput.includes(preset.value);
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => toggleLoad(preset.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#1769aa] border-[#1769aa] text-white'
                            : 'bg-white border-slate-200 text-[#0d1f33] hover:border-[#1769aa]'
                        }`}
                      >
                        {tr(preset.uk, preset.ru)}
                      </button>
                    );
                  })}
                  {loadsInput
                    .filter((l) => !CRITICAL_LOAD_PRESETS.some((p) => p.value === l))
                    .map((custom) => (
                      <button
                        key={custom}
                        type="button"
                        onClick={() => toggleLoad(custom)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1769aa] border border-[#1769aa] text-white text-sm font-semibold cursor-pointer"
                      >
                        <span>{custom}</span>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ))}
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={customLoadInput}
                    onChange={(e) => setCustomLoadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomLoad();
                      }
                    }}
                    placeholder={tr('Свій прилад (напр. Тепловий насос)', 'Свой прибор (напр. Тепловой насос)')}
                    className="flex-1 min-w-0 h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLoad}
                    className="h-9 sm:h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-sm font-bold text-[#0d1f33] cursor-pointer shrink-0"
                  >
                    + {tr('Додати', 'Добавить')}
                  </button>
                </div>
              </div>
            ) : loadsInput.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {loadsInput.map((load) => (
                  <span
                    key={load}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-[#0d1f33] font-semibold"
                  >
                    {load}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                {tr('Критичні прилади не вказані — натисніть «Змінити», щоб додати.', 'Критические приборы не указаны — нажмите «Изменить», чтобы добавить.')}
              </div>
            )}
          </section>

          {/* Linked Tasks Preview */}
          {dealTasks.length > 0 && (
            <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-2.5">
              <div className="font-bold text-slate-600 inline-flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#1769aa]" />
                {tr('Пов’язані задачі', 'Связанные задачи')} ({dealTasks.length})
              </div>
              <div className="space-y-2">
                {dealTasks.map((t) => (
                  <div
                    key={t.id}
                    className="px-3.5 py-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className={t.status === 'done' ? 'line-through text-slate-400' : 'font-semibold text-[#0d1f33]'}>
                      {t.title}
                    </span>
                    <span className="text-sm text-slate-500 whitespace-nowrap tabular-nums">
                      {t.assignee}
                      {t.dueDate ? ` · ${t.dueDate}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stage, Assignee, Budget & Notes Management */}
          <section className="space-y-4 pt-2 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="detail-deal-stage" className="block text-sm font-bold text-slate-600 mb-1.5">
                  {tr('Етап воронки')}
                </label>
                <select
                  id="detail-deal-stage"
                  value={deal.stage}
                  disabled={saving}
                  onChange={(e) => void onPatchDeal(deal.id, { stage: e.target.value as DealStage })}
                  className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px]"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {tr(s.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="detail-deal-assignee" className="block text-sm font-bold text-slate-600 mb-1.5">
                  {tr('Відповідальний')}
                </label>
                <select
                  id="detail-deal-assignee"
                  value={deal.assignee}
                  disabled={saving}
                  onChange={(e) => void onPatchDeal(deal.id, { assignee: e.target.value })}
                  className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 bg-white font-semibold text-[15px]"
                >
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  {deal.assignee && !assignees.includes(deal.assignee) && (
                    <option value={deal.assignee}>{deal.assignee}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="detail-deal-total" className="block text-sm font-bold text-slate-600 mb-1.5">
                {tr('Бюджет / Сума угоди (USD)')}
              </label>
              <input
                id="detail-deal-total"
                type="number"
                min="0"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-full h-9 sm:h-10 px-3.5 rounded-lg border border-slate-300 font-mono font-bold text-[15px]"
              />
            </div>

            <div>
              <label htmlFor="detail-deal-notes" className="block text-sm font-bold text-slate-600 mb-1.5">
                {tr('Нотатки інженера / менеджера')}
              </label>
              <textarea
                id="detail-deal-notes"
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder={tr('Додайте нотатку по об’єкту...')}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-[15px]"
              />
            </div>
          </section>

          {validationErr && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
              {validationErr}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-[#169374]" />
              <span>
                {saving
                  ? tr('Зберігаємо зміни...', 'Сохраняем изменения...')
                  : hasUnsavedChanges
                    ? tr('Є незбережені зміни', 'Есть несохранённые изменения')
                    : tr('Зміни зберігаються автоматично', 'Изменения сохраняются автоматически')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveDetails()}
                  className="h-9 sm:h-10 px-5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-[15px] font-bold cursor-pointer disabled:opacity-60"
                >
                  {tr('Зберегти зміни', 'Сохранить изменения')}
                </button>
              )}

              {confirmDelete ? (
                <div className="inline-flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void onDeleteDeal(deal.id)}
                    className="h-9 sm:h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[15px] font-bold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tr('Підтвердити видалення', 'Подтвердить удаление')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-slate-600 text-[15px] font-semibold hover:underline cursor-pointer"
                  >
                    {tr('Скасувати')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-red-600 text-[15px] font-bold hover:underline cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {tr('Видалити угоду')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
