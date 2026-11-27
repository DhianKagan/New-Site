export type ProductCategory = 'kits' | 'inverters' | 'batteries' | 'panels' | 'parts';

export interface Product {
  id: string;
  sku: string;
  title: string;
  titleRu?: string;
  cat: ProductCategory;
  rawCats: string[];
  brand: string;
  isKit: boolean;
  price: number;
  oldPrice: number;
  inStock: boolean;
  statusLabel: string;
  statusLabelRu?: string;
  img: string;
  specs: [string, string][];
  specsRu?: [string, string][];
  description: string;
  descriptionRu?: string;
  sourceUrl: string;
}

export interface CartItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  qty: number;
  img: string;
}

export type DealType = 'order' | 'lead';
export type DealStage = 'new' | 'audit' | 'proposal' | 'fulfillment' | 'done' | 'archived';

export interface DealItem {
  productId: string;
  sku: string;
  title: string;
  price: number;
  qty: number;
}

export interface Deal {
  id: number;
  dealNumber: string;
  contactId?: number | null;
  customerEmail?: string;
  type: DealType;
  stage: DealStage;
  customerName: string;
  phone: string;
  city: string;
  channel: string;
  topic: string;
  taskType: string;
  loads: string[];
  items: DealItem[];
  totalUsd: number;
  assignee: string;
  notes: string;
  telegramSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealPatchPayload {
  type?: DealType;
  stage?: DealStage;
  assignee?: string;
  customerName?: string;
  phone?: string;
  customerEmail?: string;
  city?: string;
  channel?: string;
  topic?: string;
  taskType?: string;
  loads?: string[];
  items?: Array<{ productId: string; qty: number }>;
  notes?: string;
  totalUsd?: number;
}

export type ContactSegment = 'b2c' | 'b2b';

export interface Contact {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  channel: string;
  segment: ContactSegment;
  createdAt: string;
  updatedAt: string;
  dealsCount?: number;
  totalUsd?: number;
  openTasksCount?: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface CrmTask {
  id: number;
  contactId: number | null;
  dealId: number | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  contactName?: string;
  contactPhone?: string;
  dealNumber?: string;
}

export interface CrmNote {
  id: number;
  contactId: number | null;
  dealId: number | null;
  author: string;
  body: string;
  createdAt: string;
}

export type StaffRole = 'admin' | 'manager' | 'engineer' | 'installer';

export interface StaffUser {
  id: number;
  name: string;
  login: string;
  email: string;
  phone: string;
  position: string;
  role: StaffRole;
  assigneeLabel: string;
  canLogin: boolean;
  active: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSessionUser {
  userId: number | null;
  name: string;
  login: string;
  email: string;
  role: StaffRole;
  assigneeLabel: string;
}

export interface ProjectCase {
  id: string;
  seg: 'b2b' | 'b2c';
  tag: string;
  tagRu?: string;
  title: string;
  titleRu?: string;
  img: string;
  task: string;
  taskRu?: string;
  solution: string;
  solutionRu?: string;
  specs: string;
  specsRu?: string;
  result: string;
  resultRu?: string;
}

export interface ServiceItem {
  id: string;
  category: 'montage' | 'extra';
  kicker: string;
  kickerRu?: string;
  title: string;
  titleRu?: string;
  image?: string;
  imageAlt?: string;
  priceLabel: string;
  priceLabelRu?: string;
  summary: string;
  summaryRu?: string;
  bullets: string[];
  bulletsRu?: string[];
}

export interface AnalyticsConfig {
  metaPixelId: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  analyticsEnabled: boolean;
}

export interface AnalyticsEventRecord {
  id: number;
  eventName: string;
  metaEvent: string;
  ga4Event: string;
  payload: Record<string, string | number>;
  createdAt: string;
}

export interface SocialLinksConfig {
  telegram: string;
  instagram: string;
  facebook: string;
  youtube: string;
  viber: string;
  tiktok: string;
}

export interface RecentChangeRecord {
  kind: 'product' | 'project';
  id: string;
  title: string;
  updatedAt: string;
}

export interface StorageDiagnostics {
  dataDir: string;
  dbPath: string;
  dbSizeBytes: number;
  uploadsDir: string;
  uploadsCount: number;
  productsCount: number;
  projectsCount: number;
  dealsCount: number;
  isCustomVolume: boolean;
}

export interface AdminAuthStatus {
  configured: boolean;
  mode: 'setup' | 'login';
  googleEnabled?: boolean;
  setupTokenRequired?: boolean;
  setupTokenConfigured?: boolean;
}

export interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  authProvider: 'google' | 'password' | 'both';
  active: boolean;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCustomer extends CustomerProfile {
  dealsCount: number;
  activeDealsCount: number;
  totalUsd: number;
}

export interface ClientSessionUser {
  customerId: number;
  name: string;
  email: string;
  phone: string;
  city: string;
}

export interface UnifiedAuthResult {
  accountType: 'staff' | 'client';
  token: string;
  user?: CrmSessionUser;
  customer?: CustomerProfile;
}

export interface FirebaseDomainRule {
  hostPattern: string;
  authDomain?: string;
  projectId?: string;
  apiKey?: string;
  appId?: string;
}

export interface FirebaseRuntimeWebConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId: string;
  requestHost: string;
  matchedRule: string | null;
  authorizedHosts: string[];
}

export type ClientErrorKind = 'react_boundary' | 'window_error' | 'unhandled_rejection';

export interface ClientErrorRecord {
  id: number;
  errorId: string;
  kind: ClientErrorKind;
  name: string;
  message: string;
  stack: string;
  componentStack: string;
  route: string;
  locale: string;
  createdAt: string;
}

export interface CommercialRateInfo {
  rate: number | null;
  updatedAt: string;
  updatedBy: string;
}

export interface Market7kmRateInfo {
  available: boolean;
  buy: number | null;
  sell: number | null;
  wholesaleBuy: number | null;
  wholesaleSell: number | null;
  cityAverageBuy: number | null;
  cityAverageSell: number | null;
  sourceLabel: string;
  fetchedAt: string;
  stale?: boolean;
  error?: string;
}

export interface CrmExchangeRateResponse {
  commercial: CommercialRateInfo;
  effectiveRate: number | null;
  effectiveSource: 'commercial' | 'market_fallback' | 'unset';
  market7km: Market7kmRateInfo;
}

export type ProductReviewStatus = 'published' | 'hidden';

export interface ProductReview {
  id: string;
  productId: string;
  authorUid: string;
  authorName: string;
  rating: number;
  comment: string;
  status: ProductReviewStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ProductReviewInput {
  productId: string;
  authorName: string;
  rating: number;
  comment: string;
}

export interface ProductReviewStats {
  count: number;
  averageRating: number;
  distribution: [number, number, number, number, number];
}

export type ProductReviewSortOrder = 'newest' | 'oldest' | 'highest' | 'lowest';
export type ProductReviewRatingFilter = 'all' | 1 | 2 | 3 | 4 | 5;

export interface DbColumnMeta {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isAutoGenerated: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface DbTableMeta {
  name: string;
  rowCount: number;
  totalBytes: number;
  primaryKey: string[];
  writable: boolean;
  columns: DbColumnMeta[];
}

export interface DbOverviewResponse {
  mode: 'postgresql' | 'memory';
  connected: boolean;
  databaseName: string;
  hostLabel: string;
  version: string;
  sizeBytes: number;
  activeConnections: number;
  tables: DbTableMeta[];
  error?: string;
}

export interface DbRowsResponse {
  mode: 'postgresql' | 'memory';
  table: string;
  primaryKey: string[];
  writable: boolean;
  columns: DbColumnMeta[];
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  executionMs: number;
}

export interface DbQueryResponse {
  mode: 'postgresql' | 'memory';
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  command: string;
  durationMs: number;
  truncated: boolean;
  readOnly: boolean;
}

export interface S3ObjectItem {
  key: string;
  fileName: string;
  size: number;
  lastModified: string;
  etag: string;
  isImage: boolean;
  contentTypeGuess: string;
  publicUrl: string;
}

export interface LocalVolumeFileItem {
  fileName: string;
  size: number;
  modifiedAt: string;
  isImage: boolean;
  url: string;
}

export interface StorageOverviewResponse {
  s3Configured: boolean;
  s3ProxyEnabled: boolean;
  s3Reachable: boolean;
  s3Error?: string;
  bucket: string;
  endpointHost: string;
  region: string;
  localUploadsDir: string;
  localFilesCount: number;
  localFilesTotalBytes: number;
}

export interface S3ListResponse {
  configured: boolean;
  bucket: string;
  prefix: string;
  folders: string[];
  objects: S3ObjectItem[];
  nextContinuationToken: string | null;
  totalSizeBytes: number;
}

export interface S3MigrateResult {
  uploaded: number;
  skippedExisting: number;
  failed: number;
  details: Array<{ fileName: string; status: 'uploaded' | 'skipped' | 'error'; message?: string }>;
}

export interface CatalogIntegrityReport {
  checkedAt: string;
  productsCount: number;
  projectsCount: number;
  dealsCount: number;
  zeroPriceProducts: Array<{ id: string; sku: string; title: string }>;
  duplicateSkus: Array<{ sku: string; count: number }>;
  brokenLocalImages: Array<{ kind: 'product' | 'project'; id: string; title: string; img: string }>;
  uploadsReferencedCount: number;
  uploadsOnVolumeCount: number;
  uploadsInS3Count: number;
}

