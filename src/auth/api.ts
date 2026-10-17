/**
 * Contract B (auth half). The frontend never touches Supabase Auth directly.
 * All implementations hold the Vault and unlock it on sign-in.
 */
import type { Profile } from '@/types';

export interface Session { userId: string; email: string; name: string }

export interface AuthApi {
  /**
   * Resolves the remembered session (if any). If this device holds a stored
   * session key (see auth/keystore.ts) the vault comes back UNLOCKED;
   * otherwise it stays locked and the UI asks for the password.
   */
  restore(): Promise<Session | null>;
  signUp(name: string, email: string, password: string): Promise<{ session: Session; recoveryCode: string }>;
  /** Unlocks the vault. Throws on bad credentials. */
  signIn(email: string, password: string): Promise<Session>;
  /** Unlock using the recovery code, then set a new password. */
  recover(email: string, recoveryCode: string, newPassword: string): Promise<Session>;
  signOut(): Promise<void>;
  /** For the demo button: a throwaway local account with example data. */
  demo?(): Promise<Session>;
}

export class AuthError extends Error {}

export function toSession(p: Profile): Session { return { userId: p.id, email: p.email, name: p.name }; }
