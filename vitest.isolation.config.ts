// Config for `npm run test:isolation` only — the Zone 2 acceptance test that
// hits the real Supabase project (see src/data/isolation.inttest.ts).
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.inttest.ts'],
    testTimeout: 120_000,
  },
});
