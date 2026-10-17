import type { Alert, Budget, Expense } from '@/types';
import { fmt } from '@/lib/money';
import { byCategory, computePace, monthExpenses } from './pace';

export const WARN_RATIO = 0.8;

/** Rules in priority order. The first 'bad' alert is what Home shows. */
export function buildAlerts(expenses: Expense[], budget: Budget, now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const p = computePace(expenses, budget, now);
  if (p.status === 'over-budget') {
    alerts.push({ level: 'bad', message: `You have exceeded this month's budget by ${fmt(p.spent - p.total)}.` });
  } else if (p.status === 'over-pace') {
    alerts.push({ level: 'warn', message: `At the current pace you will end the month around ${fmt(p.projected)}, above your ${fmt(p.total)} budget. Keep daily spending under ${fmt(p.safePerDay)} to stay on track.` });
  }
  if (p.total > 0 && p.ratio >= WARN_RATIO && p.ratio < 1) {
    alerts.push({ level: 'warn', message: `You have used ${Math.round(p.ratio * 100)}% of your budget with ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left.` });
  }
  const cats = byCategory(monthExpenses(expenses, now));
  for (const c of Object.keys(budget.cats)) { // every category with a limit, custom included
    const limit = budget.cats[c]; const v = cats[c] ?? 0;
    if (!limit || limit <= 0) continue;
    if (v >= limit) alerts.push({ level: 'bad', category: c, message: `${c} is over its ${fmt(limit)} limit (${fmt(v)} spent).` });
    else if (v >= limit * WARN_RATIO) alerts.push({ level: 'warn', category: c, message: `${c} has used ${Math.round((v / limit) * 100)}% of its ${fmt(limit)} limit.` });
  }
  return alerts;
}

/** Toast text after adding an expense. */
export function afterAddMessage(expenses: Expense[], budget: Budget, added: Expense, now = new Date()): string {
  const p = computePace(expenses, budget, now);
  const cats = byCategory(monthExpenses(expenses, now));
  const limit = budget.cats[added.category];
  if (p.total > 0 && p.spent > p.total) return `Added. Monthly budget exceeded by ${fmt(p.spent - p.total)}`;
  if (limit && (cats[added.category] ?? 0) > limit) return `Added. ${added.category} is over its limit`;
  if (p.total > 0 && p.ratio >= WARN_RATIO) return `Added. ${Math.round(p.ratio * 100)}% of budget used`;
  return `Added ${fmt(added.amount, added.currency)}`;
}
