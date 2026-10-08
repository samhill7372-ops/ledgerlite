import { describe, it, expect } from 'vitest';
import { computePace, monthlyTotals, byCategory } from './pace';
import { buildAlerts, afterAddMessage } from './alerts';
import type { Expense, Budget } from '@/types';

const now = new Date(2026, 9, 10); // 10 Oct 2026 (31-day month)
const ex = (amount: number, date: string, category: Expense['category'] = 'Food'): Expense => ({
  id: date + amount, amount, currency: 'INR', category, date, note: '', source: 'manual', createdAt: '', updatedAt: '',
});

describe('computePace', () => {
  it('projects to month end and flags over-pace', () => {
    const p = computePace([ex(5000, '2026-10-05'), ex(3000, '2026-10-09')], { total: 20000, cats: {} }, now);
    expect(p.spent).toBe(8000);
    expect(p.projected).toBe(24800);          // 8000/10*31
    expect(p.status).toBe('over-pace');
    expect(p.daysLeft).toBe(21);
    expect(p.safePerDay).toBeCloseTo(571.43, 2);
  });
  it('on-track when projection fits', () => {
    expect(computePace([ex(2000, '2026-10-05')], { total: 20000, cats: {} }, now).status).toBe('on-track');
  });
  it('over-budget when spent exceeds total', () => {
    expect(computePace([ex(21000, '2026-10-05')], { total: 20000, cats: {} }, now).status).toBe('over-budget');
  });
  it('none when no budget', () => {
    expect(computePace([ex(100, '2026-10-05')], { total: 0, cats: {} }, now).status).toBe('none');
  });
  it('ignores other months', () => {
    expect(computePace([ex(999, '2026-09-30')], { total: 1000, cats: {} }, now).spent).toBe(0);
  });
});

describe('aggregations', () => {
  it('groups by month and category', () => {
    const list = [ex(100, '2026-10-01', 'Food'), ex(50, '2026-10-02', 'Travel'), ex(70, '2026-09-20', 'Food')];
    expect(monthlyTotals(list)).toEqual({ '2026-10': { total: 150, count: 2 }, '2026-09': { total: 70, count: 1 } });
    expect(byCategory(list)).toEqual({ Food: 170, Travel: 50 });
  });
});

describe('alerts', () => {
  const budget: Budget = { total: 10000, cats: { Food: 2000 } };
  it('emits a category alert and an 80% warning', () => {
    const list = [ex(1700, '2026-10-03', 'Food'), ex(6800, '2026-10-04', 'Bills')];
    const a = buildAlerts(list, budget, now);
    expect(a.some((x) => x.message.includes('85% of your budget'))).toBe(true);
    expect(a.find((x) => x.category === 'Food')?.level).toBe('warn');
  });
  it('afterAddMessage escalates correctly', () => {
    const added = ex(2500, '2026-10-05', 'Food');
    expect(afterAddMessage([added], budget, added, now)).toBe('Added. Food is over its limit');
    expect(afterAddMessage([ex(100, '2026-10-05', 'Travel')], budget, ex(100, '2026-10-05', 'Travel'), now)).toBe('Added ₹100');
  });
});
