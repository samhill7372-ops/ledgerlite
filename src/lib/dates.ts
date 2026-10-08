const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(now = new Date()): string { return toISODate(now); }
export function monthKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function monthKeyOf(iso: string): string { return iso.slice(0, 7); }
export function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
export function lastNMonthKeys(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}
export function monthLabel(key: string, locale = 'en-IN'): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, m - 1, 1)) + ' ' + y;
}

export type RangeKey = 'month' | '7' | '30' | 'all' | `m:${string}`;

export function inRange(dateISO: string, range: RangeKey, now = new Date()): boolean {
  if (range === 'all') return true;
  if (range === 'month') return monthKeyOf(dateISO) === monthKey(now);
  if (range.startsWith('m:')) return monthKeyOf(dateISO) === range.slice(2);
  const days = Number(range);
  const t = new Date(todayISO(now));
  const d = new Date(dateISO);
  const lim = new Date(t); lim.setDate(lim.getDate() - days + 1);
  return d >= lim && d <= t;
}
