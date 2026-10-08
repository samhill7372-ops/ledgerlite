import type { Expense } from '@/types';
import { toISODate } from '@/lib/dates';

/** Example rows for the demo account only. Every note ends in "– example". */
export function seedExpenses(now = new Date()): Expense[] {
  const iso = (off: number) => { const d = new Date(now); d.setDate(d.getDate() - off); return toISODate(d); };
  const ts = now.toISOString();
  const row = (id: string, amount: number, category: Expense['category'], off: number, note: string, source: Expense['source'] = 'manual'): Expense =>
    ({ id, amount, currency: 'INR', category, date: iso(off), note: `${note} – example`, source, createdAt: ts, updatedAt: ts });
  return [
    row('ex1', 180, 'Food', 0, 'Lunch'), row('ex2', 1240, 'Groceries', 1, 'Weekly groceries', 'receipt'),
    row('ex3', 60, 'Travel', 1, 'Metro'), row('ex4', 899, 'Bills', 3, 'Broadband'),
    row('ex5', 450, 'Health', 5, 'Pharmacy', 'receipt'), row('ex6', 2300, 'Shopping', 8, 'Shoes'),
    row('ex7', 899, 'Bills', 33, 'Broadband'), row('ex8', 3400, 'Groceries', 36, 'Monthly groceries', 'receipt'),
    row('ex9', 1250, 'Food', 40, 'Dinner out'), row('ex10', 780, 'Travel', 44, 'Cab'),
    row('ex11', 899, 'Bills', 63, 'Broadband'), row('ex12', 5600, 'Shopping', 70, 'Festival shopping', 'receipt'),
    row('ex13', 2100, 'Groceries', 75, 'Groceries'),
  ];
}
