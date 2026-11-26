import { useEffect, useMemo, useRef, useState } from 'react';
import { Sun } from 'lucide-react';
import type { ProductCategory } from '../types.ts';
import { cn } from '../lib/utils.ts';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  progressive?: boolean;
  placeholderTone?: ProductCategory | string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
}

const PLACEHOLDER_PALETTES: Record<string, [string, string, string, string]> = {
  kits: ['#fef3c7', '#e0f2fe', '#7dd3fc', '#0b66b2'],
  inverters: ['#e0f2fe', '#bae6fd', '#38bdf8', '#0369a1'],
  batteries: ['#ccfbf1', '#e0f2fe', '#5eead4', '#0d9488'],
  panels: ['#dbeafe', '#bfdbfe', '#60a5fa', '#1d4ed8'],
  parts: ['#f1f5f9', '#e2e8f0', '#cbd5e1', '#64748b'],
  default: ['#e0f2fe', '#f0f9ff', '#bae6fd', '#0b66b2'],
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildBlurPlaceholderDataUri(
  seed: string,
  tone: ProductCategory | string = 'default',
): string {
  const palette = PLACEHOLDER_PALETTES[tone] ?? PLACEHOLDER_PALETTES.default;
  const hash = hashSeed(`${tone}:${seed}`);
  const cx1 = 4 + (hash % 7);
  const cy1 = 2 + ((hash >>> 4) % 5);
  const cx2 = 7 + ((hash >>> 8) % 8);
  const cy2 = 4 + ((hash >>> 12) % 5);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 10" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${palette[0]}"/>` +
    `<stop offset="100%" stop-color="${palette[1]}"/>` +
    `</linearGradient></defs>` +
    `<rect width="16" height="10" fill="url(#g)"/>` +
    `<circle cx="${cx1}" cy="${cy1}" r="5.5" fill="${palette[2]}" fill-opacity="0.45"/>` +
    `<circle cx="${cx2}" cy="${cy2}" r="4.5" fill="${palette[3]}" fill-opacity="0.22"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveSmartImageAttrs({
  priority = false,
  loading,
}: {
  priority?: boolean;
  loading?: 'lazy' | 'eager';
} = {}) {
  const resolvedLoading: 'lazy' | 'eager' = loading ?? (priority ? 'eager' : 'lazy');
  const isEager = resolvedLoading === 'eager';
  return {
    loading: resolvedLoading,
    fetchPriority: isEager && priority ? ('high' as const) : ('auto' as const),
    decoding: isEager ? ('sync' as const) : ('async' as const),
  };
}

export function SmartImage({
  src,
  alt,
  className = '',
  wrapperClassName,
  progressive = false,
  placeholderTone = 'default',
  priority = false,
  loading,
}: SmartImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const failed = !src || failedSrc === src;
  const isLoaded = Boolean(src) && loadedSrc === src;

  useEffect(() => {
    const img = imgRef.current;
    if (img && src && img.complete && img.naturalWidth > 0) {
      setLoadedSrc(src);
    }
  }, [src]);

  const placeholderUri = useMemo(
    () => (progressive && src ? buildBlurPlaceholderDataUri(src, placeholderTone) : ''),
    [progressive, src, placeholderTone],
  );

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center',
          wrapperClassName ?? className,
        )}
        role="img"
        aria-label={alt}
      >
        <Sun className="w-8 h-8 mb-1.5 text-slate-400" strokeWidth={1.5} />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  const attrs = resolveSmartImageAttrs({ priority, loading });

  if (!progressive) {
    return (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={attrs.loading}
        fetchPriority={attrs.fetchPriority}
        decoding={attrs.decoding}
        referrerPolicy="no-referrer"
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        className={className}
      />
    );
  }

  return (
    <div
      data-progressive-state={isLoaded ? 'loaded' : 'loading'}
      className={cn('relative overflow-hidden bg-sky-50/60', wrapperClassName ?? 'w-full h-full')}
    >
      <img
        src={placeholderUri}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={cn(
          'pointer-events-none absolute inset-0 w-full h-full object-cover blur-lg scale-110 transition-opacity duration-500 ease-out motion-reduce:transition-none',
          isLoaded ? 'opacity-0' : 'opacity-100',
        )}
      />
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent ec-blur-shimmer motion-reduce:hidden"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={attrs.loading}
        fetchPriority={attrs.fetchPriority}
        decoding={attrs.decoding}
        referrerPolicy="no-referrer"
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        className={cn(
          'relative z-[1] transition-[opacity,filter,transform] duration-500 ease-out motion-reduce:transition-none',
          isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-[1.04]',
          className,
        )}
      />
    </div>
  );
}
