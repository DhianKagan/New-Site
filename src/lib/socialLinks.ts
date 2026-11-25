import type { SocialLinksConfig } from '../types.ts';

export type SocialChannelKey = keyof SocialLinksConfig;

export interface SocialChannelMeta {
  key: SocialChannelKey;
  label: string;
  placeholder: string;
  hintUk: string;
  hintRu: string;
  featured?: boolean;
}

export const SOCIAL_CHANNELS: SocialChannelMeta[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/energocomfort.shop',
    hintUk: 'Повне посилання або @username',
    hintRu: 'Полная ссылка или @username',
    featured: true,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@energocomfort',
    hintUk: 'Посилання на канал або @handle',
    hintRu: 'Ссылка на канал или @handle',
    featured: true,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@energocomfort',
    hintUk: 'Посилання на профіль або @username',
    hintRu: 'Ссылка на профиль или @username',
    featured: true,
  },
  {
    key: 'viber',
    label: 'Viber',
    placeholder: 'https://invite.viber.com/... або +380507777172',
    hintUk: 'https://invite.viber.com/..., viber://chat?number=... або номер +380...',
    hintRu: 'https://invite.viber.com/..., viber://chat?number=... или номер +380...',
    featured: true,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    placeholder: 'https://t.me/energocomfort',
    hintUk: 'Канал, бот або менеджер (https://t.me/... чи @username)',
    hintRu: 'Канал, бот или менеджер (https://t.me/... или @username)',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/energocomfort.shop',
    hintUk: 'Сторінка компанії у Facebook',
    hintRu: 'Страница компании в Facebook',
  },
];

const VIBER_DEEP_LINK_RE = /^viber:\/\/(chat|pa|add|public|forward|contact)(?:[/?#]|$)/i;

function normalizeViberPhoneInput(raw: string): string | null {
  if (!/^[\d\s()+-]{7,20}$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  let e164: string | null = null;
  if (/^0\d{9}$/.test(digits)) {
    e164 = `+38${digits}`;
  } else if (/^380\d{9}$/.test(digits)) {
    e164 = `+${digits}`;
  } else if (digits.length >= 9 && digits.length <= 15) {
    e164 = `+${digits}`;
  }
  if (!e164) return null;
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}

export function normalizeSocialUrl(key: SocialChannelKey, raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  // Keep explicit schemes intact for strict validation (so unsafe schemes fail validation rather than getting prefixed)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (key === 'viber') {
    const viberFromPhone = normalizeViberPhoneInput(trimmed);
    if (viberFromPhone) return viberFromPhone;
  }

  if (/^@[a-zA-Z0-9._-]{2,80}$/.test(trimmed)) {
    const handle = trimmed.slice(1);
    switch (key) {
      case 'instagram':
        return `https://www.instagram.com/${handle}`;
      case 'youtube':
        return `https://www.youtube.com/@${handle}`;
      case 'tiktok':
        return `https://www.tiktok.com/@${handle}`;
      case 'telegram':
        return `https://t.me/${handle}`;
      case 'facebook':
        return `https://www.facebook.com/${handle}`;
      default:
        break;
    }
  }

  if (!/\s/.test(trimmed) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function safeSocialHref(raw: string, key?: SocialChannelKey): string | null {
  const normalized = key ? normalizeSocialUrl(key, raw) : String(raw || '').trim();
  if (!normalized) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(normalized)) return null;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      const host = parsed.hostname;
      if (!host || !host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
        return null;
      }
      return parsed.toString();
    }
    if (key === 'viber' && parsed.protocol === 'viber:') {
      if (VIBER_DEEP_LINK_RE.test(normalized) && !/(?:javascript|data|vbscript):/i.test(normalized)) {
        return normalized;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidSocialUrl(key: SocialChannelKey, raw: string): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  return safeSocialHref(trimmed, key) !== null;
}

export function normalizeSocialLinksConfig(links: Partial<SocialLinksConfig>): SocialLinksConfig {
  return {
    telegram: normalizeSocialUrl('telegram', links.telegram ?? ''),
    viber: normalizeSocialUrl('viber', links.viber ?? ''),
    instagram: normalizeSocialUrl('instagram', links.instagram ?? ''),
    facebook: normalizeSocialUrl('facebook', links.facebook ?? ''),
    youtube: normalizeSocialUrl('youtube', links.youtube ?? ''),
    tiktok: normalizeSocialUrl('tiktok', links.tiktok ?? ''),
  };
}
