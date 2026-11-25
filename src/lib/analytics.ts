import type { AnalyticsConfig, CartItem, Product } from '../types.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
  }
}

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
}

export interface AttributionContext {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  referrer?: string;
  landing_path?: string;
  captured_at?: string;
}

const ATTRIBUTION_STORAGE_KEY = 'ec_attribution_v1';

let activeConfig: AnalyticsConfig = {
  metaPixelId: '',
  ga4MeasurementId: '',
  gtmContainerId: '',
  analyticsEnabled: true,
};

let initializedMetaId = '';
let initializedGa4Id = '';
let initializedGtmId = '';

function createEventId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function captureAttribution(): AttributionContext {
  if (typeof window === 'undefined') return {};
  let stored: AttributionContext = {};
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as AttributionContext;
  } catch {
    stored = {};
  }

  const params = new URLSearchParams(window.location.search);
  const incoming: AttributionContext = {};
  const keys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
    'ttclid',
  ] as const;

  let hasNewCampaignParams = false;
  for (const key of keys) {
    const val = params.get(key)?.trim().slice(0, 120);
    if (val) {
      incoming[key] = val;
      hasNewCampaignParams = true;
    }
  }

  let externalReferrer = '';
  try {
    if (document.referrer) {
      const refUrl = new URL(document.referrer);
      if (refUrl.hostname && refUrl.hostname !== window.location.hostname) {
        externalReferrer = refUrl.hostname.slice(0, 120);
      }
    }
  } catch {
    externalReferrer = '';
  }

  const next: AttributionContext = {
    ...stored,
    ...(hasNewCampaignParams ? incoming : {}),
    referrer: stored.referrer || externalReferrer || undefined,
    landing_path: stored.landing_path || `${window.location.pathname}${window.location.search}`.slice(0, 200),
    captured_at: stored.captured_at || new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }

  return next;
}

export function getAttribution(): AttributionContext {
  return captureAttribution();
}

export function getAttributionSummary(): string {
  const attr = captureAttribution();
  const parts: string[] = [];
  if (attr.utm_source) parts.push(`utm_source=${attr.utm_source}`);
  if (attr.utm_medium) parts.push(`utm_medium=${attr.utm_medium}`);
  if (attr.utm_campaign) parts.push(`utm_campaign=${attr.utm_campaign}`);
  if (attr.utm_content) parts.push(`utm_content=${attr.utm_content}`);
  if (attr.utm_term) parts.push(`utm_term=${attr.utm_term}`);
  if (attr.gclid) parts.push(`gclid=${attr.gclid.slice(0, 32)}`);
  if (attr.fbclid) parts.push(`fbclid=${attr.fbclid.slice(0, 32)}`);
  if (attr.ttclid) parts.push(`ttclid=${attr.ttclid.slice(0, 32)}`);
  if (attr.referrer && !parts.length) parts.push(`ref=${attr.referrer}`);
  if (attr.landing_path) parts.push(`entry=${attr.landing_path}`);
  return parts.join(' | ').slice(0, 380);
}

export function resolveAnalyticsMoney(
  usdAmount: number,
  usdUahRate: number | null,
): { value: number; currency: 'UAH' | 'USD' } {
  const safeUsd = Number.isFinite(usdAmount) ? Math.max(0, usdAmount) : 0;
  if (usdUahRate && Number.isFinite(usdUahRate) && usdUahRate > 0) {
    return {
      value: Math.round(safeUsd * usdUahRate),
      currency: 'UAH',
    };
  }
  return {
    value: Math.round(safeUsd * 100) / 100,
    currency: 'USD',
  };
}

export function toAnalyticsProductItem(
  product: Pick<Product, 'id' | 'sku' | 'title' | 'brand' | 'cat' | 'price'>,
  usdUahRate: number | null,
  quantity = 1,
): AnalyticsItem {
  const money = resolveAnalyticsMoney(product.price, usdUahRate);
  return {
    item_id: product.sku || product.id,
    item_name: product.title,
    item_brand: product.brand || 'Energo Comfort',
    item_category: product.cat,
    price: money.value,
    quantity,
  };
}

export function toAnalyticsCartItem(
  item: Pick<CartItem, 'id' | 'sku' | 'title' | 'price' | 'qty'>,
  usdUahRate: number | null,
): AnalyticsItem {
  const money = resolveAnalyticsMoney(item.price, usdUahRate);
  return {
    item_id: item.sku || item.id,
    item_name: item.title,
    item_brand: 'Energo Comfort',
    price: money.value,
    quantity: item.qty,
  };
}

export function initAnalytics(config: AnalyticsConfig): void {
  activeConfig = config;
  captureAttribution();
  if (!config.analyticsEnabled) return;

  // 1. Google Analytics 4 (gtag.js)
  if (/^G-[A-Z0-9]{4,20}$/i.test(config.ga4MeasurementId) && initializedGa4Id !== config.ga4MeasurementId) {
    initializedGa4Id = config.ga4MeasurementId;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
    }
    window.gtag('js', new Date());
    window.gtag('config', config.ga4MeasurementId, { send_page_view: false });

    if (!document.querySelector(`script[data-ec-ga4="${config.ga4MeasurementId}"]`)) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4MeasurementId)}`;
      s.dataset.ecGa4 = config.ga4MeasurementId;
      document.head.appendChild(s);
    }
  }

  // 2. Google Tag Manager (optional)
  if (/^GTM-[A-Z0-9]{4,20}$/i.test(config.gtmContainerId) && initializedGtmId !== config.gtmContainerId) {
    initializedGtmId = config.gtmContainerId;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    if (!document.querySelector(`script[data-ec-gtm="${config.gtmContainerId}"]`)) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmContainerId)}`;
      s.dataset.ecGtm = config.gtmContainerId;
      document.head.appendChild(s);
    }
  }

  // 3. Meta (Facebook) Pixel
  if (/^\d{8,20}$/.test(config.metaPixelId) && initializedMetaId !== config.metaPixelId) {
    initializedMetaId = config.metaPixelId;
    if (!window.fbq) {
      const fbqFn = function fbq(this: unknown, ...args: unknown[]) {
        if (fbqFn.callMethod) {
          fbqFn.callMethod.apply(this, args);
        } else {
          fbqFn.queue!.push(args);
        }
      } as NonNullable<Window['fbq']>;
      fbqFn.push = fbqFn;
      fbqFn.loaded = true;
      fbqFn.version = '2.0';
      fbqFn.queue = [];
      window.fbq = fbqFn;
      window._fbq = fbqFn;
    }

    if (!document.querySelector('script[data-ec-meta-pixel="true"]')) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      s.dataset.ecMetaPixel = 'true';
      document.head.appendChild(s);
    }

    window.fbq('init', config.metaPixelId);
  }
}

export type TrackableEventName =
  | 'page_view'
  | 'view_item_list'
  | 'search'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'generate_lead'
  | 'contact'
  | 'calculator_used'
  | 'scroll_depth';

export type Placement = 'hero' | 'sticky' | 'section' | 'footer';
export type Property = 'apartment' | 'house' | 'business';
export type Goal = 'backup' | 'solar' | 'hybrid';
export type Scenario = 'backup' | 'solar' | 'hybrid' | 'unspecified';
export interface LeadPayload {
  readonly name: string;
  readonly phone: string;
  readonly property: Property;
  readonly goal?: Goal;
  readonly consent: true;
}
type ConversionContext = { readonly placement: Placement; readonly scenario: Scenario };
export type AnalyticsEvent =
  | ({ readonly name: 'cta_click' } & ConversionContext)
  | ({ readonly name: 'form_start' } & ConversionContext)
  | ({ readonly name: 'form_error'; readonly field: 'name' | 'phone' | 'property' } & ConversionContext)
  | ({ readonly name: 'lead_submit'; readonly property: Property } & ConversionContext)
  | ({ readonly name: 'messenger_click'; readonly channel: 'telegram' | 'viber' } & ConversionContext)
  | ({ readonly name: 'phone_click' } & ConversionContext);

function getDeviceType(): 'mobile' | 'desktop' {
  return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
}

function sendDiagnosticLog(
  eventName: string,
  metaEvent: string,
  ga4Event: string,
  params: Record<string, unknown>,
): void {
  const logPayload: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' || typeof v === 'number') {
      logPayload[k] = v;
    }
  }
  const attr = getAttribution();
  if (attr.utm_source && !logPayload.utm_source) logPayload.utm_source = attr.utm_source;
  if (attr.utm_campaign && !logPayload.utm_campaign) logPayload.utm_campaign = attr.utm_campaign;

  void fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      metaEvent,
      ga4Event,
      payload: logPayload,
    }),
  }).catch(() => {
    // non-blocking telemetry
  });
}

export function track(event: AnalyticsEvent): void {
  const { name, ...params } = event;
  const attr = getAttribution();
  const payload = {
    ...params,
    device: getDeviceType(),
    ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
    ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
  };

  let metaEvent: string = name;
  if (activeConfig.analyticsEnabled) {
    if (window.gtag && initializedGa4Id) {
      window.gtag('event', name, payload);
    }
    if (window.fbq && initializedMetaId) {
      if (name === 'phone_click' || name === 'messenger_click') {
        metaEvent = 'Contact';
        window.fbq(
          'track',
          'Contact',
          {
            content_name: name === 'phone_click' ? 'phone_call' : (params as { channel?: string }).channel || 'messenger',
            content_category: event.placement,
          },
          { eventID: createEventId('contact') },
        );
      } else if (name === 'cta_click') {
        metaEvent = 'CTAClick';
        window.fbq('trackCustom', 'CTAClick', payload);
      } else if (name === 'form_start') {
        metaEvent = 'FormStart';
        window.fbq('trackCustom', 'FormStart', payload);
      } else if (name === 'lead_submit') {
        metaEvent = 'Lead';
      }
    }
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...payload });
  sendDiagnosticLog(name, metaEvent, name, payload);
}

const META_EVENT_MAP: Record<TrackableEventName, { method: 'track' | 'trackCustom'; name: string } | null> = {
  page_view: { method: 'track', name: 'PageView' },
  view_item_list: { method: 'trackCustom', name: 'ViewCategory' },
  search: { method: 'track', name: 'Search' },
  view_item: { method: 'track', name: 'ViewContent' },
  add_to_cart: { method: 'track', name: 'AddToCart' },
  remove_from_cart: null,
  begin_checkout: { method: 'track', name: 'InitiateCheckout' },
  purchase: { method: 'track', name: 'Purchase' },
  generate_lead: { method: 'track', name: 'Lead' },
  contact: { method: 'track', name: 'Contact' },
  calculator_used: { method: 'track', name: 'CustomizeProduct' },
  scroll_depth: null,
};

const ECOMMERCE_EVENTS = new Set<TrackableEventName>([
  'view_item_list',
  'view_item',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
]);

export function trackEvent(
  eventName: TrackableEventName,
  params: Record<string, string | number | boolean | AnalyticsItem[] | unknown[]> = {},
): void {
  const metaSpec = META_EVENT_MAP[eventName];
  const metaEventName = metaSpec?.name ?? '-';
  const ga4Event = eventName;
  const attr = getAttribution();
  const eventId = createEventId(eventName);

  const enrichedParams: Record<string, unknown> = {
    ...params,
    ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
    ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
    ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
  };

  if (activeConfig.analyticsEnabled) {
    if (window.gtag && initializedGa4Id) {
      window.gtag('event', ga4Event, enrichedParams);
    }

    if (window.fbq && initializedMetaId && metaSpec) {
      const fbParams: Record<string, unknown> = {};
      if (typeof params.value === 'number') fbParams.value = params.value;
      if (typeof params.currency === 'string') fbParams.currency = params.currency;
      if (typeof params.item_name === 'string') fbParams.content_name = params.item_name;
      if (typeof params.lead_topic === 'string') fbParams.content_name = params.lead_topic;
      if (typeof params.item_list_name === 'string') fbParams.content_name = params.item_list_name;
      if (typeof params.item_category === 'string') fbParams.content_category = params.item_category;
      if (typeof params.search_term === 'string') fbParams.search_string = params.search_term;
      if (typeof params.transaction_id === 'string') fbParams.order_id = params.transaction_id;

      const items = Array.isArray(params.items) ? (params.items as AnalyticsItem[]) : [];
      if (items.length > 0) {
        fbParams.content_type = 'product';
        fbParams.content_ids = items.map((it) => it.item_id).filter(Boolean);
        fbParams.contents = items.map((it) => ({
          id: it.item_id,
          quantity: it.quantity ?? 1,
          ...(typeof it.price === 'number' ? { item_price: it.price } : {}),
        }));
        fbParams.num_items = items.reduce((sum, it) => sum + (it.quantity ?? 1), 0);
        if (!fbParams.content_name && items.length === 1) {
          fbParams.content_name = items[0].item_name;
        }
        if (!fbParams.content_category && items[0]?.item_category) {
          fbParams.content_category = items[0].item_category;
        }
      } else if (typeof params.item_id === 'string') {
        fbParams.content_type = 'product';
        fbParams.content_ids = [params.item_id];
      } else if (typeof params.items_count === 'number') {
        fbParams.num_items = params.items_count;
      }

      if (metaSpec.method === 'track') {
        window.fbq('track', metaSpec.name, fbParams, { eventID: eventId });
      } else {
        window.fbq('trackCustom', metaSpec.name, fbParams);
      }
    }
  }

  window.dataLayer = window.dataLayer || [];
  if (ECOMMERCE_EVENTS.has(eventName)) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: ga4Event,
      ecommerce: {
        currency: params.currency,
        value: params.value,
        transaction_id: params.transaction_id,
        item_list_id: params.item_list_id,
        item_list_name: params.item_list_name,
        items: params.items,
      },
      event_id: eventId,
    });
  } else {
    window.dataLayer.push({
      event: ga4Event,
      ...enrichedParams,
      event_id: eventId,
    });
  }

  sendDiagnosticLog(eventName, metaEventName, ga4Event, {
    ...params,
    event_id: eventId,
  });
}
