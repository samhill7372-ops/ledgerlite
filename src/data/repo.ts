/**
 * Contract B — the only data interfaces the frontend may import.
 * Implementations: mockRepo.ts (browser-only) and supabaseRepo.ts.
 * Every implementation receives plaintext objects and is responsible for
 * encrypting before persisting and decrypting after loading, via the Vault.
 */
import type { Budget, Expense, RecurringRule, Space, SpaceMember } from '@/types';

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

export interface RecurringRepo {
  list(): Promise<RecurringRule[]>;
  saveAll(rules: RecurringRule[]): Promise<void>;
}

/**
 * Shared spaces. The implementation encrypts/decrypts with the SPACE key via
 * the Vault; callers must have registered it (invite link or unwrap) first,
 * except mine(), which unwraps stored keys itself.
 */
export interface SpaceRepo {
  /** Create the space + my membership. The vault must already hold `rawKey` under space.id. */
  create(space: Space, rawKey: string, myName: string): Promise<void>;
  /** Join with the key from an invite link (registers membership + wrapped key). */
  join(spaceId: string, rawKey: string, myName: string): Promise<void>;
  /** My spaces; unwraps each stored space key into the vault and decrypts names. */
  mine(): Promise<Space[]>;
  members(spaceId: string): Promise<SpaceMember[]>;
  leave(spaceId: string): Promise<void>;
  listExpenses(spaceId: string): Promise<Expense[]>;
  upsertExpense(e: Expense): Promise<void>;   // requires e.spaceId
  removeExpense(spaceId: string, id: string): Promise<void>;
}

export interface Repos { expenses: ExpenseRepo; budgets: BudgetRepo; recurring: RecurringRepo; spaces: SpaceRepo }
