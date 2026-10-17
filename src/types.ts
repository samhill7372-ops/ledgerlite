export const CATEGORIES = ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Health', 'Other'] as const;
export type BuiltinCategory = (typeof CATEGORIES)[number];
/** Built-in or user-defined (see Budget.customCats). */
export type Category = string;

/** Built-ins followed by the user's custom categories (deduped, order kept). */
export function allCategories(budget?: { customCats?: string[] }): Category[] {
  const out: Category[] = [...CATEGORIES];
  for (const c of budget?.customCats ?? []) if (!out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
  return out;
}

export type Currency = 'INR' | 'USD' | 'EUR' | 'CAD';

export interface Expense {
  id: string;
  amount: number;          // major units, 2dp
  currency: Currency;
  category: Category;
  date: string;            // YYYY-MM-DD
  note: string;            // vendor / note
  source: 'manual' | 'receipt';
  ocrRawText?: string;
  createdAt: string;       // ISO timestamp
  updatedAt: string;
}

export interface Budget {
  total: number;                              // 0 = not set
  cats: Partial<Record<Category, number>>;
  /** User-defined category names (encrypted with the rest of the blob). */
  customCats?: string[];
}

export interface WrappedKey { salt: string; iv: string; key: string }

export interface Profile {
  id: string;
  email: string;
  name: string;
  byPassword: WrappedKey;
  byRecovery: WrappedKey;
  createdAt: string;
}

export type AlertLevel = 'warn' | 'bad';
export interface Alert { level: AlertLevel; message: string; category?: Category }
