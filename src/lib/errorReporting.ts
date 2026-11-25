import type { ClientErrorKind } from '../types.ts';

export interface ClientErrorReportPayload {
  errorId: string;
  kind: ClientErrorKind;
  name: string;
  message: string;
  stack: string;
  componentStack: string;
  route: string;
  locale: 'uk' | 'ru';
}

const DEDUP_WINDOW_MS = 15_000;
const recentReportTimestamps = new Map<string, number>();

export function sanitizeErrorText(raw: string, maxLength = 4000): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT_REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[API_KEY_REDACTED]')
    .replace(/([?&](?:token|idToken|access_token|secret|password|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, maxLength);
}

export function sanitizeRoutePathname(rawHrefOrPath: string): string {
  const trimmed = rawHrefOrPath.trim();
  if (!trimmed) return '/';
  try {
    if (trimmed.includes('://')) {
      return new URL(trimmed).pathname.slice(0, 300) || '/';
    }
  } catch {
    // fall through to path splitting
  }
  const clean = trimmed.split('?')[0].split('#')[0];
  return (clean.startsWith('/') ? clean : `/${clean}`).slice(0, 300) || '/';
}

export function generateClientErrorId(): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `ec-${hex}`;
  }
  return `ec-${Date.now().toString(36)}`;
}

export function createClientErrorPayload(input: {
  errorId?: string;
  kind: ClientErrorKind;
  error: unknown;
  componentStack?: string;
  route?: string;
  locale?: 'uk' | 'ru';
}): ClientErrorReportPayload {
  const errObj = input.error instanceof Error ? input.error : null;
  const rawName = errObj?.name || 'Error';
  const rawMessage =
    errObj?.message ||
    (typeof input.error === 'string' && input.error.trim() ? input.error : 'Unknown runtime error');
  const rawStack = errObj?.stack || '';

  const fallbackPath =
    typeof window !== 'undefined' ? window.location.pathname : '/';

  return {
    errorId: (input.errorId || generateClientErrorId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'ec-err',
    kind: input.kind,
    name: sanitizeErrorText(rawName, 120) || 'Error',
    message: sanitizeErrorText(rawMessage, 600) || 'Unknown runtime error',
    stack: sanitizeErrorText(rawStack, 4000),
    componentStack: sanitizeErrorText(input.componentStack || '', 4000),
    route: sanitizeRoutePathname(input.route || fallbackPath),
    locale: input.locale === 'ru' ? 'ru' : 'uk',
  };
}

export function shouldSkipDuplicateError(payload: Pick<ClientErrorReportPayload, 'kind' | 'name' | 'message' | 'route'>): boolean {
  const now = Date.now();
  if (recentReportTimestamps.size > 100) {
    for (const [k, ts] of recentReportTimestamps.entries()) {
      if (now - ts > DEDUP_WINDOW_MS) {
        recentReportTimestamps.delete(k);
      }
    }
  }
  const signature = `${payload.kind}:${payload.route}:${payload.name}:${payload.message.slice(0, 120)}`;
  const lastSeen = recentReportTimestamps.get(signature);
  if (lastSeen !== undefined && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }
  recentReportTimestamps.set(signature, now);
  return false;
}

export function clearErrorReportingDedupCache(): void {
  recentReportTimestamps.clear();
}

export function reportClientError(input: {
  errorId?: string;
  kind: ClientErrorKind;
  error: unknown;
  componentStack?: string;
  route?: string;
  locale?: 'uk' | 'ru';
}): ClientErrorReportPayload {
  const payload = createClientErrorPayload(input);

  // Always log scrubbed diagnostic metadata to console for immediate debugging
  console.error(`[EnergoComfort:${payload.kind}] (${payload.errorId}) ${payload.name}: ${payload.message}`, {
    route: payload.route,
    stack: payload.stack || undefined,
    componentStack: payload.componentStack || undefined,
  });

  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return payload;
  }

  if (shouldSkipDuplicateError(payload)) {
    return payload;
  }

  try {
    void fetch('/api/telemetry/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Never throw from error reporter
    });
  } catch {
    // Never throw from error reporter
  }

  return payload;
}
