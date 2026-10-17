import type { Currency } from '@/types';

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: 'INR', symbol: '₹', label: 'INR ₹ — Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'USD $ — US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR € — Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP £ — British Pound' },
  { code: 'CAD', symbol: '$', label: 'CAD $ — Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'AUD $ — Australian Dollar' },
  { code: 'SGD', symbol: '$', label: 'SGD $ — Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', label: 'AED — UAE Dirham' },
  { code: 'JPY', symbol: '¥', label: 'JPY ¥ — Japanese Yen' },
];

export const SYMBOL = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol])) as Record<Currency, string>;

/** INR groups by lakh/crore; everything else by thousands. */
const LOCALE: Partial<Record<Currency, string>> = { INR: 'en-IN' };

/** App-wide home currency; set from the user's (encrypted) preference on sign-in. */
let home: Currency = 'INR';
export function setHomeCurrency(c: Currency) { home = c; }
export function homeCurrency(): Currency { return home; }

/** Guess a sensible default from the browser locale's region. */
export function guessCurrency(locale?: string): Currency {
  const loc = locale ?? (typeof navigator !== 'undefined' ? navigator.language : '') ?? '';
  const region = (loc.split('-')[1] ?? '').toUpperCase();
  const map: Record<string, Currency> = {
    IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', SG: 'SGD', AE: 'AED', JP: 'JPY',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
  };
  return map[region] ?? 'USD';
}

export function fmt(n: number, c: Currency = home): string {
  const digits = c === 'JPY' ? 0 : 2;
  return SYMBOL[c] + Number(n).toLocaleString(LOCALE[c] ?? 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(list: { amount: number }[]): number {
  return round2(list.reduce((a, e) => a + Number(e.amount), 0));
}
