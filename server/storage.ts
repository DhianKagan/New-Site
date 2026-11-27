import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import busboy from 'busboy';
import { getUploadsDir } from './db/utils.ts';
import { logger } from './logger.ts';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

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
      url: buildS3PublicUrl(key),
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
