/**
 * Real backend. Rows are encrypted with the Vault before upsert; the server
 * only ever stores `payload` ciphertext. RLS (see supabase/migrations) makes
 * sure a user can only touch their own rows.
 */
import type { Budget, Contact, Expense, PendingInvite, Profile, RecurringRule, Space, SpaceMember, WrappedKey } from '@/types';
import type { BudgetRepo, ExpenseRepo, RecurringRepo, SpaceRepo, Repos } from './repo';
import type { AuthApi, Session } from '@/auth/api';
import { AuthError } from '@/auth/api';
import { saveSessionKey, loadSessionKey, clearSessionKeys } from '@/auth/keystore';
import { Vault } from '@/lib/crypto';
import { supabase } from './supabase';

class SbExpenseRepo implements ExpenseRepo {
  constructor(private vault: Vault, private userId: string) {}
  async list(): Promise<Expense[]> {
    const { data, error } = await supabase().from('expenses').select('id,payload').eq('user_id', this.userId).is('space_id', null).is('deleted_at', null);
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
    const { error: delErr } = await supabase().from('expenses').delete().eq('user_id', this.userId).is('space_id', null);
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

class SbSpaceRepo implements SpaceRepo {
  constructor(private vault: Vault, private userId: string) {}

  async create(space: Space, rawKey: string, myName: string) {
    const meta = await this.vault.encryptJSONFor(space.id, { name: space.name });
    const { error } = await supabase().from('spaces').insert({ id: space.id, created_by: this.userId, meta });
    if (error) throw error;
    await this.join(space.id, rawKey, myName);
  }
  async join(spaceId: string, rawKey: string, myName: string) {
    await this.vault.addSpaceKey(spaceId, rawKey);
    const row = {
      space_id: spaceId, user_id: this.userId,
      wrapped_key: await this.vault.wrapSpaceKey(rawKey),
      profile: await this.vault.encryptJSONFor(spaceId, { name: myName }),
    };
    // Plain insert (return=minimal): an upsert would read the row back, but the
    // SELECT policy is is_space_member(), which this very row establishes. A
    // duplicate (23505 = already a member) is fine — the key is registered above.
    const { error } = await supabase().from('space_members').insert(row);
    if (error && error.code !== '23505') throw error;
  }
  async mine(): Promise<Space[]> {
    const { data, error } = await supabase().from('space_members').select('space_id,wrapped_key').eq('user_id', this.userId);
    if (error) throw error;
    const out: Space[] = [];
    for (const m of data ?? []) {
      try {
        await this.vault.unwrapSpaceKey(m.space_id, m.wrapped_key);
        const { data: s } = await supabase().from('spaces').select('meta').eq('id', m.space_id).single();
        if (!s) continue;
        out.push({ id: m.space_id, name: (await this.vault.decryptJSONFor<{ name: string }>(m.space_id, s.meta)).name });
      } catch { /* key or meta unreadable: skip */ }
    }
    return out;
  }
  async members(spaceId: string): Promise<SpaceMember[]> {
    const { data, error } = await supabase().from('space_members').select('user_id,profile').eq('space_id', spaceId);
    if (error) throw error;
    const out: SpaceMember[] = [];
    for (const m of data ?? []) {
      try { out.push({ userId: m.user_id, name: (await this.vault.decryptJSONFor<{ name: string }>(spaceId, m.profile)).name }); }
      catch { out.push({ userId: m.user_id, name: 'Member' }); }
    }
    return out;
  }
  async leave(spaceId: string) {
    const { error } = await supabase().from('space_members').delete().eq('space_id', spaceId).eq('user_id', this.userId);
    if (error) throw error;
    this.vault.dropSpaceKey(spaceId);
  }
  async listExpenses(spaceId: string): Promise<Expense[]> {
    const { data, error } = await supabase().from('expenses').select('payload').eq('space_id', spaceId).is('deleted_at', null);
    if (error) throw error;
    const out: Expense[] = [];
    for (const r of data ?? []) { try { out.push(await this.vault.decryptJSONFor<Expense>(spaceId, r.payload)); } catch { /* skip */ } }
    return out;
  }
  async upsertExpense(e: Expense) {
    if (!e.spaceId) throw new Error('upsertExpense needs spaceId');
    const payload = await this.vault.encryptJSONFor(e.spaceId, e);
    const { error } = await supabase().from('expenses').upsert({ id: e.id, user_id: this.userId, space_id: e.spaceId, payload, deleted_at: null });
    if (error) throw error;
  }
  async removeExpense(spaceId: string, id: string) {
    const { error } = await supabase().from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('space_id', spaceId);
    if (error) throw error;
  }
  async findUser(email: string): Promise<Contact | null> {
    const { data, error } = await supabase().rpc('find_user_for_invite', { lookup_email: email });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.public_key || row.id === this.userId) return null;
    return { userId: row.id, name: row.name, publicKey: row.public_key };
  }
  async directory(): Promise<Contact[]> {
    const { data, error } = await supabase().rpc('list_discoverable_users');
    if (error) throw error;
    return (data ?? []).filter((r: { public_key?: string }) => r.public_key)
      .map((r: { id: string; name: string; public_key: string }) => ({ userId: r.id, name: r.name, publicKey: r.public_key }));
  }
  async isDiscoverable(): Promise<boolean> {
    const { data } = await supabase().from('profiles').select('discoverable').eq('id', this.userId).maybeSingle();
    return !!data?.discoverable;
  }
  async setDiscoverable(on: boolean) {
    const { error } = await supabase().from('profiles').update({ discoverable: on }).eq('id', this.userId);
    if (error) throw error;
  }
  async invite(spaceId: string, spaceName: string, contact: Contact, fromName: string) {
    const raw = this.vault.rawSpaceKey(spaceId);
    if (!raw) throw new Error('Open the group first so its key is available');
    const sealed = await this.vault.sealFor(contact.publicKey, JSON.stringify({ k: raw, n: spaceName, f: fromName }));
    const { error } = await supabase().from('space_invites')
      .upsert({ id: crypto.randomUUID(), space_id: spaceId, from_user: this.userId, to_user: contact.userId, sealed }, { onConflict: 'space_id,to_user' });
    if (error) throw error;
  }
  async pendingInvites(): Promise<PendingInvite[]> {
    const { data, error } = await supabase().from('space_invites').select('id,space_id,sealed').eq('to_user', this.userId);
    if (error) throw error;
    const out: PendingInvite[] = [];
    for (const r of data ?? []) {
      try { const o = JSON.parse(await this.vault.openSealed(r.sealed)); out.push({ id: r.id, spaceId: r.space_id, spaceName: o.n, fromName: o.f }); }
      catch { /* can't open (not for this key): skip */ }
    }
    return out;
  }
  async acceptInvite(inviteId: string, myName: string): Promise<Space | null> {
    const { data, error } = await supabase().from('space_invites').select('space_id,sealed').eq('id', inviteId).single();
    if (error || !data) return null;
    const o = JSON.parse(await this.vault.openSealed(data.sealed)) as { k: string; n: string };
    await this.join(data.space_id, o.k, myName);
    await supabase().from('space_invites').delete().eq('id', inviteId);
    return { id: data.space_id, name: o.n };
  }
  async declineInvite(inviteId: string) {
    const { error } = await supabase().from('space_invites').delete().eq('id', inviteId);
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
    return { id: data.id, name: data.name, email: '', byPassword: data.by_password as WrappedKey, byRecovery: data.by_recovery as WrappedKey, publicKey: data.public_key ?? undefined, wrappedPrivateKey: data.wrapped_private_key ?? undefined, createdAt: data.created_at };
  }

  /** Load the contact keypair (needs the DEK unlocked); create + save it for older accounts.
   *  Best-effort: if the DB lacks the key columns (migration not yet applied), the rest of
   *  the app still works — only direct invites are unavailable until it is. */
  private async ensureContactKeys(userId: string, p: Profile) {
    if (this.vault.locked) return;
    if (p.wrappedPrivateKey) { try { await this.vault.loadContactKeys(p.wrappedPrivateKey); return; } catch { /* fall through and regenerate */ } }
    try {
      const ck = await this.vault.createContactKeys();
      await supabase().from('profiles').update({ public_key: ck.publicKey, wrapped_private_key: ck.wrappedPrivateKey }).eq('id', userId);
    } catch { /* columns missing or write blocked: invites stay off until migration */ }
  }

  async restore(): Promise<Session | null> {
    const { data } = await supabase().auth.getSession();
    const u = data.session?.user; if (!u) return null;
    const p = await this.profile(u.id);
    const k = await loadSessionKey(u.id);
    if (k) { this.vault.unlockWithSessionKey(k); await this.ensureContactKeys(u.id, p); } // stays unlocked on this device
    return { userId: u.id, email: u.email ?? '', name: p.name };
  }

  async signUp(name: string, email: string, password: string) {
    const keys = await this.vault.createUserKeys(password);
    const { data, error } = await supabase().auth.signUp({ email, password });
    if (error || !data.user) throw new AuthError(error?.message ?? 'Sign-up failed.');
    const { error: pErr } = await supabase().from('profiles').insert({ id: data.user.id, name, by_password: keys.byPassword, by_recovery: keys.byRecovery });
    if (pErr) throw new AuthError(pErr.message);
    // Contact keys are a best-effort follow-up write, so a pre-migration DB still allows signup.
    try {
      const ck = await this.vault.createContactKeys();
      await supabase().from('profiles').update({ public_key: ck.publicKey, wrapped_private_key: ck.wrappedPrivateKey }).eq('id', data.user.id);
    } catch { /* invites unavailable until the key columns exist */ }
    await this.persistKey(data.user.id);
    return { session: { userId: data.user.id, email, name }, recoveryCode: keys.recoveryCode };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new AuthError('Email or password is incorrect.');
    const p = await this.profile(data.user.id);
    if (!(await this.vault.unlock(p.byPassword, password))) throw new AuthError('Could not unlock your data with this password.');
    await this.ensureContactKeys(data.user.id, p);
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
    await this.ensureContactKeys(data.user.id, p);
    await this.persistKey(data.user.id);
    return { userId: data.user.id, email: data.user.email ?? '', name: p.name };
  }

  async signOut() { this.vault.lock(); await clearSessionKeys(); await supabase().auth.signOut(); }
}

export function supabaseRepos(vault: Vault, userId: string): Repos {
  return { expenses: new SbExpenseRepo(vault, userId), budgets: new SbBudgetRepo(vault, userId), recurring: new SbRecurringRepo(vault, userId), spaces: new SbSpaceRepo(vault, userId) };
}
