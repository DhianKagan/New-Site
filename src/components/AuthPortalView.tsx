import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, Lock, ShieldAlert, ShieldCheck, UserPlus, Wand2 } from 'lucide-react';
import type { AdminAuthStatus, FirebaseRuntimeWebConfig, UnifiedAuthResult } from '../types.ts';
import { getFirebaseProjectId, getRuntimeFirebaseConfig, signInWithGooglePopup } from '../lib/firebaseAuth.ts';
import { formatUaPhone, isValidUaPhone } from '../lib/leadForm.ts';
import { tr } from '../lib/i18n.ts';

interface AuthPortalViewProps {
  status: AdminAuthStatus;
  apiAvailable?: boolean;
  initialMode?: 'login' | 'register';
  onAuthenticated: (result: UnifiedAuthResult) => void;
  onBackToStore: () => void;
}

function generateStrongPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function AuthPortalView({
  status,
  apiAvailable = true,
  initialMode = 'login',
  onAuthenticated,
  onBackToStore,
}: AuthPortalViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'setup'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Одеса');
  const [setupName, setSetupName] = useState('Головний адміністратор');
  const [setupEmail, setSetupEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [unauthorizedHost, setUnauthorizedHost] = useState('');
  const [copiedHost, setCopiedHost] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<FirebaseRuntimeWebConfig | null>(null);
  const identifierInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setIsLockedOut(false);
    setUnauthorizedHost('');
  }, [initialMode]);

  useEffect(() => {
    if (!apiAvailable) return;
    let active = true;
    void getRuntimeFirebaseConfig().then((cfg) => {
      if (active) setRuntimeConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, [apiAvailable]);

  const activeProjectId = runtimeConfig?.projectId || getFirebaseProjectId();

  const isRegister = mode === 'register';
  const isSetup = mode === 'setup';

  function switchMode(nextMode: 'login' | 'register' | 'setup') {
    setMode(nextMode);
    setError('');
    setIsLockedOut(false);
    setUnauthorizedHost('');
    setPassword('');
    setConfirmPassword('');
  }

  function handleGenerateSetupPassword() {
    const generated = generateStrongPassword(12);
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setCopiedPwd(false);
  }

  async function handleCopySetupPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPwd(true);
      window.setTimeout(() => setCopiedPwd(false), 2000);
    } catch {
      setCopiedPwd(false);
    }
  }

  async function handleCopyUnauthorizedHost() {
    if (!unauthorizedHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedHost);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      setCopiedHost(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setIsLockedOut(false);
    setUnauthorizedHost('');
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
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedHost(host);
        setError(
          tr(
            `Домен ${host} ще не додано в Authorized domains у Firebase Console`,
            `Домен ${host} ещё не добавлен в Authorized domains в Firebase Console`,
          ),
        );
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

    if (isSetup) {
      if (password.length < 6) {
        setError(tr('Пароль має містити щонайменше 6 символів', 'Пароль должен содержать минимум 6 символов'));
        return;
      }
      if (password !== confirmPassword) {
        setError(tr('Паролі не співпадають', 'Пароли не совпадают'));
        return;
      }
    } else if (isRegister) {
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
      const endpoint = isSetup
        ? '/api/admin/auth/setup'
        : isRegister
          ? '/api/auth/register'
          : '/api/auth/login';
      const payload = isSetup
        ? {
            name: setupName.trim() || 'Головний адміністратор',
            email: setupEmail.trim().toLowerCase(),
            password,
          }
        : isRegister
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
    <div className="bg-[#081421]/30 min-h-[calc(100vh-140px)] flex flex-col items-center py-8 px-4">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl w-full max-w-md p-7 shadow-lg my-auto">
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
            {isSetup ? (
              <ShieldCheck className="w-5 h-5 text-[#f59e0b]" />
            ) : isRegister ? (
              <UserPlus className="w-5 h-5 text-[#f59e0b]" />
            ) : (
              <Lock className="w-5 h-5 text-[#f59e0b]" />
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#1769aa]">Energo Comfort</div>
            <h1 className="text-lg font-extrabold text-[#0d1f33]">
              {isSetup
                ? tr('Перше налаштування адміністратора', 'Первая настройка администратора')
                : isRegister
                  ? tr('Реєстрація акаунту', 'Регистрация аккаунта')
                  : tr('Вхід до акаунту', 'Вход в аккаунт')}
            </h1>
          </div>
        </div>

        <p className="text-xs text-[#52657a] leading-relaxed mb-5">
          {isSetup
            ? tr(
                'Задайте пароль головного адміністратора (логін admin) для першого запуску CRM.',
                'Задайте пароль главного администратора (логин admin) для первого запуска CRM.',
              )
            : isRegister
              ? tr(
                  'Створіть особистий кабінет через Google або Email, щоб відстежувати замовлення та розрахунки сонячної станції.',
                  'Создайте личный кабинет через Google или Email, чтобы отслеживать заказы и расчёты солнечной станции.',
                )
              : tr(
                  'Єдина форма входу для клієнтів, співробітників та адміністратора — через Google або за Email/логіном і паролем.',
                  'Единая форма входа для клиентов, сотрудников и администратора — через Google или по Email/логину и паролю.',
                )}
        </p>

        {/* Universal Mode Switcher: Login | Register */}
        {!isSetup && (
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
        )}

        {!apiAvailable && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>{tr('Сервер зараз недоступний', 'Сервер сейчас недоступен')}</strong> —{' '}
            {tr(
              'авторизація тимчасово вимкнена в автономному режимі.',
              'авторизация временно недоступна в автономном режиме.',
            )}
          </div>
        )}

        {!isSetup && status.mode === 'setup' && apiAvailable && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#0d1f33] space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              {tr('Перший запуск: задайте пароль адміністратора', 'Первый запуск: задайте пароль администратора')}
            </div>
            <p className="text-[11px] text-[#52657a] leading-relaxed">
              {tr(
                'Пароль для входу admin ще не створено. Натисніть кнопку нижче, щоб створити майстер-пароль і одразу увійти в CRM.',
                'Пароль для входа admin ещё не создан. Нажмите кнопку ниже, чтобы создать мастер-пароль и сразу войти в CRM.',
              )}
            </p>
            <button
              type="button"
              onClick={() => switchMode('setup')}
              className="w-full py-2 px-3 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {tr('Створити пароль адміністратора (admin)', 'Создать пароль администратора (admin)')}
            </button>
          </div>
        )}

        {!isSetup && status.googleEnabled !== false && apiAvailable && (
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
                {isRegister ? tr('або за Email', 'или по Email') : tr('або за Email / логіном та паролем', 'или по Email / логину и паролю')}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSetup ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#0d1f33]">{tr('Майстер-логін', 'Мастер-логин')}</span>
                <span className="font-mono font-bold text-[#1769aa] bg-white px-2 py-0.5 rounded border border-slate-200">
                  admin
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="setup-name" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    {tr('Ім’я керівника', 'Имя руководителя')}
                  </label>
                  <input
                    id="setup-name"
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    disabled={!apiAvailable || submitting || googleSubmitting}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="setup-email" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    Google Email <span className="font-normal text-slate-400">({tr('опц.', 'опц.')})</span>
                  </label>
                  <input
                    id="setup-email"
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="owner@gmail.com"
                    disabled={!apiAvailable || submitting || googleSubmitting}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          ) : isRegister ? (
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
                ref={identifierInputRef}
                id="auth-identifier"
                name="username"
                type="text"
                required
                autoComplete="username"
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com / admin"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#1769aa]"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="auth-password" className="block text-xs font-bold text-[#0d1f33]">
                {tr('Пароль', 'Пароль')}
              </label>
              {isSetup && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateSetupPassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1769aa] hover:underline cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    {tr('Згенерувати', 'Сгенерировать')}
                  </button>
                  {password && (
                    <button
                      type="button"
                      onClick={() => void handleCopySetupPassword()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#169374] hover:underline cursor-pointer"
                    >
                      {copiedPwd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedPwd ? tr('Скопійовано', 'Скопировано') : tr('Копіювати', 'Копировать')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isRegister || isSetup ? 6 : 1}
                autoComplete={isRegister || isSetup ? 'new-password' : 'current-password'}
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister || isSetup ? tr('Мінімум 6 символів', 'Минимум 6 символов') : '••••••••'}
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

          {(isRegister || isSetup) && (
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
              className={`p-3 rounded-lg border text-xs flex flex-col gap-2 ${
                isLockedOut
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <div className="font-semibold flex items-start gap-2">
                {isLockedOut && <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                <span>{error}</span>
              </div>
              {unauthorizedHost && (
                <div className="pt-2 border-t border-red-200/80 text-[11px] text-[#0d1f33] space-y-2 leading-relaxed">
                  <div>
                    {tr(
                      'Щоб запрацював Google-вхід на цьому домені, додайте його у Firebase Console → Authentication → Settings → Authorized domains:',
                      'Чтобы заработал вход через Google на этом домене, добавьте его в Firebase Console → Authentication → Settings → Authorized domains:',
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="px-2 py-1 rounded bg-white border border-red-200 font-mono text-[11px] font-bold text-[#0d1f33]">
                      {unauthorizedHost}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyUnauthorizedHost()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-bold text-[#0d1f33] cursor-pointer"
                    >
                      {copiedHost ? <Check className="w-3 h-3 text-[#169374]" /> : <Copy className="w-3 h-3" />}
                      {copiedHost ? tr('Скопійовано', 'Скопировано') : tr('Копіювати домен', 'Копировать домен')}
                    </button>
                    {activeProjectId && (
                      <a
                        href={`https://console.firebase.google.com/project/${encodeURIComponent(activeProjectId)}/authentication/settings`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1769aa] hover:bg-[#12558a] text-[11px] font-bold text-white"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {tr('Відкрити Firebase Console', 'Открыть Firebase Console')}
                      </a>
                    )}
                  </div>
                  {runtimeConfig?.authDomain && (
                    <div className="text-[11px] text-[#52657a]">
                      {tr('Активний authDomain:', 'Активный authDomain:')}{' '}
                      <code className="font-mono font-semibold text-[#0d1f33]">{runtimeConfig.authDomain}</code>
                      {runtimeConfig.matchedRule ? (
                        <span>
                          {' '}
                          ({tr('правило', 'правило')}: <code className="font-mono">{runtimeConfig.matchedRule}</code>)
                        </span>
                      ) : null}
                    </div>
                  )}
                  <div className="text-[#52657a] space-y-1.5">
                    <div>
                      {tr(
                        'Для входу без прив’язки до домену (у тому числі при розгортанні в іншому акаунті або на *.ai.studio) використовуйте Email/логін та пароль:',
                        'Для входа без привязки к домену (в том числе при развёртывании в другом аккаунте или на *.ai.studio) используйте Email/логин и пароль:',
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setUnauthorizedHost('');
                        if (!isRegister && !isSetup && !identifier.trim()) {
                          setIdentifier('admin');
                        }
                        window.setTimeout(() => identifierInputRef.current?.focus(), 0);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#0d1f33] hover:bg-[#16324f] text-white text-[11px] font-bold cursor-pointer"
                    >
                      {tr('Увійти за логіном і паролем', 'Войти по логину и паролю')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!apiAvailable || submitting || googleSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {submitting
              ? tr('Зачекайте...', 'Подождите…')
              : isSetup
                ? tr('Створити майстер-акаунт та увійти', 'Создать мастер-аккаунт и войти')
                : isRegister
                  ? tr('Зареєструватися', 'Зарегистрироваться')
                  : tr('Увійти', 'Войти')}
          </button>
        </form>

        {/* Bottom quick switchers */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-center text-xs">
          {isSetup ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-bold text-[#1769aa] hover:underline cursor-pointer"
            >
              {tr('Повернутися до звичайного входу', 'Вернуться к обычному входу')}
            </button>
          ) : isRegister ? (
            <div className="text-slate-500">
              {tr('Вже є акаунт?', 'Уже есть аккаунт?')}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-[#1769aa] hover:underline cursor-pointer"
              >
                {tr('Увійти', 'Войти')}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0d1f33] text-xs font-bold transition-colors cursor-pointer"
              >
                {tr('Реєстрація нового акаунту', 'Регистрация нового аккаунта')}
              </button>
              {status.mode === 'setup' && apiAvailable && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('setup')}
                    className="text-[11px] font-semibold text-slate-400 hover:text-[#1769aa] cursor-pointer"
                  >
                    {tr('Перший запуск: налаштувати пароль адміністратора', 'Первый запуск: настроить пароль администратора')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
