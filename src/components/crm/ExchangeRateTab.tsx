import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Banknote, CheckCircle2, RefreshCw, TrendingUp } from 'lucide-react';
import type { CrmExchangeRateResponse, CrmSessionUser } from '../../types.ts';
import { tr } from '../../lib/i18n.ts';

interface ExchangeRateTabProps {
  data: CrmExchangeRateResponse | null;
  loading: boolean;
  currentUser: CrmSessionUser | null;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefresh: (forceMarketRefresh?: boolean) => Promise<void>;
  onDataUpdated: (next: CrmExchangeRateResponse) => void;
}

export function ExchangeRateTab({
  data,
  loading,
  currentUser,
  authFetch,
  onRefresh,
  onDataUpdated,
}: ExchangeRateTabProps) {
  const canEdit = !currentUser || currentUser.role === 'admin' || currentUser.role === 'manager';

  const [rateInput, setRateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    const initial = data.commercial.rate ?? data.effectiveRate ?? data.market7km.sell;
    if (initial && !rateInput) {
      setRateInput(initial.toFixed(2));
    }
  }, [data, rateInput]);

  const numericPreview = Number(String(rateInput).replace(',', '.'));
  const hasValidPreview = Number.isFinite(numericPreview) && numericPreview >= 10 && numericPreview <= 500;

  function applySuggestedRate(value: number | null | undefined, delta = 0) {
    if (!value || !Number.isFinite(value)) return;
    const next = Math.round((value + delta) * 100) / 100;
    setRateInput(next.toFixed(2));
    setErr('');
    setMsg('');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');

    const parsed = Number(String(rateInput).replace(',', '.').trim());
    if (!Number.isFinite(parsed) || parsed < 10 || parsed > 500) {
      setErr(tr('Вкажіть коректний курс у межах від 10 до 500 грн за 1 USD', 'Укажите корректный курс в пределах от 10 до 500 грн за 1 USD'));
      return;
    }

    setSaving(true);
    try {
      const resp = await authFetch('/api/crm/exchange-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: parsed }),
      });
      const payload = (await resp.json().catch(() => ({}))) as CrmExchangeRateResponse & { error?: string };
      if (!resp.ok || !payload.commercial) {
        setErr(payload.error || tr('Не вдалося зберегти комерційний курс', 'Не удалось сохранить коммерческий курс'));
        return;
      }
      onDataUpdated(payload);
      if (payload.commercial.rate !== null) {
        setRateInput(payload.commercial.rate.toFixed(2));
      }
      setMsg(
        tr(
          `Комерційний курс оновлено: 1 USD = ${payload.commercial.rate?.toFixed(2)} грн. Ціни на вітрині вже перераховано.`,
          `Коммерческий курс обновлён: 1 USD = ${payload.commercial.rate?.toFixed(2)} грн. Цены на витрине уже пересчитаны.`,
        ),
      );
    } catch {
      setErr(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSaving(false);
    }
  }

  const market = data?.market7km;
  const commercial = data?.commercial;
  const effectiveRate = data?.effectiveRate ?? null;

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#1769aa]" />
            {tr('Управління комерційним курсом (USD → UAH)', 'Управление коммерческим курсом (USD → UAH)')}
          </h2>
          <p className="text-xs text-[#52657a] mt-0.5">
            {tr(
              'Курс відв’язано від НБУ. Усі гривневі ціни на вітрині, в кошику та фіді розраховуються за вашим комерційним курсом.',
              'Курс отвязан от НБУ. Все цены в гривнах на витрине, в корзине и фиде рассчитываются по вашему коммерческому курсу.',
            )}
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void onRefresh(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? tr('Оновлюємо 7 км…', 'Обновляем 7 км…') : tr('Оновити курс «7 км»', 'Обновить курс «7 км»')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Manual Commercial Rate Card */}
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tr('Активний курс вітрини', 'Активный курс витрины')}
              </div>
              <div className="font-mono text-2xl font-extrabold text-[#0d1f33] mt-0.5 tabular-nums">
                {effectiveRate ? `${effectiveRate.toFixed(2)} ₴` : '—'}
                <span className="text-xs font-sans font-semibold text-slate-500 ml-1.5">/ 1 USD</span>
              </div>
            </div>

            {data?.effectiveSource === 'commercial' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#169374]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {tr('Задано вручну', 'Задан вручную')}
              </span>
            ) : data?.effectiveSource === 'market_fallback' ? (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                {tr('Авто-орієнтир «7 км» (до збереження)', 'Авто-ориентир «7 км» (до сохранения)')}
              </span>
            ) : null}
          </div>

          {commercial?.updatedAt && (
            <div className="text-[11px] text-slate-500">
              {tr('Останнє ручне оновлення:', 'Последнее ручное обновление:')}{' '}
              <strong className="text-slate-700">{new Date(commercial.updatedAt).toLocaleString('uk-UA')}</strong>
              {commercial.updatedBy ? ` · ${commercial.updatedBy}` : ''}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="crm-commercial-rate-input" className="block text-xs font-bold text-slate-700">
              {tr('Комерційний курс (грн за 1 USD)', 'Коммерческий курс (грн за 1 USD)')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="crm-commercial-rate-input"
                type="number"
                step="0.01"
                min="10"
                max="500"
                required
                disabled={!canEdit || saving}
                value={rateInput}
                onChange={(e) => {
                  setRateInput(e.target.value);
                  setErr('');
                  setMsg('');
                }}
                placeholder="45.80"
                className="w-40 px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-base font-extrabold text-[#0d1f33] disabled:bg-slate-100"
              />
              {canEdit && hasValidPreview && (
                <div className="inline-flex items-center gap-1">
                  {[-0.1, 0.1, 0.25].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => applySuggestedRate(numericPreview, step)}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-mono text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      {step > 0 ? `+${step.toFixed(2)}` : step.toFixed(2)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Price Conversion Preview */}
          {hasValidPreview && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="font-bold text-slate-600">
                {tr('Попередній перерахунок цін для сайту:', 'Предварительный пересчёт цен для сайта:')}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                {[100, 1000, 5000].map((usd) => (
                  <div key={usd} className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-2">
                    <div className="text-[10.5px] text-slate-400">${usd.toLocaleString('uk-UA')}</div>
                    <div className="font-bold text-[#0d1f33] tabular-nums">
                      {Math.round(usd * numericPreview).toLocaleString('uk-UA')} ₴
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{err}</div>
          )}
          {msg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#169374]">
              {msg}
            </div>
          )}

          {canEdit ? (
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти комерційний курс', 'Сохранить коммерческий курс')}
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              {tr('Змінювати комерційний курс можуть адміністратор або менеджер.', 'Изменять коммерческий курс могут администратор или менеджер.')}
            </div>
          )}
        </form>

        {/* 7km Odessa Market Reference Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-[#0d1f33] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                {tr('Курс долара «7 км» (Одеса)', 'Курс доллара «7 км» (Одесса)')}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {market?.sourceLabel || tr('Одеса · готівковий та оптовий ринок', 'Одесса · наличный и оптовый рынок')}
              </p>
            </div>
            {market?.stale && (
              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10.5px] font-bold text-amber-800">
                {tr('Кеш', 'Кэш')}
              </span>
            )}
          </div>

          {market?.available ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">{tr('Купівля USD', 'Покупка USD')}</div>
                  <div className="font-mono text-2xl font-extrabold text-[#0d1f33] mt-1 tabular-nums">
                    {market.buy ? `${market.buy.toFixed(2)} ₴` : '—'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-900">{tr('Продаж USD', 'Продажа USD')}</div>
                  <div className="font-mono text-2xl font-extrabold text-amber-950 mt-1 tabular-nums">
                    {market.sell ? `${market.sell.toFixed(2)} ₴` : '—'}
                  </div>
                </div>
              </div>

              {(market.wholesaleSell || market.cityAverageSell) && (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                  {market.wholesaleBuy && market.wholesaleSell && (
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-slate-600 font-semibold">
                        {tr('Одеса «7 км» / опт (від $500)', 'Одесса «7 км» / опт (от $500)')}
                      </span>
                      <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
                        {market.wholesaleBuy.toFixed(2)} / {market.wholesaleSell.toFixed(2)} ₴
                      </span>
                    </div>
                  )}
                  {market.cityAverageBuy && market.cityAverageSell && (
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-slate-600 font-semibold">
                        {tr('Середній готівковий по Одесі (Minfin)', 'Средний наличный по Одессе (Minfin)')}
                      </span>
                      <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
                        {market.cityAverageBuy.toFixed(2)} / {market.cityAverageSell.toFixed(2)} ₴
                      </span>
                    </div>
                  )}
                </div>
              )}

              {canEdit && market.sell && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-500">
                    {tr('Швидко підставити у форму зліва:', 'Быстро подставить в форму слева:')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applySuggestedRate(market.sell, 0)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                      {tr(`Продаж 7 км (${market.sell.toFixed(2)})`, `Продажа 7 км (${market.sell.toFixed(2)})`)}
                    </button>
                    <button
                      type="button"
                      onClick={() => applySuggestedRate(market.sell, 0.2)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#0d1f33] text-xs font-bold cursor-pointer"
                    >
                      {tr(`Продаж +0.20 (${(market.sell + 0.2).toFixed(2)})`, `Продажа +0.20 (${(market.sell + 0.2).toFixed(2)})`)}
                    </button>
                    {market.cityAverageSell && market.cityAverageSell !== market.sell && (
                      <button
                        type="button"
                        onClick={() => applySuggestedRate(market.cityAverageSell, 0)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#0d1f33] text-xs font-bold cursor-pointer"
                      >
                        {tr(`Minfin Одеса (${market.cityAverageSell.toFixed(2)})`, `Minfin Одесса (${market.cityAverageSell.toFixed(2)})`)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-400">
                {tr('Дані отримано:', 'Данные получены:')} {new Date(market.fetchedAt).toLocaleString('uk-UA')}
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold">
                {market?.error || tr('Не вдалося отримати актуальний курс «7 км»', 'Не удалось получить актуальный курс «7 км»')}
              </div>
              <p className="text-[11px]">
                {tr(
                  'Ви можете ввести комерційний курс вручну у формі ліворуч та натиснути «Оновити курс 7 км» пізніше.',
                  'Вы можете ввести коммерческий курс вручную в форме слева и нажать «Обновить курс 7 км» позже.',
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
