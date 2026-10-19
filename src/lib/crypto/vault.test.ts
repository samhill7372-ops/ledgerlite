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

  it('space keys: invite-link delivery, DEK wrapping, and member isolation', async () => {
    const alice = new Vault(); await alice.createUserKeys('alice-pass');
    const raw = await Vault.generateSpaceKeyRaw();           // created with the space
    await alice.addSpaceKey('trip', raw);
    const ct = await alice.encryptJSONFor('trip', { note: 'Hotel', amount: 6000 });
    expect(ct).not.toContain('Hotel');

    // Bob joins via the link fragment: same raw key, can read the space…
    const bob = new Vault(); await bob.createUserKeys('bob-pass');
    await bob.addSpaceKey('trip', raw);
    expect(await bob.decryptJSONFor('trip', ct)).toEqual({ note: 'Hotel', amount: 6000 });
    // …then wraps it under his own DEK for other devices, and can unwrap it back.
    const wrapped = await bob.wrapSpaceKey(raw);
    bob.dropSpaceKey('trip');
    expect(bob.hasSpaceKey('trip')).toBe(false);
    await bob.unwrapSpaceKey('trip', wrapped);
    expect(await bob.decryptJSONFor('trip', ct)).toEqual({ note: 'Hotel', amount: 6000 });

    // An outsider without the space key cannot read it, DEK or not.
    const eve = new Vault(); await eve.createUserKeys('eve-pass');
    await expect(eve.decryptJSONFor('trip', ct)).rejects.toThrow(/No key/);
    // And locking clears space keys too.
    alice.lock();
    await expect(alice.encryptJSONFor('trip', {})).rejects.toThrow(/No key/);
  });

  it('contact keys: seal to a public key, only the holder opens it', async () => {
    const bob = new Vault(); await bob.createUserKeys('bob-pass');
    const bobKeys = await bob.createContactKeys();                 // bob publishes bobKeys.publicKey
    const alice = new Vault(); await alice.createUserKeys('alice-pass');
    const sealed = await alice.sealFor(bobKeys.publicKey, 'the-space-key'); // alice invites bob
    expect(sealed).not.toContain('the-space-key');

    expect(await bob.openSealed(sealed)).toBe('the-space-key');
    await bob.loadContactKeys(bobKeys.wrappedPrivateKey);          // wrapped form also opens it
    expect(await bob.openSealed(sealed)).toBe('the-space-key');

    const eve = new Vault(); await eve.createUserKeys('eve-pass'); await eve.createContactKeys();
    await expect(eve.openSealed(sealed)).rejects.toThrow();        // outsider cannot open
    bob.lock();
    expect(bob.hasContactKey).toBe(false);                         // lock clears the contact key
  });
});

describe('recovery code', () => {
  it('is 20 chars in 5 groups without ambiguous characters', () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, ' '))).toBe(c.replace(/-/g, ''));
  });
});
