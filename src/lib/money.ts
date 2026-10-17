import type { Currency } from '@/types';

export type Region = 'Asia' | 'Europe' | 'North America' | 'Other';
export interface CurrencyInfo { code: Currency; symbol: string; label: string; region: Region }

const C = (code: string, symbol: string, name: string, region: Region): CurrencyInfo =>
  ({ code, symbol, label: `${code} ${symbol.trim() && symbol !== code + ' ' ? symbol + ' ' : ''}— ${name}`, region });

/** Supported currencies, grouped by region (most-used first within each). */
export const CURRENCIES: CurrencyInfo[] = [
  // Asia
  C('INR', '₹', 'Indian Rupee', 'Asia'),
  C('AED', 'د.إ', 'UAE Dirham', 'Asia'),
  C('SGD', '$', 'Singapore Dollar', 'Asia'),
  C('JPY', '¥', 'Japanese Yen', 'Asia'),
  C('CNY', '¥', 'Chinese Yuan', 'Asia'),
  C('HKD', '$', 'Hong Kong Dollar', 'Asia'),
  C('KRW', '₩', 'South Korean Won', 'Asia'),
  C('TWD', 'NT$', 'New Taiwan Dollar', 'Asia'),
  C('THB', '฿', 'Thai Baht', 'Asia'),
  C('MYR', 'RM', 'Malaysian Ringgit', 'Asia'),
  C('IDR', 'Rp', 'Indonesian Rupiah', 'Asia'),
  C('PHP', '₱', 'Philippine Peso', 'Asia'),
  C('VND', '₫', 'Vietnamese Dong', 'Asia'),
  C('SAR', '﷼', 'Saudi Riyal', 'Asia'),
  C('QAR', 'QR', 'Qatari Riyal', 'Asia'),
  C('KWD', 'KD', 'Kuwaiti Dinar', 'Asia'),
  C('BHD', 'BD', 'Bahraini Dinar', 'Asia'),
  C('OMR', 'OMR ', 'Omani Rial', 'Asia'),
  C('JOD', 'JD', 'Jordanian Dinar', 'Asia'),
  C('ILS', '₪', 'Israeli Shekel', 'Asia'),
  C('PKR', '₨', 'Pakistani Rupee', 'Asia'),
  C('BDT', '৳', 'Bangladeshi Taka', 'Asia'),
  C('LKR', 'Rs', 'Sri Lankan Rupee', 'Asia'),
  C('NPR', '₨', 'Nepalese Rupee', 'Asia'),
  C('BTN', 'Nu.', 'Bhutanese Ngultrum', 'Asia'),
  C('MVR', 'Rf', 'Maldivian Rufiyaa', 'Asia'),
  C('MMK', 'K', 'Myanmar Kyat', 'Asia'),
  C('KHR', '៛', 'Cambodian Riel', 'Asia'),
  C('LAK', '₭', 'Lao Kip', 'Asia'),
  C('BND', '$', 'Brunei Dollar', 'Asia'),
  C('MOP', 'MOP ', 'Macanese Pataca', 'Asia'),
  C('MNT', '₮', 'Mongolian Tögrög', 'Asia'),
  C('KZT', '₸', 'Kazakhstani Tenge', 'Asia'),
  C('UZS', 'UZS ', 'Uzbekistani Som', 'Asia'),
  C('KGS', 'KGS ', 'Kyrgyzstani Som', 'Asia'),
  C('TJS', 'TJS ', 'Tajikistani Somoni', 'Asia'),
  C('TMT', 'TMT ', 'Turkmenistani Manat', 'Asia'),
  C('AFN', '؋', 'Afghan Afghani', 'Asia'),
  C('IQD', 'IQD ', 'Iraqi Dinar', 'Asia'),
  C('IRR', 'IRR ', 'Iranian Rial', 'Asia'),
  C('LBP', 'LBP ', 'Lebanese Pound', 'Asia'),
  C('YER', 'YER ', 'Yemeni Rial', 'Asia'),
  C('GEL', '₾', 'Georgian Lari', 'Asia'),
  C('AMD', '֏', 'Armenian Dram', 'Asia'),
  C('AZN', '₼', 'Azerbaijani Manat', 'Asia'),
  // Europe
  C('EUR', '€', 'Euro', 'Europe'),
  C('GBP', '£', 'British Pound', 'Europe'),
  C('CHF', 'CHF ', 'Swiss Franc', 'Europe'),
  C('TRY', '₺', 'Turkish Lira', 'Europe'),
  C('SEK', 'kr', 'Swedish Krona', 'Europe'),
  C('NOK', 'kr', 'Norwegian Krone', 'Europe'),
  C('DKK', 'kr', 'Danish Krone', 'Europe'),
  C('ISK', 'kr', 'Icelandic Króna', 'Europe'),
  C('PLN', 'zł', 'Polish Złoty', 'Europe'),
  C('CZK', 'Kč', 'Czech Koruna', 'Europe'),
  C('HUF', 'Ft', 'Hungarian Forint', 'Europe'),
  C('RON', 'lei', 'Romanian Leu', 'Europe'),
  C('BGN', 'лв', 'Bulgarian Lev', 'Europe'),
  C('RSD', 'RSD ', 'Serbian Dinar', 'Europe'),
  C('BAM', 'KM', 'Bosnian Mark', 'Europe'),
  C('MKD', 'MKD ', 'Macedonian Denar', 'Europe'),
  C('ALL', 'L', 'Albanian Lek', 'Europe'),
  C('MDL', 'MDL ', 'Moldovan Leu', 'Europe'),
  C('UAH', '₴', 'Ukrainian Hryvnia', 'Europe'),
  C('BYN', 'Br', 'Belarusian Ruble', 'Europe'),
  C('RUB', '₽', 'Russian Ruble', 'Europe'),
  // North America
  C('USD', '$', 'US Dollar', 'North America'),
  C('CAD', '$', 'Canadian Dollar', 'North America'),
  C('MXN', '$', 'Mexican Peso', 'North America'),
  C('GTQ', 'Q', 'Guatemalan Quetzal', 'North America'),
  C('CRC', '₡', 'Costa Rican Colón', 'North America'),
  C('PAB', 'B/.', 'Panamanian Balboa', 'North America'),
  C('HNL', 'L', 'Honduran Lempira', 'North America'),
  C('NIO', 'C$', 'Nicaraguan Córdoba', 'North America'),
  C('BZD', '$', 'Belize Dollar', 'North America'),
  C('DOP', '$', 'Dominican Peso', 'North America'),
  C('JMD', '$', 'Jamaican Dollar', 'North America'),
  C('TTD', '$', 'Trinidad & Tobago Dollar', 'North America'),
  C('BBD', '$', 'Barbadian Dollar', 'North America'),
  C('BSD', '$', 'Bahamian Dollar', 'North America'),
  C('HTG', 'G', 'Haitian Gourde', 'North America'),
  C('XCD', '$', 'East Caribbean Dollar', 'North America'),
  C('CUP', '$', 'Cuban Peso', 'North America'),
  // Other (kept from the earlier list so existing data keeps formatting)
  C('AUD', '$', 'Australian Dollar', 'Other'),
];

export const REGIONS: Region[] = ['Asia', 'Europe', 'North America', 'Other'];

export const SYMBOL = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol])) as Record<Currency, string>;
export const CURRENCY_CODES = new Set<string>(CURRENCIES.map((c) => c.code));

/** INR groups by lakh/crore; everything else by thousands. */
const LOCALE: Partial<Record<Currency, string>> = { INR: 'en-IN' };
/** Currencies written without decimals in daily use. */
const NO_DECIMALS = new Set<Currency>(['JPY', 'KRW', 'VND', 'IDR', 'LAK', 'MMK', 'HUF', 'ISK']);

/** App-wide home currency; set from the user's (encrypted) preference on sign-in. */
let home: Currency = 'INR';
export function setHomeCurrency(c: Currency) { home = c; }
export function homeCurrency(): Currency { return home; }

/** Guess a sensible default from the browser locale's region. */
export function guessCurrency(locale?: string): Currency {
  const loc = locale ?? (typeof navigator !== 'undefined' ? navigator.language : '') ?? '';
  const region = (loc.split('-')[1] ?? '').toUpperCase();
  const EUR = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
  if (EUR.includes(region)) return 'EUR';
  const map: Record<string, Currency> = {
    IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', MX: 'MXN', AU: 'AUD', NZ: 'AUD',
    AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', IL: 'ILS',
    SG: 'SGD', JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', TH: 'THB', MY: 'MYR',
    ID: 'IDR', PH: 'PHP', VN: 'VND', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', MM: 'MMK',
    KH: 'KHR', LA: 'LAK', BN: 'BND', MO: 'MOP', MN: 'MNT', KZ: 'KZT', UZ: 'UZS', KG: 'KGS',
    TJ: 'TJS', TM: 'TMT', AF: 'AFN', IQ: 'IQD', IR: 'IRR', LB: 'LBP', YE: 'YER', GE: 'GEL',
    AM: 'AMD', AZ: 'AZN', TR: 'TRY', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK',
    PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD', BA: 'BAM', MK: 'MKD',
    AL: 'ALL', MD: 'MDL', UA: 'UAH', BY: 'BYN', RU: 'RUB', GT: 'GTQ', CR: 'CRC', PA: 'PAB',
    HN: 'HNL', NI: 'NIO', BZ: 'BZD', DO: 'DOP', JM: 'JMD', TT: 'TTD', BB: 'BBD', BS: 'BSD', HT: 'HTG', CU: 'CUP',
  };
  return map[region] ?? 'USD';
}

export function fmt(n: number, c: Currency = home): string {
  const digits = NO_DECIMALS.has(c) ? 0 : 2;
  const sym = SYMBOL[c] ?? c + ' ';
  return sym + Number(n).toLocaleString(LOCALE[c] ?? 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(list: { amount: number }[]): number {
  return round2(list.reduce((a, e) => a + Number(e.amount), 0));
}
