// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Vault } from './vault';
import { generateRecoveryCode, normalizeRecoveryCode } from './recovery';


describe('Vault', () => {
  it('round-trips data and keeps ciphertext opaque', async () => {
    const v = new Vault();
    await v.createUserKeys('secret123');
    const ct = await v.encryptJSON({ note: 'Lunch at Meghana', amount: 250 });
    expect(ct).not.toContain('Meghana');
    expect(await v.decryptJSON(ct)).toEqual({ note: 'Lunch at Meghana', amount: 250 });
  });

  it('unlocks with the right password and rejects the wrong one', async () => {
    const v = new Vault();
    const keys = await v.createUserKeys('secret123');
    const ct = await v.encrypt('hello');
    v.lock();
    expect(await v.unlock(keys.byPassword, 'wrongpass')).toBe(false);
    expect(v.locked).toBe(true);
    expect(await v.unlock(keys.byPassword, 'secret123')).toBe(true);
    expect(await v.decrypt(ct)).toBe('hello');
  });

  it('recovery code unlocks and allows re-wrapping with a new password', async () => {
    const v = new Vault();
    const keys = await v.createUserKeys('secret123');
    const ct = await v.encrypt('persisted');
    v.lock();
    expect(await v.unlockWithRecoveryCode(keys.byRecovery, keys.recoveryCode.toLowerCase())).toBe(true);
    const byNewPassword = await v.rewrap('newpass99');
    v.lock();
    expect(await v.unlock(byNewPassword, 'newpass99')).toBe(true);
    expect(await v.decrypt(ct)).toBe('persisted');
  });

  it('throws when used while locked', async () => {
    const v = new Vault();
    await expect(v.encrypt('x')).rejects.toThrow(/locked/);
  });
});

describe('recovery code', () => {
  it('is 20 chars in 5 groups without ambiguous characters', () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, ' '))).toBe(c.replace(/-/g, ''));
  });
});
