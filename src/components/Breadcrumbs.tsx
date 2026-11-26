import type { MouseEvent } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { BreadcrumbItem } from '../lib/breadcrumbs.ts';
import { tr } from '../lib/i18n.ts';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  function handleClick(e: MouseEvent<HTMLAnchorElement>, item: BreadcrumbItem) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(item);
  }

  return (
    <div className="relative z-10 bg-white/78 backdrop-blur-xl border-b border-sky-200/60">
      <nav
        aria-label={tr('Хлібні крихти', 'Навигационная цепочка')}
        className="ec-container py-2.5"
      >
        <ol
          itemScope
          itemType="https://schema.org/BreadcrumbList"
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-[13px] text-[#1c3d5e]"
        >
          {items.map((item, index) => {
            const isHome = item.id === 'home';
            const position = index + 1;

            return (
              <li
                key={item.id}
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
                className="inline-flex items-center gap-1.5 min-w-0"
              >
                {index > 0 && (
                  <ChevronRight
                    className="w-3.5 h-3.5 text-[#0b66b2]/60 shrink-0"
                    aria-hidden="true"
                  />
                )}

                {item.isCurrent ? (
                  <span
                    aria-current="page"
                    itemProp="name"
                    title={item.label}
                    className="inline-flex items-center gap-1.5 font-bold text-[#07213e] truncate max-w-[260px] sm:max-w-[460px]"
                  >
                    {isHome && <Home className="w-3.5 h-3.5 text-[#0b66b2] shrink-0" aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                ) : (
                  <a
                    href={item.href}
                    itemProp="item"
                    onClick={(e) => handleClick(e, item)}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#0b66b2] hover:text-[#07213e] hover:underline rounded-sm py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b66b2]"
                  >
                    {isHome && <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    <span itemProp="name" className="truncate max-w-[200px] sm:max-w-[300px]">
                      {item.label}
                    </span>
                  </a>
                )}

                <meta itemProp="position" content={String(position)} />
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
