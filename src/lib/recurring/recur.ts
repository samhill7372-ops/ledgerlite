/**
 * Recurrence engine (pure). There is no server cron: whenever the app opens,
 * materialize() turns every due occurrence since the rule's lastRun into a
 * regular Expense. Occurrence ids are DETERMINISTIC per (rule, date), so two
 * devices materializing the same month upsert the same row — no duplicates.
 */
import type { Expense, RecurringRule } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m1: number) => new Date(y, m1, 0).getDate(); // m1: 1..12

/** Same (rule, date) → same id on every device. Valid UUID shape: the rule id's last 12 hex chars become 0000YYYYMMDD. */
export function occurrenceId(ruleId: string, date: string): string {
  return ruleId.slice(0, 24) + '0000' + date.replace(/-/g, '');
}

/** Occurrence dates that are due: after lastRun (or from startDate), up to `today`, inclusive. */
export function dueDates(rule: RecurringRule, today: string): string[] {
  if (rule.paused || today < rule.startDate) return [];
  const out: string[] = [];
  let y = Number(rule.startDate.slice(0, 4)), m = Number(rule.startDate.slice(5, 7));
  const ty = Number(today.slice(0, 4)), tm = Number(today.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    const d = `${y}-${pad(m)}-${pad(Math.min(rule.dayOfMonth, daysIn(y, m)))}`;
    if (d >= rule.startDate && d <= today && (!rule.lastRun || d > rule.lastRun) && (!rule.endDate || d <= rule.endDate)) out.push(d);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export interface Materialized { expenses: Expense[]; rules: RecurringRule[]; changed: boolean }

/** Expand every rule's due occurrences into Expenses and advance lastRun. */
export function materialize(rules: RecurringRule[], today: string): Materialized {
  const expenses: Expense[] = [];
  let changed = false;
  const ts = new Date().toISOString();
  const out = rules.map((r) => {
    const due = dueDates(r, today);
    if (!due.length) return r;
    changed = true;
    for (const d of due) {
      expenses.push({
        id: occurrenceId(r.id, d), amount: r.amount, currency: r.currency, category: r.category,
        date: d, note: r.note, source: 'recurring', createdAt: ts, updatedAt: ts,
      });
    }
    return { ...r, lastRun: due[due.length - 1], updatedAt: ts };
  });
  return { expenses, rules: out, changed };
}
