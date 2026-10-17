/**
 * Bank/UPI SMS parser (pure). The user shares ONE message by choice; we pull
 * amount, vendor and date out of it ON THE DEVICE and throw the text away.
 * Nothing here stores or transmits the message. Formats are forgiving: the
 * result prefills the Add form, where the user can correct anything.
 */

export interface ParsedSms {
  amount: number | null;
  vendor: string;
  date: string | null;   // YYYY-MM-DD
  debit: boolean;        // false = looks like money received, not spent
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

function findAmount(t: string): number | null {
  // "Rs.540.00", "INR 1,234.56", "₹99", "Rs 2,500/-"
  const m = t.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(v) && v > 0 ? v : null;
}

function findDate(t: string): string | null {
  // 17-10-2026, 17/10/26
  let m = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (m) {
    const d = +m[1], mo = +m[2];
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(mo)}-${pad(d)}`;
  }
  // 17-Oct-26, 17 Oct 2026, 17Oct26
  m = t.match(/\b(\d{1,2})[- ]?([a-z]{3})[a-z]*[- ]?(\d{2,4})\b/i);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const d = +m[1];
    if (d >= 1 && d <= 31) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(d)}`;
  }
  return null;
}

function findVendor(t: string): string {
  // "... at SWIGGY on ...", "... to JOHN STORE via UPI", "... towards ELECTRICITY BILL."
  const m = t.match(/\b(?:at|to|towards|in favor of)[:\s]+([A-Za-z0-9&@*._'\- ]{2,40}?)(?=\s+(?:on|via|ref|refno|upi|a\/c|avl|bal|info|dt|dated|txn)\b|[.,;\n]|$)/i);
  if (!m) return '';
  const v = m[1].replace(/\s+/g, ' ').trim();
  // Drop pure account/card fragments like "A/c XX1234"
  if (/^(?:a\/c|ac|card|acct)\b/i.test(v) || /^[x*\d ]+$/i.test(v)) return '';
  return v;
}

export function parseSms(text: string): ParsedSms {
  const t = text.replace(/\s+/g, ' ').trim();
  const credit = /\b(?:credited|received|refund(?:ed)?|deposited|cashback)\b/i.test(t);
  const debitWord = /\b(?:debited|debit|spent|paid|payment|sent|purchase[d]?|withdrawn|txn|transaction)\b/i.test(t);
  return {
    amount: findAmount(t),
    vendor: findVendor(t),
    date: findDate(t),
    debit: debitWord || !credit,
  };
}
