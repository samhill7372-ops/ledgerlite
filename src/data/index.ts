/** Picks the backend from VITE_DATA_BACKEND. The frontend imports only this file and repo.ts. */
import { Vault } from '@/lib/crypto';
import type { Repos } from './repo';
import type { AuthApi } from '@/auth/api';

export const vault = new Vault();
const backend = (import.meta.env.VITE_DATA_BACKEND ?? 'mock') as 'mock' | 'supabase';

export async function createAuth(): Promise<AuthApi> {
  if (backend === 'supabase') { const { SupabaseAuth } = await import('./supabaseRepo'); return new SupabaseAuth(vault); }
  const { MockAuth } = await import('./mockRepo'); return new MockAuth(vault);
}

export async function createRepos(userId: string): Promise<Repos> {
  if (backend === 'supabase') { const { supabaseRepos } = await import('./supabaseRepo'); return supabaseRepos(vault, userId); }
  const { mockRepos } = await import('./mockRepo'); return mockRepos(vault, userId);
}

export const BACKEND = backend;
