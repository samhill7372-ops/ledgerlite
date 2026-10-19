/**
 * Browser-only backend: encrypted localStorage, namespaced per user.
 * Lets Zone 3 run with no network. Also the shape of the future offline cache.
 */
import type { Budget, Contact, Expense, PendingInvite, Profile, RecurringRule, Space, SpaceMember } from '@/types';
import type { BudgetRepo, ExpenseRepo, RecurringRepo, SpaceRepo, Repos } from './repo';
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

/**
 * Mock spaces live in shared (not per-user) localStorage keys, playing the role
 * of the server: several mock users in the same browser can share a space,
 * which makes the whole split flow testable offline.
 */
const SPACES = 'll.spaces.v1', MEMBERS = 'll.spacemembers.v1', INVITES = 'll.spaceinvites.v1';
interface MemberRow { spaceId: string; userId: string; wrappedKey: string; profile: string }
interface InviteRow { id: string; spaceId: string; fromUser: string; toUser: string; sealed: string }

class MockSpaceRepo implements SpaceRepo {
  constructor(private vault: Vault, private userId: string) {}
  private spaces(): Record<string, { meta: string; createdBy: string }> { try { return JSON.parse(safe.get(SPACES) || '{}'); } catch { return {}; } }
  private membersAll(): MemberRow[] { try { return JSON.parse(safe.get(MEMBERS) || '[]'); } catch { return []; } }
  private expKey(spaceId: string) { return `ll.spaceexp.${spaceId}.v1`; }
  private exps(spaceId: string): Record<string, string> { try { return JSON.parse(safe.get(this.expKey(spaceId)) || '{}'); } catch { return {}; } }

  async create(space: Space, rawKey: string, myName: string) {
    const all = this.spaces();
    all[space.id] = { meta: await this.vault.encryptJSONFor(space.id, { name: space.name }), createdBy: this.userId };
    safe.set(SPACES, JSON.stringify(all));
    await this.join(space.id, rawKey, myName);
  }
  async join(spaceId: string, rawKey: string, myName: string) {
    await this.vault.addSpaceKey(spaceId, rawKey);
    const rows = this.membersAll().filter((m) => !(m.spaceId === spaceId && m.userId === this.userId));
    rows.push({ spaceId, userId: this.userId, wrappedKey: await this.vault.wrapSpaceKey(rawKey), profile: await this.vault.encryptJSONFor(spaceId, { name: myName }) });
    safe.set(MEMBERS, JSON.stringify(rows));
  }
  async mine(): Promise<Space[]> {
    const spaces = this.spaces();
    const out: Space[] = [];
    for (const m of this.membersAll().filter((m) => m.userId === this.userId)) {
      try {
        await this.vault.unwrapSpaceKey(m.spaceId, m.wrappedKey);
        const meta = spaces[m.spaceId]; if (!meta) continue;
        out.push({ id: m.spaceId, name: (await this.vault.decryptJSONFor<{ name: string }>(m.spaceId, meta.meta)).name });
      } catch { /* key or meta unreadable: skip */ }
    }
    return out;
  }
  async members(spaceId: string): Promise<SpaceMember[]> {
    const out: SpaceMember[] = [];
    for (const m of this.membersAll().filter((m) => m.spaceId === spaceId)) {
      try { out.push({ userId: m.userId, name: (await this.vault.decryptJSONFor<{ name: string }>(spaceId, m.profile)).name }); }
      catch { out.push({ userId: m.userId, name: 'Member' }); }
    }
    return out;
  }
  async leave(spaceId: string) {
    safe.set(MEMBERS, JSON.stringify(this.membersAll().filter((m) => !(m.spaceId === spaceId && m.userId === this.userId))));
    this.vault.dropSpaceKey(spaceId);
  }
  async listExpenses(spaceId: string): Promise<Expense[]> {
    const out: Expense[] = [];
    for (const payload of Object.values(this.exps(spaceId))) {
      try { out.push(await this.vault.decryptJSONFor<Expense>(spaceId, payload)); } catch { /* skip */ }
    }
    return out;
  }
  async upsertExpense(e: Expense) {
    if (!e.spaceId) throw new Error('upsertExpense needs spaceId');
    const all = this.exps(e.spaceId);
    all[e.id] = await this.vault.encryptJSONFor(e.spaceId, e);
    safe.set(this.expKey(e.spaceId), JSON.stringify(all));
  }
  async removeExpense(spaceId: string, id: string) {
    const all = this.exps(spaceId); delete all[id];
    safe.set(this.expKey(spaceId), JSON.stringify(all));
  }
  private invites(): InviteRow[] { try { return JSON.parse(safe.get(INVITES) || '[]'); } catch { return []; } }
  async findUser(email: string): Promise<Contact | null> {
    let list: Profile[] = []; try { list = JSON.parse(safe.get(USERS) || '[]'); } catch { /* none */ }
    const u = list.find((x) => x.email === email.trim().toLowerCase());
    if (!u || !u.publicKey || u.id === this.userId) return null;
    return { userId: u.id, name: u.name, publicKey: u.publicKey };
  }
  async invite(spaceId: string, spaceName: string, contact: Contact, fromName: string) {
    const raw = this.vault.rawSpaceKey(spaceId);
    if (!raw) throw new Error('Open the group first so its key is available');
    const sealed = await this.vault.sealFor(contact.publicKey, JSON.stringify({ k: raw, n: spaceName, f: fromName }));
    const rows = this.invites().filter((r) => !(r.spaceId === spaceId && r.toUser === contact.userId));
    rows.push({ id: crypto.randomUUID(), spaceId, fromUser: this.userId, toUser: contact.userId, sealed });
    safe.set(INVITES, JSON.stringify(rows));
  }
  async pendingInvites(): Promise<PendingInvite[]> {
    const out: PendingInvite[] = [];
    for (const r of this.invites().filter((r) => r.toUser === this.userId)) {
      try { const o = JSON.parse(await this.vault.openSealed(r.sealed)); out.push({ id: r.id, spaceId: r.spaceId, spaceName: o.n, fromName: o.f }); }
      catch { /* not for this key: skip */ }
    }
    return out;
  }
  async acceptInvite(inviteId: string, myName: string): Promise<Space | null> {
    const row = this.invites().find((r) => r.id === inviteId); if (!row) return null;
    const o = JSON.parse(await this.vault.openSealed(row.sealed)) as { k: string; n: string };
    await this.join(row.spaceId, o.k, myName);
    safe.set(INVITES, JSON.stringify(this.invites().filter((r) => r.id !== inviteId)));
    return { id: row.spaceId, name: o.n };
  }
  async declineInvite(inviteId: string) {
    safe.set(INVITES, JSON.stringify(this.invites().filter((r) => r.id !== inviteId)));
  }
}

const USERS = 'll.users.v1', SESSION = 'll.session.v1';

export class MockAuth implements AuthApi {
  constructor(private vault: Vault) {}
  private users(): Profile[] { try { return JSON.parse(safe.get(USERS) || '[]'); } catch { return []; } }
  private save(list: Profile[]) { safe.set(USERS, JSON.stringify(list)); }
  private async persistKey(userId: string) { const k = await this.vault.sessionKey(); if (k) await saveSessionKey(userId, k); }
  /** Load the contact keypair (needs DEK unlocked); create + save for older accounts. */
  private async ensureContactKeys(u: Profile) {
    if (this.vault.locked) return;
    if (u.wrappedPrivateKey) { try { await this.vault.loadContactKeys(u.wrappedPrivateKey); return; } catch { /* regenerate */ } }
    const ck = await this.vault.createContactKeys();
    const list = this.users(); const row = list.find((x) => x.id === u.id);
    if (row) { row.publicKey = ck.publicKey; row.wrappedPrivateKey = ck.wrappedPrivateKey; this.save(list); }
  }

  async restore(): Promise<Session | null> {
    const id = safe.get(SESSION); const u = id && this.users().find((x) => x.id === id);
    if (!u) return null;
    const k = await loadSessionKey(u.id);
    if (k) { this.vault.unlockWithSessionKey(k); await this.ensureContactKeys(u); }
    return toSession(u);
  }
  async signUp(name: string, email: string, password: string) {
    const list = this.users(); email = email.trim().toLowerCase();
    if (list.some((u) => u.email === email)) throw new AuthError('An account with this email already exists. Sign in instead.');
    const keys = await this.vault.createUserKeys(password);
    const ck = await this.vault.createContactKeys();
    const p: Profile = { id: crypto.randomUUID(), name: name.trim(), email, byPassword: keys.byPassword, byRecovery: keys.byRecovery, publicKey: ck.publicKey, wrappedPrivateKey: ck.wrappedPrivateKey, createdAt: new Date().toISOString() };
    list.push(p); this.save(list); safe.set(SESSION, p.id); await this.persistKey(p.id);
    return { session: toSession(p), recoveryCode: keys.recoveryCode };
  }
  async signIn(email: string, password: string) {
    const u = this.users().find((x) => x.email === email.trim().toLowerCase());
    if (!u || !(await this.vault.unlock(u.byPassword, password))) throw new AuthError('Email or password is incorrect.');
    await this.ensureContactKeys(u); safe.set(SESSION, u.id); await this.persistKey(u.id); return toSession(u);
  }
  async recover(email: string, code: string, newPassword: string) {
    const list = this.users(); const u = list.find((x) => x.email === email.trim().toLowerCase());
    if (!u) throw new AuthError('No account found for this email.');
    if (!(await this.vault.unlockWithRecoveryCode(u.byRecovery, code))) throw new AuthError('Recovery code is incorrect.');
    u.byPassword = await this.vault.rewrap(newPassword); this.save(list); await this.ensureContactKeys(u); safe.set(SESSION, u.id); await this.persistKey(u.id); return toSession(u);
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
  return { expenses: new MockExpenseRepo(vault, `ll.${userId}.expenses.v1`), budgets: new MockBudgetRepo(vault, `ll.${userId}.budget.v1`), recurring: new MockRecurringRepo(vault, `ll.${userId}.recurring.v1`), spaces: new MockSpaceRepo(vault, userId) };
}
