import type { WrappedKey } from '@/types';
import { normalizeRecoveryCode, generateRecoveryCode } from './recovery';

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 210_000;

const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => { const b = atob(s); const u = new Uint8Array(new ArrayBuffer(b.length)); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const rand = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));

async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'],
  );
}

async function wrapDek(dek: CryptoKey, secret: string): Promise<WrappedKey> {
  const salt = rand(16), iv = rand(12);
  const kek = await deriveKek(secret, salt);
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv }));
  return { salt: b64(salt), iv: b64(iv), key: b64(wrapped) };
}

async function unwrapDek(blob: WrappedKey, secret: string): Promise<CryptoKey> {
  const kek = await deriveKek(secret, unb64(blob.salt));
  return crypto.subtle.unwrapKey(
    'raw', unb64(blob.key), kek, { name: 'AES-GCM', iv: unb64(blob.iv) },
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

export interface NewUserKeys { byPassword: WrappedKey; byRecovery: WrappedKey; recoveryCode: string }

/**
 * Holds the user's data-encryption key (DEK) in memory for the session.
 * Nothing here ever persists the DEK. Storage layers call encrypt/decrypt.
 */
export class Vault {
  private dek: CryptoKey | null = null;
  /** Shared-space keys (spaceId → AES key), delivered via invite link or unwrapped from storage. */
  private spaces = new Map<string, CryptoKey>();

  static get supported(): boolean {
    return typeof crypto !== 'undefined' && !!crypto.subtle;
  }

  get locked(): boolean { return !this.dek; }

  /** Sign-up: fresh DEK, wrapped by password and by a one-time recovery code. */
  async createUserKeys(password: string): Promise<NewUserKeys> {
    this.dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const recoveryCode = generateRecoveryCode();
    return {
      byPassword: await wrapDek(this.dek, password),
      byRecovery: await wrapDek(this.dek, normalizeRecoveryCode(recoveryCode)),
      recoveryCode,
    };
  }

  /** Sign-in or recovery: returns false on wrong secret. */
  async unlock(blob: WrappedKey, secret: string): Promise<boolean> {
    try { this.dek = await unwrapDek(blob, secret); return true; }
    catch { this.dek = null; return false; }
  }

  async unlockWithRecoveryCode(blob: WrappedKey, code: string): Promise<boolean> {
    return this.unlock(blob, normalizeRecoveryCode(code));
  }

  /** After recovery: re-wrap the current DEK with a new password. */
  async rewrap(newPassword: string): Promise<WrappedKey> {
    if (!this.dek) throw new Error('Vault is locked');
    return wrapDek(this.dek, newPassword);
  }

  lock(): void { this.dek = null; this.spaces.clear(); }

  // ---- Shared spaces -------------------------------------------------------
  // Each space has one AES-GCM key. It travels person-to-person inside the
  // invite link's #fragment (never sent to a server) and is stored per member
  // wrapped by their personal DEK, so any of their devices can recover it.

  /** Fresh space key as base64 (goes into the invite link + gets wrapped per member). */
  static async generateSpaceKeyRaw(): Promise<string> {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    return b64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
  }

  /** Register a space key (from an invite link or an unwrap) for this session. */
  async addSpaceKey(spaceId: string, rawB64: string): Promise<void> {
    const key = await crypto.subtle.importKey('raw', unb64(rawB64), 'AES-GCM', false, ['encrypt', 'decrypt']);
    this.spaces.set(spaceId, key);
  }

  hasSpaceKey(spaceId: string): boolean { return this.spaces.has(spaceId); }
  dropSpaceKey(spaceId: string): void { this.spaces.delete(spaceId); }

  /** Wrap a raw space key under the personal DEK (stored in the member row). */
  async wrapSpaceKey(rawB64: string): Promise<string> { return this.encrypt(rawB64); }

  /** Unwrap a stored space key with the personal DEK and register it. */
  async unwrapSpaceKey(spaceId: string, wrapped: string): Promise<void> {
    await this.addSpaceKey(spaceId, await this.decrypt(wrapped));
  }

  private spaceKey(spaceId: string): CryptoKey {
    const k = this.spaces.get(spaceId);
    if (!k) throw new Error('No key for this space');
    return k;
  }

  async encryptJSONFor(spaceId: string, value: unknown): Promise<string> {
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.spaceKey(spaceId), enc.encode(JSON.stringify(value))));
    return `${b64(iv)}.${b64(ct)}`;
  }

  async decryptJSONFor<T>(spaceId: string, cipher: string): Promise<T> {
    const [iv, ct] = cipher.split('.');
    const plain = dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, this.spaceKey(spaceId), unb64(ct)));
    return JSON.parse(plain) as T;
  }

  /**
   * A NON-EXTRACTABLE copy of the DEK for the browser's key store (IndexedDB),
   * so the app can stay unlocked across reloads on this device. Its raw bytes
   * can never be read back by any script; it can only encrypt/decrypt here.
   */
  async sessionKey(): Promise<CryptoKey | null> {
    if (!this.dek) return null;
    try {
      const raw = await crypto.subtle.exportKey('raw', this.dek);
      return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    } catch { return null; } // dek already non-extractable (came from the key store)
  }

  /** Unlock from a stored session key (no password). Rewrap still requires a password or recovery unlock. */
  unlockWithSessionKey(key: CryptoKey): void { this.dek = key; }

  async encrypt(plain: string): Promise<string> {
    if (!this.dek) throw new Error('Vault is locked');
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.dek, enc.encode(plain)));
    return `${b64(iv)}.${b64(ct)}`;
  }

  async decrypt(cipher: string): Promise<string> {
    if (!this.dek) throw new Error('Vault is locked');
    const [iv, ct] = cipher.split('.');
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, this.dek, unb64(ct)));
  }

  async encryptJSON(value: unknown): Promise<string> { return this.encrypt(JSON.stringify(value)); }
  async decryptJSON<T>(cipher: string): Promise<T> { return JSON.parse(await this.decrypt(cipher)) as T; }
}
