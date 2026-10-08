export const CATEGORIES = ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Health', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

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
