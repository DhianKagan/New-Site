import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'server', 'data');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const SEED_CATALOG_PATH = path.resolve(process.cwd(), 'server', 'seed', 'catalog.json');
export const SEED_PROJECTS_PATH = path.resolve(process.cwd(), 'server', 'seed', 'projects.json');

export function getUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

export function writeJsonFileAtomic(filePath: string, data: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) return;
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch {
    // non-fatal if workspace filesystem is read-only
  }
}

export function normalizeContactPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^380\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
  if (/^\d{9}$/.test(digits)) return `+380${digits}`;
  return raw.trim();
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
