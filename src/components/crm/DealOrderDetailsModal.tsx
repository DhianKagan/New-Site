import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type { Contact, CrmCustomer, CrmTask, Deal, DealStage, Product } from '../../types.ts';
import { localizeCatalogText, tr } from '../../lib/i18n.ts';
import { SmartImage } from '../SmartImage.tsx';

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
  onPatchDeal: (
    dealId: number,
    patch: { stage?: DealStage; assignee?: string; notes?: string; totalUsd?: number },
  ) => Promise<void>;
  onDeleteDeal: (dealId: number) => Promise<void>;
}

function phoneTail(raw: string): string {
  return raw.replace(/\D/g, '').slice(-9);
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
  const [totalInput, setTotalInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'deal' | 'phone' | null>(null);

  useEffect(() => {
    if (!deal) return;
    setTotalInput(String(deal.totalUsd ?? 0));
    setNotesInput(deal.notes ?? '');
    setConfirmDelete(false);
    setCopiedKey(null);
  }, [deal?.id, deal?.totalUsd, deal?.notes]);

  useEffect(() => {
    if (!deal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deal, saving, onClose]);

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
    const contactEmail = linkedContact?.email.trim().toLowerCase() || '';
    return (
      customers.find((cust) => {
        if (contactEmail && cust.email.trim().toLowerCase() === contactEmail) return true;
        if (tail.length === 9 && phoneTail(cust.phone) === tail) return true;
        return false;
      }) ?? null
    );
  }, [deal, customers, linkedContact]);

  const dealTasks = useMemo(() => {
    if (!deal) return [];
    return tasks.filter((t) => t.dealId === deal.id);
  }, [deal, tasks]);

  if (!deal) return null;

  const stageInfo = stages.find((s) => s.id === deal.stage);
  const contactEmail = linkedContact?.email || linkedCustomer?.email || '';
  const contactCompany = linkedContact?.company || '';
  const totalUnits = deal.items.reduce((sum, item) => sum + item.qty, 0);
  const itemsSubtotalUsd = deal.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const parsedTotal = Math.max(0, Math.round(Number(totalInput) || 0));
  const hasUnsavedChanges = parsedTotal !== deal.totalUsd || notesInput !== deal.notes;

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

  async function handleSaveDetails() {
    if (!deal || !hasUnsavedChanges) return;
    await onPatchDeal(deal.id, {
      totalUsd: parsedTotal,
      notes: notesInput,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-order-details-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 sticky top-0 z-10">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy(deal.dealNumber, 'deal')}
                title={tr('Скопіювати номер', 'Скопировать номер')}
                className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-[#1769aa] hover:text-[#12568c] cursor-pointer"
              >
                <span>{deal.dealNumber}</span>
                {copiedKey === 'deal' ? <Check className="w-3 h-3 text-[#169374]" /> : <Copy className="w-3 h-3 opacity-60" />}
              </button>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                  deal.type === 'order' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-[#1769aa]'
                }`}
              >
                {deal.type === 'order' ? <ShoppingBag className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {deal.type === 'order' ? tr('Замовлення', 'Заказ') : tr('Угода / Лід', 'Сделка / Лид')}
              </span>

              {stageInfo && (
                <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-white border border-slate-200 ${stageInfo.colorClass}`}>
                  {tr(stageInfo.label)}
                </span>
              )}

              {deal.telegramSent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 border border-emerald-200 text-[#169374]">
                  <Send className="w-2.5 h-2.5" />
                  Telegram
                </span>
              )}
            </div>

            <h3 id="deal-order-details-title" className="text-base font-extrabold text-[#0d1f33] leading-snug">
              {deal.topic}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {tr('Створено:', 'Создано:')} {new Date(deal.createdAt).toLocaleString('uk-UA')}
              </span>
              {deal.updatedAt !== deal.createdAt && (
                <span>
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
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-[#0d1f33] shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Customer Contact Details */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-extrabold text-[#0d1f33] inline-flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#1769aa]" />
                {tr('Контактні дані клієнта', 'Контактные данные клиента')}
              </h4>
              <div className="flex flex-wrap items-center gap-1.5">
                {linkedContact && (
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10.5px] font-bold text-slate-700 uppercase">
                    {linkedContact.segment}
                  </span>
                )}
                {linkedCustomer && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10.5px] font-bold text-[#169374]">
                    {tr('Кабінет клієнта', 'Кабинет клиента')}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-slate-200/80 p-3 space-y-1">
                <div className="text-[11px] text-slate-500">{tr('Клієнт')}</div>
                <div className="font-extrabold text-[#0d1f33] text-sm">{deal.customerName}</div>
                {contactCompany && contactCompany !== deal.customerName && (
                  <div className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {contactCompany}
                  </div>
                )}
                {typeof linkedContact?.dealsCount === 'number' && linkedContact.dealsCount > 1 && (
                  <div className="text-[11px] text-[#1769aa] font-semibold">
                    {tr('Усього угод з клієнтом:', 'Всего сделок с клиентом:')} {linkedContact.dealsCount}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200/80 p-3 space-y-1.5">
                <div className="text-[11px] text-slate-500">{tr('Телефон та Email', 'Телефон и Email')}</div>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`tel:${deal.phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-mono font-bold text-[#1769aa] hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {deal.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(deal.phone, 'phone')}
                    title={tr('Скопіювати телефон', 'Скопировать телефон')}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0d1f33] cursor-pointer"
                  >
                    {copiedKey === 'phone' ? <Check className="w-3.5 h-3.5 text-[#169374]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {contactEmail ? (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#1769aa] hover:underline break-all"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {contactEmail}
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {tr('Email не вказано', 'Email не указан')}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200/80 p-3 flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-500">{tr('Місто / Об’єкт')}</div>
                  <div className="font-semibold text-[#0d1f33]">{deal.city || 'Одеса'}</div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200/80 p-3 flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-500">{tr('Канал зв’язку та тип', 'Канал связи и тип')}</div>
                  <div className="font-semibold text-[#0d1f33]">
                    {deal.channel}
                    {deal.taskType ? ` · ${deal.taskType}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Ordered Items Breakdown */}
          {(deal.items.length > 0 || deal.type === 'order') && (
            <section className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-extrabold text-[#0d1f33] inline-flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#1769aa]" />
                  {tr('Склад замовлення та розбивка товарів', 'Состав заказа и разбивка товаров')}
                </h4>
                {deal.items.length > 0 && (
                  <span className="font-mono text-[11px] font-bold text-slate-600 tabular-nums">
                    {deal.items.length} {tr('поз.', 'поз.')} · {totalUnits} {tr('шт.', 'шт.')}
                  </span>
                )}
              </div>

              {deal.items.length === 0 ? (
                <div className="p-4 text-slate-500 text-center bg-white">
                  {tr(
                    'Позиції з каталогу не додані (замовлення оформлено за погодженою сумою).',
                    'Позиции из каталога не добавлены (заказ оформлен на согласованную сумму).',
                  )}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 bg-white">
                    {deal.items.map((item) => {
                      const prod = productMap.get(item.productId);
                      const lineTotal = item.price * item.qty;
                      return (
                        <div key={item.productId} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                              {prod?.img ? (
                                <SmartImage
                                  src={prod.img}
                                  alt={item.title}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#0d1f33] leading-snug">
                                {localizeCatalogText(item.title)}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
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

                          <div className="text-right shrink-0 space-y-0.5">
                            <div className="font-mono font-extrabold text-[#0d1f33] tabular-nums">
                              ${lineTotal.toLocaleString('uk-UA')}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                              {item.qty} × ${item.price.toLocaleString('uk-UA')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{tr('Сума за позиціями каталогу', 'Сумма по позициям каталога')}</span>
                      <span className="font-mono font-bold tabular-nums">
                        ${itemsSubtotalUsd.toLocaleString('uk-UA')}
                      </span>
                    </div>
                    {deal.totalUsd !== itemsSubtotalUsd && (
                      <div className="flex items-center justify-between text-[#1769aa] font-semibold">
                        <span>{tr('Коригування / знижка / монтаж', 'Корректировка / скидка / монтаж')}</span>
                        <span className="font-mono font-bold tabular-nums">
                          {deal.totalUsd > itemsSubtotalUsd ? '+' : '−'}$
                          {Math.abs(deal.totalUsd - itemsSubtotalUsd).toLocaleString('uk-UA')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm font-extrabold text-[#0d1f33] pt-1 border-t border-slate-200/70">
                      <span>{tr('Разом до оплати', 'Итого к оплате')}</span>
                      <span className="font-mono text-[#169374] tabular-nums">
                        ${deal.totalUsd.toLocaleString('uk-UA')}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Critical Loads (for engineering leads) */}
          {deal.loads.length > 0 && (
            <section className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 space-y-2">
              <div className="font-bold text-slate-600">{tr('Критичні прилади')}</div>
              <div className="flex flex-wrap gap-1.5">
                {deal.loads.map((load) => (
                  <span
                    key={load}
                    className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[#0d1f33] font-semibold"
                  >
                    {load}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Linked Tasks Preview */}
          {dealTasks.length > 0 && (
            <section className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 space-y-2">
              <div className="font-bold text-slate-600 inline-flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#1769aa]" />
                {tr('Пов’язані задачі', 'Связанные задачи')} ({dealTasks.length})
              </div>
              <div className="space-y-1.5">
                {dealTasks.map((t) => (
                  <div
                    key={t.id}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className={t.status === 'done' ? 'line-through text-slate-400' : 'font-semibold text-[#0d1f33]'}>
                      {t.title}
                    </span>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {t.assignee}
                      {t.dueDate ? ` · ${t.dueDate}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stage, Assignee, Budget & Notes Management */}
          <section className="space-y-3.5 pt-1 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="detail-deal-stage" className="block font-bold text-slate-600 mb-1">
                  {tr('Етап воронки')}
                </label>
                <select
                  id="detail-deal-stage"
                  value={deal.stage}
                  disabled={saving}
                  onChange={(e) => void onPatchDeal(deal.id, { stage: e.target.value as DealStage })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {tr(s.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="detail-deal-assignee" className="block font-bold text-slate-600 mb-1">
                  {tr('Відповідальний')}
                </label>
                <select
                  id="detail-deal-assignee"
                  value={deal.assignee}
                  disabled={saving}
                  onChange={(e) => void onPatchDeal(deal.id, { assignee: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
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
              <label htmlFor="detail-deal-total" className="block font-bold text-slate-600 mb-1">
                {tr('Бюджет / Сума угоди (USD)')}
              </label>
              <input
                id="detail-deal-total"
                type="number"
                min="0"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                onBlur={() => {
                  if (parsedTotal !== deal.totalUsd) {
                    void onPatchDeal(deal.id, { totalUsd: parsedTotal });
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>

            <div>
              <label htmlFor="detail-deal-notes" className="block font-bold text-slate-600 mb-1">
                {tr('Нотатки інженера / менеджера')}
              </label>
              <textarea
                id="detail-deal-notes"
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                onBlur={() => {
                  if (notesInput !== deal.notes) {
                    void onPatchDeal(deal.id, { notes: notesInput });
                  }
                }}
                placeholder={tr('Додайте нотатку по об’єкту...')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </section>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="inline-flex items-center gap-1.5 text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#169374]" />
              <span>
                {saving
                  ? tr('Зберігаємо зміни...', 'Сохраняем изменения...')
                  : tr('Зміни зберігаються в SQLite автоматично')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveDetails()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {tr('Зберегти зміни', 'Сохранить изменения')}
                </button>
              )}

              {confirmDelete ? (
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void onDeleteDeal(deal.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr('Підтвердити видалення', 'Подтвердить удаление')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-slate-500 font-semibold hover:underline cursor-pointer"
                  >
                    {tr('Скасувати')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {tr('Видалити угоду')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
