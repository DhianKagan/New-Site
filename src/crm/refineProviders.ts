import axios, { AxiosHeaders, type AxiosInstance } from 'axios';
import type {
  AccessControlProvider,
  AuthProvider,
  BaseRecord,
  CreateParams,
  CrudFilter,
  CrudSort,
  CustomParams,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  GetOneParams,
  HttpError,
  ResourceProps,
  RouterProvider,
  UpdateParams,
} from '@refinedev/core';
import simpleRestProvider from '@refinedev/simple-rest';
import type { CrmSessionUser, StaffRole } from '../types.ts';
import { tr } from '../lib/i18n.ts';

export type CrmTabId =
  | 'pipeline'
  | 'table'
  | 'clients'
  | 'tasks'
  | 'staff'
  | 'catalog'
  | 'projects'
  | 'rates'
  | 'analytics'
  | 'social'
  | 'deploy';

export type CrmMenuGroupId = 'sales' | 'storefront' | 'team' | 'system';

export interface CrmResourceMeta {
  tabId?: CrmTabId;
  group?: CrmMenuGroupId;
  labelUk?: string;
  labelRu?: string;
  adminOnly?: boolean;
  hide?: boolean;
  apiResource?: string;
  readUrl?: string;
  envelopeListKey?: string;
  envelopeSingleKey?: string;
}

export const VALID_CRM_TABS = new Set<CrmTabId>([
  'pipeline',
  'table',
  'clients',
  'tasks',
  'staff',
  'catalog',
  'projects',
  'rates',
  'analytics',
  'social',
  'deploy',
]);

export function parseCrmTabFromLocation(): CrmTabId {
  if (typeof window === 'undefined') return 'pipeline';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as CrmTabId | null;
  return tab && VALID_CRM_TABS.has(tab) ? tab : 'pipeline';
}

export const CRM_RESOURCES: ResourceProps[] = [
  {
    name: 'deals',
    list: '/crm?tab=pipeline',
    meta: {
      tabId: 'pipeline',
      group: 'sales',
      labelUk: 'Воронка угод',
      labelRu: 'Воронка сделок',
      apiResource: 'deals',
      envelopeListKey: 'deals',
      envelopeSingleKey: 'deal',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'orders-table',
    list: '/crm?tab=table',
    meta: {
      tabId: 'table',
      group: 'sales',
      labelUk: 'Таблиця замовлень',
      labelRu: 'Таблица заказов',
      apiResource: 'deals',
      envelopeListKey: 'deals',
      envelopeSingleKey: 'deal',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'customers',
    list: '/crm?tab=clients',
    meta: {
      tabId: 'clients',
      group: 'sales',
      labelUk: 'Клієнти та контакти',
      labelRu: 'Клиенты и контакты',
      apiResource: 'customers',
      envelopeListKey: 'customers',
      envelopeSingleKey: 'customer',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'contacts',
    meta: {
      hide: true,
      apiResource: 'contacts',
      envelopeListKey: 'contacts',
      envelopeSingleKey: 'contact',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'tasks',
    list: '/crm?tab=tasks',
    meta: {
      tabId: 'tasks',
      group: 'sales',
      labelUk: 'Задачі',
      labelRu: 'Задачи',
      apiResource: 'tasks',
      envelopeListKey: 'tasks',
      envelopeSingleKey: 'task',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'notes',
    meta: {
      hide: true,
      apiResource: 'notes',
      envelopeListKey: 'notes',
      envelopeSingleKey: 'note',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'products',
    list: '/crm?tab=catalog',
    meta: {
      tabId: 'catalog',
      group: 'storefront',
      labelUk: 'Каталог обладнання',
      labelRu: 'Каталог оборудования',
      apiResource: 'products',
      readUrl: '/api/catalog',
      envelopeListKey: 'products',
      envelopeSingleKey: 'product',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'projects',
    list: '/crm?tab=projects',
    meta: {
      tabId: 'projects',
      group: 'storefront',
      labelUk: 'Реальні об’єкти',
      labelRu: 'Реальные объекты',
      apiResource: 'projects',
      readUrl: '/api/projects',
      envelopeListKey: 'projects',
      envelopeSingleKey: 'project',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'rates',
    list: '/crm?tab=rates',
    meta: {
      tabId: 'rates',
      group: 'storefront',
      labelUk: 'Курс валют (USD/UAH)',
      labelRu: 'Курс валют (USD/UAH)',
      apiResource: 'exchange-rate',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'social',
    list: '/crm?tab=social',
    meta: {
      tabId: 'social',
      group: 'storefront',
      labelUk: 'Соцмережі та Telegram',
      labelRu: 'Соцсети и Telegram',
      apiResource: 'social',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'staff',
    list: '/crm?tab=staff',
    meta: {
      tabId: 'staff',
      group: 'team',
      labelUk: 'Користувачі та доступ',
      labelRu: 'Пользователи и доступ',
      apiResource: 'staff',
      envelopeListKey: 'staff',
      envelopeSingleKey: 'member',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'analytics',
    list: '/crm?tab=analytics',
    meta: {
      tabId: 'analytics',
      group: 'system',
      labelUk: 'Аналітика',
      labelRu: 'Аналитика',
      adminOnly: true,
      apiResource: 'analytics',
    } satisfies CrmResourceMeta,
  },
  {
    name: 'data-management',
    list: '/crm?tab=deploy',
    meta: {
      tabId: 'deploy',
      group: 'system',
      labelUk: 'Управління даними',
      labelRu: 'Управление данными',
      adminOnly: true,
      apiResource: 'data/db/overview',
    } satisfies CrmResourceMeta,
  },
];

const RESOURCE_META_MAP = new Map<string, CrmResourceMeta>(
  CRM_RESOURCES.map((r) => [r.name, (r.meta ?? {}) as CrmResourceMeta]),
);

export function getResourceMeta(resource: string): CrmResourceMeta {
  return RESOURCE_META_MAP.get(resource) ?? {};
}

export function createCrmAxios(
  getToken: () => string,
  onUnauthorized: () => void,
): AxiosInstance {
  const instance = axios.create({
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    const headers = AxiosHeaders.from(config.headers);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    config.headers = headers;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status as number | undefined;
      if (status === 401) {
        onUnauthorized();
      }
      const serverMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Помилка запиту до CRM API';
      const customError: HttpError = {
        message: String(serverMsg),
        statusCode: status ?? 500,
      };
      return Promise.reject(customError);
    },
  );

  return instance;
}

function unwrapListPayload<T extends BaseRecord>(payload: unknown, envelopeKey?: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (envelopeKey && Array.isArray(obj[envelopeKey])) {
      return obj[envelopeKey] as T[];
    }
    for (const candidate of ['data', 'items', 'deals', 'customers', 'contacts', 'tasks', 'staff', 'notes', 'products', 'projects']) {
      if (Array.isArray(obj[candidate])) {
        return obj[candidate] as T[];
      }
    }
  }
  return [];
}

function unwrapSinglePayload<T extends BaseRecord>(payload: unknown, envelopeKey?: string): T {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (envelopeKey && obj[envelopeKey] && typeof obj[envelopeKey] === 'object') {
      return obj[envelopeKey] as T;
    }
    for (const candidate of ['data', 'deal', 'customer', 'contact', 'task', 'member', 'note', 'product', 'project']) {
      if (obj[candidate] && typeof obj[candidate] === 'object') {
        return obj[candidate] as T;
      }
    }
    return obj as T;
  }
  return {} as T;
}

function applyClientFilters<T extends Record<string, unknown>>(rows: T[], filters?: CrudFilter[]): T[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => {
    for (const filter of filters) {
      if (!('field' in filter)) continue;
      const { field, operator, value } = filter;
      if (value === undefined || value === null || value === '') continue;
      if (field === 'q') {
        const needle = String(value).toLowerCase();
        const hit = Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(needle));
        if (!hit) return false;
        continue;
      }
      const cell = row[field];
      if (operator === 'eq' && cell !== value) return false;
      if (operator === 'ne' && cell === value) return false;
      if (operator === 'contains') {
        if (!String(cell ?? '').toLowerCase().includes(String(value).toLowerCase())) return false;
      }
    }
    return true;
  });
}

function applyClientSorters<T extends Record<string, unknown>>(rows: T[], sorters?: CrudSort[]): T[] {
  if (!sorters || sorters.length === 0) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    for (const s of sorters) {
      const av = a[s.field];
      const bv = b[s.field];
      if (av === bv) continue;
      const dir = s.order === 'desc' ? -1 : 1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'uk') * dir;
    }
    return 0;
  });
  return copy;
}

export function createEnergoRefineDataProvider(
  getToken: () => string,
  onUnauthorized: () => void,
): DataProvider {
  const crmAxios = createCrmAxios(getToken, onUnauthorized);
  const baseProvider = simpleRestProvider('/api/crm', crmAxios);

  const resolveApiResource = (resource: string) => getResourceMeta(resource).apiResource || resource;

  return {
    getApiUrl: () => baseProvider.getApiUrl(),

    getList: async <TData extends BaseRecord = BaseRecord>(params: GetListParams) => {
      const meta = getResourceMeta(params.resource);
      const apiRes = resolveApiResource(params.resource);
      let rawItems: TData[];

      if (meta.readUrl) {
        const resp = await crmAxios.get(meta.readUrl);
        rawItems = unwrapListPayload<TData>(resp.data, meta.envelopeListKey);
      } else {
        const resp = await crmAxios.get(`/api/crm/${apiRes}`);
        rawItems = unwrapListPayload<TData>(resp.data, meta.envelopeListKey);
      }

      const filtered = applyClientFilters(rawItems, params.filters);
      const sorted = applyClientSorters(filtered, params.sorters);
      const mode = params.pagination?.mode ?? 'off';
      const currentPage = params.pagination?.currentPage ?? 1;
      const pageSize = params.pagination?.pageSize ?? 50;

      const data =
        mode === 'off'
          ? sorted
          : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      return {
        data,
        total: sorted.length,
      };
    },

    getOne: async <TData extends BaseRecord = BaseRecord>(params: GetOneParams) => {
      const meta = getResourceMeta(params.resource);
      const apiRes = resolveApiResource(params.resource);
      const safeId = typeof params.id === 'string' ? encodeURIComponent(params.id) : params.id;
      const res = await baseProvider.getOne({
        ...params,
        id: safeId,
        resource: apiRes,
      });
      return {
        data: unwrapSinglePayload<TData>(res.data, meta.envelopeSingleKey),
      };
    },

    create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
      params: CreateParams<TVariables>,
    ) => {
      const meta = getResourceMeta(params.resource);
      const apiRes = resolveApiResource(params.resource);
      const res = await baseProvider.create<TData, TVariables>({
        ...params,
        resource: apiRes,
      });
      return {
        data: unwrapSinglePayload<TData>(res.data, meta.envelopeSingleKey),
      };
    },

    update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
      params: UpdateParams<TVariables>,
    ) => {
      const meta = getResourceMeta(params.resource);
      const apiRes = resolveApiResource(params.resource);
      const safeId = typeof params.id === 'string' ? encodeURIComponent(params.id) : params.id;
      const res = await baseProvider.update<TData, TVariables>({
        ...params,
        id: safeId,
        resource: apiRes,
      });
      return {
        data: unwrapSinglePayload<TData>(res.data, meta.envelopeSingleKey),
      };
    },

    deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
      params: DeleteOneParams<TVariables>,
    ) => {
      const meta = getResourceMeta(params.resource);
      const apiRes = resolveApiResource(params.resource);
      const safeId = typeof params.id === 'string' ? encodeURIComponent(params.id) : params.id;
      const res = await baseProvider.deleteOne<TData, TVariables>({
        ...params,
        id: safeId,
        resource: apiRes,
      });
      return {
        data: unwrapSinglePayload<TData>(res.data, meta.envelopeSingleKey),
      };
    },

    custom: async <TData extends BaseRecord = BaseRecord, TQuery = unknown, TPayload = unknown>(
      params: CustomParams<TQuery, TPayload>,
    ) => {
      return baseProvider.custom<TData, TQuery, TPayload>(params);
    },
  };
}

export function createEnergoAuthProvider(opts: {
  getToken: () => string;
  onLogout: () => void;
  onIdentityLoaded?: (user: CrmSessionUser) => void;
}): AuthProvider {
  const fetchMe = async (): Promise<CrmSessionUser | null> => {
    const token = opts.getToken();
    if (!token) return null;
    const resp = await fetch('/api/crm/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { user?: CrmSessionUser };
    if (data.user && opts.onIdentityLoaded) {
      opts.onIdentityLoaded(data.user);
    }
    return data.user ?? null;
  };

  return {
    login: async () => ({ success: true }),
    logout: async () => {
      opts.onLogout();
      return { success: true, redirectTo: '/login' };
    },
    check: async () => {
      const user = await fetchMe();
      if (!user) {
        return { authenticated: false, logout: true, redirectTo: '/login' };
      }
      return { authenticated: true };
    },
    getIdentity: async () => fetchMe(),
    getPermissions: async () => {
      const user = await fetchMe();
      return user?.role ?? null;
    },
    onError: async (error) => {
      const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
      if (statusCode === 401) {
        opts.onLogout();
        return { logout: true, error };
      }
      return { error };
    },
  };
}

export function canRoleAccessResource(
  role: StaffRole | null | undefined,
  resource: string | undefined,
  action: string,
): boolean {
  if (!role) return false;
  if (role === 'admin') return true;

  if (resource === 'analytics' || resource === 'data-management' || resource === 'deploy') {
    return false;
  }
  if (resource === 'staff' && (action === 'create' || action === 'delete')) {
    return false;
  }
  if (resource === 'customers' && (action === 'create' || action === 'edit' || action === 'delete')) {
    return false;
  }
  if (resource === 'deals' || resource === 'orders-table' || resource === 'contacts') {
    if (action === 'delete') return role === 'manager';
    if (action === 'create' || action === 'edit') return role === 'manager' || role === 'engineer';
  }
  if (resource === 'products' || resource === 'projects' || resource === 'rates' || resource === 'social') {
    if (action === 'create' || action === 'edit' || action === 'delete') return role === 'manager';
  }
  if (resource === 'tasks' || resource === 'notes') {
    if (action === 'delete') return role === 'manager';
  }
  return true;
}

export function createEnergoAccessControlProvider(
  getRole: () => StaffRole | null | undefined,
): AccessControlProvider {
  return {
    can: async ({ resource, action }) => {
      const allowed = canRoleAccessResource(getRole(), resource, action);
      return allowed
        ? { can: true }
        : {
            can: false,
            reason: tr(
              'Недостатньо прав для цієї дії (потрібна роль адміністратора або менеджера)',
              'Недостаточно прав для этого действия',
            ),
          };
    },
    options: {
      buttons: {
        enableAccessControl: true,
        hideIfUnauthorized: true,
      },
    },
  };
}

export function createEnergoCrmRouterProvider(
  activeTabRef: { current: CrmTabId },
  onTabChange: (tab: CrmTabId) => void,
): RouterProvider {
  return {
    go: () => {
      return ({ to, query, type }) => {
        const queryTab = typeof query?.tab === 'string' ? (query.tab as CrmTabId) : null;
        let resolvedTab: CrmTabId | null = queryTab && VALID_CRM_TABS.has(queryTab) ? queryTab : null;

        if (!resolvedTab && typeof to === 'string') {
          const match = to.match(/[?&]tab=([a-z-]+)/i);
          if (match && VALID_CRM_TABS.has(match[1] as CrmTabId)) {
            resolvedTab = match[1] as CrmTabId;
          } else {
            const byResource = CRM_RESOURCES.find((r) => r.name === to || r.list === to);
            const metaTab = (byResource?.meta as CrmResourceMeta | undefined)?.tabId;
            if (metaTab) resolvedTab = metaTab;
          }
        }

        if (resolvedTab) {
          onTabChange(resolvedTab);
          if (typeof window !== 'undefined' && type !== 'path') {
            const nextUrl = `/crm?tab=${resolvedTab}`;
            if (type === 'replace') {
              window.history.replaceState({}, '', nextUrl);
            } else {
              window.history.pushState({}, '', nextUrl);
            }
          }
          return `/crm?tab=${resolvedTab}`;
        }
        return to || '/crm';
      };
    },
    back: () => {
      return () => {
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      };
    },
    parse: () => {
      return () => {
        const currentTab =
          typeof window !== 'undefined' ? parseCrmTabFromLocation() : activeTabRef.current;
        const matched = CRM_RESOURCES.find(
          (r) => (r.meta as CrmResourceMeta | undefined)?.tabId === currentTab,
        );
        return {
          resource: matched
            ? {
                name: matched.name,
                list: matched.list,
                meta: matched.meta,
              }
            : undefined,
          action: 'list',
          pathname: '/crm',
          params: { tab: currentTab },
        };
      };
    },
  };
}
