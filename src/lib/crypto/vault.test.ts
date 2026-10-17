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

  it('session key decrypts on a fresh vault but its bytes cannot be extracted', async () => {
    const v = new Vault();
    await v.createUserKeys('secret123');
    const ct = await v.encrypt('stay unlocked');
    const sk = await v.sessionKey();
    expect(sk).not.toBeNull();
    expect(sk!.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', sk!)).rejects.toThrow();

    const fresh = new Vault(); // "after a reload"
    fresh.unlockWithSessionKey(sk!);
    expect(fresh.locked).toBe(false);
    expect(await fresh.decrypt(ct)).toBe('stay unlocked');
    expect(await fresh.sessionKey()).toBeNull(); // non-extractable dek cannot be copied again
  });

  it('sessionKey is null while locked', async () => {
    expect(await new Vault().sessionKey()).toBeNull();
  });
});

describe('recovery code', () => {
  it('is 20 chars in 5 groups without ambiguous characters', () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, ' '))).toBe(c.replace(/-/g, ''));
  });
});
