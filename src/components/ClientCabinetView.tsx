import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  User,
} from 'lucide-react';
import type { CustomerProfile, Deal, DealStage } from '../types.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';
import { tr } from '../lib/i18n.ts';
import { Badge } from './ui/badge.tsx';
import { Button } from './ui/button.tsx';
import { Card } from './ui/card.tsx';
import { Input } from './ui/input.tsx';

interface ClientCabinetViewProps {
  clientToken: string;
  initialCustomer: CustomerProfile | null;
  usdUahRate: number | null;
  onCustomerUpdated: (customer: CustomerProfile) => void;
  onOpenLeadModal: (topic: string) => void;
  onNavigateShop: () => void;
  onBackToStore: () => void;
  onLogout: () => void;
  refreshTrigger?: number;
}

const STAGE_META: Record<
  DealStage,
  { uk: string; ru: string; variant: 'warning' | 'info' | 'success' | 'neutral' }
> = {
  new: { uk: 'Нова заявка', ru: 'Новая заявка', variant: 'info' },
  audit: { uk: 'Інженерний аудит', ru: 'Инженерный аудит', variant: 'warning' },
  proposal: { uk: 'КП підготовлено', ru: 'КП подготовлено', variant: 'info' },
  fulfillment: { uk: 'Комплектація / монтаж', ru: 'Комплектация / монтаж', variant: 'warning' },
  done: { uk: 'Виконано', ru: 'Выполнено', variant: 'success' },
  archived: { uk: 'Архів', ru: 'Архив', variant: 'neutral' },
};

export function ClientCabinetView({
  clientToken,
  initialCustomer,
  usdUahRate,
  onCustomerUpdated,
  onOpenLeadModal,
  onNavigateShop,
  onBackToStore,
  onLogout,
  refreshTrigger = 0,
}: ClientCabinetViewProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(initialCustomer);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState(initialCustomer?.name || '');
  const [phone, setPhone] = useState(initialCustomer?.phone ? formatUaPhone(initialCustomer.phone) : '');
  const [city, setCity] = useState(initialCustomer?.city || 'Одеса');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');

  const loadCabinet = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const resp = await fetch('/api/client/me', {
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      if (resp.status === 401) {
        onLogout();
        return;
      }
      const data = (await resp.json()) as { customer?: CustomerProfile; deals?: Deal[]; error?: string };
      if (!resp.ok || !data.customer) {
        setLoadError(data.error || tr('Не вдалося завантажити дані кабінету', 'Не удалось загрузить данные кабинета'));
        return;
      }
      setCustomer(data.customer);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setName(data.customer.name);
      setPhone(data.customer.phone ? formatUaPhone(data.customer.phone) : '');
      setCity(data.customer.city || 'Одеса');
      onCustomerUpdated(data.customer);
    } catch {
      setLoadError(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setLoading(false);
    }
  }, [clientToken, onCustomerUpdated, onLogout]);

  useEffect(() => {
    void loadCabinet();
  }, [loadCabinet, refreshTrigger]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileNotice('');
    setProfileError('');

    if (name.trim().length < 2) {
      setProfileError(tr('Ім’я має містити щонайменше 2 символи', 'Имя должно содержать минимум 2 символа'));
      return;
    }
    if (phone.trim() && !isValidUaPhone(phone)) {
      setProfileError(tr('Вкажіть коректний номер у форматі +380 XX XXX XX XX', 'Укажите корректный номер в формате +380 XX XXX XX XX'));
      return;
    }

    setSavingProfile(true);
    try {
      const resp = await fetch('/api/client/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() ? `+${phone.replace(/\D/g, '')}` : '',
          city: city.trim() || 'Одеса',
        }),
      });
      const data = (await resp.json()) as { customer?: CustomerProfile; deals?: Deal[]; error?: string };
      if (!resp.ok || !data.customer) {
        setProfileError(data.error || tr('Не вдалося зберегти профіль', 'Не удалось сохранить профиль'));
        return;
      }
      setCustomer(data.customer);
      if (Array.isArray(data.deals)) setDeals(data.deals);
      onCustomerUpdated(data.customer);
      setProfileNotice(tr('Профіль оновлено', 'Профиль обновлён'));
    } catch {
      setProfileError(tr('Помилка з’єднання із сервером', 'Ошибка соединения с сервером'));
    } finally {
      setSavingProfile(false);
    }
  }

  const activeDeals = deals.filter((d) => d.stage !== 'done' && d.stage !== 'archived');
  const completedDeals = deals.filter((d) => d.stage === 'done');

  return (
    <div className="bg-[#f6f8fb] min-h-[calc(100vh-140px)] pb-14">
      {/* Cabinet Header Bar */}
      <div className="bg-[#0d1f33] text-white border-b border-white/10">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {tr('Повернутися до магазину', 'Вернуться в магазин')}
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              {tr('Особистий кабінет', 'Личный кабинет')} · {customer?.name || tr('Клієнт', 'Клиент')}
            </h1>
            {customer?.email && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-300">
                <Mail className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>{customer.email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenLeadModal(tr('Розрахунок системи з особистого кабінету', 'Расчёт системы из личного кабинета'))}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] border-0 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {tr('Новий розрахунок', 'Новый расчёт')}
            </Button>
            <Button variant="outline" size="sm" onClick={onNavigateShop} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <ShoppingBag className="w-3.5 h-3.5" />
              {tr('Каталог', 'Каталог')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="bg-transparent text-slate-200 border-white/20 hover:bg-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              {tr('Вийти', 'Выйти')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 pt-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#1769aa] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('Усього замовлень і заявок', 'Всего заказов и заявок')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{deals.length}</div>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('В роботі зараз', 'В работе сейчас')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{activeDeals.length}</div>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">{tr('Виконано', 'Выполнено')}</div>
              <div className="text-xl font-extrabold text-[#0d1f33] tabular-nums">{completedDeals.length}</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Orders & Requests History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#0d1f33]">
                {tr('Мої замовлення та заявки', 'Мои заказы и заявки')}
              </h2>
              <button
                type="button"
                onClick={() => void loadCabinet()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769aa] hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {tr('Оновити', 'Обновить')}
              </button>
            </div>

            {loadError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {loadError}
              </div>
            )}

            {loading && deals.length === 0 ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-32 rounded-xl bg-white border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <Card className="p-8 text-center">
                <ShoppingBag className="w-9 h-9 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-extrabold text-[#0d1f33] mb-1">
                  {tr('Поки немає замовлень чи заявок', 'Пока нет заказов или заявок')}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  {tr(
                    'Оформіть замовлення в каталозі або надішліть запит на підбір обладнання — усі ваші заявки з’являться тут автоматично.',
                    'Оформите заказ в каталоге или отправьте запрос на подбор оборудования — все ваши заявки появятся здесь автоматически.',
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Button onClick={() => onOpenLeadModal(tr('Підбір рішення з кабінету', 'Подбор решения из кабинета'))}>
                    {tr('Підібрати рішення', 'Подобрать решение')}
                  </Button>
                  <Button variant="outline" onClick={onNavigateShop}>
                    {tr('Перейти в каталог', 'Перейти в каталог')}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3.5">
                {deals.map((deal) => {
                  const stageInfo = STAGE_META[deal.stage] || STAGE_META.new;
                  const createdLabel = new Date(deal.createdAt).toLocaleDateString('uk-UA', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <Card key={deal.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-[#1769aa] bg-sky-50 px-2 py-0.5 rounded">
                              {deal.dealNumber}
                            </span>
                            <Badge variant={stageInfo.variant}>{tr(stageInfo.uk, stageInfo.ru)}</Badge>
                            <span className="text-[11px] text-slate-400">{createdLabel}</span>
                          </div>
                          <h3 className="text-sm font-extrabold text-[#0d1f33] mt-1.5">{deal.topic}</h3>
                        </div>

                        {deal.totalUsd > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-extrabold text-[#0d1f33] font-mono">
                              {formatUahFromUsd(deal.totalUsd, usdUahRate)}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">≈ ${deal.totalUsd.toLocaleString('en-US')}</div>
                          </div>
                        )}
                      </div>

                      {deal.items.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-1.5">
                          {deal.items.map((item, idx) => (
                            <div key={`${item.productId}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-[#0d1f33] font-medium truncate">
                                {item.title} <span className="text-slate-400">× {item.qty}</span>
                              </span>
                              <span className="font-mono font-bold text-slate-700 shrink-0">
                                {formatUahFromUsd(item.price * item.qty, usdUahRate)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {deal.phone}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {deal.city || 'Одеса'}
                        </span>
                        {deal.assignee && (
                          <span>
                            {tr('Відповідальний:', 'Ответственный:')} <strong className="text-[#0d1f33]">{deal.assignee}</strong>
                          </span>
                        )}
                      </div>

                      {deal.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50/70 border-l-2 border-slate-300 pl-3 py-1 whitespace-pre-line">
                          {deal.notes}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Client Profile Card */}
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#0d1f33] text-white flex items-center justify-center">
                <User className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#0d1f33]">{tr('Мій профіль', 'Мой профиль')}</h2>
                <div className="text-[11px] text-slate-500">{customer?.email}</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              {tr(
                'Вкажіть номер телефону, з якого ви залишали заявки раніше — вони автоматично підтягнуться до вашого кабінету.',
                'Укажите номер телефона, с которого вы оставляли заявки ранее — они автоматически привяжутся к вашему кабинету.',
              )}
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label htmlFor="client-profile-name" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Ім’я', 'Имя')}
                </label>
                <Input
                  id="client-profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingProfile}
                  required
                />
              </div>

              <div>
                <label htmlFor="client-profile-phone" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Телефон', 'Телефон')}
                </label>
                <Input
                  id="client-profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatUaPhone(e.target.value))}
                  placeholder="+380 50 000 00 00"
                  disabled={savingProfile}
                  className="font-mono"
                />
              </div>

              <div>
                <label htmlFor="client-profile-city" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Місто', 'Город')}
                </label>
                <Input
                  id="client-profile-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Одеса"
                  disabled={savingProfile}
                />
              </div>

              {profileError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {profileError}
                </div>
              )}
              {profileNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileNotice}</span>
                </div>
              )}

              <Button type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? tr('Збереження...', 'Сохранение…') : tr('Зберегти дані', 'Сохранить данные')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
