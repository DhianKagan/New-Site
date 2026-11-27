import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  FileCheck2,
  Globe,
  HardDrive,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import type {
  CatalogIntegrityReport,
  ClientErrorRecord,
  FirebaseRuntimeWebConfig,
  RecentChangeRecord,
  StorageDiagnostics,
} from '../../types.ts';
import { getFirebaseProjectId } from '../../lib/firebaseAuth.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { SqlDatabaseClient } from './SqlDatabaseClient.tsx';
import { S3BucketManager } from './S3BucketManager.tsx';

interface DataManagementTabProps {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  storageInfo: StorageDiagnostics | null;
  recentChanges: RecentChangeRecord[];
  downloadingBackup: boolean;
  backupErr: string;
  onDownloadBackup: () => Promise<void>;
  onDataMutated: () => Promise<void>;
  // Firebase / Admin Allowlist
  effectiveAdminEmails: string[];
  adminEmailsInput: string;
  onAdminEmailsInputChange: (val: string) => void;
  savingEmails: boolean;
  emailsMsg: string;
  emailsErr: string;
  onSaveAdminEmails: (e: FormEvent) => Promise<void>;
  activeFirebaseConfig: FirebaseRuntimeWebConfig | null;
  copiedCurrentHost: boolean;
  onCopyCurrentHost: (host: string) => Promise<void>;
  // Client Error Logs
  clientErrors: ClientErrorRecord[];
  clearingErrors: boolean;
  onRefreshDiagnostics: () => Promise<void>;
  onClearClientErrors: () => Promise<void>;
}

type DataSubTab = 'sql' | 's3' | 'site' | 'access';

export function DataManagementTab({
  authFetch,
  storageInfo,
  recentChanges,
  downloadingBackup,
  backupErr,
  onDownloadBackup,
  onDataMutated,
  effectiveAdminEmails,
  adminEmailsInput,
  onAdminEmailsInputChange,
  savingEmails,
  emailsMsg,
  emailsErr,
  onSaveAdminEmails,
  activeFirebaseConfig,
  copiedCurrentHost,
  onCopyCurrentHost,
  clientErrors,
  clearingErrors,
  onRefreshDiagnostics,
  onClearClientErrors,
}: DataManagementTabProps) {
  const [subTab, setSubTab] = useState<DataSubTab>('sql');
  const [integrity, setIntegrity] = useState<CatalogIntegrityReport | null>(null);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);

  const loadIntegrity = useCallback(async () => {
    setLoadingIntegrity(true);
    try {
      const resp = await authFetch('/api/crm/data/integrity');
      if (resp.ok) {
        setIntegrity((await resp.json()) as CatalogIntegrityReport);
      }
    } finally {
      setLoadingIntegrity(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (subTab === 'site' && !integrity) {
      void loadIntegrity();
    }
  }, [subTab, integrity, loadIntegrity]);

  const subTabs: Array<{ id: DataSubTab; label: string; Icon: typeof Database }> = [
    { id: 'sql', label: tr('SQL База даних', 'SQL База данных'), Icon: Database },
    { id: 's3', label: tr('S3 Бакет і Сховище', 'S3 Бакет и Хранилище'), Icon: Cloud },
    { id: 'site', label: tr('Дані сайту та Бекапи', 'Данные сайта и Бекапы'), Icon: FileCheck2 },
    { id: 'access', label: tr('Доступи і Журнал', 'Доступы и Журнал'), Icon: Shield },
  ];

  return (
    <div className="space-y-5">
      {/* Admin-Only Workbench Header & Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-[#0d1f33]">
              {tr('Управління даними', 'Управление данными')}
            </h2>
            <Badge variant="info">{tr('Тільки для адміністратора', 'Только для администратора')}</Badge>
          </div>
          <p className="text-xs text-[#52657a] mt-0.5">
            {tr(
              'Повний клієнт PostgreSQL, файловий менеджер S3 Bucket і локального Volume, перевірка цілісності сайту та резервні копії.',
              'Полный клиент PostgreSQL, файловый менеджер S3 Bucket и локального Volume, проверка целостности сайта и резервные копии.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {subTabs.map(({ id, label, Icon }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0d1f33] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-[#0d1f33]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#f59e0b]' : 'text-slate-400'}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. SQL Database Client */}
      {subTab === 'sql' && <SqlDatabaseClient authFetch={authFetch} onDataMutated={onDataMutated} />}

      {/* 2. S3 Bucket & Volume Storage Manager */}
      {subTab === 's3' && <S3BucketManager authFetch={authFetch} />}

      {/* 3. Site Data Integrity & Backups */}
      {subTab === 'site' && (
        <div className="space-y-5">
          {storageInfo && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#169374]" />
                    {tr('Сховище бази даних, медіа та резервна копія', 'Хранилище базы данных, медиа и резервная копия')}
                  </h3>
                  <p className="text-xs text-[#52657a] mt-0.5">
                    БД: <code className="font-mono text-[#0d1f33]">{storageInfo.dbPath}</code> · Розмір:{' '}
                    <strong>{Math.round(storageInfo.dbSizeBytes / 1024)} КБ</strong> · Volume{' '}
                    <code className="font-mono">{storageInfo.dataDir}</code> · Файлів у{' '}
                    <code className="font-mono">/uploads</code>: <strong>{storageInfo.uploadsCount}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingIntegrity}
                    onClick={() => void loadIntegrity()}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingIntegrity ? 'animate-spin' : ''}`} />
                    {tr('Перевірити дані сайту', 'Проверить данные сайта')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => void onDownloadBackup()}
                    disabled={downloadingBackup}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-[#f59e0b]" />
                    {downloadingBackup ? tr('Готуємо файл...', 'Готовим файл...') : tr('Завантажити бекап БД (.json)', 'Скачать бекап БД (.json)')}
                  </button>
                </div>
              </div>

              {backupErr && <div className="text-xs font-semibold text-red-600">{backupErr}</div>}

              {recentChanges.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-bold text-slate-500 mb-2">
                    {tr('Останні оновлення каталогу та проєктів у БД:', 'Последние обновления каталога и проектов в БД:')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {recentChanges.slice(0, 6).map((ch) => (
                      <div
                        key={`${ch.kind}-${ch.id}`}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <span className="truncate font-semibold text-[#0d1f33]">
                          {ch.kind === 'product' ? 'Товар: ' : 'Проєкт: '}
                          {ch.title}
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-500 shrink-0">
                          {new Date(ch.updatedAt).toLocaleDateString('uk-UA')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Site Integrity Audit Report */}
          {integrity && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0d1f33] flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#1769aa]" />
                    {tr('Аудит цілісності каталогу та зображень сайту', 'Аудит целостности каталога и изображений сайта')}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Перевірено: {new Date(integrity.checkedAt).toLocaleString('uk-UA')}
                  </p>
                </div>
                <Badge
                  variant={
                    integrity.brokenLocalImages.length === 0 && integrity.duplicateSkus.length === 0
                      ? 'success'
                      : 'warning'
                  }
                >
                  {integrity.brokenLocalImages.length === 0 && integrity.duplicateSkus.length === 0
                    ? tr('Проблем з медіа та SKU не знайдено', 'Проблем с медиа и SKU не найдено')
                    : tr('Виявлено зауваження', 'Найдены замечания')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-slate-500">Товарів / Проєктів</div>
                  <div className="font-mono text-sm font-extrabold text-[#0d1f33] mt-0.5">
                    {integrity.productsCount} / {integrity.projectsCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-slate-500">Файли /uploads (посилання)</div>
                  <div className="font-mono text-sm font-extrabold text-[#1769aa] mt-0.5">
                    {integrity.uploadsReferencedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-slate-500">На Volume / у S3 Bucket</div>
                  <div className="font-mono text-sm font-extrabold text-[#169374] mt-0.5">
                    {integrity.uploadsOnVolumeCount} / {integrity.uploadsInS3Count}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-slate-500">Товарів без ціни / Дублі SKU</div>
                  <div className="font-mono text-sm font-extrabold text-amber-700 mt-0.5">
                    {integrity.zeroPriceProducts.length} / {integrity.duplicateSkus.length}
                  </div>
                </div>
              </div>

              {integrity.brokenLocalImages.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 text-xs">
                  <div className="font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Незнайдені локальні зображення ({integrity.brokenLocalImages.length}):
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {integrity.brokenLocalImages.map((b) => (
                      <div key={`${b.kind}-${b.id}`} className="flex items-center justify-between gap-2 text-slate-700">
                        <span className="truncate">
                          [{b.kind}] {b.title}
                        </span>
                        <span className="text-red-700 shrink-0">{b.img}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {integrity.duplicateSkus.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs">
                  <div className="font-bold text-amber-800 mb-1">Повторювані артикули (SKU):</div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {integrity.duplicateSkus.map((d) => (
                      <span key={d.sku} className="px-2 py-0.5 rounded bg-white border border-amber-200">
                        {d.sku} ×{d.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {integrity.brokenLocalImages.length === 0 && integrity.duplicateSkus.length === 0 && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#169374]">
                  <CheckCircle2 className="w-4 h-4" />
                  Всі посилання на зображення та артикули каталогу пройшли перевірку.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Access Allowlist & Production Error Logs */}
      {subTab === 'access' && (
        <div className="space-y-5">
          {/* Google Auth & Admin Allowlist Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#1769aa]" />
                  {tr('Google-вхід (Firebase) і доступи адміністраторів', 'Вход через Google (Firebase) и доступы администраторов')}
                </h3>
                <p className="text-xs text-[#52657a] mt-1 max-w-2xl leading-relaxed">
                  {tr(
                    'Firebase підключено автоматично — окремі змінні оточення вводити не потрібно. Користувачі з цього списку та співробітники з розділу «Користувачі» входять у CRM через Google або за Email та паролем.',
                    'Firebase подключён автоматически — отдельные переменные окружения вводить не нужно. Пользователи из этого списка и сотрудники из раздела «Пользователи» входят в CRM через Google или по Email и паролю.',
                  )}
                </p>
              </div>
              <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {tr('Активні:', 'Активные:')} {effectiveAdminEmails.join(', ') || '—'}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="text-[#0d1f33] font-semibold">
                  {tr('Проєкт Firebase:', 'Проект Firebase:')}{' '}
                  <code className="font-mono font-bold text-[#1769aa]">
                    {activeFirebaseConfig?.projectId || getFirebaseProjectId() || '—'}
                  </code>
                </div>
                <div className="text-[11px] text-[#52657a]">
                  {tr(
                    'Якщо відкриваєте сайт на власному або *.ai.studio домені та Google-вхід просить додати домен, скопіюйте поточний домен і додайте його один раз у Firebase Console → Authorized domains:',
                    'Если открываете сайт на своём или *.ai.studio домене и вход Google просит добавить домен, скопируйте текущий домен и добавьте его один раз в Firebase Console → Authorized domains:',
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(activeFirebaseConfig?.requestHost || (typeof window !== 'undefined' ? window.location.hostname : '')) && (
                  <button
                    type="button"
                    onClick={() =>
                      void onCopyCurrentHost(
                        activeFirebaseConfig?.requestHost || window.location.hostname,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-[#0d1f33] cursor-pointer"
                  >
                    {copiedCurrentHost ? <Check className="w-3 h-3 text-[#169374]" /> : <Copy className="w-3 h-3" />}
                    {copiedCurrentHost
                      ? tr('Скопійовано', 'Скопировано')
                      : activeFirebaseConfig?.requestHost || window.location.hostname}
                  </button>
                )}
                {(activeFirebaseConfig?.projectId || getFirebaseProjectId()) && (
                  <a
                    href={`https://console.firebase.google.com/project/${encodeURIComponent(activeFirebaseConfig?.projectId || getFirebaseProjectId())}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1769aa] hover:bg-[#12558a] text-white text-[11px] font-bold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Authorized domains
                  </a>
                )}
              </div>
            </div>

            <form onSubmit={onSaveAdminEmails} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-[#0d1f33] mb-1">
                  {tr('Email адміністраторів (через кому)', 'Email администраторов (через запятую)')}
                </label>
                <input
                  type="text"
                  value={adminEmailsInput}
                  onChange={(e) => onAdminEmailsInputChange(e.target.value)}
                  placeholder="owner@gmail.com, partner@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                />
              </div>
              <button
                type="submit"
                disabled={savingEmails}
                className="px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                {savingEmails ? tr('Зберігаємо...', 'Сохраняем...') : tr('Зберегти список доступу', 'Сохранить список доступа')}
              </button>
            </form>

            {emailsErr && <div className="text-xs font-semibold text-red-600">{emailsErr}</div>}
            {emailsMsg && <div className="text-xs font-semibold text-[#169374]">{emailsMsg}</div>}
          </div>

          {/* Production Client Runtime Error Logs Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#0d1f33] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-600" />
                  {tr('Журнал клієнтських помилок (Production Debug)', 'Журнал клиентских ошибок (Production Debug)')}
                </h3>
                <p className="text-xs text-[#52657a] mt-0.5">
                  {tr(
                    'Звіти від GlobalErrorBoundary та неперехоплені винятки браузера (без токенів і секретів).',
                    'Отчёты от GlobalErrorBoundary и неперехваченные исключения браузера (без токенов и секретов).',
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onRefreshDiagnostics()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {tr('Оновити', 'Обновить')}
                </button>
                {clientErrors.length > 0 && (
                  <button
                    type="button"
                    disabled={clearingErrors}
                    onClick={() => void onClearClientErrors()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr('Очистити', 'Очистить')}
                  </button>
                )}
              </div>
            </div>

            {clientErrors.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                {tr('Критичних помилок інтерфейсу не зафіксовано.', 'Критических ошибок интерфейса не зафиксировано.')}
              </div>
            ) : (
              <div className="space-y-2">
                {clientErrors.slice(0, 15).map((errItem) => (
                  <div
                    key={errItem.id}
                    className="rounded-lg border border-red-200/80 bg-red-50/40 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono font-bold text-[#0d1f33]">
                        [{errItem.kind}] {errItem.name} · <span className="text-[#1769aa]">{errItem.route}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {errItem.errorId} · {new Date(errItem.createdAt).toLocaleString('uk-UA')}
                      </div>
                    </div>
                    <div className="text-red-800 font-semibold break-words">{errItem.message}</div>
                    {(errItem.componentStack || errItem.stack) && (
                      <details className="text-[11px] text-slate-600">
                        <summary className="cursor-pointer font-semibold text-[#1769aa] hover:underline">
                          Stack / Component stack
                        </summary>
                        <pre className="mt-1.5 bg-white border border-slate-200 rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto max-h-36">
                          {errItem.componentStack || errItem.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
