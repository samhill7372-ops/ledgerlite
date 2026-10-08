import { describe, it, expect } from 'vitest';
import { inRange, lastNMonthKeys, monthLabel } from './dates';

const now = new Date(2026, 9, 10);
describe('dates', () => {
  it('range filters', () => {
    expect(inRange('2026-10-01', 'month', now)).toBe(true);
    expect(inRange('2026-09-30', 'month', now)).toBe(false);
    expect(inRange('2026-10-04', '7', now)).toBe(true);
    expect(inRange('2026-10-03', '7', now)).toBe(false);
    expect(inRange('2026-08-01', 'm:2026-08', now)).toBe(true);
    expect(inRange('2020-01-01', 'all', now)).toBe(true);
  });
  it('month keys and labels', () => {
    expect(lastNMonthKeys(3, now)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(monthLabel('2026-10')).toMatch(/Oct 2026/);
  });
});
