import type { Currency } from '@/types';

export const SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', CAD: '$' };

export function fmt(n: number, c: Currency = 'INR', locale = 'en-IN'): string {
  return SYMBOL[c] + Number(n).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(list: { amount: number }[]): number {
  return round2(list.reduce((a, e) => a + Number(e.amount), 0));
}
