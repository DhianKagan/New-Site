import type { Deal } from '../src/types.ts';

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

export function hasTelegramToken(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendDealToTelegram(deal: Deal): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { sent: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured' };
  }

  const header =
    deal.type === 'order'
      ? `<b>Нове замовлення з кошика · ${escapeHtml(deal.dealNumber)}</b>`
      : `<b>Нова інженерна заявка · ${escapeHtml(deal.dealNumber)}</b>`;

  const lines: string[] = [
    header,
    `Тема: ${escapeHtml(deal.topic)}`,
    `Клієнт: ${escapeHtml(deal.customerName)}`,
    `Телефон: <code>${escapeHtml(deal.phone)}</code>`,
    `Локація: ${escapeHtml(deal.city)}`,
    `Канал зв'язку: ${escapeHtml(deal.channel)}`,
  ];

  if (deal.loads.length > 0) {
    lines.push(`Критичні прилади: ${escapeHtml(deal.loads.join(', '))}`);
  }
  if (deal.items.length > 0) {
    lines.push('');
    lines.push('<b>Позиції кошика:</b>');
    for (const item of deal.items) {
      lines.push(`• ${escapeHtml(item.title)} (${item.qty} шт × $${item.price})`);
    }
  }
  if (deal.totalUsd > 0) {
    lines.push(`Сума: <b>$${deal.totalUsd.toLocaleString('en-US')}</b>`);
  }
  if (deal.notes) {
    lines.push(`Коментар: ${escapeHtml(deal.notes)}`);
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { sent: false, error: `Telegram API ${resp.status}: ${text}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendTelegramText(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken?: string,
): Promise<{ ok: boolean; description?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: 'Не задано TELEGRAM_BOT_TOKEN у змінних оточення' };
  }
  const cleanSecret = (secretToken ?? process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
        ...(cleanSecret ? { secret_token: cleanSecret } : {}),
      }),
    });
    const data = (await resp.json()) as { ok?: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      return { ok: false, error: data.description || `Telegram API ${resp.status}` };
    }
    return { ok: true, description: data.description || 'Webhook встановлено' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Помилка мережі' };
  }
}

export async function getTelegramWebhookInfo(): Promise<{
  configured: boolean;
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { configured: false, url: '', pendingUpdateCount: 0, lastErrorMessage: '' };
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await resp.json()) as {
      ok?: boolean;
      result?: { url?: string; pending_update_count?: number; last_error_message?: string };
    };
    if (!resp.ok || !data.ok || !data.result) {
      return { configured: true, url: '', pendingUpdateCount: 0, lastErrorMessage: '' };
    }
    return {
      configured: true,
      url: String(data.result.url ?? ''),
      pendingUpdateCount: Number(data.result.pending_update_count ?? 0),
      lastErrorMessage: String(data.result.last_error_message ?? ''),
    };
  } catch {
    return { configured: true, url: '', pendingUpdateCount: 0, lastErrorMessage: '' };
  }
}

