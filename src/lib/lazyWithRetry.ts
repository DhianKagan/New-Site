import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { recordComponentLoadComplete, recordComponentLoadStart } from './performanceMonitor.ts';

export interface LazyLoadOptions {
  retries?: number;
  delayMs?: number;
  componentName?: string;
}

export function isDynamicImportError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|error loading dynamically imported module/i.test(
    message,
  );
}

function nowTime(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export async function retryDynamicImport<T>(
  importer: () => Promise<T>,
  retriesOrOptions: number | LazyLoadOptions = 2,
  delayMs = 350,
  componentName?: string,
): Promise<T> {
  const opts: Required<Pick<LazyLoadOptions, 'retries' | 'delayMs'>> & { componentName?: string } =
    typeof retriesOrOptions === 'object'
      ? {
          retries: retriesOrOptions.retries ?? 2,
          delayMs: retriesOrOptions.delayMs ?? 350,
          componentName: retriesOrOptions.componentName ?? componentName,
        }
      : {
          retries: retriesOrOptions,
          delayMs,
          componentName,
        };

  const trackedName = opts.componentName?.trim();
  const startedAt = trackedName ? recordComponentLoadStart(trackedName) : nowTime();

  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      const result = await importer();
      if (trackedName) {
        recordComponentLoadComplete({
          componentName: trackedName,
          durationMs: Math.max(0, nowTime() - startedAt),
          attempts: attempt + 1,
          status: 'loaded',
          startedAt,
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === opts.retries || !isDynamicImportError(error)) {
        if (trackedName) {
          recordComponentLoadComplete({
            componentName: trackedName,
            durationMs: Math.max(0, nowTime() - startedAt),
            attempts: attempt + 1,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : String(error),
            startedAt,
          });
        }
        throw error;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, opts.delayMs * (attempt + 1));
      });
    }
  }
  throw lastError;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retriesOrOptions: number | LazyLoadOptions = 2,
  delayMs = 350,
  componentName?: string,
): LazyExoticComponent<T> {
  return lazy(() => retryDynamicImport(importer, retriesOrOptions, delayMs, componentName));
}
