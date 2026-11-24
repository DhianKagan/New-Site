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
      setEmailsErr('Помилка з         </div>
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
         унти для входу в Адмінку
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
                   