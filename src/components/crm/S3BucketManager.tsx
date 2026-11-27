import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRightLeft,
  Check,
  Cloud,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  LocalVolumeFileItem,
  S3ListResponse,
  S3MigrateResult,
  S3ObjectItem,
  StorageOverviewResponse,
} from '../../types.ts';
import { tr } from '../../lib/i18n.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';

interface S3BucketManagerProps {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export function S3BucketManager({ authFetch }: S3BucketManagerProps) {
  const [overview, setOverview] = useState<StorageOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [activeStorageTab, setActiveStorageTab] = useState<'s3' | 'volume'>('s3');

  // S3 Explorer state
  const [prefix, setPrefix] = useState('');
  const [s3Data, setS3Data] = useState<S3ListResponse | null>(null);
  const [loadingS3, setLoadingS3] = useState(false);
  const [s3Err, setS3Err] = useState('');
  const [s3Msg, setS3Msg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<S3MigrateResult | null>(null);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Local Volume state
  const [volumeFiles, setVolumeFiles] = useState<LocalVolumeFileItem[]>([]);
  const [loadingVolume, setLoadingVolume] = useState(false);
  const [selectedVolumeFiles, setSelectedVolumeFiles] = useState<Set<string>>(new Set());

  // Rename Modal
  const [renameTarget, setRenameTarget] = useState<S3ObjectItem | null>(null);
  const [renameNewKey, setRenameNewKey] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Secure Preview Modal (uses authFetch Blob so private S3 buckets preview cleanly)
  const [previewMeta, setPreviewMeta] = useState<{
    title: string;
    subtitle: string;
    isImage: boolean;
    blobUrl: string;
    textContent?: string;
    downloadUrl: string;
    fileName: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const resp = await authFetch('/api/crm/data/storage/overview');
      if (resp.ok) {
        const data = (await resp.json()) as StorageOverviewResponse;
        setOverview(data);
        if (!data.s3Configured) {
          setActiveStorageTab('volume');
        }
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [authFetch]);

  const loadS3Objects = useCallback(
    async (targetPrefix = prefix) => {
      setLoadingS3(true);
      setS3Err('');
      try {
        const qs = new URLSearchParams();
        if (targetPrefix) qs.set('prefix', targetPrefix);
        const resp = await authFetch(`/api/crm/data/s3/objects?${qs.toString()}`);
        const data = (await resp.json()) as S3ListResponse & { error?: string };
        if (!resp.ok) {
          setS3Err(data.error || 'Не вдалося прочитати S3 Bucket');
          return;
        }
        setS3Data(data);
        setSelectedKeys(new Set());
      } catch {
        setS3Err('Помилка з’єднання під час читання S3 Bucket');
      } finally {
        setLoadingS3(false);
      }
    },
    [authFetch, prefix],
  );

  const loadVolumeFiles = useCallback(async () => {
    setLoadingVolume(true);
    try {
      const resp = await authFetch('/api/crm/data/volume/files');
      if (resp.ok) {
        const data = (await resp.json()) as { files?: LocalVolumeFileItem[] };
        setVolumeFiles(data.files ?? []);
        setSelectedVolumeFiles(new Set());
      }
    } finally {
      setLoadingVolume(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadOverview();
    void loadVolumeFiles();
  }, [loadOverview, loadVolumeFiles]);

  useEffect(() => {
    if (overview?.s3Configured) {
      void loadS3Objects(prefix);
    }
  }, [overview?.s3Configured, prefix, loadS3Objects]);

  const filteredS3Objects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = s3Data?.objects ?? [];
    if (!q) return list;
    return list.filter(
      (o) =>
        o.key.toLowerCase().includes(q) ||
        o.fileName.toLowerCase().includes(q) ||
        o.contentTypeGuess.toLowerCase().includes(q),
    );
  }, [s3Data, searchQuery]);

  const filteredVolumeFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return volumeFiles;
    return volumeFiles.filter((f) => f.fileName.toLowerCase().includes(q));
  }, [volumeFiles, searchQuery]);

  const breadcrumbs = useMemo(() => {
    const parts = prefix.split('/').filter(Boolean);
    const items: Array<{ label: string; prefix: string }> = [{ label: 'root', prefix: '' }];
    let acc = '';
    for (const part of parts) {
      acc += `${part}/`;
      items.push({ label: part, prefix: acc });
    }
    return items;
  }, [prefix]);

  async function handleUploadFiles(files: FileList | null, target: 's3' | 'volume') {
    if (!files || files.length === 0) return;
    setUploading(true);
    setS3Err('');
    setS3Msg('');
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) {
          setS3Err(`Файл "${file.name}" перевищує 15 МБ`);
          continue;
        }
        const formData = new FormData();
        if (target === 's3' && prefix) {
          formData.append('prefix', prefix);
        }
        formData.append('file', file);
        const endpoint = target === 's3' ? '/api/crm/data/s3/upload' : '/api/crm/data/volume/upload';
        const resp = await authFetch(endpoint, { method: 'POST', body: formData });
        const data = (await resp.json()) as { error?: string };
        if (!resp.ok) {
          setS3Err(data.error || `Помилка завантаження ${file.name}`);
        } else {
          uploadedCount += 1;
        }
      }
      if (uploadedCount > 0) {
        setS3Msg(
          tr(`Завантажено файлів: ${uploadedCount}`, `Загружено файлов: ${uploadedCount}`),
        );
        await loadOverview();
        if (target === 's3') await loadS3Objects(prefix);
        else await loadVolumeFiles();
      }
    } catch {
      setS3Err('Помилка з’єднання при завантаженні файлів');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteS3(keys: string[]) {
    if (keys.length === 0) return;
    setS3Err('');
    setS3Msg('');
    try {
      const resp = await authFetch('/api/crm/data/s3/objects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      const data = (await resp.json()) as { deleted?: number; error?: string };
      if (!resp.ok) {
        setS3Err(data.error || 'Не вдалося видалити об’єкти з S3');
        return;
      }
      setS3Msg(tr(`Видалено з S3: ${data.deleted ?? keys.length}`, `Удалено из S3: ${data.deleted ?? keys.length}`));
      await Promise.all([loadS3Objects(prefix), loadOverview()]);
    } catch {
      setS3Err('Помилка при видаленні об’єктів S3');
    }
  }

  async function handleDeleteVolume(fileNames: string[]) {
    if (fileNames.length === 0) return;
    setS3Err('');
    setS3Msg('');
    try {
      const resp = await authFetch('/api/crm/data/volume/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames }),
      });
      const data = (await resp.json()) as { deleted?: number; error?: string };
      if (!resp.ok) {
        setS3Err(data.error || 'Не вдалося видалити файли з Volume');
        return;
      }
      setS3Msg(tr(`Видалено з Volume: ${data.deleted ?? fileNames.length}`, `Удалено из Volume: ${data.deleted ?? fileNames.length}`));
      await Promise.all([loadVolumeFiles(), loadOverview()]);
    } catch {
      setS3Err('Помилка при видаленні файлів Volume');
    }
  }

  async function handleMigrateVolumeToS3() {
    setMigrating(true);
    setS3Err('');
    setS3Msg('');
    setMigrateResult(null);
    try {
      const resp = await authFetch('/api/crm/data/s3/migrate-from-volume', { method: 'POST' });
      const data = (await resp.json()) as S3MigrateResult & { error?: string };
      if (!resp.ok) {
        setS3Err(data.error || 'Не вдалося виконати міграцію у S3 Bucket');
        return;
      }
      setMigrateResult(data);
      setS3Msg(
        `Міграція завершена: перенесено ${data.uploaded}, пропущено (вже в S3) ${data.skippedExisting}, помилок ${data.failed}.`,
      );
      await Promise.all([loadOverview(), loadS3Objects(prefix)]);
    } catch {
      setS3Err('Помилка з’єднання під час міграції у S3');
    } finally {
      setMigrating(false);
    }
  }

  async function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renameTarget || !renameNewKey.trim()) return;
    setRenaming(true);
    setS3Err('');
    try {
      const resp = await authFetch('/api/crm/data/s3/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey: renameTarget.key,
          targetKey: renameNewKey.trim(),
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setS3Err(data.error || 'Не вдалося перейменувати об’єкт');
        return;
      }
      setRenameTarget(null);
      setS3Msg(tr('Об’єкт перейменовано / переміщено', 'Объект переименован / перемещён'));
      await loadS3Objects(prefix);
    } catch {
      setS3Err('Помилка перейменування');
    } finally {
      setRenaming(false);
    }
  }

  async function openSecurePreview(opts: {
    fetchUrl: string;
    downloadUrl: string;
    title: string;
    subtitle: string;
    fileName: string;
    isImage: boolean;
  }) {
    setLoadingPreview(true);
    setS3Err('');
    try {
      const resp = await authFetch(opts.fetchUrl);
      if (!resp.ok) {
        setS3Err('Не вдалося завантажити превью файлу');
        return;
      }
      const blob = await resp.blob();
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const blobUrl = URL.createObjectURL(blob);
      previewBlobRef.current = blobUrl;

      let textContent: string | undefined;
      if (!opts.isImage && /\.(json|txt|csv|xml|svg)$/i.test(opts.fileName) && blob.size < 512 * 1024) {
        textContent = await blob.text();
      }
      setPreviewMeta({
        title: opts.title,
        subtitle: opts.subtitle,
        isImage: opts.isImage,
        blobUrl,
        textContent,
        downloadUrl: opts.downloadUrl,
        fileName: opts.fileName,
      });
    } catch {
      setS3Err('Помилка перегляду файлу');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function downloadAuthenticatedFile(url: string, fileName: string) {
    try {
      const resp = await authFetch(url);
      if (!resp.ok) return;
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setS3Err('Помилка завантаження файлу');
    }
  }

  async function copyUrl(url: string, label: string) {
    try {
      const resolved = url.startsWith('/') ? `${window.location.origin}${url}` : url;
      await navigator.clipboard.writeText(resolved);
      setCopiedKey(label);
      window.setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      setCopiedKey('');
    }
  }

  return (
    <div className="space-y-4">
      {/* Storage Overview Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Cloud className="w-5 h-5 text-[#1769aa]" />
              <h2 className="text-lg font-extrabold text-[#0d1f33]">
                {tr('Менеджер S3 Bucket та локального Volume', 'Менеджер S3 Bucket и локального Volume')}
              </h2>
              {overview && (
                <Badge variant={overview.s3Reachable ? 'success' : overview.s3Configured ? 'warning' : 'default'}>
                  {overview.s3Reachable
                    ? `S3 Online · ${overview.bucket}`
                    : overview.s3Configured
                      ? 'S3 Configured (перевірте доступ)'
                      : 'Тільки локальний Volume'}
                </Badge>
              )}
            </div>
            {overview && (
              <p className="text-sm text-[#52657a] mt-1.5">
                {overview.s3Configured ? (
                  <>
                    Бакет: <code className="font-mono text-[#0d1f33]">{overview.bucket}</code> · Endpoint:{' '}
                    <code className="font-mono">{overview.endpointHost || 'AWS'}</code> · Регіон:{' '}
                    <code className="font-mono">{overview.region}</code> · Proxy{' '}
                    <code className="font-mono">/uploads</code>:{' '}
                    <strong>{overview.s3ProxyEnabled ? 'Увімкнено' : 'Вимкнено'}</strong>
                  </>
                ) : (
                  <>
                    S3-змінні (<code className="font-mono">S3_BUCKET</code>, <code className="font-mono">S3_ACCESS_KEY_ID</code>,{' '}
                    <code className="font-mono">S3_SECRET_ACCESS_KEY</code>) не задані — використовується резервний Volume{' '}
                    <code className="font-mono">{overview.localUploadsDir}</code>.
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {overview?.s3Configured && overview.localFilesCount > 0 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={migrating}
                onClick={() => void handleMigrateVolumeToS3()}
              >
                <ArrowRightLeft className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                {migrating
                  ? tr('Переносимо...', 'Переносим...')
                  : tr(`Перенести Volume → S3 (${overview.localFilesCount})`, `Перенести Volume → S3 (${overview.localFilesCount})`)}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingOverview || loadingS3 || loadingVolume}
              onClick={() => {
                void loadOverview();
                void loadVolumeFiles();
                if (overview?.s3Configured) void loadS3Objects(prefix);
              }}
            >
              <RefreshCw className={`w-4 h-4 ${loadingOverview || loadingS3 || loadingVolume ? 'animate-spin' : ''}`} />
              {tr('Оновити', 'Обновить')}
            </Button>
          </div>
        </div>

        {overview?.s3Error && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-800">
            Помилка S3: {overview.s3Error}
          </div>
        )}

        {migrateResult && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-1.5">
            <div className="font-bold text-[#0d1f33]">
              Результат синхронізації Volume → S3: завантажено {migrateResult.uploaded}, пропущено{' '}
              {migrateResult.skippedExisting}, помилок {migrateResult.failed}
            </div>
            <div className="text-sm text-slate-500">
              Локальні файли на Volume збережено як резерв (сервер віддає їх автоматично при недоступності бакета).
            </div>
          </div>
        )}

        {/* Storage Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setActiveStorageTab('s3')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold cursor-pointer ${
                activeStorageTab === 's3' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Cloud className="w-4 h-4 text-[#1769aa]" />
              S3 Bucket {s3Data?.configured ? `(${s3Data.objects.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveStorageTab('volume')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold cursor-pointer ${
                activeStorageTab === 'volume' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-600'
              }`}
            >
              <HardDrive className="w-4 h-4 text-[#169374]" />
              {tr('Локальний Volume', 'Локальный Volume')} ({overview?.localFilesCount ?? volumeFiles.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('Фільтр файлів...', 'Фильтр файлов...')}
                className="pl-9 h-10 text-sm w-56"
              />
            </div>

            {activeStorageTab === 's3' && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="Таблиця"
                  className={`p-2 rounded cursor-pointer ${viewMode === 'list' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-500'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Сітка"
                  className={`p-2 rounded cursor-pointer ${viewMode === 'grid' ? 'bg-white text-[#0d1f33] shadow-2xs' : 'text-slate-500'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            )}

            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-sm font-bold cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading
                ? tr('Завантаження...', 'Загрузка...')
                : activeStorageTab === 's3'
                  ? tr('Завантажити у S3', 'Загрузить в S3')
                  : tr('Завантажити у Volume', 'Загрузить в Volume')}
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.json,.csv,.txt,.xml"
                className="hidden"
                disabled={uploading || (activeStorageTab === 's3' && !overview?.s3Configured)}
                onChange={(e) => {
                  void handleUploadFiles(e.target.files, activeStorageTab);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {s3Err && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
          {s3Err}
        </div>
      )}
      {s3Msg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-semibold text-[#169374]">
          {s3Msg}
        </div>
      )}

      {/* S3 Explorer View */}
      {activeStorageTab === 's3' ? (
        !overview?.s3Configured ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm space-y-2.5">
            <div className="font-extrabold text-base text-[#0d1f33]">
              S3 Bucket ще не підключено у змінних оточення
            </div>
            <p className="text-slate-600 leading-relaxed">
              Додайте у Railway Variables значення <code className="font-mono">S3_BUCKET</code>,{' '}
              <code className="font-mono">S3_ENDPOINT</code>, <code className="font-mono">S3_REGION</code>,{' '}
              <code className="font-mono">S3_ACCESS_KEY_ID</code>, <code className="font-mono">S3_SECRET_ACCESS_KEY</code> та{' '}
              <code className="font-mono">S3_PROXY_UPLOADS=true</code>. Поки S3 не підключено, керуйте файлами на вкладці{' '}
              <strong>«Локальний Volume»</strong>.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            {/* Breadcrumbs & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-sm">
              <div className="flex flex-wrap items-center gap-1 font-mono">
                {breadcrumbs.map((b, i) => (
                  <span key={b.prefix || 'root'} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-slate-400">/</span>}
                    <button
                      type="button"
                      onClick={() => setPrefix(b.prefix)}
                      className={`px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer ${
                        b.prefix === prefix ? 'font-bold text-[#1769aa]' : 'text-slate-600'
                      }`}
                    >
                      {b.label}
                    </button>
                  </span>
                ))}
                {s3Data && (
                  <span className="text-slate-400 ml-2">
                    ({filteredS3Objects.length} об’єктів · {formatBytes(s3Data.totalSizeBytes)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedKeys.size > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDeleteS3(Array.from(selectedKeys))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr(`Видалити (${selectedKeys.size})`, `Удалить (${selectedKeys.size})`)}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewFolder((v) => !v)}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  {tr('Перейти / папка', 'Папка')}
                </Button>
              </div>
            </div>

            {showNewFolder && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = newFolderInput.trim().replace(/^\/+|\/+$/g, '');
                  if (!clean) return;
                  setPrefix(`${prefix}${clean}/`);
                  setNewFolderInput('');
                  setShowNewFolder(false);
                }}
                className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm"
              >
                <Input
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  placeholder="uploads або backups/2026"
                  className="w-64 h-10 text-sm font-mono bg-white"
                />
                <Button type="submit" variant="primary" size="sm">
                  Відкрити префікс
                </Button>
                <button
                  type="button"
                  onClick={() => setPrefix('uploads/')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-sm text-[#1769aa] cursor-pointer"
                >
                  uploads/
                </button>
              </form>
            )}

            {/* Subfolders */}
            {s3Data && s3Data.folders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s3Data.folders.map((folderPrefix) => {
                  const shortName = folderPrefix.slice(prefix.length).replace(/\/$/, '');
                  return (
                    <button
                      key={folderPrefix}
                      type="button"
                      onClick={() => setPrefix(folderPrefix)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 text-sm font-mono font-bold text-[#0d1f33] cursor-pointer"
                    >
                      <Folder className="w-4 h-4 text-amber-500" />
                      {shortName}/
                    </button>
                  );
                })}
              </div>
            )}

            {/* Objects Grid or Table */}
            {loadingS3 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                {tr('Завантаження об’єктів S3...', 'Загрузка объектов S3...')}
              </div>
            ) : filteredS3Objects.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                {tr('У цьому префіксі немає об’єктів. Завантажте файли або перенесіть з Volume.', 'В этом префиксе нет объектов.')}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredS3Objects.map((obj) => {
                  const checked = selectedKeys.has(obj.key);
                  return (
                    <div
                      key={obj.key}
                      className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 text-sm transition-colors ${
                        checked ? 'border-[#1769aa] bg-sky-50/40' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedKeys((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(obj.key);
                              else next.delete(obj.key);
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-[#1769aa]"
                        />
                        <span className="font-mono text-xs text-slate-500 tabular-nums">{formatBytes(obj.size)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void openSecurePreview({
                            fetchUrl: `/api/crm/data/s3/object?key=${encodeURIComponent(obj.key)}`,
                            downloadUrl: `/api/crm/data/s3/object?key=${encodeURIComponent(obj.key)}&download=1`,
                            title: obj.fileName,
                            subtitle: obj.key,
                            fileName: obj.fileName,
                            isImage: obj.isImage,
                          })
                        }
                        className="h-28 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer hover:border-sky-200"
                      >
                        {obj.isImage && obj.publicUrl.startsWith('/uploads/') ? (
                          <img src={obj.publicUrl} alt={obj.fileName} className="w-full h-full object-contain" loading="lazy" />
                        ) : obj.isImage ? (
                          <ImageIcon className="w-8 h-8 text-[#1769aa]" />
                        ) : obj.fileName.endsWith('.json') ? (
                          <FileCode2 className="w-8 h-8 text-amber-600" />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-400" />
                        )}
                      </button>

                      <div className="space-y-1.5">
                        <div className="font-mono font-bold text-sm text-[#0d1f33] truncate" title={obj.key}>
                          {obj.fileName}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => void copyUrl(obj.publicUrl, obj.key)}
                            className="text-xs font-bold text-[#1769aa] hover:underline cursor-pointer"
                          >
                            {copiedKey === obj.key ? 'Скопійовано' : 'URL'}
                          </button>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRenameTarget(obj);
                                setRenameNewKey(obj.key);
                              }}
                              className="p-1.5 text-slate-500 hover:text-[#0d1f33] cursor-pointer"
                              title="Перейменувати"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteS3([obj.key])}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Видалити"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
                      <th className="py-3 px-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredS3Objects.length > 0 &&
                            filteredS3Objects.every((o) => selectedKeys.has(o.key))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeys(new Set(filteredS3Objects.map((o) => o.key)));
                            } else {
                              setSelectedKeys(new Set());
                            }
                          }}
                          className="w-4 h-4 accent-[#1769aa]"
                        />
                      </th>
                      <th className="py-3 px-3.5">Ключ / Ім’я файлу</th>
                      <th className="py-3 px-3.5">Тип</th>
                      <th className="py-3 px-3.5">Розмір</th>
                      <th className="py-3 px-3.5">Оновлено</th>
                      <th className="py-3 px-3.5 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredS3Objects.map((obj) => (
                      <tr key={obj.key} className="hover:bg-slate-50">
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(obj.key)}
                            onChange={(e) => {
                              setSelectedKeys((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(obj.key);
                                else next.delete(obj.key);
                                return next;
                              });
                            }}
                            className="w-4 h-4 accent-[#1769aa]"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-[#0d1f33] max-w-xs truncate" title={obj.key}>
                          {obj.key}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-sm text-slate-500">{obj.contentTypeGuess}</td>
                        <td className="py-3 px-3.5 font-mono text-sm tabular-nums">{formatBytes(obj.size)}</td>
                        <td className="py-3 px-3.5 font-mono text-sm text-slate-500 whitespace-nowrap tabular-nums">
                          {obj.lastModified ? new Date(obj.lastModified).toLocaleString('uk-UA') : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={loadingPreview}
                              onClick={() =>
                                void openSecurePreview({
                                  fetchUrl: `/api/crm/data/s3/object?key=${encodeURIComponent(obj.key)}`,
                                  downloadUrl: `/api/crm/data/s3/object?key=${encodeURIComponent(obj.key)}&download=1`,
                                  title: obj.fileName,
                                  subtitle: obj.key,
                                  fileName: obj.fileName,
                                  isImage: obj.isImage,
                                })
                              }
                              className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#0d1f33] cursor-pointer"
                              title="Переглянути"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyUrl(obj.publicUrl, obj.key)}
                              className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#1769aa] cursor-pointer"
                              title="Копіювати URL"
                            >
                              {copiedKey === obj.key ? <Check className="w-4 h-4 text-[#169374]" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void downloadAuthenticatedFile(
                                  `/api/crm/data/s3/object?key=${encodeURIComponent(obj.key)}&download=1`,
                                  obj.fileName,
                                )
                              }
                              className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#0d1f33] cursor-pointer"
                              title="Завантажити"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameTarget(obj);
                                setRenameNewKey(obj.key);
                              }}
                              className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#0d1f33] cursor-pointer"
                              title="Перейменувати / перемістити"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteS3([obj.key])}
                              className="p-2 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                              title="Видалити"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      ) : (
        /* Local Volume Reserve View */
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-sm">
            <div className="text-slate-600">
              Директорія: <code className="font-mono font-bold text-[#0d1f33]">{overview?.localUploadsDir}</code> ·{' '}
              <strong>{filteredVolumeFiles.length}</strong> файлів ·{' '}
              <strong>{formatBytes(overview?.localFilesTotalBytes ?? 0)}</strong>
            </div>
            {selectedVolumeFiles.size > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeleteVolume(Array.from(selectedVolumeFiles))}
              >
                <Trash2 className="w-4 h-4" />
                {tr(`Видалити (${selectedVolumeFiles.size})`, `Удалить (${selectedVolumeFiles.size})`)}
              </Button>
            )}
          </div>

          {loadingVolume ? (
            <div className="py-12 text-center text-sm text-slate-400">Завантаження файлів Volume...</div>
          ) : filteredVolumeFiles.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
              На локальному Volume поки немає завантажених файлів.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
                    <th className="py-3 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredVolumeFiles.length > 0 &&
                          filteredVolumeFiles.every((f) => selectedVolumeFiles.has(f.fileName))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVolumeFiles(new Set(filteredVolumeFiles.map((f) => f.fileName)));
                          } else {
                            setSelectedVolumeFiles(new Set());
                          }
                        }}
                        className="w-4 h-4 accent-[#1769aa]"
                      />
                    </th>
                    <th className="py-3 px-3.5">Файл</th>
                    <th className="py-3 px-3.5">Розмір</th>
                    <th className="py-3 px-3.5">Змінено</th>
                    <th className="py-3 px-3.5 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVolumeFiles.map((f) => (
                    <tr key={f.fileName} className="hover:bg-slate-50">
                      <td className="py-3 px-3.5">
                        <input
                          type="checkbox"
                          checked={selectedVolumeFiles.has(f.fileName)}
                          onChange={(e) => {
                            setSelectedVolumeFiles((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(f.fileName);
                              else next.delete(f.fileName);
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-[#1769aa]"
                        />
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-[#0d1f33]">{f.fileName}</td>
                      <td className="py-3 px-3.5 font-mono text-sm tabular-nums">{formatBytes(f.size)}</td>
                      <td className="py-3 px-3.5 font-mono text-sm text-slate-500 tabular-nums">
                        {new Date(f.modifiedAt).toLocaleString('uk-UA')}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              void openSecurePreview({
                                fetchUrl: `/api/crm/data/volume/file?name=${encodeURIComponent(f.fileName)}`,
                                downloadUrl: `/api/crm/data/volume/file?name=${encodeURIComponent(f.fileName)}&download=1`,
                                title: f.fileName,
                                subtitle: `Volume: ${f.url}`,
                                fileName: f.fileName,
                                isImage: f.isImage,
                              })
                            }
                            className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#0d1f33] cursor-pointer"
                            title="Переглянути"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyUrl(f.url, f.fileName)}
                            className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#1769aa] cursor-pointer"
                            title="Копіювати URL"
                          >
                            {copiedKey === f.fileName ? <Check className="w-4 h-4 text-[#169374]" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void downloadAuthenticatedFile(
                                `/api/crm/data/volume/file?name=${encodeURIComponent(f.fileName)}&download=1`,
                                f.fileName,
                              )
                            }
                            className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[#0d1f33] cursor-pointer"
                            title="Завантажити"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteVolume([f.fileName])}
                            className="p-2 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                            title="Видалити"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rename S3 Object Dialog */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {tr('Перейменувати / перемістити об’єкт S3', 'Переименовать / переместить объект S3')}
            </DialogTitle>
            <DialogDescription>{renameTarget?.key}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="p-7 space-y-5 text-[15px]">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Новий ключ (шлях у бакеті)</label>
              <Input
                value={renameNewKey}
                onChange={(e) => setRenameNewKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Скасувати
              </Button>
              <Button type="submit" variant="primary" disabled={renaming}>
                {renaming ? 'Зберігаємо...' : 'Застосувати'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Secure File Preview Dialog */}
      <Dialog open={Boolean(previewMeta)} onOpenChange={(open) => !open && setPreviewMeta(null)}>
        <DialogContent className="max-w-4xl">
          {previewMeta && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{previewMeta.title}</DialogTitle>
                    <DialogDescription className="font-mono text-sm truncate">{previewMeta.subtitle}</DialogDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadAuthenticatedFile(previewMeta.downloadUrl, previewMeta.fileName)}
                  >
                    <Download className="w-4 h-4" />
                    Завантажити
                  </Button>
                </div>
              </DialogHeader>
              <div className="p-7">
                {previewMeta.isImage ? (
                  <img
                    src={previewMeta.blobUrl}
                    alt={previewMeta.title}
                    className="max-h-[65vh] mx-auto rounded-lg object-contain bg-slate-50 border border-slate-200"
                  />
                ) : previewMeta.textContent !== undefined ? (
                  <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm max-h-[65vh] overflow-auto whitespace-pre-wrap">
                    {previewMeta.textContent}
                  </pre>
                ) : (
                  <div className="py-12 text-center text-[15px] text-slate-600">
                    Попередній перегляд недоступний для цього формату — скористайтесь кнопкою «Завантажити».
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
