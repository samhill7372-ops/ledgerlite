/**
 * Browser-only backend: encrypted localStorage, namespaced per user.
 * Lets Zone 3 run with no network. Also the shape of the future offline cache.
 */
import type { Budget, Expense, Profile, RecurringRule } from '@/types';
import type { BudgetRepo, ExpenseRepo, RecurringRepo, Repos } from './repo';
import type { AuthApi, Session } from '@/auth/api';
import { AuthError, toSession } from '@/auth/api';
import { saveSessionKey, loadSessionKey, clearSessionKeys } from '@/auth/keystore';
import { Vault } from '@/lib/crypto';
import { seedExpenses } from './seed';

const safe = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

class MockExpenseRepo implements ExpenseRepo {
  constructor(private vault: Vault, private key: string) {}
  async list(): Promise<Expense[]> {
    const raw = safe.get(this.key); if (!raw) return [];
    try { return await this.vault.decryptJSON<Expense[]>(raw); } catch { return []; }
  }
  async replaceAll(list: Expense[]) { safe.set(this.key, await this.vault.encryptJSON(list)); }
  async upsert(e: Expense) { const l = await this.list(); const i = l.findIndex((x) => x.id === e.id); if (i >= 0) l[i] = e; else l.push(e); await this.replaceAll(l); }
  async remove(id: string) { await this.replaceAll((await this.list()).filter((x) => x.id !== id)); }
}

class MockBudgetRepo implements BudgetRepo {
  constructor(private vault: Vault, private key: string) {}
  async get(): Promise<Budget | null> {
    const raw = safe.get(this.key); if (!raw) return null;
    try { return await this.vault.decryptJSON<Budget>(raw); } catch { return null; }
  }
  async set(b: Budget) { safe.set(this.key, await this.vault.encryptJSON(b)); }
}

class MockRecurringRepo implements RecurringRepo {
  constructor(private vault: Vault, private key: string) {}
  async list(): Promise<RecurringRule[]> {
    const raw = safe.get(this.key); if (!raw) return [];
    try { return await this.vault.decryptJSON<RecurringRule[]>(raw); } catch { return []; }
  }
  async saveAll(rules: RecurringRule[]) { safe.set(this.key, await this.vault.encryptJSON(rules)); }
}

const USERS = 'll.users.v1', SESSION = 'll.session.v1';

export class MockAuth implements AuthApi {
  constructor(private vault: Vault) {}
  private users(): Profile[] { try { return JSON.parse(safe.get(USERS) || '[]'); } catch { return []; } }
  private save(list: Profile[]) { safe.set(USERS, JSON.stringify(list)); }
  private async persistKey(userId: string) { const k = await this.vault.sessionKey(); if (k) await saveSessionKey(userId, k); }

  async restore(): Promise<Session | null> {
    const id = safe.get(SESSION); const u = id && this.users().find((x) => x.id === id);
    if (!u) return null;
    const k = await loadSessionKey(u.id);
    if (k) this.vault.unlockWithSessionKey(k);
    return toSession(u);
  }
  async signUp(name: string, email: string, password: string) {
    const list = this.users(); email = email.trim().toLowerCase();
    if (list.some((u) => u.email === email)) throw new AuthError('An account with this email already exists. Sign in instead.');
    const keys = await this.vault.createUserKeys(password);
    const p: Profile = { id: crypto.randomUUID(), name: name.trim(), email, byPassword: keys.byPassword, byRecovery: keys.byRecovery, createdAt: new Date().toISOString() };
    list.push(p); this.save(list); safe.set(SESSION, p.id); await this.persistKey(p.id);
    return { session: toSession(p), recoveryCode: keys.recoveryCode };
  }
  async signIn(email: string, password: string) {
    const u = this.users().find((x) => x.email === email.trim().toLowerCase());
    if (!u || !(await this.vault.unlock(u.byPassword, password))) throw new AuthError('Email or password is incorrect.');
    safe.set(SESSION, u.id); await this.persistKey(u.id); return toSession(u);
  }
  async recover(email: string, code: string, newPassword: string) {
    const list = this.users(); const u = list.find((x) => x.email === email.trim().toLowerCase());
    if (!u) throw new AuthError('No account found for this email.');
    if (!(await this.vault.unlockWithRecoveryCode(u.byRecovery, code))) throw new AuthError('Recovery code is incorrect.');
    u.byPassword = await this.vault.rewrap(newPassword); this.save(list); safe.set(SESSION, u.id); await this.persistKey(u.id); return toSession(u);
  }
  async signOut() { this.vault.lock(); await clearSessionKeys(); safe.del(SESSION); }
  async demo() {
    const list = this.users(); let d = list.find((x) => x.id === 'demo');
    if (!d) {
      const keys = await this.vault.createUserKeys('demo-pass');
      d = { id: 'demo', name: 'Demo User', email: 'demo@ledgerlite.app', byPassword: keys.byPassword, byRecovery: keys.byRecovery, createdAt: new Date().toISOString() };
      list.push(d); this.save(list);
      const repos = mockRepos(this.vault, d.id);
      await repos.expenses.replaceAll(seedExpenses());
      await repos.budgets.set({ total: 20000, cats: { Food: 4000, Groceries: 5000, Travel: 2000, Bills: 3000, Shopping: 3000, Health: 1500, Other: 1500 }, currency: 'INR' });
    } else await this.vault.unlock(d.byPassword, 'demo-pass');
    safe.set(SESSION, d.id); return toSession(d);
  }
}

export function mockRepos(vault: Vault, userId: string): Repos {
  return { expenses: new MockExpenseRepo(vault, `ll.${userId}.expenses.v1`), budgets: new MockBudgetRepo(vault, `ll.${userId}.budget.v1`), recurring: new MockRecurringRepo(vault, `ll.${userId}.recurring.v1`) };
}
