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
}

