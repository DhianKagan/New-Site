import { getSetting, setSetting } from './db.ts';

const COMMERCIAL_RATE_KEY = 'commercial_usd_uah_rate';
const COMMERCIAL_UPDATED_AT_KEY = 'commercial_usd_uah_updated_at';
const COMMERCIAL_UPDATED_BY_KEY = 'commercial_usd_uah_updated_by';

const MARKET_CACHE_TTL_MS = 10 * 60 * 1000;

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

let cachedMarketRate: { info: Market7kmRateInfo; fetchedAtMs: number } | null = null;

function parseValidRate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const num = Number(String(raw).replace(',', '.').trim());
  if (!Number.isFinite(num) || num < 10 || num > 500) return null;
  return Math.round(num * 100) / 100;
}

export function getStoredCommercialRate(): CommercialRateInfo {
  const rate = parseValidRate(getSetting(COMMERCIAL_RATE_KEY));
  const updatedAt = (getSetting(COMMERCIAL_UPDATED_AT_KEY) ?? '').trim();
  const updatedBy = (getSetting(COMMERCIAL_UPDATED_BY_KEY) ?? '').trim();
  return { rate, updatedAt, updatedBy };
}

export function saveCommercialRate(rate: number, updatedBy: string): CommercialRateInfo {
  const cleanRate = Math.round(Number(rate) * 100) / 100;
  const now = new Date().toISOString();
  const actor = updatedBy.trim() || 'CRM';
  setSetting(COMMERCIAL_RATE_KEY, cleanRate.toFixed(2));
  setSetting(COMMERCIAL_UPDATED_AT_KEY, now);
  setSetting(COMMERCIAL_UPDATED_BY_KEY, actor);
  return {
    rate: cleanRate,
    updatedAt: now,
    updatedBy: actor,
  };
}

async function fetchOdessaWholesaleRate(): Promise<{ buy: number; sell: number } | null> {
  const resp = await fetch('https://obmenka.od.ua/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnergoComfortCRM/1.0)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) throw new Error(`obmenka.od.ua responded ${resp.status}`);
  const html = await resp.text();
  const match = html.match(
    /Курс USD\/UAH<\/td>\s*<td>(?:<a[^>]*>)?(\d{2}[.,]\d{2})(?:<\/a>)?<\/td>\s*<td>(?:<a[^>]*>)?(\d{2}[.,]\d{2})/i,
  );
  if (!match) return null;
  const buy = parseValidRate(match[1]);
  const sell = parseValidRate(match[2]);
  if (!buy || !sell) return null;
  return { buy, sell };
}

async function fetchMinfinOdessaRate(): Promise<{ buy: number; sell: number } | null> {
  const resp = await fetch('https://minfin.com.ua/ua/currency/auction/usd/buy/odessa/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnergoComfortCRM/1.0)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) throw new Error(`minfin.com.ua responded ${resp.status}`);
  const html = await resp.text();
  const buyMatch = html.match(/Середня купівля[\s\S]{0,220}?>(\d{2}[.,]\d{2})/i);
  const sellMatch = html.match(/Середній продаж[\s\S]{0,220}?>(\d{2}[.,]\d{2})/i);
  const buy = parseValidRate(buyMatch?.[1]);
  const sell = parseValidRate(sellMatch?.[1]);
  if (!buy || !sell) return null;
  return { buy, sell };
}

export async function getMarket7kmRate(forceRefresh = false): Promise<Market7kmRateInfo> {
  const nowMs = Date.now();
  if (!forceRefresh && cachedMarketRate && nowMs - cachedMarketRate.fetchedAtMs < MARKET_CACHE_TTL_MS) {
    return cachedMarketRate.info;
  }

  const [wholesaleRes, minfinRes] = await Promise.allSettled([
    fetchOdessaWholesaleRate(),
    fetchMinfinOdessaRate(),
  ]);

  const wholesale = wholesaleRes.status === 'fulfilled' ? wholesaleRes.value : null;
  const minfin = minfinRes.status === 'fulfilled' ? minfinRes.value : null;

  const primaryBuy = wholesale?.buy ?? minfin?.buy ?? null;
  const primarySell = wholesale?.sell ?? minfin?.sell ?? null;

  if (primaryBuy && primarySell) {
    const sources: string[] = [];
    if (wholesale) sources.push('Одеса «7 км» / опт (obmenka.od.ua)');
    if (minfin) sources.push('Валютний аукціон Одеси (Minfin)');

    const info: Market7kmRateInfo = {
      available: true,
      buy: primaryBuy,
      sell: primarySell,
      wholesaleBuy: wholesale?.buy ?? null,
      wholesaleSell: wholesale?.sell ?? null,
      cityAverageBuy: minfin?.buy ?? null,
      cityAverageSell: minfin?.sell ?? null,
      sourceLabel: sources.join(' · '),
      fetchedAt: new Date().toISOString(),
    };
    cachedMarketRate = { info, fetchedAtMs: nowMs };
    return info;
  }

  if (cachedMarketRate) {
    return {
      ...cachedMarketRate.info,
      stale: true,
    };
  }

  return {
    available: false,
    buy: null,
    sell: null,
    wholesaleBuy: null,
    wholesaleSell: null,
    cityAverageBuy: null,
    cityAverageSell: null,
    sourceLabel: 'Одеса «7 км»',
    fetchedAt: new Date().toISOString(),
    error: 'Тимчасово не вдалося отримати котирування ринку Одеси («7 км»)',
  };
}

export async function getActiveStorefrontRate(): Promise<{
  rate: number;
  updatedAt: string;
  updatedBy: string;
  source: 'commercial' | 'market_fallback';
}> {
  const stored = getStoredCommercialRate();
  if (stored.rate !== null) {
    return {
      rate: stored.rate,
      updatedAt: stored.updatedAt,
      updatedBy: stored.updatedBy,
      source: 'commercial',
    };
  }

  const market = await getMarket7kmRate(false);
  if (market.available && market.sell) {
    return {
      rate: market.sell,
      updatedAt: market.fetchedAt,
      updatedBy: market.sourceLabel,
      source: 'market_fallback',
    };
  }

  throw new Error('Комерційний курс ще не встановлено в CRM');
}

export function getCachedActiveRateSync(): number | null {
  const stored = getStoredCommercialRate();
  if (stored.rate !== null) return stored.rate;
  if (cachedMarketRate?.info.available && cachedMarketRate.info.sell) {
    return cachedMarketRate.info.sell;
  }
  return null;
}
