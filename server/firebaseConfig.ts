import type { FirebaseDomainRule, FirebaseRuntimeWebConfig } from '../src/types.ts';

const SAFE_HOST_PATTERN_REGEX = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

export function normalizeHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (candidate.includes('://')) {
    try {
      candidate = new URL(candidate).hostname.toLowerCase();
    } catch {
      return '';
    }
  } else {
    candidate = candidate.split('/')[0].split(',')[0].trim();
    candidate = candidate.replace(/:\d+$/, '');
  }
  if (!candidate || candidate.length > 253 || !SAFE_HOST_PATTERN_REGEX.test(candidate)) {
    return '';
  }
  return candidate;
}

export function hostMatchesPattern(rawHost: string, rawPattern: string): boolean {
  const host = normalizeHost(rawHost);
  const pattern = normalizeHost(rawPattern);
  if (!host || !pattern) return false;

  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.slice(2);
    if (!baseDomain || host === baseDomain) return false;
    return host.endsWith(`.${baseDomain}`);
  }

  return host === pattern;
}

export function parseDomainRulesFromString(raw: string): FirebaseDomainRule[] {
  const out: FirebaseDomainRule[] = [];
  const seen = new Set<string>();

  for (const chunk of raw.split(/[\s,;]+/)) {
    const entry = chunk.trim();
    if (!entry) continue;
    const eqIdx = entry.indexOf('=');
    const rawHost = eqIdx >= 0 ? entry.slice(0, eqIdx) : entry;
    const rawAuthDomain = eqIdx >= 0 ? entry.slice(eqIdx + 1) : '';
    const hostPattern = normalizeHost(rawHost);
    if (!hostPattern || seen.has(hostPattern)) continue;
    seen.add(hostPattern);

    const authDomain = rawAuthDomain ? normalizeHost(rawAuthDomain) : '';
    out.push({
      hostPattern,
      ...(authDomain && !authDomain.startsWith('*.') ? { authDomain } : {}),
    });
  }

  return out;
}

export function sanitizeDomainRules(rules: FirebaseDomainRule[]): FirebaseDomainRule[] {
  const deduped = new Map<string, FirebaseDomainRule>();

  for (const rule of rules) {
    const hostPattern = normalizeHost(rule.hostPattern || '');
    if (!hostPattern) continue;

    const cleanAuthDomain = rule.authDomain ? normalizeHost(rule.authDomain) : '';
    const cleanProjectId = (rule.projectId ?? '').trim();
    const cleanApiKey = (rule.apiKey ?? '').trim();
    const cleanAppId = (rule.appId ?? '').trim();

    deduped.set(hostPattern, {
      hostPattern,
      ...(cleanAuthDomain && !cleanAuthDomain.startsWith('*.') ? { authDomain: cleanAuthDomain } : {}),
      ...(cleanProjectId && cleanProjectId !== 'remixed-project-id' ? { projectId: cleanProjectId } : {}),
      ...(cleanApiKey ? { apiKey: cleanApiKey } : {}),
      ...(cleanAppId ? { appId: cleanAppId } : {}),
    });
  }

  return Array.from(deduped.values());
}

export function resolveFirebaseWebConfigForHost(options: {
  requestHost: string;
  baseConfig: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    appId: string;
  };
  envRules?: FirebaseDomainRule[];
  dbRules?: FirebaseDomainRule[];
  appUrl?: string;
  useHostAsAuthDomain?: boolean;
}): FirebaseRuntimeWebConfig {
  const normalizedRawHost = normalizeHost(options.requestHost);
  const requestHost = normalizedRawHost && !normalizedRawHost.startsWith('*.') ? normalizedRawHost : '';
  const combinedRules = sanitizeDomainRules([...(options.envRules ?? []), ...(options.dbRules ?? [])]);

  let matched: FirebaseDomainRule | null = null;
  if (requestHost) {
    // Prefer exact domain match over wildcard subdomain match
    matched =
      combinedRules.find((r) => !r.hostPattern.startsWith('*.') && hostMatchesPattern(requestHost, r.hostPattern)) ??
      combinedRules.find((r) => r.hostPattern.startsWith('*.') && hostMatchesPattern(requestHost, r.hostPattern)) ??
      null;
  }

  const resolvedProjectId = matched?.projectId || options.baseConfig.projectId || '';
  const resolvedApiKey = matched?.apiKey || options.baseConfig.apiKey || '';
  const resolvedAppId = matched?.appId || options.baseConfig.appId || '';
  const matchedAuthLower = (matched?.authDomain ?? '').trim().toLowerCase();
  const baseAuthLower = options.baseConfig.authDomain.trim().toLowerCase();
  const isAutoAuthDomain =
    Boolean(options.useHostAsAuthDomain) || matchedAuthLower === 'auto' || (!matchedAuthLower && baseAuthLower === 'auto');

  let resolvedAuthDomain =
    matchedAuthLower && matchedAuthLower !== 'auto'
      ? matched!.authDomain!
      : baseAuthLower && baseAuthLower !== 'auto'
        ? options.baseConfig.authDomain
        : resolvedProjectId
          ? `${resolvedProjectId}.firebaseapp.com`
          : '';

  if (
    isAutoAuthDomain &&
    requestHost &&
    requestHost !== 'localhost' &&
    requestHost !== '127.0.0.1'
  ) {
    resolvedAuthDomain = requestHost;
  }

  const authorizedSet = new Set<string>(['localhost', '127.0.0.1']);
  if (baseAuthLower && baseAuthLower !== 'auto') {
    const cleanBaseAuth = normalizeHost(options.baseConfig.authDomain);
    if (cleanBaseAuth) authorizedSet.add(cleanBaseAuth);
  }
  if (options.appUrl) {
    const appHost = normalizeHost(options.appUrl);
    if (appHost) authorizedSet.add(appHost);
  }
  for (const r of combinedRules) {
    authorizedSet.add(r.hostPattern);
    if (r.authDomain && r.authDomain.toLowerCase() !== 'auto') {
      authorizedSet.add(r.authDomain);
    }
  }

  return {
    projectId: resolvedProjectId,
    apiKey: resolvedApiKey,
    authDomain: resolvedAuthDomain,
    appId: resolvedAppId,
    requestHost,
    matchedRule: matched?.hostPattern ?? null,
    authorizedHosts: Array.from(authorizedSet),
  };
}
