import fs from 'node:fs';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface FirebaseAppletConfig {
  projectId?: string;
}

let cachedProjectId: string | null | undefined;

function getFirebaseProjectId(): string | null {
  if (cachedProjectId !== undefined) return cachedProjectId;

  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) {
    cachedProjectId = envProjectId;
    return cachedProjectId;
  }

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
      if (parsed.projectId && parsed.projectId !== 'remixed-project-id') {
        cachedProjectId = parsed.projectId;
        return cachedProjectId;
      }
    } catch {
      // ignore invalid config JSON
    }
  }

  cachedProjectId = null;
  return null;
}

export function isFirebaseAuthConfigured(): boolean {
  return Boolean(getFirebaseProjectId());
}

export async function verifyFirebaseGoogleToken(
  idToken: string,
): Promise<{ uid: string; email: string; name: string } | null> {
  const projectId = getFirebaseProjectId();
  if (!projectId) return null;

  try {
    const app = getApps().length ? getApp() : initializeApp({ projectId });
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (!decoded.email || decoded.email_verified !== true) {
      return null;
    }
    return {
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
      name: typeof decoded.name === 'string' ? decoded.name : decoded.email,
    };
  } catch {
    return null;
  }
}
