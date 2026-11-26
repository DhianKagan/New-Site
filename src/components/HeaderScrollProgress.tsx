import { useEffect, useState } from 'react';
import { tr } from '../lib/i18n.ts';

export function calculateScrollProgressPct(
  scrollY: number,
  scrollHeight: number,
  innerHeight: number,
): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(scrollHeight) || !Number.isFinite(innerHeight)) {
    return 0;
  }
  const maxScroll = Math.max(0, scrollHeight - innerHeight);
  if (maxScroll <= 0) return 0;
  const raw = (Math.max(0, scrollY) / maxScroll) * 100;
  const clamped = Math.min(100, Math.max(0, raw));
  return Math.round(clamped * 10) / 10;
}

interface HeaderScrollProgressProps {
  routeKey: string;
}

export function HeaderScrollProgress({ routeKey }: HeaderScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const doc = document.documentElement;
      const scrollY = window.scrollY || doc.scrollTop || 0;
      const scrollHeight = Math.max(doc.scrollHeight, document.body?.scrollHeight || 0);
      const next = calculateScrollProgressPct(scrollY, scrollHeight, window.innerHeight);
      setProgress((prev) => (prev === next ? prev : next));
    };

    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(document.documentElement);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [routeKey]);

  return (
    <div
      role="progressbar"
      aria-label={tr('Прогрес читання сторінки', 'Прогресс чтения страницы')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none absolute top-0 inset-x-0 z-10 h-[3px] bg-sky-950/35 overflow-hidden"
    >
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#f59e0b] shadow-[0_0_8px_rgba(56,189,248,0.65)] transition-transform duration-100 ease-out will-change-transform"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
