import { useEffect, useState, type FormEvent } from 'react';
import { Lock, ShieldCheck, ArrowLeft, Eye, EyeOff, Wand2, Copy, Check, ExternalLink } from 'lucide-react';
import type { AdminAuthStatus, FirebaseRuntimeWebConfig } from '../types.ts';
import { getFirebaseProjectId, getRuntimeFirebaseConfig, signInWithGooglePopup } from '../lib/firebaseAuth.ts';
import { tr } from '../lib/i18n.ts';

interface AdminAuthGateProps {
  status: AdminAuthStatus;
  apiAvailable?: boolean;
  onAuthenticated: (token: string) => void;
  onBackToStore: () => void;
}

function generateStrongPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function AdminAuthGate({ status, apiAvailable = true, onAuthenticated, onBackToStore }: AdminAuthGateProps) {
  const [identifier, setIdentifier] = useState('admin');
  const [setupName, setSetupName] = useState('Головний адміністратор');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showSetupToken, setShowSetupToken] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [unauthorizedHost, setUnauthorizedHost] = useState('');
  const [runtimeConfig, setRuntimeConfig] = useState<FirebaseRuntimeWebConfig | null>(null);

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
  const isSetup = status.mode === 'setup';
  const requiresSetupToken = status.setupTokenRequired !== false;
  const setupBlockedByMissingToken = isSetup && requiresSetupToken && status.setupTokenConfigured === false;

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

  async function handleGoogleLogin() {
    setError('');
    setUnauthorizedHost('');
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
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedHost(host);
        setError(`Домен ${host} ще не додано в Authorized domains у Firebase Console`);
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
      if (setupBlockedByMissingToken) {
        setError(
          tr(
            'Змінну оточення ADMIN_SETUP_TOKEN ще не задано на сервері.',
            'Переменная окружения ADMIN_SETUP_TOKEN ещё не задана на сервере.',
          ),
        );
        return;
      }
      if (requiresSetupToken && !setupToken.trim()) {
        setError(tr('Введіть одноразовий токен налаштування (ADMIN_SETUP_TOKEN)', 'Введите одноразовый токен настройки (ADMIN_SETUP_TOKEN)'));
        return;
      }
      if (password.length < 6) {
        setError('Пароль має містити щонайменше 6 символів');
        return;
      }
      if (password !== confirmPassword) {
        setError('Паролі не співпадають');
        return;
      }
    } else if (!identifier.trim()) {
      setError('Введіть майстер-логін адміністратора');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isSetup ? '/api/admin/auth/setup' : '/api/admin/auth/login';
      const payload = isSetup
        ? {
            name: setupName.trim() || 'Головний адміністратор',
            email: setupEmail.trim().toLowerCase(),
            password,
          }
        : { identifier: identifier.trim(), password };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isSetup && setupToken.trim()) {
        headers['X-Setup-Token'] = setupToken.trim();
      }
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { token?: string; error?: string };
      if (!resp.ok || !data.token) {
        setError(data.error || 'Помилка авторизації');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setSetupToken('');
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
            <div className="text-[11px] font-bold text-[#1769aa]">Energo Comfort · CRM</div>
            <h1 className="text-lg font-extrabold text-[#0d1f33]">
              {isSetup
                ? tr('Перше налаштування CRM', 'Первая настройка CRM')
                : tr('Вхід до CRM', 'Вход в CRM')}
            </h1>
          </div>
        </div>

        <p className="text-xs text-[#52657a] leading-relaxed mb-5">
          {isSetup
            ? tr(
                'Увійдіть через Google-акаунт або створіть майстер-пароль адміністратора (також можна задати ADMIN_LOGIN / ADMIN_PASSWORD у налаштуваннях оточення).',
                'Войдите через Google-аккаунт или создайте мастер-пароль администратора (также можно задать ADMIN_LOGIN / ADMIN_PASSWORD в настройках окружения).',
              )
            : tr(
                'Співробітники входять через Google за своїм Email, доданим адміністратором. Адміністратор також може увійти за майстер-логіном і паролем із налаштувань оточення.',
                'Сотрудники входят через Google по своему Email, добавленному администратором. Администратор также может войти по мастер-логину и паролю из настроек окружения.',
              )}
        </p>

        {!apiAvailable && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>{tr('Серверне API зараз недоступне', 'Серверное API сейчас недоступно')}</strong>{' '}
            {tr(
              '(сайт відкрито в автономному статичному режимі). Вітрина, каталог із 250 товарів і кошик працюють, але вхід до CRM і збереження угод потребують запущеного сервера',
              '(сайт открыт в автономном статическом режиме). Магазин, каталог из 250 товаров и корзина работают, но для входа в CRM и сохранения сделок нужен запущенный сервер',
            )}{' '}
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
              <span>
                {googleSubmitting
                  ? tr('Виконується вхід через Google...', 'Выполняется вход через Google…')
                  : tr('Увійти через Google (за Email)', 'Войти через Google (по Email)')}
              </span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {tr('або майстер-вхід адміністратора', 'или мастер-вход администратора')}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate={false}>
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
                    Google Email <span className="font-normal text-slate-400">({tr('опц.')})</span>
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
              {requiresSetupToken ? (
                <div>
                  <label htmlFor="gate-setup-token" className="block text-[11px] font-bold text-[#0d1f33] mb-1">
                    {tr('Одноразовий токен налаштування (ADMIN_SETUP_TOKEN)', 'Одноразовый токен настройки (ADMIN_SETUP_TOKEN)')}
                  </label>
                  <div className="relative">
                    <input
                      id="gate-setup-token"
                      name="setupToken"
                      type={showSetupToken ? 'text' : 'password'}
                      required
                      autoComplete="one-time-code"
                      value={setupToken}
                      onChange={(e) => setSetupToken(e.target.value)}
                      placeholder="ADMIN_SETUP_TOKEN"
                      disabled={!apiAvailable || submitting || googleSubmitting || setupBlockedByMissingToken}
                      className="w-full pl-3 pr-9 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-[#1769aa]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupToken((v) => !v)}
                      aria-label={showSetupToken ? tr('Сховати токен', 'Скрыть токен') : tr('Показати токен', 'Показать токен')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0d1f33] p-0.5 cursor-pointer"
                    >
                      {showSetupToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {status.setupTokenConfigured === false && (
                    <p className="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                      {tr(
                        'Змінну оточення ADMIN_SETUP_TOKEN ще не задано на сервері.',
                        'Переменная окружения ADMIN_SETUP_TOKEN ещё не задана на сервере.',
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                  {tr(
                    'Режим попереднього перегляду: токен налаштування не потрібен для створення пароля адміністратора.',
                    'Режим предпросмотра: токен настройки не требуется для создания пароля администратора.',
                  )}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="admin-identifier" className="block text-xs font-bold text-[#0d1f33] mb-1">
                {tr('Майстер-логін адміністратора', 'Мастер-логин администратора')}
              </label>
              <input
                id="admin-identifier"
                name="username"
                type="text"
                required
                autoComplete="username"
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-[#1769aa]"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="admin-password" className="block text-xs font-bold text-[#0d1f33]">
                {isSetup ? tr('Майстер-пароль адміністратора', 'Мастер-пароль администратора') : tr('Пароль адміністратора', 'Пароль администратора')}
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
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isSetup ? 6 : 1}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                disabled={!apiAvailable || submitting || googleSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? tr('Мінімум 6 символів', 'Минимум 6 символов') : '••••••••'}
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

          {isSetup && (
            <div>
              <label htmlFor="admin-password-confirm" className="block text-xs font-bold text-[#0d1f33] mb-1">
                {tr('Підтвердіть пароль', 'Подтвердите пароль')}
              </label>
              <input
                id="admin-password-confirm"
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
            <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 space-y-2">
              <div>{error}</div>
              {unauthorizedHost && activeProjectId && (
                <div className="font-normal text-[#0d1f33] flex flex-wrap items-center gap-2 pt-1 border-t border-red-200">
                  {runtimeConfig?.authDomain && (
                    <span className="text-[11px] text-[#52657a]">
                      authDomain: <code className="font-mono font-semibold">{runtimeConfig.authDomain}</code>
                    </span>
                  )}
                  <a
                    href={`https://console.firebase.google.com/project/${encodeURIComponent(activeProjectId)}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1769aa] hover:bg-[#12558a] text-[11px] font-bold text-white"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {tr('Відкрити Firebase Console', 'Открыть Firebase Console')}
                  </a>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!apiAvailable || submitting || googleSubmitting || setupBlockedByMissingToken}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {submitting
              ? tr('Перевірка...', 'Проверка…')
              : isSetup
                ? tr('Створити майстер-акаунт та увійти', 'Создать мастер-аккаунт и войти')
                : tr('Увійти як адміністратор', 'Войти как администратор')}
          </button>
        </form>
      </div>
    </div>
  );
}