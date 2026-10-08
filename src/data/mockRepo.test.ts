// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Vault } from '@/lib/crypto';
import { MockAuth, mockRepos } from './mockRepo';

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
