export interface ExtractedFields { vendor: string; date: string | null; total: number | null }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function numbersIn(line: string): number[] {
  const m = line.match(/(?:rs\.?|₹|inr|\$|€)?\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+\.\d{2}/gi) || [];
  return m.map((s) => parseFloat(s.replace(/[^\d.]/g, ''))).filter((n) => !isNaN(n) && n > 0 && n < 10_000_000);
}

const TOTAL_RE = /(grand\s*total|net\s*(amount|payable)|amount\s*(due|payable)|total|balance\s*due|to\s*pay)/i;
const NOT_TOTAL_RE = /sub\s*-?total|total\s*(qty|items|quantity)/i;

/** Largest amount on a "total"-like line; else the largest number anywhere. */
export function extractTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let total: number | null = null;
  for (const l of lines) {
    if (TOTAL_RE.test(l) && !NOT_TOTAL_RE.test(l)) {
      const n = numbersIn(l);
      if (n.length) total = Math.max(total ?? 0, ...n);
    }
  }
  if (total == null) {
    const all = lines.flatMap(numbersIn);
    if (all.length) total = Math.max(...all);
  }
  return total;
}

/** First recognisable date → YYYY-MM-DD. Handles d/m/y, y-m-d, "12 Sep 2026". */
export function extractDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
  }
  const dmy = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    let d = +dmy[1], m = +dmy[2], y = +dmy[3];
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) [d, m] = [m, d];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
  }
  const named = text.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{4})/i);
  if (named) {
    const m = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    return `${named[3]}-${pad(m)}-${pad(+named[1])}`;
  }
  return null;
}

const NOISE_RE = /invoice|receipt|bill|tax|gst|date|tel|phone|www|\.com/i;

/** First line that looks like a name rather than boilerplate. */
export function extractVendor(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const v = lines.find((l) => /[a-z]{3,}/i.test(l) && !NOISE_RE.test(l) && l.replace(/[^a-z]/gi, '').length >= 3) || '';
  return v.slice(0, 60);
}

export function extractFields(text: string): ExtractedFields {
  return { vendor: extractVendor(text), date: extractDate(text), total: extractTotal(text) };
}
