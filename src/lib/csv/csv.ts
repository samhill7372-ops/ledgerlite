/**
 * CSV export/import (pure). Export writes our canonical columns; import is
 * forgiving about other apps' files: it finds columns by header name, reads
 * DD/MM/YYYY and YYYY-MM-DD dates, strips currency symbols and thousands
 * separators, and skips rows it cannot understand rather than failing.
 */
import type { Category, Currency, Expense } from '@/types';
import { CURRENCIES, round2 } from '@/lib/money';

const CODES = new Set<string>(CURRENCIES.map((c) => c.code));

const pad = (n: number) => String(n).padStart(2, '0');
const q = (s: string) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);

export function toCsv(expenses: Expense[]): string {
  const rows = [['date', 'amount', 'currency', 'category', 'note', 'source'],
    ...expenses.map((e) => [e.date, String(e.amount), e.currency, e.category, e.note || '', e.source])];
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

/** Minimal quote-aware CSV parser (handles "a,b", "" escapes, \r\n). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

function parseDate(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const mo = +m[2], d = +m[3]; return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${m[1]}-${pad(mo)}-${pad(d)}` : null; }
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // it was MM/DD
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

function parseAmount(s: string): number | null {
  const cleaned = s.trim().replace(/^\((.*)\)$/, '-$1').replace(/[₹$€£\s,]/g, '');
  const v = Math.abs(parseFloat(cleaned));
  return Number.isFinite(v) && v > 0 ? round2(v) : null;
}

const HEADERS = {
  date: ['date', 'txn date', 'transaction date', 'posted date', 'value date'],
  amount: ['amount', 'amt', 'debit', 'value', 'price', 'amount (inr)', 'withdrawal'],
  note: ['note', 'notes', 'description', 'desc', 'vendor', 'narration', 'details', 'payee', 'merchant', 'remarks', 'particulars'],
  category: ['category', 'cat', 'type', 'tag'],
  currency: ['currency', 'cur', 'ccy'],
};

function findCol(header: string[], names: string[]): number {
  const h = header.map((x) => x.trim().toLowerCase());
  for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
  return -1;
}

export interface ImportedRow { date: string; amount: number; note: string; category: Category; currency: Currency }
export interface ImportResult { rows: ImportedRow[]; skipped: number; error?: string }

/** Map arbitrary CSV text to expense rows. `categories` = the user's full category list. */
export function importCsv(text: string, categories: string[], defaultCurrency: Currency = 'INR'): ImportResult {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], skipped: 0, error: 'The file has no data rows.' };
  const header = grid[0];
  const ci = {
    date: findCol(header, HEADERS.date), amount: findCol(header, HEADERS.amount),
    note: findCol(header, HEADERS.note), category: findCol(header, HEADERS.category), currency: findCol(header, HEADERS.currency),
  };
  if (ci.date < 0 || ci.amount < 0) return { rows: [], skipped: 0, error: 'Could not find "date" and "amount" columns in the header row.' };
  const catByLower = new Map(categories.map((c) => [c.toLowerCase(), c]));
  const rows: ImportedRow[] = []; let skipped = 0;
  for (const r of grid.slice(1)) {
    const date = parseDate(r[ci.date] ?? ''); const amount = parseAmount(r[ci.amount] ?? '');
    if (!date || amount == null) { skipped++; continue; }
    const rawCat = ci.category >= 0 ? (r[ci.category] ?? '').trim().toLowerCase() : '';
    const rawCur = ci.currency >= 0 ? (r[ci.currency] ?? '').trim().toUpperCase() : '';
    rows.push({
      date, amount,
      note: ci.note >= 0 ? (r[ci.note] ?? '').trim().slice(0, 80) : '',
      category: catByLower.get(rawCat) ?? 'Other',
      currency: (CODES.has(rawCur) ? rawCur : defaultCurrency) as Currency,
    });
  }
  return { rows, skipped };
}
