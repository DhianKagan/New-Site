import type { ReactNode } from 'react';
import type { SocialLinksConfig } from '../types.ts';

interface SocialIconsProps {
  links: SocialLinksConfig;
  variant?: 'header' | 'footer' | 'light';
}

function safeHref(url: string): string | null {
  const val = url.trim();
  if (!val) return null;
  try {
    const parsed = new URL(val);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function SocialIcons({ links, variant = 'header' }: SocialIconsProps) {
  const items: Array<{
    key: keyof SocialLinksConfig;
    label: string;
    href: string | null;
    icon: ReactNode;
  }> = [
    {
      key: 'telegram',
      label: 'Telegram',
      href: safeHref(links.telegram),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M21.9 4.4 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L7.1 12.9l-4.5-1.4c-1-.3-1-.9.2-1.4L20.5 3.3c.8-.3 1.6.2 1.4 1.1Z" />
        </svg>
      ),
    },
    {
      key: 'viber',
      label: 'Viber',
      href: safeHref(links.viber),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M12 2C6.8 2 2.5 5.8 2.5 10.7c0 2.9 1.5 5.5 3.8 7.1V22l3.8-2.1c.6.1 1.2.2 1.9.2 5.2 0 9.5-3.8 9.5-8.7S17.2 2 12 2Zm3.9 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4-.1.6.4.2.6.8 1.9.8 2 .1.2.1.4 0 .6-.1.2-.2.3-.3.5-.2.2-.3.4-.5.5-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 2 .9.8 1.8 1.1 2.1 1.3.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.2.5.2.6.4.1.2.1.8-.1 1.4Z" />
        </svg>
      ),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      href: safeHref(links.instagram),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      href: safeHref(links.facebook),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.2-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
        </svg>
      ),
    },
    {
      key: 'youtube',
      label: 'YouTube',
      href: safeHref(links.youtube),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8l5.4 3.2-5.4 3.2Z" />
        </svg>
      ),
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      href: safeHref(links.tiktok),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M19.3 6.6a4.8 4.8 0 0 1-3.3-3.4V3h-3.1v12.1a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.4a5.7 5.7 0 0 0-.8-.1A5.7 5.7 0 1 0 16 15V8.9a7.8 7.8 0 0 0 4.5 1.4V7.2c-.4 0-.8-.2-1.2-.6Z" />
        </svg>
      ),
    },
  ];

  const active = items.filter((item) => Boolean(item.href));
  if (active.length === 0) return null;

  const btnClass =
    variant === 'header'
      ? 'w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white inline-flex items-center justify-center transition-colors'
      : variant === 'footer'
        ? 'w-8 h-8 rounded-lg bg-white/10 hover:bg-[#1769aa] text-slate-200 hover:text-white inline-flex items-center justify-center transition-colors'
        : 'w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0d1f33] inline-flex items-center justify-center transition-colors';

  return (
    <div className="flex items-center gap-1.5" aria-label="Соціальні мережі">
      {active.map((item) => (
        <a
          key={item.key}
          href={item.href!}
          target="_blank"
          rel="noopener noreferrer"
          title={item.label}
          aria-label={item.label}
          className={btnClass}
        >
          {item.icon}
        </a>
      ))}
    </div>
  );
}
