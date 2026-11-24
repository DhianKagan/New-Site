export function formatUahFromUsd(amountUsd: number, usdUahRate: number | null): string {
  if (!usdUahRate || !Number.isFinite(usdUahRate)) return 'Курс завантажується…';
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(Math.round(amountUsd * usdUahRate));
}
