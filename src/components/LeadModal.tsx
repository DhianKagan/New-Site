import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CustomerProfile, Deal } from '../types.ts';
import { track, trackEvent, type LeadPayload, type Placement, type Property, type Scenario } from '../lib/analytics.ts';
import { tr } from '../lib/i18n.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';

interface LeadModalProps {
  open: boolean;
  initialTopic: string;
  initialNotes?: string;
  estimatedTotalUsd?: number;
  clientToken?: string | null;
  clientCustomer?: CustomerProfile | null;
  onClose: () => void;
  onCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
  placement?: Placement;
}

export function LeadModal({
  open,
  initialTopic,
  initialNotes = '',
  estimatedTotalUsd,
  clientToken,
  clientCustomer,
  onClose,
  onCreated,
  onOpenCrm,
  placement = 'section',
}: LeadModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Одеса');
  const [channel, setChannel] = useState('Telegram');
  const [notes, setNotes] = useState(initialNotes);
  const [property, setProperty] = useState<Property | ''>('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdDeal, setCreatedDeal] = useState<Deal | null>(null);
  const formStarted = useRef(false);

  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setError('');
      setCreatedDeal(null);
      formStarted.current = false;
      if (clientCustomer) {
        if (!customerName && clientCustomer.name) setCustomerName(clientCustomer.name);
        if (!phone && clientCustomer.phone) setPhone(formatUaPhone(clientCustomer.phone));
        if (clientCustomer.city) setCity(clientCustomer.city);
      }
    }
  }, [open, initialNotes, clientCustomer]);

  function getScenario(topic: string): Scenario {
    if (/сес|соняч|solar/i.test(topic)) return 'solar';
    if (/гібрид|гибрид|hybrid/i.test(topic)) return 'hybrid';
    if (/резерв|backup|живлен/i.test(topic)) return 'backup';
    return 'unspecified';
  }

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const scenario = getScenario(initialTopic);
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!customerName.trim()) {
      track({ name: 'form_error', field: 'name', placement, scenario });
      setError(tr('Вкажіть ваше ім’я', 'Укажите ваше имя'));
      return;
    }
    if (!isValidUaPhone(phone)) {
      track({ name: 'form_error', field: 'phone', placement, scenario });
      setError(tr('Вкажіть номер телефону у форматі +380 XX XXX XX XX', 'Укажите номер телефона в формате +380 XX XXX XX XX'));
      return;
    }
    if (!property) {
      track({ name: 'form_error', field: 'property', placement, scenario });
      setError(tr('Оберіть тип об’єкта', 'Выберите тип объекта'));
      return;
    }
    const propertyLabel = property === 'apartment'
      ? tr('Квартира', 'Квартира')
      : property === 'house'
        ? tr('Приватний будинок', 'Частный дом')
        : tr('Бізнес', 'Бизнес');
    const leadPayload: LeadPayload = {
      name: customerName.trim(),
      phone: `+${normalizedPhone}`,
      property,
      consent: true,
    };
    setSubmitting(true);
    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientToken ? { Authorization: `Bearer ${clientToken}` } : {}),
        },
        body: JSON.stringify({
          customerName: leadPayload.name,
          phone: leadPayload.phone,
          property: leadPayload.property,
          city,
          channel,
          topic: `${propertyLabel} · ${initialTopic}`,
          taskType: initialTopic,
          notes: [tr(`Тип об’єкта: ${propertyLabel}`, `Тип объекта: ${propertyLabel}`), notes].filter(Boolean).join('\n'),
          website,
          estimatedTotalUsd,
          consent: leadPayload.consent,
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setError(data.error || 'Помилка збереження заявки');
      } else {
        setCreatedDeal(data.deal);
        track({ name: 'lead_submit', placement, scenario, property });
        trackEvent('generate_lead', {
          lead_topic: initialTopic,
          value: estimatedTotalUsd ?? 0,
          currency: 'USD',
        });
        onCreated(data.deal);
      }
    } catch {
      setError('Сервер заявок зараз недоступний. Зателефонуйте нам: +38 (050) 777-71-72.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetAndClose() {
    setCreatedDeal(null);
    setError('');
    setCustomerName('');
    setPhone('');
    setProperty('');
    setNotes('');
    formStarted.current = false;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={handleResetAndClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="text-[11px] font-bold text-[#1769aa]">{tr('Зв’язок з інженером', 'Связь с инженером')}</div>
            <h3 id="lead-modal-title" className="text-lg font-extrabold text-[#0d1f33] mt-0.5">
              {tr('Підбір та інженерний розрахунок')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label={tr('Закрити')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {createdDeal ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 text-[#169374] font-bold text-sm mb-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{tr('Заявку', 'Заявку')} {createdDeal.dealNumber} {tr('створено в CRM', 'создана в CRM')}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {tr('Тема:', 'Тема:')} <strong>{createdDeal.topic}</strong>
                  <br />
                  {tr('Контакт:', 'Контакт:')} {createdDeal.phone} ({createdDeal.channel}, {createdDeal.city})
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleResetAndClose();
                    onOpenCrm();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold cursor-pointer"
                >
                  {tr('Переглянути у CRM')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
                >
                  {tr('Готово')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5" onFocus={() => {
              if (!formStarted.current) {
                formStarted.current = true;
                track({ name: 'form_start', placement, scenario: getScenario(initialTopic) });
              }
            }}>
              <div className="hidden" aria-hidden="true">
                <label htmlFor="lead-website">Website</label>
                <input
                  id="lead-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lead-name" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Ваше ім’я')}</label>
                  <input
                    id="lead-name"
                    name="customerName"
                    type="text"
                    autoComplete="name"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={tr('Наприклад, Андрій')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div>
                  <label htmlFor="lead-phone" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Телефон *')}</label>
                  <input
                    id="lead-phone"
                    name="phone"
                    type="tel"
                    required
                    aria-invalid={Boolean(error)}
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                    placeholder="+380 XX XXX XX XX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-property" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Тип об’єкта *', 'Тип объекта *')}</label>
                <select id="lead-property" name="property" required value={property} onChange={(e) => setProperty(e.target.value as Property | '')} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#1769aa]">
                  <option value="">{tr('Оберіть варіант', 'Выберите вариант')}</option>
                  <option value="apartment">{tr('Квартира', 'Квартира')}</option>
                  <option value="house">{tr('Приватний будинок', 'Частный дом')}</option>
                  <option value="business">{tr('Бізнес', 'Бизнес')}</option>
                </select>
              </div>

              <details open={Boolean(initialNotes)} className="rounded-lg border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">{tr('Додатково (необов’язково)', 'Дополнительно (необязательно)')}</summary>
                <div className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lead-city" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Місто або район')}</label>
                  <input
                    id="lead-city"
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div>
                  <label htmlFor="lead-channel" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Зручний канал')}</label>
                  <select
                    id="lead-channel"
                    name="channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1769aa]"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Viber">Viber</option>
                    <option value="Телефон">{tr('Дзвінок')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="lead-notes" className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Коментар (фази, прилади, дах)')}</label>
                <textarea
                  id="lead-notes"
                  name="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tr('1 чи 3 фази, які прилади потрібно живити...')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
              </div>
                </div>
              </details>

              {error && <div className="text-xs font-semibold text-red-600" role="alert" aria-live="polite">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-12 py-3 px-4 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d1f33]"
              >
                {submitting ? tr('Надсилаємо...') : tr('Надіслати запит на розрахунок', 'Отправить запрос на расчёт')}
              </button>
              <p className="text-[11px] text-slate-500 leading-relaxed">{tr('Надсилаючи заявку, ви погоджуєтесь на обробку персональних даних для зв’язку та підготовки розрахунку.', 'Отправляя заявку, вы соглашаетесь на обработку персональных данных для связи и подготовки расчёта.')}</p>
              <div className="text-center text-[11px] text-slate-500">
                {tr('Або телефонуйте зараз:')}{' '}
                <a href="tel:+380507777172" className="font-mono font-bold text-[#0d1f33] hover:text-[#1769aa]">
                  +38 (050) 777-71-72
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
