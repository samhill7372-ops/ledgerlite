import { describe, it, expect } from 'vitest';
import type { Expense } from '@/types';
import { CATEGORIES } from '@/types';
import { toCsv, parseCsv, importCsv } from './csv';

const CATS = [...CATEGORIES];

describe('toCsv / parseCsv round trip', () => {
  it('quotes commas and quotes correctly', () => {
    const e: Expense = { id: '1', amount: 250.5, currency: 'INR', category: 'Food', date: '2026-10-01', note: 'Lunch, "special" thali', source: 'manual', createdAt: '', updatedAt: '' };
    const grid = parseCsv(toCsv([e]));
    expect(grid[0]).toEqual(['date', 'amount', 'currency', 'category', 'note', 'source']);
    expect(grid[1]).toEqual(['2026-10-01', '250.5', 'INR', 'Food', 'Lunch, "special" thali', 'manual']);
  });
});

describe('importCsv', () => {
  it('imports our own export format', () => {
    const r = importCsv('date,amount,currency,category,note,source\n2026-10-01,250.5,INR,Food,Lunch,manual', CATS);
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([{ date: '2026-10-01', amount: 250.5, note: 'Lunch', category: 'Food', currency: 'INR' }]);
  });
  it('handles other apps: DD/MM/YYYY dates, ₹ and thousands separators, Description header', () => {
    const r = importCsv('Date,Description,Amount\n05/10/2026,Big Bazaar,"₹1,250.00"\n13/10/26,Auto,"85"', CATS);
    expect(r.rows).toEqual([
      { date: '2026-10-05', amount: 1250, note: 'Big Bazaar', category: 'Other', currency: 'INR' },
      { date: '2026-10-13', amount: 85, note: 'Auto', category: 'Other', currency: 'INR' },
    ]);
  });
  it('flips MM/DD when the day position is impossible', () => {
    const r = importCsv('date,amount\n10/25/2026,100', CATS);
    expect(r.rows[0].date).toBe('2026-10-25');
  });
  it('maps known categories case-insensitively, unknown to Other', () => {
    const r = importCsv('date,amount,category\n2026-10-01,10,food\n2026-10-02,20,Weird', CATS);
    expect(r.rows.map((x) => x.category)).toEqual(['Food', 'Other']);
  });
  it('skips bad rows and counts them; negative/parenthesised amounts become positive', () => {
    const r = importCsv('date,amount\nnot-a-date,50\n2026-10-01,zero\n2026-10-02,(75)', CATS);
    expect(r.skipped).toBe(2);
    expect(r.rows).toEqual([{ date: '2026-10-02', amount: 75, note: '', category: 'Other', currency: 'INR' }]);
  });
  it('errors clearly without date/amount headers or data', () => {
    expect(importCsv('foo,bar\n1,2', CATS).error).toMatch(/date.*amount/i);
    expect(importCsv('date,amount', CATS).error).toMatch(/no data/i);
  });
});
