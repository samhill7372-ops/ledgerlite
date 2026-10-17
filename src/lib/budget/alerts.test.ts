import { describe, it, expect } from 'vitest';
import type { Budget, Expense } from '@/types';
import { buildAlerts, afterAddMessage } from './alerts';

const NOW = new Date('2026-10-15T12:00:00');
function exp(amount: number, category: string, date = '2026-10-10'): Expense {
  return { id: crypto.randomUUID(), amount, currency: 'INR', category, date, note: '', source: 'manual', createdAt: date, updatedAt: date };
}

describe('buildAlerts with category limits', () => {
  it('alerts on a built-in category over its limit', () => {
    const budget: Budget = { total: 0, cats: { Food: 100 } };
    const alerts = buildAlerts([exp(120, 'Food')], budget, NOW);
    expect(alerts).toEqual([{ level: 'bad', category: 'Food', message: expect.stringContaining('Food is over its') }]);
  });
  it('alerts on a CUSTOM category over its limit', () => {
    const budget: Budget = { total: 0, cats: { Rent: 15000 }, customCats: ['Rent'] };
    const alerts = buildAlerts([exp(16000, 'Rent')], budget, NOW);
    expect(alerts).toEqual([{ level: 'bad', category: 'Rent', message: expect.stringContaining('Rent is over its') }]);
  });
  it('warns at 80% of a custom limit', () => {
    const budget: Budget = { total: 0, cats: { Pets: 1000 }, customCats: ['Pets'] };
    const alerts = buildAlerts([exp(850, 'Pets')], budget, NOW);
    expect(alerts).toEqual([{ level: 'warn', category: 'Pets', message: expect.stringContaining('85%') }]);
  });
  it('ignores categories without limits', () => {
    expect(buildAlerts([exp(99999, 'Gadgets')], { total: 0, cats: {}, customCats: ['Gadgets'] }, NOW)).toEqual([]);
  });
});

describe('afterAddMessage', () => {
  it('reports a custom category going over its limit', () => {
    const budget: Budget = { total: 0, cats: { Rent: 15000 }, customCats: ['Rent'] };
    const e = exp(16000, 'Rent');
    expect(afterAddMessage([e], budget, e, NOW)).toBe('Added. Rent is over its limit');
  });
});
