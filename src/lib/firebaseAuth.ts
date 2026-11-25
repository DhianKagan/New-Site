import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { FirebaseRuntimeWebConfig } from '../types.ts';

interface ClientFirebaseFileConfig {
  projectId?: string;
  apiKey?: string;
  authDomain?: string;
  appId?: string;
  authDomains?: Record<string, string>;
}

const runtimeConfigCache = new Map<string, Promise<FirebaseRuntimeWebConfig>>();
const resolvedConfigSnapshots = new Map<string, FirebaseRuntimeWebConfig>();
let lastResolvedConfig: FirebaseRuntimeWebConfig | null = null;
let cachedDefaultApp: FirebaseApp | null = null;

function getCurrentBrowserHost(): string {
  return typeof window !== 'undefined' ? window.location.hostname.trim().toLowerCase() : '';
}

function resolveEffectiveAuthDomain(rawAuthDomain: string, host: string, projectId: string): string {
  const candidate = rawAuthDomain.trim().toLowerCase();
  if (candidate === 'auto') {
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
    return projectId ? `${projectId}.firebaseapp.com` : '';
  }
  if (candidate) return candidate;
  return projectId ? `${projectId}.firebaseapp.com` : '';
}

function buildStaticFallbackConfig(host: string): FirebaseRuntimeWebConfig {
  const rawProjectId =
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (firebaseConfig?.projectId && firebaseConfig.projectId !== 'remixed-project-id' ? firebaseConfig.projectId : '');
  const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey || '';
  const rawAppId = import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig?.appId || '';
  const rawAuthDomain =
    import.meta.env.VITE_AUTH_DOMAIN ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    firebaseConfig?.authDomain ||
    '';

  return {
    projectId: rawProjectId,
    apiKey: rawApiKey,
    authDomain: resolveEffectiveAuthDomain(rawAuthDomain, host, rawProjectId),
    appId: rawAppId,
    requestHost: host,
    matchedRule: null,
    authorizedHosts: [],
  };
}

function matchHostPattern(host: string, pattern: string): boolean {
  const cleanHost = host.trim().toLowerCase();
  const cleanPattern = pattern.trim().toLowerCase();
  if (!cleanHost || !cleanPattern) return false;
  if (cleanPattern.startsWith('*.')) {
    const suffix = cleanPattern.slice(1);
    return cleanHost !== cleanPattern.slice(2) && cleanHost.endsWith(suffix);
  }
  return cleanHost === cleanPattern;
}

async function fetchEnvironmentStaticConfigFile(host: string): Promise<FirebaseRuntimeWebConfig | null> {
  const mode = (import.meta.env.MODE || 'production').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const candidateUrls = mode ? [`/firebase-config.${mode}.json`, '/firebase-config.json'] : ['/firebase-config.json'];

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;
      const parsed = (await resp.json()) as ClientFirebaseFileConfig;
      if (!parsed || typeof parsed !== 'object') continue;

      const fallback = buildStaticFallbackConfig(host);
      const projectId = (parsed.projectId || fallback.projectId).trim();
      const apiKey = (parsed.apiKey || fallback.apiKey).trim();
      const appId = (parsed.appId || fallback.appId).trim();
      if (!projectId || !apiKey) continue;

      let matchedPattern: string | null = null;
      let mappedAuthDomain = '';
      if (host && parsed.authDomains && typeof parsed.authDomains === 'object') {
        const entries = Object.entries(parsed.authDomains);
        const exact = entries.find(([p]) => !p.startsWith('*.') && matchHostPattern(host, p));
        const wildcard = entries.find(([p]) => p.startsWith('*.') && matchHostPattern(host, p));
        const hit = exact ?? wildcard;
        if (hit && typeof hit[1] === 'string') {
          matchedPattern = hit[0];
          mappedAuthDomain = hit[1];
        }
      }

      const rawAuth =
        mappedAuthDomain ||
        import.meta.env.VITE_AUTH_DOMAIN ||
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
        parsed.authDomain ||
        fallback.authDomain;

      return {
        projectId,
        apiKey,
        authDomain: resolveEffectiveAuthDomain(rawAuth, host, projectId),
        appId,
        requestHost: host,
        matchedRule: matchedPattern,
        authorizedHosts: [],
      };
    } catch {
      // Continue to next environment config file
    }
  }

  return null;
}

export function clearRuntimeFirebaseConfigCache(): void {
  runtimeConfigCache.clear();
  resolvedConfigSnapshots.clear();
  lastResolvedConfig = null;
}

export async function getRuntimeFirebaseConfig(forceRefresh = false): Promise<FirebaseRuntimeWebConfig> {
  const host = getCurrentBrowserHost();
  const cacheKey = host || 'default';

  if (forceRefresh) {
    runtimeConfigCache.delete(cacheKey);
    resolvedConfigSnapshots.delete(cacheKey);
  }

  const cached = runtimeConfigCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<FirebaseRuntimeWebConfig> => {
    const commitResolved = (cfg: FirebaseRuntimeWebConfig): FirebaseRuntimeWebConfig => {
      resolvedConfigSnapshots.set(cacheKey, cfg);
      lastResolvedConfig = cfg;
      return cfg;
    };

    try {
      const qs = host ? `?host=${encodeURIComponent(host)}` : '';
      const resp = await fetch(`/api/auth/firebase-config${qs}`, { cache: 'no-store' });
      if (resp.ok) {
        const data = (await resp.json()) as Partial<FirebaseRuntimeWebConfig>;
        if (data.projectId && data.apiKey) {
          return commitResolved({
            projectId: data.projectId,
            apiKey: data.apiKey,
            authDomain: resolveEffectiveAuthDomain(data.authDomain || '', host, data.projectId),
            appId: data.appId || buildStaticFallbackConfig(host).appId,
            requestHost: data.requestHost || host,
            matchedRule: data.matchedRule ?? null,
            authorizedHosts: Array.isArray(data.authorizedHosts) ? data.authorizedHosts : [],
          });
        }
      }
    } catch {
      // Fall back to environment-specific config file or Vite env defaults
    }

    const fileResolved = await fetchEnvironmentStaticConfigFile(host);
    if (fileResolved) {
      return commitResolved(fileResolved);
    }

    return commitResolved(buildStaticFallbackConfig(host));
  })();

  runtimeConfigCache.set(cacheKey, promise);
  return promise;
}

export function getPrimaryFirebaseApp(): FirebaseApp {
  if (cachedDefaultApp) return cachedDefaultApp;
  const existingDefault = getApps().find((app) => app.name === '[DEFAULT]');
  if (existingDefault) {
    cachedDefaultApp = existingDefault;
    return existingDefault;
  }
  cachedDefaultApp = initializeApp(firebaseConfig);
  return cachedDefaultApp;
}

function matchesDefaultAppletConfig(cfg: FirebaseRuntimeWebConfig): boolean {
  const defaultProject = (firebaseConfig?.projectId || '').trim();
  const defaultAuthDomain = (firebaseConfig?.authDomain || '').trim().toLowerCase();
  const defaultApiKey = (firebaseConfig?.apiKey || '').trim();
  return (
    Boolean(defaultProject) &&
    cfg.projectId === defaultProject &&
    cfg.apiKey === defaultApiKey &&
    (!cfg.authDomain || cfg.authDomain.toLowerCase() === defaultAuthDomain)
  );
}

function getOrCreateFirebaseApp(cfg: FirebaseRuntimeWebConfig): FirebaseApp | null {
  if (!cfg.apiKey || !cfg.projectId) {
    return null;
  }
  if (matchesDefaultAppletConfig(cfg)) {
    return getPrimaryFirebaseApp();
  }
  const appName = `ec-${cfg.projectId}-${cfg.authDomain || 'default'}`;
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;

  return initializeApp(
    {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain || undefined,
      projectId: cfg.projectId,
      appId: cfg.appId || undefined,
    },
    appName,
  );
}

export function getActiveFirebaseAppSync(): FirebaseApp {
  const host = getCurrentBrowserHost();
  const snapshot = resolvedConfigSnapshots.get(host || 'default') ?? lastResolvedConfig;
  if (snapshot) {
    const resolvedApp = getOrCreateFirebaseApp(snapshot);
    if (resolvedApp) return resolvedApp;
  }
  return getPrimaryFirebaseApp();
}

function getPreloadedFirebaseAuthSync(): Auth | null {
  const host = getCurrentBrowserHost();
  const snapshot = resolvedConfigSnapshots.get(host || 'default');
  if (!snapshot) return null;
  const app = getOrCreateFirebaseApp(snapshot);
  return app ? getAuth(app) : null;
}

export async function getActiveFirebaseAuth(): Promise<Auth | null> {
  const cfg = await getRuntimeFirebaseConfig();
  const app = getOrCreateFirebaseApp(cfg);
  return app ? getAuth(app) : null;
}

export function subscribeFirebaseAuthState(onChange: (user: User | null) => void): () => void {
  let active = true;
  let activeAuth = getPreloadedFirebaseAuthSync() ?? getAuth(getPrimaryFirebaseApp());
  let unsubscribe = onAuthStateChanged(activeAuth, (user) => {
    if (active) onChange(user);
  });

  void getActiveFirebaseAuth().then((resolvedAuth) => {
    if (!active || !resolvedAuth || resolvedAuth === activeAuth) return;
    unsubscribe();
    activeAuth = resolvedAuth;
    unsubscribe = onAuthStateChanged(activeAuth, (user) => {
      if (active) onChange(user);
    });
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export function getFirebaseProjectId(): string {
  const host = getCurrentBrowserHost();
  return lastResolvedConfig?.projectId || buildStaticFallbackConfig(host).projectId;
}

export async function signInWithGooglePopup(): Promise<{
  idToken: string;
  email: string;
  displayName: string;
}> {
  // Prefer synchronous pre-warmed Auth instance inside click gesture so browsers do not block the popup
  const auth = getPreloadedFirebaseAuthSync() ?? (await getActiveFirebaseAuth());
  if (!auth) {
    throw new Error('Firebase Auth не налаштовано');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return {
    idToken,
    email: result.user.email || '',
    displayName: result.user.displayName || result.user.email || 'Admin',
  };
}

export async function signOutFirebase(): Promise<void> {
  const auth = getPreloadedFirebaseAuthSync() ?? (await getActiveFirebaseAuth());
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // non-blocking cleanup
  }
}

export async function getCurrentFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getPreloadedFirebaseAuthSync() ?? (await getActiveFirebaseAuth());
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

