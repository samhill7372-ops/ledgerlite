import { describe, it, expect } from 'vitest';
import type { RecurringRule } from '@/types';
import { dueDates, materialize, occurrenceId } from './recur';

function rule(over: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', amount: 15000, currency: 'INR', category: 'Bills',
    note: 'Rent', dayOfMonth: 1, startDate: '2026-08-01', createdAt: '', updatedAt: '', ...over,
  };
}

describe('dueDates', () => {
  it('returns every monthly occurrence from start to today, inclusive', () => {
    expect(dueDates(rule(), '2026-10-17')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });
  it('starts only from lastRun forward', () => {
    expect(dueDates(rule({ lastRun: '2026-09-01' }), '2026-10-17')).toEqual(['2026-10-01']);
    expect(dueDates(rule({ lastRun: '2026-10-01' }), '2026-10-17')).toEqual([]);
  });
  it('clamps day 31 to short months (incl. February)', () => {
    expect(dueDates(rule({ dayOfMonth: 31, startDate: '2026-01-31' }), '2026-04-30'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('respects paused, endDate, future start, and day not yet reached', () => {
    expect(dueDates(rule({ paused: true }), '2026-10-17')).toEqual([]);
    expect(dueDates(rule({ endDate: '2026-08-31' }), '2026-10-17')).toEqual(['2026-08-01']);
    expect(dueDates(rule({ startDate: '2026-11-01' }), '2026-10-17')).toEqual([]);
    expect(dueDates(rule({ dayOfMonth: 25, startDate: '2026-10-01' }), '2026-10-17')).toEqual([]);
  });
});

describe('materialize', () => {
  it('creates expenses with deterministic ids and advances lastRun', () => {
    const { expenses, rules, changed } = materialize([rule()], '2026-10-17');
    expect(changed).toBe(true);
    expect(expenses).toHaveLength(3);
    expect(expenses[0].id).toBe(occurrenceId(rule().id, '2026-08-01'));
    expect(expenses[0].id).toMatch(/^[0-9a-f-]{24}[0-9a-f]{12}$/i);
    expect(expenses.every((e) => e.source === 'recurring' && e.amount === 15000)).toBe(true);
    expect(rules[0].lastRun).toBe('2026-10-01');
  });
  it('is idempotent: a second run produces nothing new', () => {
    const first = materialize([rule()], '2026-10-17');
    const second = materialize(first.rules, '2026-10-17');
    expect(second.changed).toBe(false);
    expect(second.expenses).toEqual([]);
  });
  it('same rule and date give the same id on any device', () => {
    expect(occurrenceId(rule().id, '2026-10-01')).toBe(occurrenceId(rule().id, '2026-10-01'));
    expect(occurrenceId(rule().id, '2026-10-01')).not.toBe(occurrenceId(rule().id, '2026-11-01'));
  });
});
