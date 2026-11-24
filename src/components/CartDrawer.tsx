import { useRef, useState, type FormEvent } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CartItem, Deal } from '../types.ts';
import { tr } from '../lib/i18n.ts';
import { SmartImage } from './SmartImage.tsx';
import { track, trackEvent } from '../lib/analytics.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClearCart: () => void;
  onOrderCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
  usdUahRate: number | null;
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
  usdUahRate,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Одеса (самовивіз / доставка)');
  const [channel, setChannel] = useState('Телефон');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedDeal, setConfirmedDeal] = useState<Deal | null>(null);
  const checkoutStarted = useRef(false);

  if (!open) return null;

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setError('');

    if (!isValidUaPhone(phone)) {
      track({ name: 'form_error', field: 'phone', placement: 'section', scenario: 'unspecified' });
      setError(tr('Вкажіть номер телефону у форматі +380 XX XXX XX XX', 'Укажите номер телефона в формате +380 XX XXX XX XX'));
      return;
    }

    if (!acceptedOffer) {
      setError(tr('Підтвердіть ознайомлення з проєктом публічної оферти', 'Подтвердите ознакомление с проектом публичной оферты'));
      return;
    }

    const normalizedPhone = `+${phone.replace(/\D/g, '')}`;
    setSubmitting(true);
    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'Покупець магазину',
          phone: normalizedPhone,
          city,
          channel,
          notes,
          website,
          acceptedOffer,
          items: items.map((i) => ({ productId: i.id, qty: i.qty })),
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setError(data.error || tr('Помилка оформлення замовлення', 'Ошибка оформления заказа'));
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
      setError(tr('Сервер замовлень недоступний. Оформіть замовлення телефоном: +38 (050) 777-71-72.', 'Сервер заказов недоступен. Оформите заказ по телефону: +38 (050) 777-71-72.'));
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
      aria-labelledby="cart-drawer-title"
    >
      <div
        className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#1769aa]" />
            <h3 id="cart-drawer-title" className="text-base font-extrabold text-[#0d1f33]">
              {tr('Кошик обладнання', 'Корзина оборудования')} <span className="font-mono text-sm text-slate-500">({totalQty})</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmedDeal(null);
              onClose();
            }}
            aria-label={tr('Закрити кошик', 'Закрыть корзину')}
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
                  <span>{tr('Запит на замовлення', 'Запрос на заказ')} {confirmedDeal.dealNumber} {tr('надіслано', 'отправлен')}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {tr('Сума:', 'Сумма:')} <strong className="font-mono">{formatUahFromUsd(confirmedDeal.totalUsd, usdUahRate)}</strong> · {tr('Позицій:', 'Позиций:')}{' '}
                  {confirmedDeal.items.length}
                  <br />
                  {tr(`Замовлення передано у CRM менеджерам Energo Comfort та зафіксовано на номер ${confirmedDeal.phone}.`, `Заказ передан менеджерам Energo Comfort в CRM. Контактный номер: ${confirmedDeal.phone}.`)}
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
                {tr('Відкрити замовлення у CRM', 'Открыть заказ в CRM')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#0d1f33] mb-1">{tr('Кошик порожній', 'Корзина пуста')}</p>
              <p className="text-xs text-slate-500">
                {tr('Додайте інвертор, LiFePO4 акумулятор, сонячну панель або автоматику захисту з розділу «Обладнання».', 'Добавьте инвертор, аккумулятор LiFePO4, солнечную панель или защитную автоматику из раздела «Оборудование».')}
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
                        {formatUahFromUsd(item.price, usdUahRate)} × {item.qty} ={' '}
                        <strong className="text-[#0d1f33]">
                          {formatUahFromUsd(item.price * item.qty, usdUahRate)}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={tr('Зменшити кількість', 'Уменьшить количество')}
                          className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold w-6 text-center tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={tr('Збільшити кількість', 'Увеличить количество')}
                          className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          aria-label={tr('Видалити', 'Удалить')}
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
                <span>{tr('Разом', 'Итого')} ({totalQty} {tr('од.', 'шт.')}):</span>
                <span className="font-mono text-lg tabular-nums">{formatUahFromUsd(subtotal, usdUahRate)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {tr('Ціни перераховані за офіційним курсом НБУ. Остаточну суму в гривнях підтвердить менеджер під час узгодження замовлення.', 'Цены пересчитаны по официальному курсу НБУ. Итоговую сумму в гривнах менеджер подтвердит при согласовании заказа.')}
              </p>

              <form
                onSubmit={handleCheckout}
                onFocus={() => {
                  if (!checkoutStarted.current) {
                    checkoutStarted.current = true;
                    track({ name: 'form_start', placement: 'section', scenario: 'unspecified' });
                  }
                }}
                className="space-y-3 pt-2 border-t border-slate-200"
              >
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="cart-website">Website</label>
                  <input
                    id="cart-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <div className="text-xs font-bold text-[#0d1f33]">{tr('Оформлення замовлення', 'Оформление заказа')}</div>

                <div>
                  <label htmlFor="cart-customer-name" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    {tr('Ваше ім’я або компанія', 'Ваше имя или компания')}
                  </label>
                  <input
                    id="cart-customer-name"
                    name="customerName"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={tr('Наприклад, Сергій / ТОВ «Південь»', 'Например, Сергей / ООО «Юг»')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <div>
                  <label htmlFor="cart-phone" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    {tr('Телефон *', 'Телефон *')}
                  </label>
                  <input
                    id="cart-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    aria-invalid={Boolean(error)}
                    value={phone}
                    onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                    placeholder="+380 XX XXX XX XX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="cart-city" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                      {tr('Місто / Нова Пошта', 'Город / Новая Почта')}
                    </label>
                    <input
                      id="cart-city"
                      name="city"
                      type="text"
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={tr('Місто / Нова Пошта', 'Город / Новая Почта')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                  <div>
                    <label htmlFor="cart-channel" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                      {tr('Канал зв’язку', 'Канал связи')}
                    </label>
                    <select
                      id="cart-channel"
                      name="channel"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1769aa]"
                    >
                      <option value="Телефон">{tr('Дзвінок')}</option>
                      <option value="Telegram">Telegram</option>
                      <option value="Viber">Viber</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="cart-notes" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    {tr('Коментар до замовлення', 'Комментарий к заказу')}
                  </label>
                  <textarea
                    id="cart-notes"
                    name="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={tr('Коментар щодо доставки, ПДВ/ФОП або сумісності', 'Комментарий по доставке, НДС/ФЛП или совместимости')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <label htmlFor="cart-offer" className="flex items-start gap-2 text-[11px] leading-5 text-slate-600 cursor-pointer">
                  <input
                    id="cart-offer"
                    name="acceptedOffer"
                    type="checkbox"
                    required
                    checked={acceptedOffer}
                    onChange={(e) => setAcceptedOffer(e.target.checked)}
                    className="mt-1 accent-[#1769aa]"
                  />
                  <span>
                    {tr('Ознайомився(-лася) з', 'Я ознакомился(-лась) с')}{' '}
                    <a href="/public-offer" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1769aa] underline">
                      {tr('проєктом публічної оферти', 'проектом публичной оферты')}
                    </a>{' '}
                    {tr('та підтверджую, що заявка є запитом на підтвердження замовлення.', 'и подтверждаю, что заявка является запросом на подтверждение заказа.')}
                  </span>
                </label>

                {error && (
                  <div role="alert" aria-live="polite" className="text-xs font-semibold text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-[#0d1f33] hover:text-white text-sm font-extrabold transition-colors cursor-pointer"
                >
                  {submitting ? tr('Надсилаємо...') : tr('Надіслати запит на замовлення', 'Отправить запрос на заказ')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
