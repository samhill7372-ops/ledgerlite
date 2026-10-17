/**
 * Real backend. Rows are encrypted with the Vault before upsert; the server
 * only ever stores `payload` ciphertext. RLS (see supabase/migrations) makes
 * sure a user can only touch their own rows.
 */
import type { Budget, Expense, Profile, RecurringRule, WrappedKey } from '@/types';
import type { BudgetRepo, ExpenseRepo, RecurringRepo, Repos } from './repo';
import type { AuthApi, Session } from '@/auth/api';
import { AuthError } from '@/auth/api';
import { saveSessionKey, loadSessionKey, clearSessionKeys } from '@/auth/keystore';
import { Vault } from '@/lib/crypto';
import { supabase } from './supabase';

class SbExpenseRepo implements ExpenseRepo {
  constructor(private vault: Vault, private userId: string) {}
  async list(): Promise<Expense[]> {
    const { data, error } = await supabase().from('expenses').select('id,payload').eq('user_id', this.userId).is('deleted_at', null);
    if (error) throw error;
    const out: Expense[] = [];
    for (const r of data ?? []) { try { out.push(await this.vault.decryptJSON<Expense>(r.payload)); } catch { /* skip undecryptable */ } }
    return out;
  }
  async upsert(e: Expense) {
    const payload = await this.vault.encryptJSON(e);
    const { error } = await supabase().from('expenses').upsert({ id: e.id, user_id: this.userId, payload, deleted_at: null });
    if (error) throw error;
  }
  async remove(id: string) {
    const { error } = await supabase().from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', this.userId);
    if (error) throw error;
  }
  async replaceAll(list: Expense[]) {
    const { error: delErr } = await supabase().from('expenses').delete().eq('user_id', this.userId);
    if (delErr) throw delErr;
    if (!list.length) return;
    const rows = await Promise.all(list.map(async (e) => ({ id: e.id, user_id: this.userId, payload: await this.vault.encryptJSON(e) })));
    const { error } = await supabase().from('expenses').insert(rows);
    if (error) throw error;
  }
}

class SbBudgetRepo implements BudgetRepo {
  constructor(private vault: Vault, private userId: string) {}
  async get(): Promise<Budget | null> {
    const { data, error } = await supabase().from('budgets').select('payload').eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    try { return await this.vault.decryptJSON<Budget>(data.payload); } catch { return null; }
  }
  async set(b: Budget) {
    const { error } = await supabase().from('budgets').upsert({ user_id: this.userId, payload: await this.vault.encryptJSON(b) });
    if (error) throw error;
  }
}

class SbRecurringRepo implements RecurringRepo {
  constructor(private vault: Vault, private userId: string) {}
  async list(): Promise<RecurringRule[]> {
    const { data, error } = await supabase().from('recurring').select('payload').eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    if (!data) return [];
    try { return await this.vault.decryptJSON<RecurringRule[]>(data.payload); } catch { return []; }
  }
  async saveAll(rules: RecurringRule[]) {
    const { error } = await supabase().from('recurring').upsert({ user_id: this.userId, payload: await this.vault.encryptJSON(rules) });
    if (error) throw error;
  }
}

export class SupabaseAuth implements AuthApi {
  constructor(private vault: Vault) {}

  /** Stay unlocked on this device: store the non-extractable session key. */
  private async persistKey(userId: string) {
    const k = await this.vault.sessionKey();
    if (k) await saveSessionKey(userId, k);
  }

  private async profile(userId: string): Promise<Profile> {
    const { data, error } = await supabase().from('profiles').select('*').eq('id', userId).single();
    if (error || !data) throw new AuthError('Profile not found.');
    return { id: data.id, name: data.name, email: '', byPassword: data.by_password as WrappedKey, byRecovery: data.by_recovery as WrappedKey, createdAt: data.created_at };
  }

  async restore(): Promise<Session | null> {
    const { data } = await supabase().auth.getSession();
    const u = data.session?.user; if (!u) return null;
    const p = await this.profile(u.id);
    const k = await loadSessionKey(u.id);
    if (k) this.vault.unlockWithSessionKey(k); // stays unlocked on this device
    return { userId: u.id, email: u.email ?? '', name: p.name };
  }

  async signUp(name: string, email: string, password: string) {
    const keys = await this.vault.createUserKeys(password);
    const { data, error } = await supabase().auth.signUp({ email, password });
    if (error || !data.user) throw new AuthError(error?.message ?? 'Sign-up failed.');
    const { error: pErr } = await supabase().from('profiles').insert({ id: data.user.id, name, by_password: keys.byPassword, by_recovery: keys.byRecovery });
    if (pErr) throw new AuthError(pErr.message);
    await this.persistKey(data.user.id);
    return { session: { userId: data.user.id, email, name }, recoveryCode: keys.recoveryCode };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new AuthError('Email or password is incorrect.');
    const p = await this.profile(data.user.id);
    if (!(await this.vault.unlock(p.byPassword, password))) throw new AuthError('Could not unlock your data with this password.');
    await this.persistKey(data.user.id);
    return { userId: data.user.id, email, name: p.name };
  }

  /**
   * Recovery needs two steps with Supabase Auth: (1) the auth password is reset via
   * the normal email link (supabase.auth.resetPasswordForEmail), then (2) once
   * signed in, this method unwraps the DEK with the recovery code and re-wraps
   * it with the new password. The UI must call resetPasswordForEmail first.
   */
  async recover(_email: string, recoveryCode: string, newPassword: string) {
    const { data } = await supabase().auth.getUser();
    if (!data.user) throw new AuthError('Open the password-reset link from your email first, then enter your recovery code.');
    const p = await this.profile(data.user.id);
    if (!(await this.vault.unlockWithRecoveryCode(p.byRecovery, recoveryCode))) throw new AuthError('Recovery code is incorrect.');
    const byPassword = await this.vault.rewrap(newPassword);
    const { error: aErr } = await supabase().auth.updateUser({ password: newPassword });
    if (aErr) throw new AuthError(aErr.message);
    const { error } = await supabase().from('profiles').update({ by_password: byPassword }).eq('id', data.user.id);
    if (error) throw new AuthError(error.message);
    await this.persistKey(data.user.id);
    return { userId: data.user.id, email: data.user.email ?? '', name: p.name };
  }

  async signOut() { this.vault.lock(); await clearSessionKeys(); await supabase().auth.signOut(); }
}

export function supabaseRepos(vault: Vault, userId: string): Repos {
  return { expenses: new SbExpenseRepo(vault, userId), budgets: new SbBudgetRepo(vault, userId), recurring: new SbRecurringRepo(vault, userId) };
}
