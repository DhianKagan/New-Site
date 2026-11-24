import { useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldAlert, UserPlus } from 'lucide-react';
import type { AdminAuthStatus, UnifiedAuthResult } from '../types.ts';
import { signInWithGooglePopup } from '../lib/firebaseAuth.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';
import { tr } from '../lib/i18n.ts';

interface AuthPortalViewProps {
  status: AdminAuthStatus;
  apiAvailable?: boolean;
  initialMode?: 'login' | 'register';
  onAuthenticated: (result: UnifiedAuthResult) => void;
  onBackToStore: () => void;
}

export function AuthPortalView({
  status,
  apiAvailable = true,
  initialMode = 'login',
  onAuthenticated,
  onBackToStore,
}: AuthPortalViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Одеса');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);

  const isRegister = mode === 'register';

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setError('');
    setIsLockedOut(false);
  }

  async function handleGoogleLogin() {
    setError('');
    setIsLockedOut(false);
    setGoogleSubmitting(true);
    try {
      const { idToken } = await signInWithGooglePopup();
      const resp = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await resp.json()) as Partial<UnifiedAuthResult> & { error?: string };
      if (!resp.ok || !data.token || !data.accountType) {
        if (resp.status === 429) setIsLockedOut(true);
        setError(data.error || tr('Помилка входу через Google', 'Ошибка входа через Google'));
        return;
      }
      onAuthenticated({
        accountType: data.accountType,
        token: data.token,
        user: data.user,
        customer: data.customer,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('popup-closed-by-user')) {
        setError(tr('Вікно входу Google було закрито до завершення авторизації', 'Окно входа Google было закрыто до завершения авторизации'));
      } else if (message.includes('unauthorized-domain')) {
        setError(tr('Домен ще не додано в налаштування авторизації', 'Домен ещё не добавлен в настройки авторизации'));
      } else {
        setError(tr('Не вдалося виконати вхід через Google', 'Не удалось выполнить вход через Google'));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLockedOut(false);

    if (isRegister) {
      if (regName.trim().length < 2) {
        setError(tr('Вкажіть ваше ім’я (мінімум 2 символи)', 'Укажите ваше имя (минимум 2 символа)'));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
        setError(tr('Вкажіть коректний Email', 'Укажите корректный Email'));
        return;
      }
      if (regPhone.trim() && !isValidUaPhone(regPhone)) {
        setError(tr('Вкажіть номер телефону у форматі +380 XX XXX XX XX або залиште поле порожнім', 'Укажите номер телефона в формате +380 XX XXX XX XX или оставьте поле пустым'));
        return;
      }
      if (password.length < 6) {
        setError(tr('Пароль має містити щонайменше 6 символів', 'Пароль должен содержать минимум 6 символов'));
        return;
      }
      if (password !== confirmPassword) {
        setError(tr('Паролі не співпадають', 'Пароли не совпадают'));
        return;
      }
    } else {
      if (!identifier.trim()) {
        setError(tr('Введіть Email або логін', 'Введите Email или логин'));
        return;
      }
      if (!password) {
        setError(tr('Введіть пароль', 'Введите пароль'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            name: regName.trim(),
            email: regEmail.trim().toLowerCase(),
            phone: regPhone.trim() ? `+${regPhone.replace(/\D/g, '')}` : '',
            city: regCity.trim() || 'Одеса',
            password,
          }
        : {
            identifier: identifier.trim(),
            password,
          };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as Partial<UnifiedAuthResult> & { error?: string };
      if (!resp.ok || !data.token || !data.accountType) {
        if (resp.status === 429) setIsLockedOut(true);
        setError(data.error || tr('Невірні дані для входу', 'Неверные данные для входа'));
        return;
      }

      setPassword('');
      setConfirmPassword('');
      onAuthenticated({
        accountType: data.accountType,
        token: data.token,
        user: data.user,
        customer: data.customer,
      });
    } catch {
      setError(tr('Не вдалося зв’язатися із сервером', 'Не удалось связаться с сервером'));
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
            {isRegister ? <UserPlus className="w-5 h-5 text-[#f59e0b]" /> : <Lock className="w-5 h-5 text-[#f59e0b]" />}
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#1769aa]">Energo Comfort</div>
            <h1 className="text-lg font-extrabold text-[#0d1f33]">
              {isRegister
                ? tr('Реєстрація клієнта', 'Регистрация клиента')
                : tr('Вхід до акаунту', 'Вход в аккаунт')}
            </h1>
          </div>
        </div>

        <p className="text-xs text-[#52657a] leading-relaxed mb-5">
          {isRegister
            ? tr(
                'Створіть особистий кабінет через Google або Email, щоб відстежувати замовлення та розрахунки сонячної станції.',
                'Создайте личный кабинет через Google или Email, чтобы отслеживать заказы и расчёты солнечной станции.',
              )
            : tr(
                'Увійдіть через Google або за Email і паролем для доступу до особистого кабінету чи робочого простору.',
                'Войдите через Google или по Email и паролю для доступа к личному кабинету или рабочему пространству.',
              )}
        </p>

        {/* Clean Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              !isRegister ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
            }`}
          >
            {tr('Увійти', 'Войти')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isRegister ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600 hover:text-[#0d1f33]'
            }`}
          >
            {tr('Реєстрація', 'Регистрация')}
          </button>
        </div>

        {!apiAvailable && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>{tr('Сервер зараз недоступний', 'Сервер сейчас недоступен')}</strong> —{' '}
            {tr(
              'авторизація тимчасово вимкнена в автономному режимі.',
              'авторизация временно недоступна в автономном режиме.',
            )}
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
              <span>
                {googleSubmitting
                  ? tr('Підключення Google...', 'Подключение Google…')
                  : isRegister
                    ? tr('Зареєструватися через Google', 'Зарегистрироваться через Google')
                    : tr('Увійти через Google', 'Войти через Google')}
              </span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {isRegister ? tr('або за Email', 'или по Email') : tr('або за Email та паролем', 'или по Email и паролю')}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister ? (
            <>
              <div>
                <label htmlFor="auth-reg-name" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Ваше ім’я', 'Ваше имя')} *
                </label>
                <input
                  id="auth-reg-name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={!apiAvailable || submitting || googleSubmitting}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={tr('Олексій Коваленко', 'Алексей Коваленко')}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
              </div>

              <div>
                <label htmlFor="auth-reg-email" className="block text-xs font-bold text-[#0d1f33] mb-1">
                  Email *
                </label>
                <input
                  id="auth-reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={!apiAvailable || submitting || googleSubmitting}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auth-reg-phone" className="block text-xs font-bold text-[#0d1f33] mb-1">
                    {tr('Телефон', 'Телефон')}
                  </label>
                  <input
                    id="auth-reg-phone"
                    type="tel"
                    autoComplete="tel"
                    disabled={!apiAvailable || submitting || googleSubmitting}
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatUaPhone(e.target.value))}
                    placeholder="+380 50 000 00 00"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <div>
                  <label htmlFor="auth-reg-city" className="block text-xs font-bold text-[#0d1f33] mb-1">
                    {tr('Місто', 'Город')}
                  </label>
                  <input
                    id="auth-reg-city"
                    type="text"
                    autoComplete="address-level2"
                    disabled={!apiAvailable || submitting || googleSubmitting}
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="Одеса"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="auth-identifier" className="block text-xs font-bold text-[#0d1f33] mb-1">
                {tr('Email або логін', 'Email или логин')}
              </label>
              <input
                id="auth-identifier"
                name="username"
                type="text"
                required
                autoComplete="username"
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-[#0d1f33] mb-1">
              {tr('Пароль', 'Пароль')}
            </label>
            <div className="relative">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isRegister ? 6 : 1}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? tr('Мінімум 6 символів', 'Минимум 6 символов') : '••••••••'}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? tr('Сховати пароль', 'Скрыть пароль') : tr('Показати пароль', 'Показать пароль')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0d1f33] p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label htmlFor="auth-password-confirm" className="block text-xs font-bold text-[#0d1f33] mb-1">
                {tr('Підтвердіть пароль', 'Подтвердите пароль')}
              </label>
              <input
                id="auth-password-confirm"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={tr('Повторіть пароль', 'Повторите пароль')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
                isLockedOut
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {isLockedOut && <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!apiAvailable || submitting || googleSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {submitting
              ? tr('Зачекайте...', 'Подождите…')
              : isRegister
                ? tr('Створити акаунт', 'Создать аккаунт')
                : tr('Увійти', 'Войти')}
          </button>
        </form>
      </div>
    </div>
  );
}
