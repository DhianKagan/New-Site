import { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
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

export function SmartImage({ src, alt, className = '', priority = false, loading }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sun className="w-8 h-8 mb-1.5 text-slate-400" strokeWidth={1.5} />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  const attrs = resolveSmartImageAttrs({ priority, loading });

  return (
    <img
      src={src}
      alt={alt}
      loading={attrs.loading}
      fetchPriority={attrs.fetchPriority}
      decoding={attrs.decoding}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
