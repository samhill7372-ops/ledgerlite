import { describe, it, expect } from 'vitest';
import { extractFields, extractDate, extractTotal } from './extract';
import { guessCategory } from './categorize';

const RECEIPT = `
MEGHANA FOODS
Residency Road, Bengaluru
GSTIN: 29ABCDE1234F1Z5
Date: 12/09/2026  Time: 13:42
Chicken Biryani      1   320.00
Raita                1    40.00
Sub Total                360.00
CGST 2.5%                  9.00
SGST 2.5%                  9.00
Grand Total              378.00
Thank you, visit again
`;

describe('extractFields', () => {
  it('reads vendor, date and grand total from a typical Indian receipt', () => {
    const f = extractFields(RECEIPT);
    expect(f.vendor).toBe('MEGHANA FOODS');
    expect(f.date).toBe('2026-09-12');
    expect(f.total).toBe(378);
  });
  it('ignores sub total when a total line exists', () => {
    expect(extractTotal('Sub Total 999.00\nTotal 120.00')).toBe(120);
  });
  it('falls back to the largest number when no total line', () => {
    expect(extractTotal('Item 40.00\nItem 55.50')).toBe(55.5);
  });
  it('parses several date formats', () => {
    expect(extractDate('2026-10-08')).toBe('2026-10-08');
    expect(extractDate('08-10-26')).toBe('2026-10-08');
    expect(extractDate('8 Oct 2026')).toBe('2026-10-08');
    expect(extractDate('no date here')).toBeNull();
  });
});

describe('guessCategory', () => {
  it('maps keywords to categories', () => {
    expect(guessCategory(RECEIPT)).toBe('Food');
    expect(guessCategory('DMART invoice')).toBe('Groceries');
    expect(guessCategory('Namma Yatri ride')).toBe('Travel');
    expect(guessCategory('xyz')).toBe('Other');
  });
});
