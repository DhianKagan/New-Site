import { useState, type FormEvent } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Deal } from '../types.ts';
import { trackEvent } from '../lib/analytics.ts';

interface LeadModalProps {
  open: boolean;
  initialTopic: string;
  estimatedTotalUsd?: number;
  onClose: () => void;
  onCreated: (deal: Deal) => void;
  onOpenCrm: () => void;
}

export function LeadModal({
  open,
  initialTopic,
  estimatedTotalUsd,
  onClose,
  onCreated,
  onOpenCrm,
}: LeadModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Одеса');
  const [channel, setChannel] = useState('Telegram');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdDeal, setCreatedDeal] = useState<Deal | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'Клієнт сайту',
          phone,
          city,
          channel,
          topic: initialTopic,
          taskType: initialTopic,
          notes,
          website,
          estimatedTotalUsd,
        }),
      });
      const data = (await resp.json()) as { deal?: Deal; error?: string };
      if (!resp.ok || !data.deal) {
        setError(data.error || 'Помилка збереження заявки');
      } else {
        setCreatedDeal(data.deal);
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
    setNotes('');
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
            <div className="text-[11px] font-bold text-[#1769aa]">Відповідь інженера за 15 хв</div>
            <h3 id="lead-modal-title" className="text-lg font-extrabold text-[#0d1f33] mt-0.5">
              Підбір та інженерний розрахунок
            </h3>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Закрити"
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
                  <span>Заявку {createdDeal.dealNumber} створено в CRM</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Тема: <strong>{createdDeal.topic}</strong>
                  <br />
                  Контакт: {createdDeal.phone} ({createdDeal.channel}, {createdDeal.city})
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
                  Переглянути у CRM
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
                >
                  Готово
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0d1f33] mb-1">Обрана тема / конфігурація</label>
                <input
                  type="text"
                  value={initialTopic}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Ваше ім’я</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Наприклад, Андрій"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Телефон *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+38 (0__) ___-__-__"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Місто або район</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Зручний канал</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1769aa]"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Viber">Viber</option>
                    <option value="Телефон">Дзвінок</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0d1f33] mb-1">Коментар (фази, прилади, дах)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="1 чи 3 фази, які прилади потрібно живити..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
              </div>

              {error && <div className="text-xs font-semibold text-red-600">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
              >
                {submitting ? 'Надсилаємо...' : 'Отримати розрахунок за 15 хв'}
              </button>
              <div className="text-center text-[11px] text-slate-500">
                Або телефонуйте зараз:{' '}
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
