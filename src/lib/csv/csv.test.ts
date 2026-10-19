import { describe, it, expect } from 'vitest';
import type { Expense } from '@/types';
import { CATEGORIES } from '@/types';
import { toCsv, parseCsv, importCsv, importGrid } from './csv';

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

describe('importGrid (bank statements)', () => {
  it('skips preamble rows and finds the real header', () => {
    const grid = [
      ['HDFC Bank — Account Statement'],
      ['Account No: XX8019', '', ''],
      [''],
      ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
      ['10/10/26', 'UPI-OXYGEN FUELS', '2,500.00', '', '12,345.00'],
      ['12/10/26', 'SALARY CREDIT', '', '50,000.00', '62,345.00'],
      ['13/10/26', 'SWIGGY', '540.00', '', '61,805.00'],
    ];
    const r = importGrid(grid, CATS, 'INR');
    // Only debits (withdrawals) become expenses; the salary credit is skipped.
    expect(r.rows).toEqual([
      { date: '2026-10-10', amount: 2500, note: 'UPI-OXYGEN FUELS', category: 'Other', currency: 'INR' },
      { date: '2026-10-13', amount: 540, note: 'SWIGGY', category: 'Other', currency: 'INR' },
    ]);
    expect(r.skipped).toBe(1);
  });
  it('matches amount headers by substring and prefers debit over a generic column', () => {
    const grid = [['Txn Date', 'Description', 'Debit', 'Credit'], ['01-10-2026', 'ATM', '1000', '']];
    expect(importGrid(grid, CATS, 'INR').rows[0]).toEqual({ date: '2026-10-01', amount: 1000, note: 'ATM', category: 'Other', currency: 'INR' });
  });
  it('tolerates numeric cells from a spreadsheet', () => {
    const grid = [['Date', 'Amount', 'Note'], ['2026-10-01', 250.5, 'Lunch']];
    expect(importGrid(grid, CATS, 'INR').rows[0].amount).toBe(250.5);
  });
});
