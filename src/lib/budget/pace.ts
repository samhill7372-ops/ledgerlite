import type { Budget, Category, Expense } from '@/types';
import { daysInMonth, monthKey, monthKeyOf } from '@/lib/dates';
import { round2 } from '@/lib/money';

export type PaceStatus = 'none' | 'on-track' | 'over-pace' | 'over-budget';

export interface PaceResult {
  spent: number;
  total: number;            // budget total (0 = none)
  ratio: number;            // spent/total, 0 when no budget
  projected: number;        // spent/day * daysInMonth
  remaining: number;        // total - spent (may be negative)
  daysLeft: number;
  safePerDay: number;       // remaining / daysLeft, 0 if none
  status: PaceStatus;
}

export function monthExpenses(expenses: Expense[], now = new Date()): Expense[] {
  const k = monthKey(now);
  return expenses.filter((e) => monthKeyOf(e.date) === k);
}

export function byCategory(expenses: Expense[]): Record<Category, number> {
  const out: Record<Category, number> = {};
  for (const e of expenses) out[e.category] = round2((out[e.category] ?? 0) + Number(e.amount));
  return out;
}

export function monthlyTotals(expenses: Expense[]): Record<string, { total: number; count: number }> {
  const out: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    const k = monthKeyOf(e.date);
    out[k] = out[k] ?? { total: 0, count: 0 };
    out[k].total = round2(out[k].total + Number(e.amount));
    out[k].count += 1;
  }
  return out;
}

export function computePace(expenses: Expense[], budget: Budget, now = new Date()): PaceResult {
  const spent = round2(monthExpenses(expenses, now).reduce((a, e) => a + Number(e.amount), 0));
  const total = Number(budget.total) || 0;
  const dim = daysInMonth(now), day = now.getDate(), daysLeft = dim - day;
  const projected = round2((spent / day) * dim);
  if (total <= 0) return { spent, total, ratio: 0, projected, remaining: 0, daysLeft, safePerDay: 0, status: 'none' };
  const ratio = spent / total;
  const remaining = round2(total - spent);
  const safePerDay = daysLeft > 0 ? round2(Math.max(0, remaining) / daysLeft) : 0;
  const status: PaceStatus = ratio >= 1 ? 'over-budget' : projected > total ? 'over-pace' : 'on-track';
  return { spent, total, ratio, projected, remaining, daysLeft, safePerDay, status };
}
