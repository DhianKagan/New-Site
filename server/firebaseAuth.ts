import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { FirebaseDomainRule, FirebaseRuntimeWebConfig } from '../src/types.ts';
import { getSetting, setSetting } from './db.ts';
import {
  normalizeHost,
  parseDomainRulesFromString,
  resolveFirebaseWebConfigForHost,
  sanitizeDomainRules,
} from './firebaseConfig.ts';

interface FirebaseAppletConfigFile {
  projectId?: string;
  apiKey?: string;
  authDomain?: string;
  appId?: string;
  authDomains?: Record<string, string>;
  domains?: FirebaseDomainRule[];
}

const DB_FIREBASE_DOMAINS_KEY = 'firebase_oauth_domains_json';

export function getFirebaseConfigFileCandidates(envName = process.env.NODE_ENV || 'development'): string[] {
  const candidates: string[] = [];
  const customFile = (process.env.FIREBASE_CONFIG_FILE || '').trim();
  if (customFile) {
    candidates.push(path.isAbsolute(customFile) ? customFile : path.resolve(process.cwd(), customFile));
  }

  const safeEnv = envName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (safeEnv) {
    candidates.push(path.resolve(process.cwd(), `firebase-config.${safeEnv}.json`));
    candidates.push(path.resolve(process.cwd(), 'config', `firebase-config.${safeEnv}.json`));
  }

  candidates.push(path.resolve(process.cwd(), 'firebase-config.local.json'));
  candidates.push(path.resolve(process.cwd(), 'firebase-config.json'));
  candidates.push(path.resolve(process.cwd(), 'firebase-applet-config.json'));
  return Array.from(new Set(candidates));
}

export function readFirebaseConfigFromPaths(candidates: string[]): {
  filePath: string | null;
  config: FirebaseAppletConfigFile;
} {
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as unknown;
      if (parsed && typeof parsed === 'object') {
        return { filePath: candidate, config: parsed as FirebaseAppletConfigFile };
      }
    } catch {
      // Ignore malformed candidate config file and continue to fallback
    }
  }
  return { filePath: null, config: {} };
}

function readEnvironmentFirebaseConfigFile(): { filePath: string | null; config: FirebaseAppletConfigFile } {
  return readFirebaseConfigFromPaths(getFirebaseConfigFileCandidates());
}

export function getBaseFirebaseWebConfig(): {
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId: string;
} {
  const { config: fileCfg } = readEnvironmentFirebaseConfigFile();
  const fileProjectId = fileCfg.projectId && fileCfg.projectId !== 'remixed-project-id' ? fileCfg.projectId : '';
  const projectId = (process.env.FIREBASE_PROJECT_ID || fileProjectId || '').trim();
  const apiKey = (process.env.FIREBASE_API_KEY || fileCfg.apiKey || '').trim();
  const authDomain = (
    process.env.AUTH_DOMAIN ||
    process.env.FIREBASE_AUTH_DOMAIN ||
    fileCfg.authDomain ||
    (projectId ? `${projectId}.firebaseapp.com` : '')
  ).trim();
  const appId = (process.env.FIREBASE_APP_ID || fileCfg.appId || '').trim();

  return { projectId, apiKey, authDomain, appId };
}

function getFileDomainRules(): FirebaseDomainRule[] {
  const { config: fileCfg } = readEnvironmentFirebaseConfigFile();
  const out: FirebaseDomainRule[] = [];

  if (fileCfg.authDomains && typeof fileCfg.authDomains === 'object') {
    for (const [hostPattern, authDomain] of Object.entries(fileCfg.authDomains)) {
      if (typeof authDomain === 'string') {
        out.push({ hostPattern, authDomain });
      }
    }
  }

  if (Array.isArray(fileCfg.domains)) {
    for (const entry of fileCfg.domains) {
      if (entry && typeof entry === 'object' && typeof entry.hostPattern === 'string') {
        out.push(entry);
      }
    }
  }

  return sanitizeDomainRules(out);
}

function getEnvDomainRules(): FirebaseDomainRule[] {
  const raw = [process.env.AUTH_DOMAINS || '', process.env.FIREBASE_AUTH_DOMAINS || ''].filter(Boolean).join(',');
  return parseDomainRulesFromString(raw);
}

function getDbDomainRules(): FirebaseDomainRule[] {
  const raw = getSetting(DB_FIREBASE_DOMAINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const candidateRules: FirebaseDomainRule[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      candidateRules.push({
        hostPattern: typeof row.hostPattern === 'string' ? row.hostPattern : '',
        authDomain: typeof row.authDomain === 'string' ? row.authDomain : undefined,
        projectId: typeof row.projectId === 'string' ? row.projectId : undefined,
        apiKey: typeof row.apiKey === 'string' ? row.apiKey : undefined,
        appId: typeof row.appId === 'string' ? row.appId : undefined,
      });
    }
    return sanitizeDomainRules(candidateRules);
  } catch {
    return [];
  }
}

function shouldUseHostAsAuthDomain(): boolean {
  const raw = (process.env.FIREBASE_USE_HOST_AS_AUTH_DOMAIN || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getRuntimeFirebaseWebConfig(requestHost: string): FirebaseRuntimeWebConfig {
  return resolveFirebaseWebConfigForHost({
    requestHost: normalizeHost(requestHost),
    baseConfig: getBaseFirebaseWebConfig(),
    envRules: [...getFileDomainRules(), ...getEnvDomainRules()],
    dbRules: getDbDomainRules(),
    appUrl: process.env.APP_URL,
    useHostAsAuthDomain: shouldUseHostAsAuthDomain(),
  });
}

export function getFirebaseDomainAdminState(): {
  envRules: FirebaseDomainRule[];
  dbRules: FirebaseDomainRule[];
  effectiveRules: FirebaseDomainRule[];
  baseConfig: {
    projectId: string;
    authDomain: string;
    hasApiKey: boolean;
    hasAppId: boolean;
  };
  useHostAsAuthDomain: boolean;
} {
  const base = getBaseFirebaseWebConfig();
  const envRules = sanitizeDomainRules([...getFileDomainRules(), ...getEnvDomainRules()]);
  const dbRules = getDbDomainRules();
  return {
    envRules,
    dbRules,
    effectiveRules: sanitizeDomainRules([...envRules, ...dbRules]),
    baseConfig: {
      projectId: base.projectId,
      authDomain: base.authDomain,
      hasApiKey: Boolean(base.apiKey),
      hasAppId: Boolean(base.appId),
    },
    useHostAsAuthDomain: shouldUseHostAsAuthDomain(),
  };
}

export function saveFirebaseDomainRules(rules: FirebaseDomainRule[]): FirebaseDomainRule[] {
  const sanitized = sanitizeDomainRules(rules);
  setSetting(DB_FIREBASE_DOMAINS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

function getAllConfiguredProjectIds(): string[] {
  const ids = new Set<string>();
  const base = getBaseFirebaseWebConfig();
  if (base.projectId) ids.add(base.projectId);
  for (const rule of [...getFileDomainRules(), ...getEnvDomainRules(), ...getDbDomainRules()]) {
    if (rule.projectId) ids.add(rule.projectId);
  }
  return Array.from(ids);
}

function getOrCreateAdminAppForProject(projectId: string): App {
  const appName = `fb-verify-${projectId}`;
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return existing;
  return initializeApp({ projectId }, appName);
}

export function isFirebaseAuthConfigured(): boolean {
  return getAllConfiguredProjectIds().length > 0;
}

export async function verifyFirebaseGoogleToken(
  idToken: string,
): Promise<{ uid: string; email: string; name: string } | null> {
  const projectIds = getAllConfiguredProjectIds();
  if (projectIds.length === 0) return null;

  for (const projectId of projectIds) {
    try {
      const app = getOrCreateAdminAppForProject(projectId);
      const decoded = await getAuth(app).verifyIdToken(idToken);
      if (!decoded.email || decoded.email_verified !== true) {
        continue;
      }
      return {
        uid: decoded.uid,
        email: decoded.email.toLowerCase(),
        name: typeof decoded.name === 'string' ? decoded.name : decoded.email,
      };
    } catch {
      // Try next configured Firebase projectId if multi-project domain override is active
    }
  }

  return null;
}
