import { useState, type FormEvent } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CartItem, Deal } from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { trackEvent } from '../lib/analytics.ts';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClearCart: () => void;
  onOrderCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
}

export function CartDrawer({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemove,
  onClearCart,
  onOrderCreated,
  onOpenCrm,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Одеса (самовивіз / доставка)');
  const [channel, setChannel] = useState('Телефон');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedDeal, setConfirmedDeal] = useState<Deal | null>(null);

  if (!open) return null;

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'Покупець магазину',
          phone,
          city,
          channel,
          notes,
          website,
          items: items.map((i) => ({ productId: i.id, qty: i.qty })),
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setError(data.error || 'Помилка оформлення замовлення');
      } else {
        setConfirmedDeal(data.deal);
        trackEvent('purchase', {
          transaction_id: data.deal.dealNumber,
          value: data.deal.totalUsd,
          currency: 'USD',
          items_count: data.deal.items.length,
        });
        onClearCart();
        onOrderCreated(data.deal);
      }
    } catch {
      setError('Сервер замовлень недоступний. Оформіть замовлення телефоном: +38 (050) 777-71-72.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex justify-end"
      onClick={() => {
        setConfirmedDeal(null);
        onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#1769aa]" />
            <h3 className="text-base font-extrabold text-[#0d1f33]">
              Кошик обладнання <span className="font-mono text-sm text-slate-500">({totalQty})</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmedDeal(null);
              onClose();
            }}
            aria-label="Закрити кошик"
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {confirmedDeal ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 text-[#169374] font-bold text-sm mb-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Замовлення {confirmedDeal.dealNumber} підтверджено</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Сума: <strong className="font-mono">${confirmedDeal.totalUsd.toLocaleString('uk-UA')}</strong> · Позицій:{' '}
                  {confirmedDeal.items.length}
                  <br />
                  Замовлення передано у CRM менеджерам Energo Comfort та зафіксовано на номер {confirmedDeal.phone}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmedDeal(null);
                  onClose();
                  onOpenCrm();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold cursor-pointer"
              >
                Відкрити замовлення у CRM
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#0d1f33] mb-1">Кошик порожній</p>
              <p className="text-xs text-slate-500">
                Додайте інвертор, LiFePO4 акумулятор, сонячну панель або автоматику захисту з розділу «Обладнання».
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
                      <SmartImage src={item.img} alt={item.title} className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#0d1f33] line-clamp-2">{item.title}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        ${item.price.toLocaleString('uk-UA')} × {item.qty} ={' '}
                        <strong className="text-[#0d1f33]">
                          ${(item.price * item.qty).toLocaleString('uk-UA')}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label="Зменшити кількість"
                          className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold w-6 text-center tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label="Збільшити кількість"
                          className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          aria-label="Видалити"
                          className="ml-auto text-slate-400 hover:text-red-600 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-[#0d1f33]">
                <span>Разом ({totalQty} од.):</span>
                <span className="font-mono text-lg tabular-nums">${subtotal.toLocaleString('uk-UA')}</span>
              </div>

              <form onSubmit={handleCheckout} className="space-y-3 pt-2 border-t border-slate-200">
                <div className="hidden" aria-hidden="true">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <div className="text-xs font-bold text-[#0d1f33]">Оформлення замовлення</div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ваше ім’я або компанія"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Телефон * (+38 0__ ___ __ __)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Місто / Нова Пошта"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1769aa]"
                  >
                    <option value="Телефон">Дзвінок</option>
                    <option value="Telegram">Telegram</option>
                    <option value="Viber">Viber</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Коментар щодо доставки, ПДВ/ФОП або сумісності"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                />

                {error && <div className="text-xs font-semibold text-red-600">{error}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-[#0d1f33] hover:text-white text-sm font-extrabold transition-colors cursor-pointer"
                >
                  {submitting ? 'Оформлюємо...' : 'Підтвердити замовлення'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
