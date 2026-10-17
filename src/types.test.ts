import { describe, it, expect } from 'vitest';
import { CATEGORIES, allCategories } from './types';

describe('allCategories', () => {
  it('returns the built-ins when there are no custom categories', () => {
    expect(allCategories()).toEqual([...CATEGORIES]);
    expect(allCategories({ customCats: [] })).toEqual([...CATEGORIES]);
  });
  it('appends custom categories after the built-ins, keeping order', () => {
    expect(allCategories({ customCats: ['Rent', 'Pets'] })).toEqual([...CATEGORIES, 'Rent', 'Pets']);
  });
  it('dedupes against built-ins and itself, case-insensitively', () => {
    expect(allCategories({ customCats: ['food', 'Rent', 'RENT'] })).toEqual([...CATEGORIES, 'Rent']);
  });
});
