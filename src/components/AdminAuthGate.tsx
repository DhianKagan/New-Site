import { useState, type FormEvent } from 'react';
import { Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import type { AdminAuthStatus } from '../types.ts';
import { signInWithGooglePopup } from '../lib/firebaseAuth.ts';
import { tr } from '../lib/i18n.ts';

interface AdminAuthGateProps {
  status: AdminAuthStatus;
  apiAvailable?: boolean;
  onAuthenticated: (token: string) => void;
  onBackToStore: () => void;
}

export function AdminAuthGate({ status, apiAvailable = true, onAuthenticated, onBackToStore }: AdminAuthGateProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isSetup = status.mode === 'setup';

  async function handleGoogleLogin() {
    setError('');
    setGoogleSubmitting(true);
    try {
      const { idToken } = await signInWithGooglePopup();
      const resp = await fetch('/api/admin/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await resp.json()) as { token?: string; error?: string };
      if (!resp.ok || !data.token) {
        setError(data.error || 'Помилка входу через Google');
        return;
      }
      onAuthenticated(data.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('popup-closed-by-user')) {
        setError('Вікно входу Google було закрито до завершення авторизації');
      } else if (message.includes('unauthorized-domain')) {
        setError('Домен ще не додано в Authorized domains у Firebase Console');
      } else {
        setError('Не вдалося виконати вхід через Google');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (isSetup) {
      if (password.length < 6) {
        setError('Пароль має містити щонайменше 6 символів');
        return;
      }
      if (password !== confirmPassword) {
        setError('Паролі не співпадають');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isSetup ? '/api/admin/auth/setup' : '/api/admin/auth/login';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await resp.json()) as { token?: string; error?: string };
      if (!resp.ok || !data.token) {
        setError(data.error || 'Помилка авторизації');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      onAuthenticated(data.token);
    } catch {
      setError('Не вдалося зв’язатися із сервером');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#f6f8fb] min-h-[calc(100vh-140px)] flex items-center justify-center p-5">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-7 shadow-sm">
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769aa] hover:underline mb-5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {tr('Повернутися в магазин', 'Вернуться в магазин')}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#0d1f33] text-white flex items-center justify-center shrink-0">
            {isSetup ? <ShieldCheck className="w-5 h-5 text-[#f59e0b]" /> : <Lock className="w-5 h-5 text-[#f59e0b]" />}
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#1769aa]">{tr('Energo Comfort · Адмін-панель', 'Energo Comfort · Панель администратора')}</div>
            <h1 className="text-lg font-extrabold text-[#0d1f33]">
              {isSetup ? tr('Вхід або перше налаштування', 'Вход или первичная настройка') : tr('Вхід до CRM та налаштувань', 'Вход в CRM и настройки')}
            </h1>
          </div>
        </div>

        <p className="text-xs text-[#52657a] leading-relaxed mb-5">
          {isSetup
            ? tr('Увійдіть через Google-акаунт адміністратора або створіть резервний пароль для доступу до угод CRM, управління цінами та пікселів.', 'Войдите через аккаунт администратора Google или создайте резервный пароль для доступа к сделкам CRM, ценам и пикселям аналитики.')
            : tr('Увійдіть через Google або введіть пароль адміністратора для доступу до угод CRM, каталогу, Telegram-бота та налаштувань Meta Pixel / GA4.', 'Войдите через Google или введите пароль администратора для доступа к сделкам CRM, каталогу, Telegram-боту и настройкам Meta Pixel / GA4.')}
        </p>

        {!apiAvailable && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>{tr('Серверне API зараз недоступне', 'Серверное API сейчас недоступно')}</strong> {tr('(сайт відкрито в автономному статичному режимі). Вітрина, каталог із 250 товарів і кошик працюють, але вхід до CRM і збереження угод потребують запущеного сервера', '(сайт открыт в автономном статическом режиме). Магазин, каталог из 250 товаров и корзина работают, но для входа в CRM и сохранения сделок нужен запущенный сервер')}{' '}
            <code className="font-mono">node server.ts</code>.
          </div>
        )}

        {status.googleEnabled && apiAvailable && (
          <div className="mb-5">
            <button
              type="button"
              disabled={googleSubmitting || submitting}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-[#0d1f33] text-sm font-bold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-2xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{googleSubmitting ? tr('Виконується вхід через Google...', 'Выполняется вход через Google…') : tr('Увійти через Google', 'Войти через Google')}</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {tr('або паролем адміністратора', 'или паролем администратора')}
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#0d1f33] mb-1">
              {isSetup ? tr('Новий пароль (від 6 символів)', 'Новый пароль (от 6 символов)') : tr('Пароль адміністратора', 'Пароль администратора')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
            />
          </div>

          {isSetup && (
            <div>
              <label className="block text-xs font-bold text-[#0d1f33] mb-1">{tr('Підтвердьте пароль', 'Подтвердите пароль')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {tr(error)}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || googleSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {submitting
              ? tr('Перевіряємо...', 'Проверяем…')
              : isSetup
                ? tr('Зберегти пароль і відкрити Адмінку', 'Сохранить пароль и открыть админ-панель')
                : tr('Увійти за паролем', 'Войти по паролю')}
          </button>
        </form>
      </div>
    </div>
  );
}
