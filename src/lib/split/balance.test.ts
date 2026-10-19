import { describe, it, expect } from 'vitest';
import type { Expense, SplitInfo } from '@/types';
import { equalShares, computeNet, simplifyDebts } from './balance';

const E = (amount: number, split?: SplitInfo, settlement?: { from: string; to: string }): Expense =>
  ({ id: String(Math.random()), amount, currency: 'INR', category: 'Other', date: '2026-10-18', note: '', source: 'manual', split, settlement, createdAt: '', updatedAt: '' });

describe('equalShares', () => {
  it('splits evenly when it divides', () => {
    expect(equalShares(6000, ['a', 'b', 'c'])).toEqual({ a: 2000, b: 2000, c: 2000 });
  });
  it('distributes the leftover paisa deterministically and sums exactly', () => {
    const s = equalShares(100, ['a', 'b', 'c']);
    expect(s).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
    expect(Math.round(Object.values(s).reduce((x, y) => x + y, 0) * 100)).toBe(10000);
  });
  it('handles one member and empty lists', () => {
    expect(equalShares(99.99, ['a'])).toEqual({ a: 99.99 });
    expect(equalShares(10, [])).toEqual({});
  });
});

describe('computeNet', () => {
  it('nets out the Goa-trip example', () => {
    const exps = [
      E(6000, { paidBy: 'you', shares: equalShares(6000, ['you', 'rahul', 'priya']) }),
      E(1500, { paidBy: 'rahul', shares: equalShares(1500, ['you', 'rahul', 'priya']) }),
      E(300, { paidBy: 'priya', shares: equalShares(300, ['you', 'priya']) }),
    ];
    const net = computeNet(exps);
    expect(net.you).toBe(3350);     // paid 6000, owes 2000+500+150
    expect(net.rahul).toBe(-1000);  // paid 1500, owes 2000+500
    expect(net.priya).toBe(-2350);  // paid 300, owes 2000+500+150
    expect(Math.round((net.you + net.rahul + net.priya) * 100)).toBe(0); // always zero-sum
  });
  it('applies settlements and ignores personal expenses', () => {
    const net = computeNet([
      E(1000, { paidBy: 'a', shares: equalShares(1000, ['a', 'b']) }),
      E(500, undefined, { from: 'b', to: 'a' }),
      E(999), // personal, no split info
    ]);
    expect(net).toEqual({ a: 0, b: 0 });
  });
});

describe('simplifyDebts', () => {
  it('settles everyone with the fewest payments', () => {
    const t = simplifyDebts({ you: 3350, rahul: -1000, priya: -2350 });
    expect(t).toEqual([
      { from: 'priya', to: 'you', amount: 2350 },
      { from: 'rahul', to: 'you', amount: 1000 },
    ]);
  });
  it('chains debts instead of pairwise webs', () => {
    // a is owed 100, c owes 100, b is flat after both its deals
    const t = simplifyDebts({ a: 100, b: 0, c: -100 });
    expect(t).toEqual([{ from: 'c', to: 'a', amount: 100 }]);
  });
  it('ignores sub-paisa dust and empty nets', () => {
    expect(simplifyDebts({ a: 0.003, b: -0.003 })).toEqual([]);
    expect(simplifyDebts({})).toEqual([]);
  });
});
