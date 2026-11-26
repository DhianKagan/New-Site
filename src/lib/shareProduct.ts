export interface ShareNavigatorLike {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
}

export type ShareProductOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildProductShareUrl(
  productId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://energocomfort.shop',
): string {
  const cleanOrigin = origin.replace(/\/+$/, '') || 'https://energocomfort.shop';
  const cleanId = productId.trim();
  return `${cleanOrigin}/shop/${encodeURIComponent(cleanId)}`;
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError',
  );
}

function copyViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopyProductUrl(
  params: {
    title: string;
    text?: string;
    url: string;
  },
  nav: ShareNavigatorLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): Promise<ShareProductOutcome> {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({
        title: params.title,
        text: params.text,
        url: params.url,
      });
      return 'shared';
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return 'cancelled';
      }
      // Fall back to copying URL when Web Share fails or is blocked in desktop/iframe contexts
    }
  }

  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(params.url);
      return 'copied';
    } catch {
      // Fall back to execCommand below
    }
  }

  return copyViaExecCommand(params.url) ? 'copied' : 'failed';
}
