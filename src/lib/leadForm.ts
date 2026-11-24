export function formatUaPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('380')) digits = digits.slice(3);
  else if (digits.startsWith('38') && value.trim().startsWith('+')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  if (!digits) return value.trim() ? '+380 ' : '';
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+380 ${groups.join(' ')}`;
}

export function isValidUaPhone(value: string): boolean {
  return /^\+?380\d{9}$/.test(value.replace(/[\s()-]/g, ''));
}
