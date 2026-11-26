import { tr } from '../lib/i18n.ts';
import { cn } from '../lib/utils.ts';

function ShimmerBar({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ec-skeleton-shimmer rounded-md', className)} />;
}

export function ProductCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <article
      aria-hidden="true"
      data-skeleton="product-card"
      className={cn(
        'ec-glass-card rounded-2xl overflow-hidden h-full min-w-0 flex flex-col',
        className,
      )}
    >
      {/* Image stage matching h-52 w-full */}
      <div className="relative h-52 w-full bg-white/95 border-b border-sky-100 overflow-hidden flex items-center justify-center p-6">
        <ShimmerBar className="w-36 h-32 rounded-xl opacity-75" />
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <ShimmerBar className="w-9 h-9 rounded-lg" />
          <ShimmerBar className="w-9 h-9 rounded-lg" />
          <ShimmerBar className="w-9 h-9 rounded-lg" />
        </div>
      </div>

      {/* Body matching ProductCard vertical rhythm */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5 min-w-0">
        <div className="min-w-0">
          {/* Category · Brand · SKU line */}
          <div className="flex items-center gap-1.5 mb-2">
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-3 w-12" />
            <ShimmerBar className="h-3 w-16" />
          </div>

          {/* Title block matching min-h-[2.6rem] */}
          <div className="min-h-[2.6rem] space-y-2">
            <ShimmerBar className="h-4 w-full" />
            <ShimmerBar className="h-4 w-4/5" />
          </div>

          {/* 3 Spec rows matching min-h-[4.6rem] */}
          <div className="mt-3 pt-2.5 border-t border-sky-200/75 space-y-2 min-h-[4.6rem]">
            <div className="flex items-center justify-between gap-2">
              <ShimmerBar className="h-3 w-20" />
              <ShimmerBar className="h-3 w-16" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <ShimmerBar className="h-3 w-24" />
              <ShimmerBar className="h-3 w-14" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <ShimmerBar className="h-3 w-16" />
              <ShimmerBar className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* Footer matching price row + payback button */}
        <div className="pt-3 border-t border-sky-200/75 space-y-2.5">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <ShimmerBar className="h-3 w-16" />
              <ShimmerBar className="h-5 w-28" />
              <ShimmerBar className="h-3 w-24" />
            </div>
            <ShimmerBar className="h-9 w-24 rounded-lg shrink-0" />
          </div>
          <ShimmerBar className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </article>
  );
}

export function ShopCatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label={tr('Завантаження каталогу обладнання', 'Загрузка каталога оборудования')}>
      {/* Banner skeleton */}
      <section className="ec-banner">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2.5 max-w-2xl w-full">
            <ShimmerBar className="h-8 w-3/4 max-w-md rounded-lg" />
            <ShimmerBar className="h-4 w-full max-w-xl" />
            <ShimmerBar className="h-4 w-2/3 max-w-md" />
          </div>
          <ShimmerBar className="h-10 w-56 rounded-xl shrink-0" />
        </div>
      </section>

      <section className="ec-section ec-main-radial-bg">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8">
          {/* Category tabs skeleton */}
          <div className="ec-glass-plate flex flex-wrap gap-1.5 p-1.5 rounded-2xl mb-6 w-fit max-w-full">
            {[112, 128, 108, 120, 134, 126].map((width, idx) => (
              <ShimmerBar
                key={idx}
                className={`h-8 rounded-xl ${
                  width === 112
                    ? 'w-28'
                    : width === 128
                      ? 'w-32'
                      : width === 108
                        ? 'w-24'
                        : width === 120
                          ? 'w-28'
                          : width === 134
                            ? 'w-32'
                            : 'w-28'
                }`}
              />
            ))}
          </div>

          {/* Search, SKU, Brand, Sort, Stock row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-7">
            <ShimmerBar className="sm:col-span-2 lg:col-span-4 h-10 rounded-xl" />
            <ShimmerBar className="lg:col-span-2 h-10 rounded-xl" />
            <ShimmerBar className="lg:col-span-2 h-10 rounded-xl" />
            <ShimmerBar className="lg:col-span-2 h-10 rounded-xl" />
            <ShimmerBar className="lg:col-span-2 h-10 rounded-xl" />
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sticky sidebar filters skeleton */}
            <aside className="w-full lg:w-[240px] xl:w-[255px] shrink-0 ec-glass-plate rounded-2xl p-4 sm:p-5 space-y-5">
              <div className="space-y-2.5 pb-4 border-b border-sky-200/80">
                <ShimmerBar className="h-4 w-32 mb-3" />
                {[1, 2, 3, 4].map((row) => (
                  <ShimmerBar key={row} className="h-9 w-full rounded-xl" />
                ))}
              </div>
              <div className="space-y-2.5 pb-4 border-b border-sky-200/80">
                <ShimmerBar className="h-4 w-28 mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  <ShimmerBar className="h-9 rounded-xl" />
                  <ShimmerBar className="h-9 rounded-xl" />
                </div>
                <ShimmerBar className="h-2.5 w-full rounded-full mt-2" />
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <ShimmerBar className="h-7 rounded-lg" />
                  <ShimmerBar className="h-7 rounded-lg" />
                  <ShimmerBar className="h-7 rounded-lg" />
                  <ShimmerBar className="h-7 rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <ShimmerBar className="h-4 w-24 mb-2" />
                {[1, 2, 3].map((row) => (
                  <ShimmerBar key={row} className="h-9 w-full rounded-xl" />
                ))}
              </div>
            </aside>

            {/* Right results bar + 3-column ProductCardSkeleton grid */}
            <div className="flex-1 min-w-0 w-full">
              <div className="ec-glass-plate flex items-center justify-between gap-3 rounded-2xl px-5 py-3 mb-5">
                <ShimmerBar className="h-4 w-44" />
                <ShimmerBar className="h-4 w-28" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
                {Array.from({ length: count }, (_, idx) => (
                  <ProductCardSkeleton key={`shop-skeleton-${idx}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomeCatalogSkeleton() {
  return (
    <div aria-busy="true" aria-label={tr('Завантаження головної сторінки', 'Загрузка главной страницы')} className="ec-main-radial-bg">
      <section className="ec-banner">
        <div className="ec-container grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <ShimmerBar className="h-5 w-48 rounded-full" />
            <ShimmerBar className="h-10 w-full max-w-xl rounded-lg" />
            <ShimmerBar className="h-10 w-4/5 max-w-lg rounded-lg" />
            <ShimmerBar className="h-4 w-full max-w-lg" />
            <div className="flex flex-wrap gap-3 pt-2">
              <ShimmerBar className="h-11 w-44 rounded-xl" />
              <ShimmerBar className="h-11 w-40 rounded-xl" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="ec-glass-card rounded-2xl overflow-hidden">
              <ShimmerBar className="h-60 w-full rounded-none" />
              <div className="p-4 space-y-2">
                <ShimmerBar className="h-4 w-3/4" />
                <ShimmerBar className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ec-section">
        <div className="ec-container">
          <div className="ec-glass-plate rounded-2xl p-5 sm:p-6 mb-6 space-y-4">
            <ShimmerBar className="h-4 w-36" />
            <ShimmerBar className="h-7 w-80 max-w-full" />
            <div className="flex flex-wrap gap-2">
              <ShimmerBar className="h-9 w-44 rounded-lg" />
              <ShimmerBar className="h-9 w-40 rounded-lg" />
              <ShimmerBar className="h-9 w-48 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {[0, 1, 2].map((idx) => (
              <ProductCardSkeleton key={`home-skeleton-${idx}`} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ProjectsCatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label={tr('Завантаження проєктів', 'Загрузка проектов')}>
      <section className="ec-banner">
        <div className="ec-container space-y-2.5">
          <ShimmerBar className="h-8 w-3/4 max-w-xl rounded-lg" />
          <ShimmerBar className="h-4 w-2/3 max-w-lg" />
        </div>
      </section>

      <section className="ec-section ec-main-radial-bg">
        <div className="ec-container">
          <div className="inline-flex flex-wrap gap-1.5 p-1.5 ec-glass-plate rounded-2xl mb-6">
            <ShimmerBar className="h-9 w-32 rounded-xl" />
            <ShimmerBar className="h-9 w-28 rounded-xl" />
            <ShimmerBar className="h-9 w-40 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {Array.from({ length: count }, (_, idx) => (
              <article
                key={`project-skeleton-${idx}`}
                aria-hidden="true"
                data-skeleton="project-card"
                className="ec-glass-card rounded-2xl overflow-hidden h-full flex flex-col"
              >
                <ShimmerBar className="h-48 w-full rounded-none" />
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <ShimmerBar className="h-4 w-full" />
                    <ShimmerBar className="h-4 w-2/3" />
                    <ShimmerBar className="h-3 w-full mt-2" />
                    <ShimmerBar className="h-3 w-5/6" />
                  </div>
                  <div className="pt-3 border-t border-sky-200/75 flex items-center justify-between gap-2">
                    <ShimmerBar className="h-3 w-36" />
                    <ShimmerBar className="h-3 w-14" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CabinetOrdersSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={tr('Завантаження замовлень', 'Загрузка заказов')}>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={`order-skeleton-${idx}`}
          aria-hidden="true"
          data-skeleton="cabinet-order"
          className="rounded-xl bg-white border border-slate-200 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShimmerBar className="h-5 w-20 rounded-md" />
              <ShimmerBar className="h-4 w-28" />
            </div>
            <ShimmerBar className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <ShimmerBar className="w-8 h-8 rounded-md shrink-0" />
                <ShimmerBar className="h-3.5 w-3/4 max-w-xs" />
              </div>
              <ShimmerBar className="h-3.5 w-20" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <ShimmerBar className="h-3.5 w-24" />
            <ShimmerBar className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label={tr('Завантаження відгуків', 'Загрузка отзывов')}>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={`review-skeleton-${idx}`}
          aria-hidden="true"
          data-skeleton="review-card"
          className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShimmerBar className="w-6 h-6 rounded-full" />
              <ShimmerBar className="h-3.5 w-28" />
              <ShimmerBar className="h-3.5 w-20" />
            </div>
            <ShimmerBar className="h-3 w-20" />
          </div>
          <ShimmerBar className="h-3.5 w-full" />
          <ShimmerBar className="h-3.5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function GenericSectionSkeleton() {
  return (
    <div aria-busy="true" aria-label={tr('Завантаження розділу', 'Загрузка раздела')}>
      <section className="ec-banner">
        <div className="ec-container space-y-2.5">
          <ShimmerBar className="h-8 w-2/3 max-w-md rounded-lg" />
          <ShimmerBar className="h-4 w-full max-w-lg" />
        </div>
      </section>
      <section className="ec-section ec-main-radial-bg">
        <div className="ec-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="ec-glass-card rounded-2xl p-5 space-y-3">
                <ShimmerBar className="h-36 w-full rounded-xl" />
                <ShimmerBar className="h-5 w-3/4" />
                <ShimmerBar className="h-3.5 w-full" />
                <ShimmerBar className="h-3.5 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ViewRouteSkeleton({ view }: { view: string }) {
  if (view === 'shop') {
    return <ShopCatalogSkeleton count={6} />;
  }
  if (view === 'home') {
    return <HomeCatalogSkeleton />;
  }
  if (view === 'projects') {
    return <ProjectsCatalogSkeleton count={6} />;
  }
  if (view === 'account') {
    return (
      <div className="ec-section ec-main-radial-bg">
        <div className="ec-container max-w-4xl">
          <div className="ec-glass-plate rounded-2xl p-5 sm:p-6 space-y-4">
            <ShimmerBar className="h-7 w-56" />
            <CabinetOrdersSkeleton count={3} />
          </div>
        </div>
      </div>
    );
  }
  return <GenericSectionSkeleton />;
}
