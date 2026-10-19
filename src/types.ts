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

/** ISO 4217 code. The supported list (symbols, labels, regions) lives in src/lib/money.ts (CURRENCIES). */
export type Currency = string;

/** Who paid and what each member owes for a shared-space expense. */
export interface SplitInfo {
  paidBy: string;                   // userId of the payer
  shares: Record<string, number>;   // userId → owed amount (sums to the expense amount)
}

export interface Expense {
  id: string;
  amount: number;          // major units, 2dp
  currency: Currency;
  category: Category;
  date: string;            // YYYY-MM-DD
  note: string;            // vendor / note
  source: 'manual' | 'receipt' | 'recurring';
  ocrRawText?: string;
  /** Set when the expense lives in a shared space (payload encrypted with the space key). */
  spaceId?: string;
  split?: SplitInfo;
  /** A settle-up payment: `from` paid `to` this amount in real life. */
  settlement?: { from: string; to: string };
  createdAt: string;       // ISO timestamp
  updatedAt: string;
}

/** A shared ledger (family or trip). Name lives encrypted in the space meta. */
export interface Space { id: string; name: string }
export interface SpaceMember { userId: string; name: string }

export interface Budget {
  total: number;                              // 0 = not set
  cats: Partial<Record<Category, number>>;
  /** User-defined category names (encrypted with the rest of the blob). */
  customCats?: string[];
  /** The user's home currency: budgets, totals and new expenses use it. Unset = not chosen yet. */
  currency?: Currency;
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

/** A monthly repeating expense (rent, EMI, subscription). Stored encrypted. */
export interface RecurringRule {
  id: string;
  amount: number;
  currency: Currency;
  category: Category;
  note: string;            // e.g. "Rent", "Netflix"
  dayOfMonth: number;      // 1..31, clamped to the month's length
  startDate: string;       // YYYY-MM-DD; first occurrence is in this month
  endDate?: string;        // optional last date an occurrence may fall on
  paused?: boolean;
  lastRun?: string;        // date of the last materialized occurrence
  createdAt: string;
  updatedAt: string;
}

export type AlertLevel = 'warn' | 'bad';
export interface Alert { level: AlertLevel; message: string; category?: Category }
