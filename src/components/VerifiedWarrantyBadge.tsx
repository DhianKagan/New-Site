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
        className={`rounded-xl border border-emerald-300/25 bg-emerald-400/10 backdrop-blur-sm p-3 text-left ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-300/30 text-emerald-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white leading-snug">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" aria-hidden="true" />
              <span>{heading}</span>
            </div>
            <p className="text-[11px] text-sky-100/80 leading-relaxed mt-1">
              {description}
            </p>
            {warrantyHref && (
              <a
                href={warrantyHref}
                onClick={onWarrantyClick}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200 hover:text-white underline underline-offset-2 decoration-emerald-300/45 mt-1.5 transition-colors"
              >
                <span>{tr('Умови гарантії та сервісу', 'Условия гарантии и сервиса')}</span>
                <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="verified-warranty-badge"
      data-variant="product"
      className={`rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/85 via-white to-sky-50/55 p-3 text-left ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white shadow-[0_3px_10px_rgba(5,150,105,0.22)] flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0d1f33] leading-snug">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{heading}</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
