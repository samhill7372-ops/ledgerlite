/**
 * Contract B — the only data interfaces the frontend may import.
 * Implementations: mockRepo.ts (browser-only) and supabaseRepo.ts.
 * Every implementation receives plaintext objects and is responsible for
 * encrypting before persisting and decrypting after loading, via the Vault.
 */
import type { Budget, Expense } from '@/types';

export interface ExpenseRepo {
  list(): Promise<Expense[]>;
  upsert(expense: Expense): Promise<void>;
  remove(id: string): Promise<void>;
  /** Replace everything (used by reset / import). */
  replaceAll(expenses: Expense[]): Promise<void>;
}

export interface BudgetRepo {
  get(): Promise<Budget | null>;
  set(budget: Budget): Promise<void>;
}

export interface Repos { expenses: ExpenseRepo; budgets: BudgetRepo }
