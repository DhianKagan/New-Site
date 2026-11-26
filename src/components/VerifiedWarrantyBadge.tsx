import type { MouseEvent } from 'react';
import { BadgeCheck, ChevronRight, ShieldCheck } from 'lucide-react';
import { tr } from '../lib/i18n.ts';

export interface VerifiedWarrantyBadgeProps {
  variant?: 'product' | 'footer';
  brand?: string;
  warrantyHref?: string;
  onWarrantyClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

export function VerifiedWarrantyBadge({
  variant = 'product',
  brand,
  warrantyHref,
  onWarrantyClick,
  className = '',
}: VerifiedWarrantyBadgeProps) {
  const isFooter = variant === 'footer';
  const cleanBrand = brand?.trim();

  const heading = tr(
    'Підтверджена гарантія та підтримка',
    'Подтверждённая гарантия и поддержка',
  );

  const description = isFooter
    ? tr(
        'Energo Comfort забезпечує офіційну сервісну та гарантійну підтримку обладнання.',
        'Energo Comfort обеспечивает официальную сервисную и гарантийную поддержку оборудования.',
      )
    : cleanBrand
      ? tr(
          `Energo Comfort забезпечує офіційну підтримку обладнання ${cleanBrand}: гарантійний супровід, сервісну діагностику та перевірку сумісності.`,
          `Energo Comfort обеспечивает официальную поддержку оборудования ${cleanBrand}: гарантийное сопровождение, сервисную диагностику и проверку совместимости.`,
        )
      : tr(
          'Energo Comfort забезпечує офіційну гарантію виробника, сервісну діагностику та інженерну підтримку обладнання.',
          'Energo Comfort обеспечивает официальную гарантию производителя, сервисную диагностику и инженерную поддержку оборудования.',
        );

  if (isFooter) {
    return (
      <div
        data-testid="verified-warranty-badge"
        data-variant="footer"
        className={`rounded-xl border border-emerald-300/20 bg-emerald-400/[0.08] backdrop-blur-sm px-4 py-2.5 text-left ${className}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-300/25 text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-white tracking-tight">
                {heading}
              </span>
              <span className="hidden lg:inline text-sky-200/40 mx-2" aria-hidden="true">·</span>
              <span className="block lg:inline text-xs text-sky-100/80 leading-snug">
                {description}
              </span>
            </div>
          </div>
          {warrantyHref && (
            <a
              href={warrantyHref}
              onClick={onWarrantyClick}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200 hover:text-white underline underline-offset-2 decoration-emerald-300/45 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto pl-11 md:pl-0"
            >
              <span>{tr('Умови гарантії та сервісу', 'Условия гарантии и сервиса')}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="verified-warranty-badge"
      data-variant="product"
      className={`rounded-xl border border-emerald-200/85 bg-gradient-to-br from-emerald-50/75 via-white to-sky-50/45 px-3 py-2.5 text-left ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-emerald-600/12 border border-emerald-500/25 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <BadgeCheck className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-[#0d1f33] leading-snug">
            {heading}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
