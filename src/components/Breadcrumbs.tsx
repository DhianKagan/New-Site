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
    <div className="relative z-10 bg-gradient-to-r from-[#062347]/88 via-[#0c3f7a]/82 to-[#062347]/88 backdrop-blur-xl border-b border-sky-300/20">
      <nav
        aria-label={tr('Хлібні крихти', 'Навигационная цепочка')}
        className="ec-container py-2.5"
      >
        <ol
          itemScope
          itemType="https://schema.org/BreadcrumbList"
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-[13px] text-sky-100/90"
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
                    className="w-3.5 h-3.5 text-sky-300/65 shrink-0"
                    aria-hidden="true"
                  />
                )}

                {item.isCurrent ? (
                  <span
                    aria-current="page"
                    itemProp="name"
                    title={item.label}
                    className="inline-flex items-center gap-1.5 font-bold text-white truncate max-w-[260px] sm:max-w-[460px]"
                  >
                    {isHome && <Home className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                ) : (
                  <a
                    href={item.href}
                    itemProp="item"
                    onClick={(e) => handleClick(e, item)}
                    className="inline-flex items-center gap-1.5 font-semibold text-sky-200 hover:text-white hover:underline rounded-sm py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
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
