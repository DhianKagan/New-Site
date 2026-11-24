import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Search,
  Download,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  X,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Upload,
  Pencil,
  Check,
  Database,
  Globe,
  HardDrive,
  Share2,
  Link2,
  ExternalLink,
  Activity,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  LayoutDashboard,
  Package,
  Table2,
} from 'lucide-react';
import type {
  AnalyticsConfig,
  AnalyticsEventRecord,
  Deal,
  DealStage,
  Product,
  ProductCategory,
  ProjectCase,
  RecentChangeRecord,
  SocialLinksConfig,
  StorageDiagnostics,
} from '../types.ts';
import { SmartImage } from './SmartImage.tsx';
import { SocialIcons } from './SocialIcons.tsx';
import { tr } from '../lib/i18n.ts';

interface CrmViewProps {
  adminToken: string;
  deals: Deal[];
  products: Product[];
  projectsList: ProjectCase[];
  telegramConfigured: boolean;
  socialLinks: SocialLinksConfig;
  onRefreshDeals: () => Promise<void>;
  onRefreshCatalog: () => Promise<void>;
  onRefreshProjects: () => Promise<void>;
  onSocialLinksUpdated: (links: SocialLinksConfig) => void;
  onAnalyticsUpdated: (cfg: AnalyticsConfig) => void;
  onLogout: () => void;
  onBackToStore: () => void;
}

const STAGES: Array<{ id: DealStage; label: string; colorClass: string }> = [
  { id: 'new', label: 'Нова заявка', colorClass: 'text-[#1769aa]' },
  { id: 'audit', label: 'Аудит / Розрахунок', colorClass: 'text-amber-700' },
  { id: 'proposal', label: 'КП відправлено', colorClass: 'text-indigo-700' },
  { id: 'fulfillment', label: 'Монтаж / Відвантаження', colorClass: 'text-[#169374]' },
  { id: 'done', label: 'Виконано', colorClass: 'text-emerald-700' },
];

const ASSIGNEES = [
  'Олександр (інженер)',
  'Дмитро (менеджер)',
  'Ірина (координатор)',
  'Монтажна бригада №1',
];

export function CrmView({
  adminToken,
  deals,
  products,
  projectsList,
  telegramConfigured,
  socialLinks,
  onRefreshDeals,
  onRefreshCatalog,
  onRefreshProjects,
  onSocialLinksUpdated,
  onAnalyticsUpdated,
  onLogout,
  onBackToStore,
}: CrmViewProps) {
  const [crmTab, setCrmTab] = useState<
    'pipeline' | 'table' | 'catalog' | 'projects' | 'analytics' | 'social' | 'deploy'
  >('pipeline');
  const [dealQuery, setDealQuery] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState<'all' | 'order' | 'lead'>('all');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [savingDeal, setSavingDeal] = useState(false);
  const [refreshingCrm, setRefreshingCrm] = useState(false);
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<DealStage | null>(null);
  const [dealActionMsg, setDealActionMsg] = useState('');

  async function refreshWorkspace() {
    setRefreshingCrm(true);
    setDealActionMsg('');
    try {
      await Promise.all([onRefreshDeals(), onRefreshCatalog(), onRefreshProjects()]);
      if (crmTab === 'analytics') await loadAnalytics();
      if (crmTab === 'deploy' || crmTab === 'catalog') await loadDiagnostics();
      setDealActionMsg(tr('Дані оновлено', 'Данные обновлены'));
    } catch {
      setDealActionMsg(tr('Не вдалося оновити дані. Спробуйте ще раз.', 'Не удалось обновить данные. Попробуйте ещё раз.'));
    } finally {
      setRefreshingCrm(false);
    }
  }

  // Catalog Manager state
  const [catQuery, setCatQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | ProductCategory>('all');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPrice, setQuickPrice] = useState('');
  const [quickOldPrice, setQuickOldPrice] = useState('');
  const [quickInStock, setQuickInStock] = useState(true);
  const [savingQuickId, setSavingQuickId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodBrand, setProdBrand] = useState('Deye');
  const [prodCat, setProdCat] = useState<ProductCategory>('inverters');
  const [prodIsKit, setProdIsKit] = useState(false);
  const [prodPrice, setProdPrice] = useState('');
  const [prodOldPrice, setProdOldPrice] = useState('');
  const [prodInStock, setProdInStock] = useState(true);
  const [prodStatusLabel, setProdStatusLabel] = useState('в наявності');
  const [prodImg, setProdImg] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodSpecs, setProdSpecs] = useState<Array<[string, string]>>([]);
  const [uploadingProdPhoto, setUploadingProdPhoto] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [confirmDeleteProd, setConfirmDeleteProd] = useState(false);
  const [prodModalErr, setProdModalErr] = useState('');
  const [catalogMsg, setCatalogMsg] = useState('');

  // Analytics & Pixel state
  const [metaPixelId, setMetaPixelId] = useState('');
  const [ga4MeasurementId, setGa4MeasurementId] = useState('');
  const [gtmContainerId, setGtmContainerId] = useState('');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEventRecord[]>([]);
  const [analyticsMsg, setAnalyticsMsg] = useState('');
  const [analyticsErr, setAnalyticsErr] = useState('');
  const [savingAnalytics, setSavingAnalytics] = useState(false);

  // Social Links state
  const [socialForm, setSocialForm] = useState<SocialLinksConfig>(socialLinks);
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialMsg, setSocialMsg] = useState('');
  const [socialErr, setSocialErr] = useState('');
  const [copiedFeed, setCopiedFeed] = useState('');

  // Telegram, Backup & Diagnostics state
  const [tgResult, setTgResult] = useState<string>('');
  const [webhookUrlInput, setWebhookUrlInput] = useState(() =>
    typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '',
  );
  const [webhookStatus, setWebhookStatus] = useState<{
    configured: boolean;
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage: string;
  } | null>(null);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState('');
  const [webhookErr, setWebhookErr] = useState('');
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [backupErr, setBackupErr] = useState('');
  const [storageInfo, setStorageInfo] = useState<StorageDiagnostics | null>(null);
  const [recentChanges, setRecentChanges] = useState<RecentChangeRecord[]>([]);

  // Google Auth allowlist state
  const [adminEmailsInput, setAdminEmailsInput] = useState('');
  const [effectiveAdminEmails, setEffectiveAdminEmails] = useState<string[]>([]);
  const [savingEmails, setSavingEmails] = useState(false);
  const [emailsMsg, setEmailsMsg] = useState('');
  const [emailsErr, setEmailsErr] = useState('');

  // Projects / Case Studies Editor state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projSeg, setProjSeg] = useState<'b2b' | 'b2c'>('b2c');
  const [projTag, setProjTag] = useState('B2C · Одеса');
  const [projTitle, setProjTitle] = useState('');
  const [projSpecs, setProjSpecs] = useState('');
  const [projImg, setProjImg] = useState('/assets/energocomfort/house_6kw.png');
  const [projTask, setProjTask] = useState('');
  const [projSolution, setProjSolution] = useState('');
  const [projResult, setProjResult] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectFormMsg, setProjectFormMsg] = useState('');
  const [projectFormErr, setProjectFormErr] = useState('');

  useEffect(() => {
    setSocialForm(socialLinks);
  }, [socialLinks]);

  const authFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${adminToken}`);
      const resp = await fetch(url, { ...init, headers });
      if (resp.status === 401) {
        onLogout();
      }
      return resp;
    },
    [adminToken, onLogout],
  );

  const loadAnalytics = useCallback(async () => {
    const resp = await authFetch('/api/crm/analytics');
    if (resp.ok) {
      const data = (await resp.json()) as AnalyticsConfig & { recentEvents: AnalyticsEventRecord[] };
      setMetaPixelId(data.metaPixelId || '');
      setGa4MeasurementId(data.ga4MeasurementId || '');
      setGtmContainerId(data.gtmContainerId || '');
      setAnalyticsEnabled(data.analyticsEnabled);
      setRecentEvents(data.recentEvents || []);
    }
  }, [authFetch]);

  const loadAdminEmails = useCallback(async () => {
    const resp = await authFetch('/api/crm/auth/emails');
    if (resp.ok) {
      const data = (await resp.json()) as { envEmails: string[]; dbEmails: string[]; effective: string[] };
      setEffectiveAdminEmails(data.effective);
      setAdminEmailsInput((data.dbEmails.length > 0 ? data.dbEmails : data.effective).join(', '));
    }
  }, [authFetch]);

  const loadDiagnostics = useCallback(async () => {
    const [statusResp, webhookResp] = await Promise.all([
      authFetch('/api/crm/status'),
      authFetch('/api/crm/telegram-webhook'),
    ]);
    if (statusResp.ok) {
      const data = (await statusResp.json()) as {
        storage?: StorageDiagnostics;
        recentChanges?: RecentChangeRecord[];
      };
      if (data.storage) setStorageInfo(data.storage);
      if (Array.isArray(data.recentChanges)) setRecentChanges(data.recentChanges);
    }
    if (webhookResp.ok) {
      const info = (await webhookResp.json()) as {
        configured: boolean;
        url: string;
        pendingUpdateCount: number;
        lastErrorMessage: string;
      };
      setWebhookStatus(info);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadAnalytics();
    void loadAdminEmails();
    void loadDiagnostics();
  }, [loadAnalytics, loadAdminEmails, loadDiagnostics]);

  const metrics = useMemo(() => {
    const active = deals.filter((d) => d.stage !== 'archived');
    const newCount = active.filter((d) => d.stage === 'new').length;
    const ordersCount = active.filter((d) => d.type === 'order').length;
    const pipelineUsd = active.reduce((s, d) => s + d.totalUsd, 0);
    return { total: active.length, newCount, ordersCount, pipelineUsd };
  }, [deals]);

  const filteredDeals = useMemo(() => {
    const q = dealQuery.trim().toLowerCase();
    return deals.filter((d) => {
      if (d.stage === 'archived') return false;
      if (dealTypeFilter !== 'all' && d.type !== dealTypeFilter) return false;
      if (q) {
        const hit =
          d.dealNumber.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          d.phone.toLowerCase().includes(q) ||
          d.topic.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [deals, dealQuery, dealTypeFilter]);

  const catalogMatches = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'all' && p.cat !== catFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
  }, [products, catQuery, catFilter]);

  const filteredProducts = useMemo(() => {
    return showAllProducts ? catalogMatches : catalogMatches.slice(0, 60);
  }, [catalogMatches, showAllProducts]);

  async function handlePatchDeal(
    dealId: number,
    patch: { stage?: DealStage; assignee?: string; notes?: string; totalUsd?: number },
  ) {
    setSavingDeal(true);
    try {
      const resp = await authFetch(`/api/crm/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { deal: Deal };
        await onRefreshDeals();
        setDealActionMsg(tr('Етап угоди оновлено', 'Этап сделки обновлён'));
        if (selectedDeal?.id === dealId) {
          setSelectedDeal(data.deal);
        }
      } else {
        setDealActionMsg(tr('Не вдалося оновити угоду', 'Не удалось обновить сделку'));
      }
    } catch {
      setDealActionMsg(tr('Помилка з’єднання під час оновлення угоди', 'Ошибка соединения при обновлении сделки'));
    } finally {
      setSavingDeal(false);
      setDraggedDealId(null);
      setDropTargetStage(null);
    }
  }

  async function handleDeleteDeal(dealId: number) {
    const resp = await authFetch(`/api/crm/deals/${dealId}`, { method: 'DELETE' });
    if (resp.ok) {
      if (selectedDeal?.id === dealId) setSelectedDeal(null);
      await onRefreshDeals();
    }
  }

  function exportCsv() {
    const headers = ['Номер', 'Тип', 'Етап', 'Клієнт', 'Телефон', 'Місто', 'Канал', 'Тема', 'Сума USD', 'Відповідальний', 'Створено'];
    const rows = filteredDeals.map((d) => [
      d.dealNumber,
      d.type === 'order' ? 'Кошик' : 'Лід',
      STAGES.find((s) => s.id === d.stage)?.label || d.stage,
      d.customerName,
      d.phone,
      d.city,
      d.channel,
      d.topic,
      String(d.totalUsd),
      d.assignee,
      d.createdAt,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energocomfort-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openCreateProductModal() {
    setEditingProdId(null);
    setProdTitle('');
    setProdSku('');
    setProdBrand('Deye');
    setProdCat('inverters');
    setProdIsKit(false);
    setProdPrice('');
    setProdOldPrice('');
    setProdInStock(true);
    setProdStatusLabel('в наявності');
    setProdImg('');
    setProdDescription('');
    setProdSpecs([['', '']]);
    setConfirmDeleteProd(false);
    setProdModalErr('');
    setProductModalOpen(true);
  }

  function openEditProductModal(p: Product) {
    setEditingProdId(p.id);
    setProdTitle(p.title);
    setProdSku(p.sku);
    setProdBrand(p.brand);
    setProdCat(p.cat);
    setProdIsKit(p.isKit);
    setProdPrice(String(p.price));
    setProdOldPrice(p.oldPrice > 0 ? String(p.oldPrice) : '');
    setProdInStock(p.inStock);
    setProdStatusLabel(p.statusLabel || (p.inStock ? 'в наявності' : 'під замовлення'));
    setProdImg(p.img || '');
    setProdDescription(p.description || '');
    setProdSpecs(p.specs.length > 0 ? p.specs.map(([k, v]) => [k, v]) : [['', '']]);
    setConfirmDeleteProd(false);
    setProdModalErr('');
    setProductModalOpen(true);
  }

  async function handleUploadProductPhoto(file: File) {
    setProdModalErr('');
    if (file.size > 4 * 1024 * 1024) {
      setProdModalErr('Файл завеликий. Оберіть зображення до 4 МБ.');
      return;
    }
    setUploadingProdPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Не вдалося прочитати файл'));
        reader.readAsDataURL(file);
      });

      const resp = await authFetch('/api/crm/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setProdModalErr(data.error || 'Помилка завантаження фото');
      } else {
        setProdImg(data.url);
      }
    } catch {
      setProdModalErr('Не вдалося завантажити фото на сервер');
    } finally {
      setUploadingProdPhoto(false);
    }
  }

  async function handleSaveProductModal(e: FormEvent) {
    e.preventDefault();
    if (!prodTitle.trim()) {
      setProdModalErr('Вкажіть назву товару');
      return;
    }
    setProdModalErr('');
    setCatalogMsg('');
    setSavingProduct(true);
    try {
      const cleanedSpecs: Array<[string, string]> = prodSpecs
        .map(([k, v]): [string, string] => [k.trim(), v.trim()])
        .filter(([k]) => k.length > 0);

      const url = editingProdId
        ? `/api/crm/products/${encodeURIComponent(editingProdId)}`
        : '/api/crm/products';
      const method = editingProdId ? 'PATCH' : 'POST';

      const resp = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prodTitle.trim(),
          sku: prodSku.trim(),
          brand: prodBrand.trim() || 'Energo Comfort',
          cat: prodCat,
          isKit: prodIsKit,
          price: Math.max(0, Math.round(Number(prodPrice) || 0)),
          oldPrice: Math.max(0, Math.round(Number(prodOldPrice) || 0)),
          inStock: prodInStock,
          statusLabel: prodStatusLabel.trim() || (prodInStock ? 'в наявності' : 'під замовлення'),
          img: prodImg.trim(),
          specs: cleanedSpecs,
          description: prodDescription.trim(),
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setProdModalErr(data.error || 'Не вдалося зберегти товар');
        return;
      }
      await onRefreshCatalog();
      await loadDiagnostics();
      setProductModalOpen(false);
      setCatalogMsg(editingProdId ? `Картку «${prodTitle.trim()}» оновлено` : `Товар «${prodTitle.trim()}» додано`);
    } catch {
      setProdModalErr('Помилка з’єднання із сервером');
    } finally {
      setSavingProduct(false);
    }
  }

  function startQuickEdit(p: Product) {
    setQuickEditId(p.id);
    setQuickTitle(p.title);
    setQuickPrice(String(p.price));
    setQuickOldPrice(p.oldPrice > 0 ? String(p.oldPrice) : '');
    setQuickInStock(p.inStock);
  }

  async function saveQuickEdit(p: Product) {
    if (!quickTitle.trim()) return;
    setSavingQuickId(p.id);
    setCatalogMsg('');
    try {
      const resp = await authFetch(`/api/crm/products/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTitle.trim(),
          price: Math.max(0, Math.round(Number(quickPrice) || 0)),
          oldPrice: Math.max(0, Math.round(Number(quickOldPrice) || 0)),
          inStock: quickInStock,
          statusLabel: quickInStock ? 'в наявності' : 'під замовлення',
        }),
      });
      if (resp.ok) {
        setQuickEditId(null);
        await onRefreshCatalog();
        await loadDiagnostics();
        setCatalogMsg(`Швидко оновлено: «${quickTitle.trim()}»`);
      }
    } finally {
      setSavingQuickId(null);
    }
  }

  async function handleToggleStockQuick(p: Product) {
    setSavingQuickId(p.id);
    setCatalogMsg('');
    try {
      const nextStock = !p.inStock;
      const resp = await authFetch(`/api/crm/products/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inStock: nextStock,
          statusLabel: nextStock ? 'в наявності' : 'під замовлення',
        }),
      });
      if (resp.ok) {
        await onRefreshCatalog();
        await loadDiagnostics();
      }
    } finally {
      setSavingQuickId(null);
    }
  }

  async function handleDeleteProduct(id: string, title: string) {
    setProdModalErr('');
    setCatalogMsg('');
    setSavingProduct(true);
    try {
      const resp = await authFetch(`/api/crm/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setProdModalErr(data.error || 'Не вдалося видалити товар');
        return;
      }
      await onRefreshCatalog();
      await loadDiagnostics();
      setProductModalOpen(false);
      setCatalogMsg(`Товар «${title}» видалено з каталогу`);
    } catch {
      setProdModalErr('Помилка з’єднання із сервером');
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleSaveSocialLinks(e: FormEvent) {
    e.preventDefault();
    setSocialMsg('');
    setSocialErr('');
    setSavingSocial(true);
    try {
      const resp = await authFetch('/api/crm/social', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(socialForm),
      });
      const data = (await resp.json()) as { socialLinks?: SocialLinksConfig; error?: string };
      if (!resp.ok || !data.socialLinks) {
        setSocialErr(data.error || 'Помилка збереження соцмереж');
      } else {
        onSocialLinksUpdated(data.socialLinks);
        setSocialForm(data.socialLinks);
        setSocialMsg('Соцмережі оновлено в шапці та футері сайту!');
      }
    } catch {
      setSocialErr('Помилка з’єднання із сервером');
    } finally {
      setSavingSocial(false);
    }
  }

  async function handleDownloadBackup() {
    setBackupErr('');
    setDownloadingBackup(true);
    try {
      const resp = await authFetch('/api/crm/backup');
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        setBackupErr(data.error || 'Не вдалося завантажити бекап БД');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `energocomfort-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setBackupErr('Помилка завантаження бекапу SQLite');
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleSetupTelegramWebhook() {
    setWebhookMsg('');
    setWebhookErr('');
    setSettingWebhook(true);
    try {
      const resp = await authFetch('/api/crm/telegram-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        webhookUrl?: string;
        description?: string;
        error?: string;
        info?: { configured: boolean; url: string; pendingUpdateCount: number; lastErrorMessage: string };
      };
      if (!resp.ok || !data.ok) {
        setWebhookErr(data.error || 'Не вдалося встановити Webhook');
      } else {
        setWebhookMsg(`Webhook активовано: ${data.webhookUrl || webhookUrlInput}`);
        if (data.info) setWebhookStatus(data.info);
      }
    } catch {
      setWebhookErr('Помилка з’єднання із сервером');
    } finally {
      setSettingWebhook(false);
    }
  }

  async function handleSaveAnalytics(e: FormEvent) {
    e.preventDefault();
    setAnalyticsMsg('');
    setAnalyticsErr('');
    setSavingAnalytics(true);
    try {
      const resp = await authFetch('/api/crm/analytics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaPixelId,
          ga4MeasurementId,
          gtmContainerId,
          analyticsEnabled,
        }),
      });
      const data = (await resp.json()) as AnalyticsConfig & { error?: string };
      if (!resp.ok) {
        setAnalyticsErr(data.error || 'Помилка збереження');
      } else {
        onAnalyticsUpdated(data);
        setAnalyticsMsg('Налаштування пікселів збережено та активовано на сайті');
      }
    } catch {
      setAnalyticsErr('Помилка з’єднання із сервером');
    } finally {
      setSavingAnalytics(false);
    }
  }

  async function handleSaveAdminEmails(e: FormEvent) {
    e.preventDefault();
    setEmailsMsg('');
    setEmailsErr('');
    setSavingEmails(true);
    try {
      const resp = await authFetch('/api/crm/auth/emails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: adminEmailsInput }),
      });
      const data = (await resp.json()) as { effective?: string[]; error?: string };
      if (!resp.ok || !data.effective) {
        setEmailsErr(data.error || 'Помилка збереження списку email');
      } else {
        setEffectiveAdminEmails(data.effective);
        setEmailsMsg('Список дозволених Google-акаунтів оновлено');
      }
    } catch {
      setEmailsErr('Помилка з’єднання із сервером');
    } finally {
      setSavingEmails(false);
    }
  }

  async function handleTestTelegram() {
    setTgResult('Перевіряємо...');
    try {
      const resp = await authFetch('/api/crm/telegram-test', { method: 'POST' });
      const data = (await resp.json()) as { sent?: boolean; error?: string };
      if (resp.ok && data.sent) {
        setTgResult('Повідомлення надіслано у ваш Telegram-чат!');
      } else {
        setTgResult(data.error || 'Не налаштовано TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
      }
    } catch {
      setTgResult('Помилка мережі');
    }
  }

  function resetProjectForm() {
    setEditingProjectId(null);
    setProjSeg('b2c');
    setProjTag('B2C · Одеса');
    setProjTitle('');
    setProjSpecs('');
    setProjImg('/assets/energocomfort/house_6kw.png');
    setProjTask('');
    setProjSolution('');
    setProjResult('');
    setProjectFormErr('');
  }

  function startEditProject(p: ProjectCase) {
    setEditingProjectId(p.id);
    setProjSeg(p.seg);
    setProjTag(p.tag);
    setProjTitle(p.title);
    setProjSpecs(p.specs);
    setProjImg(p.img);
    setProjTask(p.task);
    setProjSolution(p.solution);
    setProjResult(p.result);
    setProjectFormErr('');
    setProjectFormMsg('');
    setShowProjectForm(true);
  }

  async function handleUploadProjectPhoto(file: File) {
    setProjectFormErr('');
    if (file.size > 4 * 1024 * 1024) {
      setProjectFormErr('Файл завеликий. Оберіть зображення до 4 МБ.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Не вдалося прочитати файл'));
        reader.readAsDataURL(file);
      });

      const resp = await authFetch('/api/crm/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setProjectFormErr(data.error || 'Помилка завантаження фото');
      } else {
        setProjImg(data.url);
      }
    } catch {
      setProjectFormErr('Не вдалося завантажити фото на сервер');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveProject(e: FormEvent) {
    e.preventDefault();
    if (!projTitle.trim()) {
      setProjectFormErr('Вкажіть назву об’єкта');
      return;
    }
    setProjectFormErr('');
    setProjectFormMsg('');
    setSavingProject(true);
    try {
      const url = editingProjectId
        ? `/api/crm/projects/${encodeURIComponent(editingProjectId)}`
        : '/api/crm/projects';
      const method = editingProjectId ? 'PATCH' : 'POST';
      const resp = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seg: projSeg,
          tag: projTag,
          title: projTitle,
          specs: projSpecs,
          img: projImg,
          task: projTask,
          solution: projSolution,
          result: projResult,
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setProjectFormErr(data.error || 'Помилка збереження об’єкта');
        return;
      }
      await onRefreshProjects();
      setProjectFormMsg(editingProjectId ? 'Об’єкт оновлено на вітрині!' : 'Новий об’єкт додано на сайт!');
      resetProjectForm();
      setShowProjectForm(false);
    } catch {
      setProjectFormErr('Помилка з’єднання із сервером');
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject(id: string, title: string) {
    setProjectFormMsg('');
    setProjectFormErr('');
    const resp = await authFetch(`/api/crm/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (resp.ok) {
      await onRefreshProjects();
      setProjectFormMsg(`Об’єкт «${title}» видалено`);
    }
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#f3f6fa] pb-12">
      <div className="bg-gradient-to-r from-[#0d1f33] via-[#12304b] to-[#17466a] text-white shadow-sm">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={onBackToStore}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-200 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {tr('Повернутися на вітрину')}
              </button>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-200">
                <Activity className="h-3.5 w-3.5" /> {tr('Внутрішня CRM та управління каталогом', 'CRM и управление магазином')}
              </div>
              <h1 className="text-xl font-extrabold sm:text-2xl">Energo Comfort CRM</h1>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                {tr('Замовлення, клієнти, каталог і робочі інструменти', 'Заказы, клиенты, каталог и рабочие инструменты')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshWorkspace()}
                disabled={refreshingCrm}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingCrm ? 'animate-spin' : ''}`} />
                {refreshingCrm ? tr('Оновлюємо…', 'Обновляем…') : tr('Оновити дані', 'Обновить данные')}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-extrabold text-[#0d1f33] transition-colors hover:bg-sky-50"
              >
                <LogOut className="h-3.5 w-3.5" /> {tr('Вийти')}
              </button>
            </div>
          </div>

          {dealActionMsg && (
            <div className="mt-3 inline-flex rounded-lg border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100" role="status">
              {dealActionMsg}
            </div>
          )}

          <nav role="tablist" aria-label={tr('Навігація CRM', 'Навигация CRM')} className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ['pipeline', 'Воронка угод', LayoutDashboard, metrics.newCount ? `${metrics.newCount}` : ''],
                ['table', 'Таблиця замовлень', Table2, ''],
                ['catalog', 'Каталог обладнання', Package, `${products.length}`],
                ['projects', 'Реальні об’єкти', BriefcaseBusiness, `${projectsList.length}`],
                ['analytics', 'Аналітика', ChartNoAxesCombined, ''],
                ['social', 'Соцмережі та SEO', Share2, ''],
                ['deploy', 'Налаштування і резервні копії', Activity, ''],
              ] as const
            ).map(([id, label, Icon, badge]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={crmTab === id}
                onClick={() => {
                  setCrmTab(id);
                  if (id === 'analytics') void loadAnalytics();
                  if (id === 'deploy' || id === 'catalog') void loadDiagnostics();
                }}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-all ${
                  crmTab === id
                    ? 'bg-white text-[#0d1f33] shadow-md'
                    : 'border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.14] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tr(label)}</span>
                {badge && <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${crmTab === id ? 'bg-[#eff6fc] text-[#1769aa]' : 'bg-white/10 text-slate-200'}`}>{badge}</span>}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
        {/* Clean KPI Summary Row */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <div className="rounded-2xl border border-slate-200 border-t-[3px] border-t-[#1769aa] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>{tr('Усього активних угод')}</span><BriefcaseBusiness className="h-4 w-4 text-[#1769aa]" /></div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-[#0d1f33] tabular-nums">{metrics.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 border-t-[3px] border-t-amber-400 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>{tr('Нових заявок до обробки')}</span><Activity className="h-4 w-4 text-amber-500" /></div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-[#1769aa] tabular-nums">
              {metrics.newCount}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 border-t-[3px] border-t-emerald-500 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>{tr('Замовлень із кошика')}</span><Package className="h-4 w-4 text-[#169374]" /></div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-[#169374] tabular-nums">
              {metrics.ordersCount}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 border-t-[3px] border-t-indigo-500 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>{tr('Сума у воронці')}</span><ChartNoAxesCombined className="h-4 w-4 text-indigo-500" /></div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-[#0d1f33] tabular-nums">
              ${metrics.pipelineUsd.toLocaleString('uk-UA')}
            </div>
          </div>
        </div>

        {/* Deals Toolbar (Pipeline & Table) */}
        {(crmTab === 'pipeline' || crmTab === 'table') && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={dealQuery}
                  onChange={(e) => setDealQuery(e.target.value)}
                  placeholder={tr('Пошук за номером, телефоном, клієнтом...')}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                />
              </div>

              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    ['all', 'Усі'],
                    ['order', 'Кошик'],
                    ['lead', 'Інженерні ліди'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDealTypeFilter(id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap cursor-pointer ${
                      dealTypeFilter === id ? 'bg-white text-[#0d1f33] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {tr(label)}
                  </button>
                ))}
              </div>
            </div>

            {crmTab === 'pipeline' && (
              <span className="text-xs font-medium text-slate-500">
                {tr('Перетягніть картку в інший стовпець, щоб змінити етап', 'Перетащите карточку в другой столбец, чтобы изменить этап')}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-500" aria-live="polite">
              {tr('Показано', 'Показано')} {filteredDeals.length} {tr('із', 'из')} {metrics.total}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {tr('Завантажити CSV')}
            </button>
          </div>
        )}

        {/* TAB 1: KANBAN PIPELINE */}
        {crmTab === 'pipeline' && (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
            {STAGES.map((stage) => {
              const stageDeals = filteredDeals.filter((d) => d.stage === stage.id);
              const stageSum = stageDeals.reduce((s, d) => s + d.totalUsd, 0);
              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropTargetStage(stage.id);
                  }}
                  onDragLeave={() => setDropTargetStage((current) => (current === stage.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dealId = Number(event.dataTransfer.getData('text/plain'));
                    setDropTargetStage(null);
                    setDraggedDealId(null);
                    if (dealId && draggedDealId === dealId) void handlePatchDeal(dealId, { stage: stage.id });
                  }}
                  className={`min-h-52 rounded-2xl border p-3 transition-colors ${
                    dropTargetStage === stage.id
                      ? 'border-[#1769aa] bg-sky-50 ring-2 ring-[#1769aa]/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                  <div className="pb-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-xs font-extrabold ${stage.colorClass}`}>{tr(stage.label)}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {stageDeals.length} {tr('угод', 'сделок')} · ${stageSum.toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>

                  {stageDeals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-400">{tr('Немає угод на цьому етапі')}</div>
                  ) : (
                    <div className="space-y-2.5">
                      {stageDeals.map((deal) => (
                        <article
                          key={deal.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${tr('Відкрити угоду', 'Открыть сделку')} ${deal.dealNumber}: ${deal.customerName}`}
                          onClick={() => setSelectedDeal(deal)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedDeal(deal);
                            }
                          }}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', String(deal.id));
                            event.dataTransfer.effectAllowed = 'move';
                            setDraggedDealId(deal.id);
                          }}
                          onDragEnd={() => {
                            setDraggedDealId(null);
                            setDropTargetStage(null);
                          }}
                          className={`cursor-grab space-y-1.5 rounded-xl border p-3 transition-all active:cursor-grabbing ${
                            draggedDealId === deal.id
                              ? 'scale-[0.98] border-[#1769aa] bg-sky-50 opacity-60'
                              : 'border-slate-200 bg-slate-50/70 hover:-translate-y-0.5 hover:border-[#1769aa] hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1769aa]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono font-bold text-[#0d1f33]">{deal.dealNumber}</span>
                            <span className="text-slate-500 font-semibold">
                              {deal.type === 'order' ? tr('Кошик') : tr('Заявка')}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-[#0d1f33] line-clamp-2">{deal.topic}</div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {deal.customerName} · {deal.phone}
                          </div>
                          <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 truncate">{deal.city}</span>
                            <span className="font-mono font-bold text-[#0d1f33] tabular-nums">
                              {deal.totalUsd > 0 ? `$${deal.totalUsd.toLocaleString('ru-RU')}` : tr('Розрахунок', 'Расчёт')}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: HIGH-DENSITY DATA TABLE */}
        {crmTab === 'table' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                    <th className="py-2.5 px-4">ID</th>
                    <th className="py-2.5 px-4">{tr('Тип')}</th>
                    <th className="py-2.5 px-4">{tr('Клієнт / Контакт')}</th>
                    <th className="py-2.5 px-4">{tr('Задача або позиції')}</th>
                    <th className="py-2.5 px-4">{tr('Етап')}</th>
                    <th className="py-2.5 px-4 text-right">{tr('Сума')}</th>
                    <th className="py-2.5 px-4 text-right">{tr('Дії')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        {tr('Угод за вибраним фільтром не знайдено')}
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono font-bold text-[#0d1f33] whitespace-nowrap">
                          {d.dealNumber}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">
                          {d.type === 'order' ? tr('Кошик') : tr('Лід')} · {d.channel}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-[#0d1f33]">{d.customerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{d.phone}</div>
                        </td>
                        <td className="py-2.5 px-4 max-w-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedDeal(d)}
                            className="font-semibold text-[#1769aa] hover:underline text-left line-clamp-1 cursor-pointer"
                          >
                            {d.topic}
                          </button>
                          <div className="text-[11px] text-slate-500 truncate">{d.city}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={d.stage}
                            onChange={(e) => handlePatchDeal(d.id, { stage: e.target.value as DealStage })}
                            className="px-2 py-1 rounded border border-slate-300 text-xs bg-white font-semibold text-[#0d1f33]"
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {tr(s.label)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#0d1f33] tabular-nums whitespace-nowrap">
                          {d.totalUsd > 0 ? `$${d.totalUsd.toLocaleString('uk-UA')}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDeal(d)}
                            className="text-xs font-bold text-[#1769aa] hover:underline mr-3 cursor-pointer"
                          >
                            {tr('Деталі')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeal(d.id)}
                            aria-label={tr('Видалити угоду')}
                            className="text-slate-400 hover:text-red-600 cursor-pointer align-middle"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CATALOG MANAGER */}
        {crmTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={catQuery}
                    onChange={(e) => setCatQuery(e.target.value)}
                    placeholder={`Пошук по ${products.length} товарах (назва, SKU, бренд)...`}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value as 'all' | ProductCategory)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0d1f33]"
                >
                  <option value="all">{tr('Усі категорії', 'Все категории')} ({products.length})</option>
                  <option value="kits">{tr('Готові рішення')}</option>
                  <option value="inverters">{tr('Інвертори')}</option>
                  <option value="batteries">{tr('Акумулятори')}</option>
                  <option value="panels">{tr('Сонячні панелі')}</option>
                  <option value="parts">{tr('Комплектуючі')}</option>
                </select>
              </div>
              <button
                type="button"
                onClick={openCreateProductModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Додати товар
              </button>
            </div>

            {catalogMsg && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#169374]">
                {catalogMsg}
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                      <th className="py-2.5 px-4">{tr('Фото / SKU', 'Фото / SKU')}</th>
                      <th className="py-2.5 px-4">{tr('Товар та категорія', 'Товар и категория')}</th>
                      <th className="py-2.5 px-4">{tr('Бренд')}</th>
                      <th className="py-2.5 px-4">{tr('Наявність', 'Наличие')}</th>
                      <th className="py-2.5 px-4 text-right">{tr('Ціна USD', 'Цена USD')}</th>
                      <th className="py-2.5 px-4 text-right">{tr('Дії')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">
                          За вашим запитом товарів не знайдено
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const catNames: Record<ProductCategory, string> = {
                          kits: 'Готові рішення',
                          inverters: 'Інвертори',
                          batteries: 'Акумулятори',
                          panels: 'Сонячні панелі',
                          parts: 'Комплектуючі',
                        };
                        const isQuick = quickEditId === p.id;
                        const isBusy = savingQuickId === p.id;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => openEditProductModal(p)}
                                  title={tr('Змінити фото та характеристики', 'Изменить фото и характеристики')}
                                  className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center hover:border-[#1769aa] cursor-pointer"
                                >
                                  <SmartImage
                                    src={p.img}
                                    alt={p.title}
                                    className="w-full h-full object-contain"
                                  />
                                </button>
                                <span className="font-mono text-[11px] text-slate-500">{p.sku}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 max-w-md">
                              {isQuick ? (
                                <input
                                  type="text"
                                  value={quickTitle}
                                  onChange={(e) => setQuickTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void saveQuickEdit(p);
                                    if (e.key === 'Escape') setQuickEditId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded border border-[#1769aa] text-xs font-semibold text-[#0d1f33] bg-white"
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditProductModal(p)}
                                    className="font-semibold text-[#0d1f33] hover:text-[#1769aa] text-left line-clamp-1 cursor-pointer"
                                  >
                                    {p.title}
                                  </button>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {catNames[p.cat]}
                                    {p.specs.length > 0 ? ` · ${p.specs.length} хар-к` : ''}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{p.brand}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {isQuick ? (
                                <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={quickInStock}
                                    onChange={(e) => setQuickInStock(e.target.checked)}
                                  />
                                  В наявності
                                </label>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleToggleStockQuick(p)}
                                  title={tr('Натисніть, щоб швидко перемкнути наявність', 'Нажмите, чтобы быстро изменить наличие')}
                                  className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                                    p.inStock
                                      ? 'bg-emerald-50 border-emerald-200 text-[#169374] hover:bg-emerald-100'
                                      : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                  }`}
                                >
                                  {p.statusLabel || (p.inStock ? 'В наявності' : 'Під замовлення')}
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                              {isQuick ? (
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={quickPrice}
                                    onChange={(e) => setQuickPrice(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void saveQuickEdit(p);
                                      if (e.key === 'Escape') setQuickEditId(null);
                                    }}
                                    placeholder={tr('Ціна', 'Цена')}
                                    className="w-20 px-2 py-1 rounded border border-[#1769aa] text-right font-mono text-xs bg-white"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    value={quickOldPrice}
                                    onChange={(e) => setQuickOldPrice(e.target.value)}
                                    placeholder={tr('Стара', 'Старая')}
                                    title={tr('Стара ціна (закреслена)', 'Старая цена (зачёркнута)')}
                                    className="w-16 px-2 py-1 rounded border border-slate-300 text-right font-mono text-[11px] text-slate-500 bg-white"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div>{p.price > 0 ? `$${p.price.toLocaleString('uk-UA')}` : 'За запитом'}</div>
                                  {p.oldPrice > p.price && (
                                    <div className="text-[10px] text-slate-400 line-through font-normal">
                                      ${p.oldPrice.toLocaleString('uk-UA')}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              {isQuick ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void saveQuickEdit(p)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#169374] hover:bg-[#127a60] text-white text-xs font-bold cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    Ок
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickEditId(null)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startQuickEdit(p)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer"
                                  >
                                    Швидко
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditProductModal(p)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#1769aa]/30 bg-sky-50/50 hover:bg-sky-50 text-xs font-bold text-[#1769aa] cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Фото / Картка
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {catalogMatches.length > 60 && (
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    Показано {filteredProducts.length} з {catalogMatches.length} позицій
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllProducts((v) => !v)}
                    className="font-bold text-[#1769aa] hover:underline cursor-pointer"
                  >
                    {showAllProducts ? 'Згорнути до 60' : `Показати всі (${catalogMatches.length})`}
                  </button>
                </div>
              )}
            </div>

            {/* Storage & Change Persistence Info Bar */}
            {storageInfo && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-extrabold text-[#0d1f33] flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#169374]" />
                    Де зберігаються фото та зміни: <code className="font-mono text-[#1769aa]">{storageInfo.dataDir}</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    БД SQLite ({Math.round(storageInfo.dbSizeBytes / 1024)} КБ) та завантажені фото ({storageInfo.uploadsCount} файлів у{' '}
                    <code className="font-mono">/uploads</code>) при підключеному Railway Volume (<code className="font-mono">DATA_DIR=/data</code>) зберігаються між деплоями — початковий сід не перезаписує ваші правки.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadBackup()}
                  disabled={downloadingBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0d1f33] cursor-pointer whitespace-nowrap"
                >
                  <Database className="w-3.5 h-3.5 text-[#1769aa]" />
                  {downloadingBackup ? 'Готуємо бекап...' : 'Завантажити бекап БД (.db)'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3B: COMPLETED PROJECTS EDITOR */}
        {crmTab === 'projects' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-[#0d1f33]">
                  Редактор реалізованих об’єктів ({projectsList.length})
                </h2>
                <p className="text-xs text-[#52657a] mt-0.5">
                  Нові об’єкти та зміни миттєво з’являються на головній сторінці й у розділі «Проєкти». Завантажені фото
                  зберігаються на Railway Volume.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (showProjectForm && !editingProjectId) {
                    setShowProjectForm(false);
                  } else {
                    resetProjectForm();
                    setProjectFormMsg('');
                    setShowProjectForm(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {showProjectForm && !editingProjectId ? 'Згорнути форму' : 'Додати новий об’єкт'}
              </button>
            </div>

            {projectFormMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#169374]">
                {projectFormMsg}
              </div>
            )}

            {showProjectForm && (
              <form
                onSubmit={handleSaveProject}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-[#0d1f33]">
                    {editingProjectId ? 'Редагувати об’єкт портфоліо' : 'Новий реалізований об’єкт'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      resetProjectForm();
                      setShowProjectForm(false);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-[#0d1f33] cursor-pointer"
                  >
                    Скасувати
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Сегмент', 'Сегмент')}</label>
                    <select
                      value={projSeg}
                      onChange={(e) => {
                        const nextSeg = e.target.value === 'b2b' ? 'b2b' : 'b2c';
                        setProjSeg(nextSeg);
                        if (!projTag || projTag.startsWith('B2B') || projTag.startsWith('B2C')) {
                          setProjTag(nextSeg === 'b2b' ? 'B2B · Одеса' : 'B2C · Одеса');
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1769aa]"
                    >
                      <option value="b2c">B2C ({tr('Для дому / квартири', 'Для дома / квартиры')})</option>
                      <option value="b2b">B2B ({tr('Для бізнесу', 'Для бизнеса')})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Локація / мітка', 'Локация / метка')}</label>
                    <input
                      type="text"
                      value={projTag}
                      onChange={(e) => setProjTag(e.target.value)}
                      placeholder={tr('B2C · Одеса, Таїрова', 'B2C · Одесса, Таирова')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Назва об’єкта *', 'Название объекта *')}</label>
                    <input
                      type="text"
                      required
                      value={projTitle}
                      onChange={(e) => setProjTitle(e.target.value)}
                      placeholder={tr('Наприклад: Приватний будинок 180 м² у Совіньйоні', 'Например: Частный дом 180 м² в Совиньоне')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Короткі параметри (відображаються внизу картки)
                      </label>
                      <input
                        type="text"
                        value={projSpecs}
                        onChange={(e) => setProjSpecs(e.target.value)}
                        placeholder={tr('PV 10 кВт · Інвертор Deye 12 кВт · АКБ 15 кВт·год', 'PV 10 кВт · Инвертор Deye 12 кВт · АКБ 15 кВт·ч')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Фото об’єкта (завантажте файл або вставте URL)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#0d1f33] cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5 text-[#1769aa]" />
                          <span>{uploadingPhoto ? 'Завантажуємо...' : 'Завантажити фото'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={uploadingPhoto}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUploadProjectPhoto(file);
                              e.target.value = '';
                            }}
                            className="sr-only"
                          />
                        </label>
                        <input
                          type="text"
                          value={projImg}
                          onChange={(e) => setProjImg(e.target.value)}
                          placeholder="/uploads/... або /assets/energocomfort/house_6kw.png"
                          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-4">
                    <div className="text-[11px] font-bold text-slate-600 mb-1">{tr('Попередній перегляд фото', 'Предварительный просмотр фото')}</div>
                    <div className="h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <SmartImage src={projImg} alt={projTitle || 'Прев’ю'} className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Задача клієнта', 'Задача клиента')}</label>
                    <textarea
                      rows={3}
                      value={projTask}
                      onChange={(e) => setProjTask(e.target.value)}
                      placeholder={tr('Яку проблему потрібно було вирішити...', 'Какую задачу нужно было решить…')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Реалізоване рішення', 'Реализованное решение')}</label>
                    <textarea
                      rows={3}
                      value={projSolution}
                      onChange={(e) => setProjSolution(e.target.value)}
                      placeholder={tr('Яке обладнання встановили (панелі, інвертор, АКБ)...', 'Какое оборудование установили (панели, инвертор, аккумулятор)…')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{tr('Результат', 'Результат')}</label>
                    <textarea
                      rows={3}
                      value={projResult}
                      onChange={(e) => setProjResult(e.target.value)}
                      placeholder={tr('Автономність, економія, стабільна робота...', 'Автономность, экономия, стабильная работа…')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                </div>

                {projectFormErr && <div className="text-xs font-semibold text-red-600">{projectFormErr}</div>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingProject || uploadingPhoto}
                    className="px-5 py-2.5 rounded-lg bg-[#169374] hover:bg-[#127a60] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                  >
                    {savingProject
                      ? 'Зберігаємо...'
                      : editingProjectId
                        ? 'Оновити об’єкт'
                        : 'Опублікувати об’єкт на сайті'}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projectsList.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-44 bg-[#0d1f33]">
                      <SmartImage src={proj.img} alt={proj.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[11px] font-bold text-white">
                        {proj.tag}
                      </div>
                    </div>
                    <div className="p-4 space-y-1.5">
                      <h3 className="text-sm font-extrabold text-[#0d1f33]">{proj.title}</h3>
                      <p className="text-xs text-[#52657a] line-clamp-2">{proj.task}</p>
                      <div className="font-mono text-[11px] font-semibold text-[#1769aa] pt-1">{proj.specs}</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => startEditProject(proj)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769aa] hover:underline cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Редагувати
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProject(proj.id, proj.title)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Видалити
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS & PIXELS (META PIXEL + GA4) */}
        {crmTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSaveAnalytics}
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div>
                  <div className="text-xs font-extrabold text-[#1769aa]">{tr('Налаштування трекінгу', 'Настройки аналитики')}</div>
                  <h2 className="text-lg font-extrabold text-[#0d1f33]">Meta Pixel та Google Analytics 4</h2>
                  <p className="text-xs text-[#52657a] mt-1 leading-relaxed">
                    Введіть ID прямо тут (або задайте у Railway Variables `META_PIXEL_ID` / `GA4_MEASUREMENT_ID`) —
                    скрипти та всі конверсійні події запрацюють на вітрині автоматично.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Meta (Facebook) Pixel ID</label>
                  <input
                    type="text"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                    placeholder={tr('Наприклад: 123456789012345', 'Например: 123456789012345')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">Google Analytics 4 Measurement ID</label>
                  <input
                    type="text"
                    value={ga4MeasurementId}
                    onChange={(e) => setGa4MeasurementId(e.target.value)}
                    placeholder={tr('Наприклад: G-XXXXXXXXXX', 'Например: G-XXXXXXXXXX')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">
                    Google Tag Manager ID (опціонально)
                  </label>
                  <input
                    type="text"
                    value={gtmContainerId}
                    onChange={(e) => setGtmContainerId(e.target.value)}
                    placeholder={tr('Наприклад: GTM-XXXXXXX', 'Например: GTM-XXXXXXX')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-[#0d1f33] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                    className="accent-[#169374]"
                  />
                  Увімкнути відправку подій у Meta Pixel / GA4
                </label>

                {analyticsErr && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                    {analyticsErr}
                  </div>
                )}
                {analyticsMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#169374]">
                    {analyticsMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingAnalytics}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                >
                  {savingAnalytics ? 'Зберігаємо...' : 'Зберегти ID та застосувати'}
                </button>
              </form>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <div className="text-xs font-extrabold text-[#169374]">{tr('Матриця конверсійних подій', 'События конверсии')}</div>
                  <h2 className="text-lg font-extrabold text-[#0d1f33]">{tr('Які події вже підключені на сайті', 'Какие события уже подключены на сайте')}</h2>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                        <th className="py-2 px-3">{tr('Дія користувача', 'Действие пользователя')}</th>
                        <th className="py-2 px-3">Meta Pixel (fbq)</th>
                        <th className="py-2 px-3">GA4 (gtag)</th>
                        <th className="py-2 px-3">{tr('Параметри', 'Параметры')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Перехід між сторінками', 'Переход между страницами')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">PageView</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">page_view</td>
                        <td className="py-2 px-3 text-slate-600">page_path, page_title</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Перегляд картки товару', 'Просмотр карточки товара')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">ViewContent</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">view_item</td>
                        <td className="py-2 px-3 text-slate-600">item_id (SKU), item_name, value, USD</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Натискання «У кошик»', 'Нажатие «В корзину»')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">AddToCart</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">add_to_cart</td>
                        <td className="py-2 px-3 text-slate-600">item_id, item_name, value, USD</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Відкриття кошика з товарами', 'Открытие корзины с товарами')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">InitiateCheckout</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">begin_checkout</td>
                        <td className="py-2 px-3 text-slate-600">value, items_count, USD</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Оформлення замовлення', 'Оформление заказа')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">Purchase</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">purchase</td>
                        <td className="py-2 px-3 text-slate-600">transaction_id (EC-XXXX), value, USD</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Відправка форми розрахунку', 'Отправка формы расчёта')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">Lead</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">generate_lead</td>
                        <td className="py-2 px-3 text-slate-600">lead_topic, value</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-[#0d1f33]">{tr('Клік по номеру телефону', 'Нажатие на номер телефона')}</td>
                        <td className="py-2 px-3 font-mono text-[#1769aa]">Contact</td>
                        <td className="py-2 px-3 font-mono text-[#169374]">contact</td>
                        <td className="py-2 px-3 text-slate-600">phone</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0d1f33]">{tr('Журнал останніх подій на сайті', 'Журнал последних событий на сайте')}</h3>
                  <p className="text-[11px] text-slate-500">
                    Показує реальні події, які відправились у Meta Pixel та Google Analytics під час роботи клієнтів.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAnalytics()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Оновити
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                      <th className="py-2 px-4">{tr('Час', 'Время')}</th>
                      <th className="py-2 px-4">Meta Event</th>
                      <th className="py-2 px-4">GA4 Event</th>
                      <th className="py-2 px-4">{tr('Параметри події', 'Параметры события')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          Подій ще не зафіксовано. Відкрийте товар або оформіть тестове замовлення на вітрині.
                        </td>
                      </tr>
                    ) : (
                      recentEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(ev.createdAt).toLocaleString('uk-UA')}
                          </td>
                          <td className="py-2 px-4 font-mono font-bold text-[#1769aa] whitespace-nowrap">
                            {ev.metaEvent}
                          </td>
                          <td className="py-2 px-4 font-mono font-bold text-[#169374] whitespace-nowrap">
                            {ev.ga4Event}
                          </td>
                          <td className="py-2 px-4 font-mono text-[11px] text-slate-700">
                            {Object.entries(ev.payload)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(' · ') || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SOCIAL NETWORKS & SEO FEEDS */}
        {crmTab === 'social' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveSocialLinks}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#1769aa] flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    Соціальні мережі та месенджери
                  </div>
                  <h2 className="text-lg font-extrabold text-[#0d1f33]">
                    Посилання для іконок у шапці та футері сайту
                  </h2>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#0d1f33]">
                  <SocialIcons links={socialForm} variant="header" />
                </div>
              </div>

              <p className="text-xs text-[#52657a]">
                Заповніть потрібні посилання (починаючи з <code className="font-mono">https://</code>). Іконки з порожніми
                полями автоматично приховуються з сайту.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {(
                  [
                    ['telegram', 'Telegram (канал або менеджер)', 'https://t.me/energocomfort'],
                    ['viber', 'Viber-спільнота / чат', 'https://invite.viber.com/...'],
                    ['instagram', 'Instagram', 'https://www.instagram.com/energocomfort.shop'],
                    ['facebook', 'Facebook', 'https://www.facebook.com/energocomfort.shop'],
                    ['youtube', 'YouTube канал', 'https://www.youtube.com/@energocomfort'],
                    ['tiktok', 'TikTok', 'https://www.tiktok.com/@energocomfort'],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key}>
                    <label className="block font-bold text-[#0d1f33] mb-1">{label}</label>
                    <input
                      type="url"
                      value={socialForm[key]}
                      onChange={(e) => setSocialForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                    />
                  </div>
                ))}
              </div>

              {socialErr && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {socialErr}
                </div>
              )}
              {socialMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#169374]">
                  {socialMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={savingSocial}
                className="px-5 py-2.5 rounded-lg bg-[#1769aa] hover:bg-[#12568c] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
              >
                {savingSocial ? 'Зберігаємо...' : 'Зберегти соцмережі'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <div className="text-xs font-extrabold text-[#169374] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  SEO, Sitemap та Товарні XML-фіди
                </div>
                <h2 className="text-lg font-extrabold text-[#0d1f33]">{tr('Посилання для Google та Meta Catalog', 'Ссылки для Google и каталога Meta')}</h2>
                <p className="text-xs text-[#52657a] mt-1 leading-relaxed">
                  Файли генеруються сервером динамічно безпосередньо з бази SQLite — кожен новий або оновлений товар
                  одразу потрапляє у Sitemap і товарний фід.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                {[
                  {
                    label: 'Товарний XML-фід (Meta Commerce / Google Merchant)',
                    path: '/feed.xml',
                  },
                  {
                    label: 'Мапа сайту для Google Search Console',
                    path: '/sitemap.xml',
                  },
                  {
                    label: 'Правила індексації пошукових роботів',
                    path: '/robots.txt',
                  },
                ].map((item) => {
                  const fullUrl =
                    typeof window !== 'undefined' ? `${window.location.origin}${item.path}` : item.path;
                  return (
                    <div key={item.path} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="font-bold text-[#0d1f33]">{item.label}</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-[11px] text-[#1769aa] truncate">{fullUrl}</code>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(fullUrl);
                              setCopiedFeed(item.path);
                              setTimeout(() => setCopiedFeed(''), 2000);
                            }}
                            className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-[#0d1f33] cursor-pointer"
                          >
                            {copiedFeed === item.path ? 'Скопійовано' : 'Копіювати'}
                          </button>
                          <a
                            href={item.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0d1f33] text-white text-[11px] font-bold"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Відкрити
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-[11px] text-[#0d1f33] leading-relaxed">
                <strong>{tr('Людські URL:', 'Понятные URL:')}</strong> {tr('сторінки', 'страницы')} <code className="font-mono">/shop</code>,{' '}
                <code className="font-mono">/services</code>, <code className="font-mono">/projects</code>,{' '}
                <code className="font-mono">/contacts</code> та картки товарів{' '}
                <code className="font-mono">/shop/&lt;id&gt;</code> оновлюють адресний рядок,{' '}
                <code className="font-mono">&lt;title&gt;</code>, <code className="font-mono">canonical</code> і Schema.org
                JSON-LD автоматично.
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BACKUP, STORAGE TRACKING, TELEGRAM WEBHOOK & GOOGLE ACCESS */}
        {crmTab === 'deploy' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SQLite Backup & Persistence Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#1769aa]">{tr('Збереження даних і резервні копії', 'Хранение данных и резервные копии')}</div>
                  <h2 className="text-lg font-extrabold text-[#0d1f33]">{tr('SQLite Volume, Фото та Бекап', 'SQLite Volume, фотографии и резервная копия')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadBackup()}
                  disabled={downloadingBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#169374] hover:bg-[#127a60] disabled:opacity-60 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingBackup ? 'Формуємо...' : 'Завантажити бекап БД (.db)'}
                </button>
              </div>

              {backupErr && <div className="text-xs font-semibold text-red-600">{backupErr}</div>}

              {storageInfo && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{tr('Каталог даних (DATA_DIR):', 'Каталог данных (DATA_DIR):')}</span>
                    <code className="font-mono font-bold text-[#0d1f33]">{storageInfo.dataDir}</code>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{tr('База даних SQLite:', 'База данных SQLite:')}</span>
                    <span className="font-mono font-semibold text-[#0d1f33]">
                      {Math.round(storageInfo.dbSizeBytes / 1024)} КБ · {storageInfo.productsCount} тов. /{' '}
                      {storageInfo.projectsCount} об’єктів / {storageInfo.dealsCount} угод
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{tr('Завантажені фото (/uploads):', 'Загруженные фото (/uploads):')}</span>
                    <span className="font-mono font-semibold text-[#0d1f33]">
                      {storageInfo.uploadsCount} файлів ({storageInfo.uploadsDir})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{tr('Постійний Volume (Railway):', 'Постоянный том (Railway):')}</span>
                    <span className={`font-bold ${storageInfo.isCustomVolume ? 'text-[#169374]' : 'text-amber-700'}`}>
                      {storageInfo.isCustomVolume ? 'Підключено (DATA_DIR задано)' : 'Локальна папка (задайте DATA_DIR=/data)'}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-[#52657a] leading-relaxed">
                Стартовий <code className="font-mono text-[#0d1f33]">server/seed/catalog.json</code> завантажується{' '}
                <strong>лише 1 раз</strong>, коли таблиця <code className="font-mono text-[#0d1f33]">products</code> порожня.
                При підключеному Volume (<code className="font-mono text-[#0d1f33]">/data</code> +{' '}
                <code className="font-mono text-[#0d1f33]">DATA_DIR=/data</code>) усі зміни цін, фото та об’єктів
                зберігаються назавжди і не втрачаються при оновленні коду.
              </div>
            </div>

            {/* Telegram Bot Test + One-Click Webhook Setup */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="text-xs font-extrabold text-[#169374]">{tr('Інтеграція Telegram Bot', 'Интеграция Telegram-бота')}</div>
              <h2 className="text-lg font-extrabold text-[#0d1f33]">{tr('Сповіщення менеджеру та Webhook', 'Уведомления менеджеру и Webhook')}</h2>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#0d1f33]">{tr('Змінні оточення Telegram:', 'Переменные окружения Telegram:')}</span>
                  <span className={`font-bold ${telegramConfigured ? 'text-[#169374]' : 'text-amber-700'}`}>
                    {telegramConfigured ? 'Підключено' : 'Очікує TELEGRAM_BOT_TOKEN'}
                  </span>
                </div>
                {webhookStatus && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{tr('Поточний Webhook URL:', 'Текущий Webhook URL:')}</span>
                    <span className="font-mono text-[11px] text-[#0d1f33] truncate max-w-[260px]">
                      {webhookStatus.url || 'Не встановлено'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-bold text-[#0d1f33]">HTTPS-адреса Webhook для Telegram-бота</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://energocomfort.shop/api/telegram/webhook"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={settingWebhook}
                    onClick={() => void handleSetupTelegramWebhook()}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#169374] hover:bg-[#127a60] disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {settingWebhook ? 'Налаштовуємо...' : 'Налаштувати Webhook'}
                  </button>
                </div>
                {webhookErr && <div className="text-xs font-semibold text-red-600">{webhookErr}</div>}
                {webhookMsg && <div className="text-xs font-semibold text-[#169374]">{webhookMsg}</div>}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1769aa] hover:bg-[#12568c] text-white text-xs font-bold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Перевірити Telegram-сповіщення
                </button>
                {tgResult && <span className="text-xs font-semibold text-slate-700">{tgResult}</span>}
              </div>
            </div>

            {/* Recent DB Changes Audit List */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0d1f33]">{tr('Останні зміни карток товарів та об’єктів у БД', 'Последние изменения товаров и объектов в базе данных')}</h3>
                  <p className="text-[11px] text-slate-500">
                    Кожне редагування або додавання товару/об’єкта фіксується в SQLite із точним часом оновлення.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDiagnostics()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-[#0d1f33] hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Оновити
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {recentChanges.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">{tr('Поки немає записів про зміни', 'Пока нет записей об изменениях')}</div>
                ) : (
                  recentChanges.map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="px-6 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.kind === 'product'
                              ? 'bg-sky-50 text-[#1769aa]'
                              : 'bg-emerald-50 text-[#169374]'
                          }`}
                        >
                          {item.kind === 'product' ? 'Товар' : 'Об’єкт'}
                        </span>
                        <span className="font-semibold text-[#0d1f33] truncate">{item.title}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleString('uk-UA')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold text-[#1769aa]">Google Login (Firebase Auth)</div>
                  <h2 className="text-lg font-extrabold text-[#0d1f33]">
                    Дозволені Google-акаунти для входу в Адмінку
                  </h2>
                  <p className="text-xs text-[#52657a] mt-1">
                    Тільки користувачі з підтвердженим email із цього списку (або зі змінної{' '}
                    <code className="font-mono text-[#0d1f33]">ADMIN_EMAILS</code>) можуть увійти через Google. При
                    перенесенні на Railway додайте ваш домен у <strong>Authentication → Settings → Authorized domains</strong>{' '}
                    у Firebase Console.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Активні: {effectiveAdminEmails.join(', ') || '—'}
                </div>
              </div>

              <form onSubmit={handleSaveAdminEmails} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-[#0d1f33] mb-1">
                    Email адміністраторів / менеджерів (через кому)
                  </label>
                  <input
                    type="text"
                    value={adminEmailsInput}
                    onChange={(e) => setAdminEmailsInput(e.target.value)}
                    placeholder="owner@gmail.com, manager@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#1769aa]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingEmails}
                  className="px-4 py-2.5 rounded-lg bg-[#0d1f33] hover:bg-[#16324f] disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {savingEmails ? 'Зберігаємо...' : 'Зберегти список доступу'}
                </button>
              </form>

              {emailsErr && <div className="text-xs font-semibold text-red-600">{emailsErr}</div>}
              {emailsMsg && <div className="text-xs font-semibold text-[#169374]">{emailsMsg}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Deal Inspector Modal */}
      {selectedDeal && (
        <div
          className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDeal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="font-mono text-xs font-bold text-[#1769aa]">{selectedDeal.dealNumber}</div>
                <h3 className="text-base font-extrabold text-[#0d1f33]">{selectedDeal.topic}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeal(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-slate-500">{tr('Клієнт')}</div>
                  <div className="font-bold text-[#0d1f33] mt-0.5">{selectedDeal.customerName}</div>
                </div>
                <div>
                  <div className="text-slate-500">{tr('Телефон')}</div>
                  <div className="font-mono font-bold text-[#0d1f33] mt-0.5">{selectedDeal.phone}</div>
                </div>
                <div>
                  <div className="text-slate-500">{tr('Місто / Об’єкт')}</div>
                  <div className="font-semibold text-[#0d1f33] mt-0.5">{selectedDeal.city}</div>
                </div>
                <div>
                  <div className="text-slate-500">{tr('Канал зв’язку')}</div>
                  <div className="font-semibold text-[#0d1f33] mt-0.5">{selectedDeal.channel}</div>
                </div>
              </div>

              {selectedDeal.loads.length > 0 && (
                <div>
                  <div className="font-bold text-slate-500 mb-1">{tr('Критичні прилади')}</div>
                  <div className="text-[#0d1f33] font-semibold">{selectedDeal.loads.join(' · ')}</div>
                </div>
              )}

              {selectedDeal.items.length > 0 && (
                <div>
                  <div className="font-bold text-slate-500 mb-1.5">{tr('Склад замовлення')}</div>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {selectedDeal.items.map((it) => (
                      <div key={it.productId} className="p-2.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0d1f33]">{it.title}</span>
                        <span className="font-mono font-bold whitespace-nowrap tabular-nums">
                          {it.qty} × ${it.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Етап воронки')}</label>
                  <select
                    value={selectedDeal.stage}
                    disabled={savingDeal}
                    onChange={(e) => handlePatchDeal(selectedDeal.id, { stage: e.target.value as DealStage })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Відповідальний')}</label>
                  <select
                    value={selectedDeal.assignee}
                    disabled={savingDeal}
                    onChange={(e) => handlePatchDeal(selectedDeal.id, { assignee: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Бюджет / Сума угоди (USD)')}</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={selectedDeal.totalUsd}
                  onBlur={(e) => handlePatchDeal(selectedDeal.id, { totalUsd: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">{tr('Нотатки інженера / менеджера')}</label>
                <textarea
                  rows={3}
                  defaultValue={selectedDeal.notes}
                  onBlur={(e) => handlePatchDeal(selectedDeal.id, { notes: e.target.value })}
                  placeholder={tr('Додайте нотатку по об’єкту...')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="inline-flex items-center gap-1.5 text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#169374]" />
                  <span>{tr('Зміни зберігаються в SQLite автоматично')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteDeal(selectedDeal.id)}
                  className="text-red-600 font-bold hover:underline cursor-pointer"
                >
                  {tr('Видалити угоду')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Product Card Editor Modal (Create & Full Edit) */}
      {productModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#081421]/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setProductModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div>
                <div className="font-mono text-[11px] font-bold text-[#1769aa]">
                  {editingProdId ? `Редагування картки · ${prodSku || editingProdId}` : 'Нова картка товару'}
                </div>
                <h3 className="text-base font-extrabold text-[#0d1f33]">
                  {editingProdId ? prodTitle || 'Товар каталогу' : 'Додати позицію в каталог'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-600 mb-1">{tr('Назва товару *', 'Название товара *')}</label>
                  <input
                    type="text"
                    required
                    value={prodTitle}
                    onChange={(e) => setProdTitle(e.target.value)}
                    placeholder={tr('Наприклад, Гібридний інвертор Deye SUN-8K-SG01LP1-EU', 'Например, гибридный инвертор Deye SUN-8K-SG01LP1-EU')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-[#0d1f33]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">SKU (артикул)</label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="10999"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Бренд')}</label>
                  <input
                    type="text"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    placeholder="Deye"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Категорія', 'Категория')}</label>
                  <select
                    value={prodCat}
                    onChange={(e) => {
                      const nextCat = e.target.value as ProductCategory;
                      setProdCat(nextCat);
                      if (nextCat === 'kits') setProdIsKit(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="kits">{tr('Готові рішення')}</option>
                    <option value="inverters">{tr('Інвертори')}</option>
                    <option value="batteries">{tr('Акумулятори')}</option>
                    <option value="panels">{tr('Сонячні панелі')}</option>
                    <option value="parts">{tr('Комплектуючі')}</option>
                  </select>
                </div>

                <div className="flex items-end pb-1.5">
                  <label className="inline-flex items-center gap-2 font-semibold text-[#0d1f33] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodIsKit}
                      onChange={(e) => setProdIsKit(e.target.checked)}
                    />
                    Показувати в блоці «Готові рішення»
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Ціна (USD, 0 = «За запитом»)', 'Цена (USD, 0 = «По запросу»)')}</label>
                  <input
                    type="number"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="1250"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Стара ціна (USD, закреслена)', 'Старая цена (USD, зачёркнутая)')}</label>
                  <input
                    type="number"
                    min="0"
                    value={prodOldPrice}
                    onChange={(e) => setProdOldPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>

                <div className="flex items-center">
                  <label className="inline-flex items-center gap-2 font-semibold text-[#0d1f33] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodInStock}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProdInStock(checked);
                        setProdStatusLabel(checked ? 'в наявності' : 'під замовлення');
                      }}
                    />
                    Товар у наявності на складі
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{tr('Текст статусу наявності', 'Текст статуса наличия')}</label>
                  <input
                    type="text"
                    value={prodStatusLabel}
                    onChange={(e) => setProdStatusLabel(e.target.value)}
                    placeholder="в наявності"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Photo Upload + Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <label className="block font-bold text-slate-600">{tr('Фото товару (завантаження на сервер або URL)', 'Фото товара (загрузка на сервер или URL)')}</label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    <SmartImage
                      key={prodImg}
                      src={prodImg}
                      alt={prodTitle || 'Товар'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-[#0d1f33] cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingProdPhoto ? 'Завантажуємо...' : 'Завантажити фото (JPG/PNG/WebP)'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingProdPhoto}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadProductPhoto(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {prodImg && (
                        <button
                          type="button"
                          onClick={() => setProdImg('')}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                        >
                          Очистити фото
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={prodImg}
                      onChange={(e) => setProdImg(e.target.value)}
                      placeholder="/assets/products/... або /uploads/... або https://..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">{tr('Опис товару (відображається в картці)', 'Описание товара (отображается в карточке)')}</label>
                <textarea
                  rows={3}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder={tr('Ключові особливості, сумісність, гарантія...', 'Ключевые особенности, совместимость, гарантия…')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Specs key-value editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-600">{tr('Технічні характеристики', 'Технические характеристики')}</label>
                  <button
                    type="button"
                    onClick={() => setProdSpecs((prev) => [...prev, ['', '']])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1769aa] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Додати характеристику
                  </button>
                </div>

                {prodSpecs.length === 0 ? (
                  <div className="text-[11px] text-slate-400">{tr('Характеристики поки не додані', 'Характеристики пока не добавлены')}</div>
                ) : (
                  <div className="space-y-1.5">
                    {prodSpecs.map(([k, v], idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={k}
                          onChange={(e) =>
                            setProdSpecs((prev) =>
                              prev.map((row, i) => (i === idx ? [e.target.value, row[1]] : row)),
                            )
                          }
                          placeholder={tr('Параметр (напр., Потужність)', 'Параметр (например, мощность)')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <input
                          type="text"
                          value={v}
                          onChange={(e) =>
                            setProdSpecs((prev) =>
                              prev.map((row, i) => (i === idx ? [row[0], e.target.value] : row)),
                            )
                          }
                          placeholder={tr('Значення (напр., 8 кВт)', 'Значение (например, 8 кВт)')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setProdSpecs((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={tr('Видалити рядок', 'Удалить строку')}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {prodModalErr && <div className="text-xs font-semibold text-red-600">{prodModalErr}</div>}

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {editingProdId &&
                    (confirmDeleteProd ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs font-semibold text-red-700">{tr('Точно видалити?', 'Точно удалить?')}</span>
                        <button
                          type="button"
                          disabled={savingProduct}
                          onClick={() => handleDeleteProduct(editingProdId, prodTitle)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Так, видалити
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProd(false)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Ні
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteProd(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Видалити товар
                      </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProductModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct || uploadingProdPhoto}
                    className="px-5 py-2 rounded-lg bg-[#169374] hover:bg-[#127a60] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                  >
                    {savingProduct
                      ? 'Зберігаємо...'
                      : editingProdId
                        ? 'Зберегти зміни'
                        : 'Створити товар'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
