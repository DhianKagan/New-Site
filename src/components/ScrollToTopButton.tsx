import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { tr } from '../lib/i18n.ts';

export interface ScrollToTopThresholdInput {
  scrollY: number;
  firstSectionBottom: number | null;
  viewportHeight: number;
  firstSectionHeight?: number | null;
}

export function shouldShowScrollToTop({
  scrollY,
  firstSectionBottom,
  viewportHeight,
  firstSectionHeight = null,
}: ScrollToTopThresholdInput): boolean {
  if (!Number.isFinite(scrollY) || !Number.isFinite(viewportHeight) || scrollY <= 80) {
    return false;
  }

  if (
    firstSectionBottom !== null &&
    Number.isFinite(firstSectionBottom) &&
    (firstSectionHeight === null || (Number.isFinite(firstSectionHeight) && firstSectionHeight > 20))
  ) {
    return firstSectionBottom <= 0;
  }

  const fallbackThreshold = Math.max(360, viewportHeight * 0.65);
  return scrollY > fallbackThreshold;
}

interface ScrollToTopButtonProps {
  routeKey: string;
  hidden?: boolean;
  hasCompareBar?: boolean;
  hasMobileStickyBar?: boolean;
}

export function ScrollToTopButton({
  routeKey,
  hidden = false,
  hasCompareBar = false,
  hasMobileStickyBar = false,
}: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hidden) {
      setVisible(false);
      return;
    }

    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const doc = document.documentElement;
      const scrollY = window.scrollY || doc.scrollTop || 0;
      const viewport = window.visualViewport;
      const keyboardOpen = Boolean(viewport && viewport.height < window.innerHeight * 0.72);
      if (keyboardOpen) {
        setVisible(false);
        return;
      }

      const firstSection = document.querySelector('main section');
      const rect = firstSection?.getBoundingClientRect() ?? null;
      const next = shouldShowScrollToTop({
        scrollY,
        firstSectionBottom: rect ? rect.bottom : null,
        firstSectionHeight: rect ? rect.height : null,
        viewportHeight: window.innerHeight,
      });

      setVisible((prev) => (prev === next ? prev : next));
    };

    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleMeasure);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(document.documentElement);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [routeKey, hidden]);

  if (hidden) {
    return null;
  }

  const label = tr('Повернутися вгору', 'Вернуться наверх');

  const bottomPositionClass = hasCompareBar
    ? 'bottom-32 md:bottom-24'
    : hasMobileStickyBar
      ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-6'
      : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6';

  const handleScrollToTop = () => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label={label}
      title={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`group fixed right-4 sm:right-6 z-30 ${bottomPositionClass} w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ec-glass-sapphire text-white inline-flex items-center justify-center transition-all duration-300 ease-out motion-reduce:transition-none hover:border-amber-300/75 hover:shadow-[0_14px_34px_rgba(4,18,40,0.45)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto cursor-pointer'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp
        className="w-5 h-5 text-sky-100 group-hover:text-amber-300 group-hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}
