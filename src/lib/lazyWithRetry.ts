import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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

export async function retryDynamicImport<T>(
  importer: () => Promise<T>,
  retries = 2,
  delayMs = 350,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isDynamicImportError(error)) {
        throw error;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs * (attempt + 1));
      });
    }
  }
  throw lastError;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 350,
): LazyExoticComponent<T> {
  return lazy(() => retryDynamicImport(importer, retries, delayMs));
}
