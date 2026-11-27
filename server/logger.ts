import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';

const requestIdMap = new WeakMap<Request, string>();

const SAFE_REQUEST_ID_REGEX = /^[A-Za-z0-9._-]{1,64}$/;

export const LOGGER_REDACT_PATHS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'setupToken',
  'secret',
  'authorization',
  'cookie',
  'phone',
  'email',
  'customerName',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-setup-token"]',
  'req.headers["x-telegram-bot-api-secret-token"]',
  '*.password',
  '*.token',
  '*.secret',
  '*.phone',
  '*.email',
  '*.authorization',
  '*.cookie',
];

export function createLogger(destination?: pino.DestinationStream) {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL?.trim() || 'info',
    base: { service: 'energocomfort' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: LOGGER_REDACT_PATHS,
      censor: '[REDACTED]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export function resolveOrCreateRequestId(headerValue: string | string[] | undefined): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = (raw ?? '').trim();
  if (trimmed && SAFE_REQUEST_ID_REGEX.test(trimmed)) {
    return trimmed;
  }
  return crypto.randomUUID();
}

export function getRequestId(req: Request): string {
  return requestIdMap.get(req) ?? '';
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveOrCreateRequestId(req.headers['x-request-id']);
  requestIdMap.set(req, requestId);
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const logPath = (req.originalUrl || req.url || req.path || '/').split('?')[0];
    const isApi = logPath.startsWith('/api/');
    const statusCode = res.statusCode;
    if (!isApi && statusCode < 400) {
      return;
    }

    const logPayload = {
      requestId,
      method: req.method,
      path: logPath,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    if (statusCode >= 500) {
      logger.error(logPayload, 'HTTP request failed');
    } else if (statusCode >= 400) {
      logger.warn(logPayload, 'HTTP request rejected');
    } else {
      logger.info(logPayload, 'HTTP request completed');
    }
  });

  next();
}
