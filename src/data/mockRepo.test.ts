// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Vault } from '@/lib/crypto';
import { MockAuth, mockRepos } from './mockRepo';
import { equalShares, computeNet, simplifyDebts } from '@/lib/split';
import type { Expense } from '@/types';

beforeEach(() => { localStorage.clear(); Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); });

describe('mock backend (Contract B)', () => {
  it('isolates users and stores only ciphertext', async () => {
    const vault = new Vault(); const auth = new MockAuth(vault);
    const a = await auth.signUp('A', 'a@x.com', 'passwordA');
    const ra = mockRepos(vault, a.session.userId);
    await ra.expenses.upsert({ id: '1', amount: 250, currency: 'INR', category: 'Food', date: '2026-10-08', note: 'Meghana', source: 'manual', createdAt: '', updatedAt: '' });
    expect(JSON.stringify(localStorage)).not.toContain('Meghana');
    await auth.signOut();

    const b = await auth.signUp('B', 'b@x.com', 'passwordB');
    const rb = mockRepos(vault, b.session.userId);
    expect(await rb.expenses.list()).toEqual([]);
    await auth.signOut();

    await expect(auth.signIn('a@x.com', 'wrongpass')).rejects.toThrow(/incorrect/);
    await auth.signIn('a@x.com', 'passwordA');
    expect((await ra.expenses.list())[0].note).toBe('Meghana');
  });

  it('shares a space between two users and keeps outsiders blind', async () => {
    // Alice creates the trip space.
    const va = new Vault(); const authA = new MockAuth(va);
    const a = await authA.signUp('Alice', 'alice@x.com', 'pass-alice');
    const ra = mockRepos(va, a.session.userId);
    const raw = await Vault.generateSpaceKeyRaw();
    const spaceId = webcrypto.randomUUID();
    await va.addSpaceKey(spaceId, raw);
    await ra.spaces.create({ id: spaceId, name: 'Goa Trip' }, raw, 'Alice');

    // Bob joins with the key from the invite link and both log split expenses.
    const vb = new Vault(); const authB = new MockAuth(vb);
    const b = await authB.signUp('Bob', 'bob@x.com', 'pass-bob');
    const rb = mockRepos(vb, b.session.userId);
    await rb.spaces.join(spaceId, raw, 'Bob');
    const ids = [a.session.userId, b.session.userId];
    const exp = (id: string, amount: number, paidBy: string): Expense => ({
      id, amount, currency: 'INR', category: 'Other', date: '2026-10-18', note: 'x', source: 'manual',
      spaceId, split: { paidBy, shares: equalShares(amount, ids) }, createdAt: '', updatedAt: '',
    });
    await ra.spaces.upsertExpense(exp(webcrypto.randomUUID(), 6000, a.session.userId));
    await rb.spaces.upsertExpense(exp(webcrypto.randomUUID(), 1500, b.session.userId));

    // Both see both expenses, names resolve, balances agree on both devices.
    expect((await ra.spaces.mine()).map((s) => s.name)).toEqual(['Goa Trip']);
    expect((await rb.spaces.members(spaceId)).map((m) => m.name).sort()).toEqual(['Alice', 'Bob']);
    const fromA = await ra.spaces.listExpenses(spaceId);
    const fromB = await rb.spaces.listExpenses(spaceId);
    expect(fromA).toHaveLength(2);
    expect(computeNet(fromB)).toEqual(computeNet(fromA));
    expect(simplifyDebts(computeNet(fromA))).toEqual([{ from: b.session.userId, to: a.session.userId, amount: 2250 }]);

    // Eve signs up but never gets the space key: ciphertext stays unreadable.
    const ve = new Vault(); const authE = new MockAuth(ve);
    const e = await authE.signUp('Eve', 'eve@x.com', 'pass-eve');
    const re = mockRepos(ve, e.session.userId);
    expect(await re.spaces.listExpenses(spaceId)).toEqual([]);
    expect(await re.spaces.mine()).toEqual([]);
  });

  it('invites an existing user by email with sealed keys (no plaintext key leaks)', async () => {
    // Alice signs up (gets a contact keypair) and creates a group.
    const va = new Vault(); const authA = new MockAuth(va);
    const a = await authA.signUp('Alice', 'alice@x.com', 'pass-alice');
    const ra = mockRepos(va, a.session.userId);
    const raw = await Vault.generateSpaceKeyRaw();
    const spaceId = webcrypto.randomUUID();
    await va.addSpaceKey(spaceId, raw);
    await ra.spaces.create({ id: spaceId, name: 'Goa Trip' }, raw, 'Alice');
    await authA.signOut();

    // Bob signs up so he has a published contact key, and opts in to be discoverable.
    const vb = new Vault(); const authB = new MockAuth(vb);
    const b = await authB.signUp('Bob', 'bob@x.com', 'pass-bob');
    const rb = mockRepos(vb, b.session.userId);
    await rb.spaces.setDiscoverable(true);
    await authB.signOut();

    // Alice signs back in: directory shows opted-in Bob (not herself, she's off), email search finds him.
    await authA.signIn('alice@x.com', 'pass-alice');
    await ra.spaces.mine(); // unwraps her space key into the vault (real path)
    expect((await ra.spaces.directory()).map((c) => c.name)).toEqual(['Bob']);
    const found = await ra.spaces.findUser('BOB@x.com'); // case-insensitive
    expect(found?.userId).toBe(b.session.userId);
    expect(await ra.spaces.findUser('nobody@x.com')).toBeNull();
    await ra.spaces.invite(spaceId, 'Goa Trip', found!, 'Alice');
    await authA.signOut();

    // The stored invite must not contain the raw space key.
    expect(JSON.stringify(localStorage)).not.toContain(raw);

    // Bob signs in, sees the pending invite, accepts, and can read the group.
    await authB.signIn('bob@x.com', 'pass-bob');
    const pend = await rb.spaces.pendingInvites();
    expect(pend).toHaveLength(1);
    expect(pend[0].spaceName).toBe('Goa Trip');
    expect(pend[0].fromName).toBe('Alice');
    const joined = await rb.spaces.acceptInvite(pend[0].id, 'Bob');
    expect(joined?.name).toBe('Goa Trip');
    expect((await rb.spaces.mine()).map((s) => s.name)).toContain('Goa Trip');
    expect((await rb.spaces.members(spaceId)).map((m) => m.name).sort()).toEqual(['Alice', 'Bob']);
    expect(await rb.spaces.pendingInvites()).toEqual([]);
  });

  it('recovers with the code and keeps data', async () => {
    const vault = new Vault(); const auth = new MockAuth(vault);
    const { session, recoveryCode } = await auth.signUp('A', 'a@x.com', 'passwordA');
    const r = mockRepos(vault, session.userId);
    await r.budgets.set({ total: 5000, cats: {} });
    await auth.signOut();
    await auth.recover('a@x.com', recoveryCode, 'newpass99');
    expect((await r.budgets.get())?.total).toBe(5000);
    await auth.signOut();
    await auth.signIn('a@x.com', 'newpass99');
  });
});
