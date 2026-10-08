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

  lock(): void { this.dek = null; }

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
