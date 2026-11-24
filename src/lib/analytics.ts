import type { AnalyticsConfig } from '../types.ts';

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

let activeConfig: AnalyticsConfig = {
  metaPixelId: '',
  ga4MeasurementId: '',
  gtmContainerId: '',
  analyticsEnabled: true,
};

let initializedMetaId = '';
let initializedGa4Id = '';
let initializedGtmId = '';

export function initAnalytics(config: AnalyticsConfig): void {
  activeConfig = config;
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
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'generate_lead'
  | 'contact';

const META_EVENT_MAP: Record<TrackableEventName, string> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  contact: 'Contact',
};

export function trackEvent(
  eventName: TrackableEventName,
  params: Record<string, string | number | unknown[]> = {},
): void {
  const metaEvent = META_EVENT_MAP[eventName];
  const ga4Event = eventName;

  if (activeConfig.analyticsEnabled) {
    if (window.gtag && initializedGa4Id) {
      window.gtag('event', ga4Event, params);
    }
    if (window.fbq && initializedMetaId) {
      const fbParams: Record<string, unknown> = {};
      if (typeof params.value === 'number') fbParams.value = params.value;
      if (typeof params.currency === 'string') fbParams.currency = params.currency;
      if (typeof params.item_name === 'string') fbParams.content_name = params.item_name;
      if (typeof params.item_category === 'string') fbParams.content_category = params.item_category;
      if (typeof params.item_id === 'string') fbParams.content_ids = [params.item_id];
      if (typeof params.transaction_id === 'string') fbParams.order_id = params.transaction_id;
      window.fbq('track', metaEvent, fbParams);
    }
  }

  // Record diagnostic event in backend SQLite for live inspection in Admin
  const logPayload: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' || typeof v === 'number') {
      logPayload[k] = v;
    }
  }

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
