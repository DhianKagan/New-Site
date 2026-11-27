import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import busboy from 'busboy';
import type {
  LocalVolumeFileItem,
  S3ListResponse,
  S3MigrateResult,
  S3ObjectItem,
  StorageOverviewResponse,
} from '../src/types.ts';
import { getUploadsDir } from './db/utils.ts';
import { logger } from './logger.ts';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_BUCKET_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export type DetectedImageFormat = {
  ext: 'jpg' | 'png' | 'webp';
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

const ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

let s3ClientInstance: S3Client | null = null;
let warnedMissingS3 = false;

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function getS3Client(): S3Client | null {
  if (!isS3Configured()) {
    if (!warnedMissingS3) {
      warnedMissingS3 = true;
      logger.warn('S3 credentials not configured; falling back to local disk uploads');
    }
    return null;
  }

  if (!s3ClientInstance) {
    const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
    const region = process.env.S3_REGION?.trim() || 'auto';
    s3ClientInstance = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Railway Buckets are private: browsers cannot read them directly. With S3_PROXY_UPLOADS=true
 * the app returns /uploads/<file> URLs and streams the object from the bucket itself.
 */
export function isS3ProxyEnabled(): boolean {
  return isS3Configured() && process.env.S3_PROXY_UPLOADS?.trim().toLowerCase() === 'true';
}

const PROXY_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}\.(jpg|png|webp)$/;

export async function getUploadObject(
  filename: string,
): Promise<{ body: Readable; contentType: string; contentLength?: number } | null> {
  const s3 = getS3Client();
  if (!s3 || !PROXY_FILENAME_RE.test(filename)) return null;
  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: `uploads/${filename}` }),
    );
    if (!result.Body) return null;
    return {
      body: result.Body as Readable,
      contentType: result.ContentType || 'application/octet-stream',
      contentLength: result.ContentLength,
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name !== 'NoSuchKey' && name !== 'NotFound') {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'S3 upload fetch failed');
    }
    return null;
  }
}

export function buildS3PublicUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, '');
  const publicUrl = process.env.S3_PUBLIC_URL?.trim();
  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, '')}/${cleanKey}`;
  }

  const bucket = process.env.S3_BUCKET!.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (endpoint) {
    return `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}/${cleanKey}`;
  }

  const region = process.env.S3_REGION?.trim() || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
}

export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export class UploadValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function parseMultipartImageUpload(req: IncomingMessage): Promise<{
  buffer: Buffer;
  format: DetectedImageFormat;
}> {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    throw new UploadValidationError('Очікується multipart/form-data з файлом зображення', 400);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (err: UploadValidationError) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 10,
      },
    });

    let fileReceived = false;
    let tooLarge = false;
    let tooManyFiles = false;
    let invalidMime = false;
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    bb.on('file', (_fieldName, stream, info) => {
      if (fileReceived) {
        tooManyFiles = true;
        stream.resume();
        return;
      }
      fileReceived = true;

      const mime = String(info?.mimeType || '').toLowerCase().trim();
      if (mime && !ALLOWED_UPLOAD_MIMES.has(mime)) {
        invalidMime = true;
        stream.resume();
        return;
      }

      stream.on('data', (chunk: Buffer) => {
        if (tooLarge || invalidMime) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          tooLarge = true;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });

      stream.on('limit', () => {
        tooLarge = true;
        chunks.length = 0;
        stream.resume();
      });
    });

    bb.on('filesLimit', () => {
      tooManyFiles = true;
    });

    bb.on('error', () => {
      finishError(new UploadValidationError('Некоректний multipart-запит для завантаження зображення', 400));
    });

    req.on('aborted', () => {
      finishError(new UploadValidationError('Завантаження файлу перервано клієнтом', 400));
    });

    bb.on('finish', () => {
      if (settled) return;
      if (tooManyFiles) {
        finishError(new UploadValidationError('Можна завантажити лише одне зображення за один запит', 400));
        return;
      }
      if (tooLarge) {
        finishError(new UploadValidationError('Розмір зображення має бути до 4 МБ', 400));
        return;
      }
      if (invalidMime) {
        finishError(new UploadValidationError('Підтримуються тільки зображення JPG, PNG або WebP', 400));
        return;
      }
      if (!fileReceived || chunks.length === 0 || totalBytes === 0) {
        finishError(new UploadValidationError('Оберіть файл зображення JPG, PNG або WebP', 400));
        return;
      }

      const buffer = Buffer.concat(chunks, totalBytes);
      const format = detectImageFormat(buffer);
      if (!format) {
        finishError(
          new UploadValidationError('Вміст файлу не відповідає формату зображення JPG, PNG або WebP', 400),
        );
        return;
      }

      settled = true;
      resolve({ buffer, format });
    });

    req.pipe(bb);
  });
}

export async function uploadImageBuffer(
  buffer: Buffer,
  options?: { format?: DetectedImageFormat; uploadsDir?: string },
): Promise<{ url: string; storage: 's3' | 'disk'; key: string }> {
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError('Розмір зображення має бути до 4 МБ', 400);
  }
  const format = options?.format ?? detectImageFormat(buffer);
  if (!format) {
    throw new UploadValidationError('Вміст файлу не відповідає формату зображення JPG, PNG або WebP', 400);
  }

  const filename = `project-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${format.ext}`;
  const s3 = getS3Client();
  if (s3) {
    const key = `uploads/${filename}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!.trim(),
        Key: key,
        Body: buffer,
        ContentType: format.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return {
      url: isS3ProxyEnabled() ? `/uploads/${filename}` : buildS3PublicUrl(key),
      storage: 's3',
      key,
    };
  }

  const uploadsDir = options?.uploadsDir ? path.resolve(options.uploadsDir) : getUploadsDir();
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const targetPath = path.resolve(uploadsDir, filename);
  if (!targetPath.startsWith(uploadsDir + path.sep)) {
    throw new UploadValidationError('Некоректний шлях файлу', 400);
  }
  await fs.promises.writeFile(targetPath, buffer);

  if (
    !options?.uploadsDir &&
    process.env.NODE_ENV !== 'production' &&
    fs.existsSync(path.resolve(process.cwd(), 'public'))
  ) {
    try {
      const workspaceUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
      await fs.promises.mkdir(workspaceUploadsDir, { recursive: true });
      const workspaceCopyPath = path.resolve(workspaceUploadsDir, filename);
      if (workspaceCopyPath.startsWith(workspaceUploadsDir + path.sep)) {
        await fs.promises.writeFile(workspaceCopyPath, buffer);
      }
    } catch {
      // ignore if workspace public directory is read-only
    }
  }

  return {
    url: `/uploads/${filename}`,
    storage: 'disk',
    key: filename,
  };
}

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

const EXT_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const ALLOWED_BUCKET_EXTENSIONS = new Set(Object.keys(EXT_CONTENT_TYPES));

export function guessContentTypeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return EXT_CONTENT_TYPES[ext] || 'application/octet-stream';
}

export function sanitizeS3Key(rawKey: string): string | null {
  const normalized = String(rawKey || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();
  if (!normalized || normalized.length > 400) return null;
  if (normalized.includes('\0')) return null;
  const segments = normalized.split('/');
  if (segments.some((s) => s === '..' || s === '.')) return null;
  if (!/^[A-Za-z0-9/_. -]+$/.test(normalized)) return null;
  return normalized;
}

export function sanitizeS3Prefix(rawPrefix: string): string {
  const trimmed = String(rawPrefix || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();
  if (!trimmed) return '';
  const clean = sanitizeS3Key(trimmed.replace(/\/+$/, ''));
  if (!clean) return '';
  return `${clean}/`;
}

export function sanitizeLocalFileName(rawName: string): string | null {
  const base = path.basename(String(rawName || '').trim()).replace(/\s+/g, '-');
  if (!base || base === '.' || base === '..' || base.length > 180) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(base)) return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_BUCKET_EXTENSIONS.has(ext)) return null;
  return base;
}

function resolveS3ObjectPublicUrl(key: string): string {
  if (key.startsWith('uploads/') && !key.slice('uploads/'.length).includes('/')) {
    const filename = key.slice('uploads/'.length);
    if (isS3ProxyEnabled() && PROXY_FILENAME_RE.test(filename)) {
      return `/uploads/${filename}`;
    }
  }
  return buildS3PublicUrl(key);
}

export async function listLocalVolumeFiles(): Promise<LocalVolumeFileItem[]> {
  const uploadsDir = getUploadsDir();
  try {
    const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
    const items: LocalVolumeFileItem[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      const fullPath = path.resolve(uploadsDir, entry.name);
      if (!fullPath.startsWith(uploadsDir + path.sep)) continue;
      const stat = await fs.promises.stat(fullPath);
      items.push({
        fileName: entry.name,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isImage: IMAGE_EXT_RE.test(entry.name),
        url: `/uploads/${encodeURIComponent(entry.name)}`,
      });
    }
    items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return items;
  } catch {
    return [];
  }
}

export async function getLocalVolumeFilePath(rawFileName: string): Promise<string | null> {
  const safeName = sanitizeLocalFileName(rawFileName);
  if (!safeName) return null;
  const uploadsDir = getUploadsDir();
  const fullPath = path.resolve(uploadsDir, safeName);
  if (!fullPath.startsWith(uploadsDir + path.sep)) return null;
  try {
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) return null;
    return fullPath;
  } catch {
    return null;
  }
}

export async function uploadLocalVolumeFile(buffer: Buffer, rawFileName: string): Promise<LocalVolumeFileItem> {
  if (buffer.length === 0 || buffer.length > MAX_BUCKET_UPLOAD_BYTES) {
    throw new UploadValidationError('Розмір файлу має бути до 15 МБ', 400);
  }
  const safeName = sanitizeLocalFileName(rawFileName);
  if (!safeName) {
    throw new UploadValidationError('Некоректне ім’я файлу або непідтримуване розширення', 400);
  }
  const ext = path.extname(safeName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
    if (!detectImageFormat(buffer)) {
      throw new UploadValidationError('Вміст файлу не відповідає формату зображення JPG, PNG або WebP', 400);
    }
  }
  const uploadsDir = getUploadsDir();
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const targetPath = path.resolve(uploadsDir, safeName);
  if (!targetPath.startsWith(uploadsDir + path.sep)) {
    throw new UploadValidationError('Некоректний шлях файлу', 400);
  }
  await fs.promises.writeFile(targetPath, buffer);
  const stat = await fs.promises.stat(targetPath);
  return {
    fileName: safeName,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    isImage: IMAGE_EXT_RE.test(safeName),
    url: `/uploads/${encodeURIComponent(safeName)}`,
  };
}

export async function deleteLocalVolumeFiles(rawFileNames: string[]): Promise<{ deleted: number }> {
  const uploadsDir = getUploadsDir();
  let deleted = 0;
  for (const name of rawFileNames) {
    const safeName = sanitizeLocalFileName(name);
    if (!safeName) continue;
    const targetPath = path.resolve(uploadsDir, safeName);
    if (!targetPath.startsWith(uploadsDir + path.sep)) continue;
    try {
      await fs.promises.unlink(targetPath);
      deleted += 1;
    } catch {
      // ignore missing
    }
  }
  return { deleted };
}

export async function getStorageOverview(): Promise<StorageOverviewResponse> {
  const configured = isS3Configured();
  const uploadsDir = getUploadsDir();
  const localFiles = await listLocalVolumeFiles();
  const localFilesTotalBytes = localFiles.reduce((sum, f) => sum + f.size, 0);

  let endpointHost = '';
  const rawEndpoint = process.env.S3_ENDPOINT?.trim() || '';
  if (rawEndpoint) {
    try {
      endpointHost = new URL(rawEndpoint).host;
    } catch {
      endpointHost = rawEndpoint;
    }
  }

  let s3Reachable = false;
  let s3Error: string | undefined;
  const s3 = getS3Client();
  if (s3) {
    try {
      await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.S3_BUCKET!.trim(),
          MaxKeys: 1,
        }),
      );
      s3Reachable = true;
    } catch (err) {
      s3Reachable = false;
      s3Error = err instanceof Error ? err.message : 'S3 bucket connection failed';
    }
  }

  return {
    s3Configured: configured,
    s3ProxyEnabled: isS3ProxyEnabled(),
    s3Reachable,
    ...(s3Error ? { s3Error } : {}),
    bucket: process.env.S3_BUCKET?.trim() || '',
    endpointHost,
    region: process.env.S3_REGION?.trim() || 'auto',
    localUploadsDir: uploadsDir,
    localFilesCount: localFiles.length,
    localFilesTotalBytes,
  };
}

export async function listS3Objects(options?: {
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
}): Promise<S3ListResponse> {
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET?.trim() || '';
  const prefix = sanitizeS3Prefix(options?.prefix || '');
  if (!s3 || !bucket) {
    return {
      configured: false,
      bucket: '',
      prefix,
      folders: [],
      objects: [],
      nextContinuationToken: null,
      totalSizeBytes: 0,
    };
  }

  const maxKeys = Math.max(10, Math.min(250, options?.maxKeys ?? 100));
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      MaxKeys: maxKeys,
      ...(options?.continuationToken ? { ContinuationToken: options.continuationToken } : {}),
    }),
  );

  const folders = (result.CommonPrefixes ?? [])
    .map((p) => p.Prefix || '')
    .filter((p) => Boolean(p) && p !== prefix);

  const objects: S3ObjectItem[] = [];
  let totalSizeBytes = 0;
  for (const item of result.Contents ?? []) {
    const key = item.Key || '';
    if (!key || key === prefix || key.endsWith('/')) continue;
    const size = Number(item.Size ?? 0);
    totalSizeBytes += size;
    const fileName = key.split('/').pop() || key;
    objects.push({
      key,
      fileName,
      size,
      lastModified: item.LastModified ? item.LastModified.toISOString() : '',
      etag: String(item.ETag || '').replace(/"/g, ''),
      isImage: IMAGE_EXT_RE.test(key),
      contentTypeGuess: guessContentTypeFromKey(key),
      publicUrl: resolveS3ObjectPublicUrl(key),
    });
  }

  objects.sort((a, b) => b.lastModified.localeCompare(a.lastModified));

  return {
    configured: true,
    bucket,
    prefix,
    folders,
    objects,
    nextContinuationToken: result.IsTruncated ? result.NextContinuationToken ?? null : null,
    totalSizeBytes,
  };
}

export async function getS3ObjectStream(
  rawKey: string,
): Promise<{ body: Readable; contentType: string; contentLength?: number; fileName: string } | null> {
  const s3 = getS3Client();
  const key = sanitizeS3Key(rawKey);
  if (!s3 || !key) return null;
  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!.trim(),
        Key: key,
      }),
    );
    if (!result.Body) return null;
    return {
      body: result.Body as Readable,
      contentType: result.ContentType || guessContentTypeFromKey(key),
      contentLength: result.ContentLength,
      fileName: key.split('/').pop() || 'file',
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name !== 'NoSuchKey' && name !== 'NotFound') {
      logger.warn({ err: err instanceof Error ? err.message : String(err), key }, 'S3 object get failed');
    }
    return null;
  }
}

export async function uploadBucketObject(
  buffer: Buffer,
  options: { prefix?: string; fileName: string; mimeType?: string },
): Promise<S3ObjectItem> {
  const s3 = getS3Client();
  if (!s3) {
    throw new UploadValidationError('S3 Bucket не налаштовано у змінних оточення', 400);
  }
  if (buffer.length === 0 || buffer.length > MAX_BUCKET_UPLOAD_BYTES) {
    throw new UploadValidationError('Розмір файлу має бути від 1 байта до 15 МБ', 400);
  }
  const safeFileName = sanitizeLocalFileName(options.fileName);
  if (!safeFileName) {
    throw new UploadValidationError(
      'Дозволені розширення: jpg, jpeg, png, webp, gif, svg, pdf, json, csv, txt, xml',
      400,
    );
  }
  const ext = path.extname(safeFileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
    if (!detectImageFormat(buffer)) {
      throw new UploadValidationError('Вміст файлу не відповідає формату зображення JPG, PNG або WebP', 400);
    }
  }
  const prefix = sanitizeS3Prefix(options.prefix || '');
  const key = sanitizeS3Key(`${prefix}${safeFileName}`);
  if (!key) {
    throw new UploadValidationError('Некоректний ключ об’єкта S3', 400);
  }

  const contentType = guessContentTypeFromKey(safeFileName);
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!.trim(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: IMAGE_EXT_RE.test(safeFileName) ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
    }),
  );

  return {
    key,
    fileName: safeFileName,
    size: buffer.length,
    lastModified: new Date().toISOString(),
    etag: '',
    isImage: IMAGE_EXT_RE.test(safeFileName),
    contentTypeGuess: contentType,
    publicUrl: resolveS3ObjectPublicUrl(key),
  };
}

export async function renameS3Object(sourceRawKey: string, targetRawKey: string): Promise<S3ObjectItem> {
  const s3 = getS3Client();
  if (!s3) {
    throw new UploadValidationError('S3 Bucket не налаштовано', 400);
  }
  const sourceKey = sanitizeS3Key(sourceRawKey);
  const destinationKey = sanitizeS3Key(targetRawKey);
  if (!sourceKey || !destinationKey || sourceKey === destinationKey) {
    throw new UploadValidationError('Вкажіть коректний новий шлях/ключ об’єкта', 400);
  }
  const ext = path.extname(destinationKey).toLowerCase();
  if (!ALLOWED_BUCKET_EXTENSIONS.has(ext)) {
    throw new UploadValidationError('Непідтримуване розширення цільового файлу', 400);
  }

  const bucket = process.env.S3_BUCKET!.trim();
  const encodedCopySource = `${bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodedCopySource,
      Key: destinationKey,
      ContentType: guessContentTypeFromKey(destinationKey),
      MetadataDirective: 'REPLACE',
    }),
  );
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    }),
  );

  let size = 0;
  let lastModified = new Date().toISOString();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: destinationKey }));
    size = Number(head.ContentLength ?? 0);
    if (head.LastModified) lastModified = head.LastModified.toISOString();
  } catch {
    // non-blocking
  }

  return {
    key: destinationKey,
    fileName: destinationKey.split('/').pop() || destinationKey,
    size,
    lastModified,
    etag: '',
    isImage: IMAGE_EXT_RE.test(destinationKey),
    contentTypeGuess: guessContentTypeFromKey(destinationKey),
    publicUrl: resolveS3ObjectPublicUrl(destinationKey),
  };
}

export async function deleteS3Objects(rawKeys: string[]): Promise<{ deleted: number }> {
  const s3 = getS3Client();
  if (!s3) {
    throw new UploadValidationError('S3 Bucket не налаштовано', 400);
  }
  const bucket = process.env.S3_BUCKET!.trim();
  const keys = Array.from(
    new Set(rawKeys.map((k) => sanitizeS3Key(k)).filter((k): k is string => Boolean(k))),
  );
  if (keys.length === 0) return { deleted: 0 };

  let deleted = 0;
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    if (batch.length === 1) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: batch[0] }));
      deleted += 1;
    } else {
      const resp = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
      deleted += resp.Deleted?.length ?? batch.length;
    }
  }
  return { deleted };
}

export async function listAllS3Keys(prefix = 'uploads/', limit = 1000): Promise<Set<string>> {
  const s3 = getS3Client();
  const keys = new Set<string>();
  if (!s3) return keys;
  const bucket = process.env.S3_BUCKET!.trim();
  let continuationToken: string | undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        MaxKeys: Math.min(250, limit - keys.size),
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }),
    );
    for (const item of resp.Contents ?? []) {
      if (item.Key) keys.add(item.Key);
    }
    continuationToken = resp.IsTruncated && keys.size < limit ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function migrateLocalUploadsToS3(): Promise<S3MigrateResult> {
  const s3 = getS3Client();
  if (!s3) {
    throw new UploadValidationError('S3 Bucket не налаштовано у змінних оточення', 400);
  }
  const bucket = process.env.S3_BUCKET!.trim();
  const uploadsDir = getUploadsDir();
  const localFiles = await listLocalVolumeFiles();
  const existingS3Keys = await listAllS3Keys('uploads/', 2000);

  const details: S3MigrateResult['details'] = [];
  let uploaded = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const file of localFiles) {
    const key = `uploads/${file.fileName}`;
    if (existingS3Keys.has(key)) {
      skippedExisting += 1;
      details.push({ fileName: file.fileName, status: 'skipped' });
      continue;
    }
    const fullPath = path.resolve(uploadsDir, file.fileName);
    if (!fullPath.startsWith(uploadsDir + path.sep)) {
      failed += 1;
      details.push({ fileName: file.fileName, status: 'error', message: 'Invalid path' });
      continue;
    }
    try {
      const buffer = await fs.promises.readFile(fullPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: guessContentTypeFromKey(file.fileName),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      uploaded += 1;
      details.push({ fileName: file.fileName, status: 'uploaded' });
    } catch (err) {
      failed += 1;
      details.push({
        fileName: file.fileName,
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }

  return { uploaded, skippedExisting, failed, details };
}

export async function parseMultipartGeneralUpload(req: IncomingMessage): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  prefix: string;
}> {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    throw new UploadValidationError('Очікується multipart/form-data з файлом', 400);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (err: UploadValidationError) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_BUCKET_UPLOAD_BYTES,
        files: 1,
        fields: 10,
      },
    });

    let fileReceived = false;
    let tooLarge = false;
    let tooManyFiles = false;
    let fileName = '';
    let mimeType = '';
    let prefix = '';
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    bb.on('field', (name, val) => {
      if (name === 'prefix') {
        prefix = String(val || '').slice(0, 200);
      }
    });

    bb.on('file', (_fieldName, stream, info) => {
      if (fileReceived) {
        tooManyFiles = true;
        stream.resume();
        return;
      }
      fileReceived = true;
      fileName = String(info?.filename || 'upload.bin');
      mimeType = String(info?.mimeType || 'application/octet-stream');

      stream.on('data', (chunk: Buffer) => {
        if (tooLarge) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_BUCKET_UPLOAD_BYTES) {
          tooLarge = true;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });

      stream.on('limit', () => {
        tooLarge = true;
        chunks.length = 0;
        stream.resume();
      });
    });

    bb.on('filesLimit', () => {
      tooManyFiles = true;
    });

    bb.on('error', () => {
      finishError(new UploadValidationError('Некоректний multipart-запит для завантаження файлу', 400));
    });

    req.on('aborted', () => {
      finishError(new UploadValidationError('Завантаження файлу перервано клієнтом', 400));
    });

    bb.on('finish', () => {
      if (settled) return;
      if (tooManyFiles) {
        finishError(new UploadValidationError('Можна завантажити лише один файл за запит', 400));
        return;
      }
      if (tooLarge) {
        finishError(new UploadValidationError('Розмір файлу має бути до 15 МБ', 400));
        return;
      }
      if (!fileReceived || chunks.length === 0 || totalBytes === 0) {
        finishError(new UploadValidationError('Оберіть файл для завантаження', 400));
        return;
      }

      settled = true;
      resolve({
        buffer: Buffer.concat(chunks, totalBytes),
        fileName,
        mimeType,
        prefix,
      });
    });

    req.pipe(bb);
  });
}
