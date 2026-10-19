/**
 * Zone 2 acceptance test (runs against the REAL Supabase project in .env.local).
 *
 *   npm run test:isolation
 *
 * Signs up two fresh users through the anon/publishable key and asserts:
 *   1. the `payload` column holds only ciphertext (never the plaintext note),
 *   2. RLS: user B cannot select, update or soft-delete user A's rows,
 *   3. user A can sign in on a "new device" (fresh Vault) and decrypt their data.
 *
 * Not part of `npm test` (needs network, creates real auth users). Each run
 * leaves two throwaway users behind; prune them in Dashboard → Authentication.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Vault } from '@/lib/crypto';
import { SupabaseAuth, supabaseRepos } from './supabaseRepo';
import { supabase } from './supabase';
import type { Expense } from '@/types';

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local before running test:isolation');
  }
});

const run = Math.random().toString(36).slice(2, 10);
const emailA = `iso.a.${run}@ledgerlite-test.dev`;
const emailB = `iso.b.${run}@ledgerlite-test.dev`;
const CANARY = 'PLAINTEXT-CANARY Meghana biryani';

describe('supabase shared spaces (live)', () => {
  it('creates a space, joins it, and round-trips a split expense', async () => {
    const vc = new Vault(); const authC = new SupabaseAuth(vc);
    const c = await authC.signUp('Iso C', `iso.c.${run}@ledgerlite-test.dev`, 'password-C-9');
    const rc = supabaseRepos(vc, c.session.userId);
    const raw = await Vault.generateSpaceKeyRaw();
    const spaceId = webcrypto.randomUUID();
    await vc.addSpaceKey(spaceId, raw);
    await rc.spaces.create({ id: spaceId, name: 'Iso Space' }, raw, 'Iso C');
    expect((await rc.spaces.mine()).map((s) => s.name)).toContain('Iso Space');

    const vd = new Vault(); const authD = new SupabaseAuth(vd);
    const d = await authD.signUp('Iso D', `iso.d.${run}@ledgerlite-test.dev`, 'password-D-9');
    const rd = supabaseRepos(vd, d.session.userId);
    await rd.spaces.join(spaceId, raw, 'Iso D');
    await rd.spaces.upsertExpense({
      id: webcrypto.randomUUID(), amount: 1000, currency: 'INR', category: 'Other', date: '2026-10-19',
      note: 'shared', source: 'manual', spaceId,
      split: { paidBy: d.session.userId, shares: { [c.session.userId]: 500, [d.session.userId]: 500 } },
      createdAt: '', updatedAt: '',
    });
    expect((await rd.spaces.members(spaceId)).map((m) => m.name).sort()).toEqual(['Iso C', 'Iso D']);
    await authD.signOut();

    await authC.signIn(`iso.c.${run}@ledgerlite-test.dev`, 'password-C-9');
    const seen = await supabaseRepos(vc, c.session.userId).spaces.listExpenses(spaceId);
    expect(seen).toHaveLength(1);
    expect(seen[0].split?.shares[c.session.userId]).toBe(500);
    await authC.signOut();
  }, 120_000);
});

describe('supabase backend (Zone 2 acceptance)', () => {
  it('isolates users and stores only ciphertext', async () => {
    // --- user A signs up and writes one expense -------------------------------
    const vaultA = new Vault();
    const authA = new SupabaseAuth(vaultA);
    const a = await authA.signUp('Iso A', emailA, 'password-A-9');
    const ra = supabaseRepos(vaultA, a.session.userId);
    const expId = webcrypto.randomUUID();
    const expense: Expense = {
      id: expId, amount: 250, currency: 'INR', category: 'Food',
      date: '2026-10-17', note: CANARY, source: 'manual',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await ra.expenses.upsert(expense);

    // payload on the server is "<iv b64>.<ciphertext b64>", not plaintext
    const { data: rawA, error: rawErr } = await supabase()
      .from('expenses').select('payload').eq('id', expId).single();
    expect(rawErr).toBeNull();
    expect(rawA!.payload).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(rawA!.payload).not.toContain('PLAINTEXT-CANARY');
    // ...but A's vault can decrypt it back
    expect((await vaultA.decryptJSON<Expense>(rawA!.payload)).note).toBe(CANARY);
    await authA.signOut();

    // --- user B signs up: must see nothing of A -------------------------------
    const vaultB = new Vault();
    const authB = new SupabaseAuth(vaultB);
    const b = await authB.signUp('Iso B', emailB, 'password-B-9');
    const rb = supabaseRepos(vaultB, b.session.userId);
    expect(await rb.expenses.list()).toEqual([]);

    // raw queries as B: RLS filters A's rows out entirely
    const leakByUser = await supabase().from('expenses').select('id').eq('user_id', a.session.userId);
    expect(leakByUser.error).toBeNull();
    expect(leakByUser.data).toEqual([]);
    const leakById = await supabase().from('expenses').select('id,payload').eq('id', expId);
    expect(leakById.data).toEqual([]);
    const leakProfile = await supabase().from('profiles').select('id,by_password').eq('id', a.session.userId);
    expect(leakProfile.data).toEqual([]);

    // B cannot update (soft-delete) or hard-delete A's row: 0 rows affected
    const upd = await supabase().from('expenses')
      .update({ deleted_at: new Date().toISOString() }).eq('id', expId).select('id');
    expect(upd.data).toEqual([]);
    const del = await supabase().from('expenses').delete().eq('id', expId).select('id');
    expect(del.data).toEqual([]);
    await authB.signOut();

    // --- A signs in on a "new device" (fresh vault) and still decrypts --------
    const vaultA2 = new Vault();
    const authA2 = new SupabaseAuth(vaultA2);
    const s = await authA2.signIn(emailA, 'password-A-9');
    const list = await supabaseRepos(vaultA2, s.userId).expenses.list();
    expect(list).toHaveLength(1);
    expect(list[0].note).toBe(CANARY);
    expect(list[0].amount).toBe(250);
    await authA2.signOut();
  }, 120_000);
});
