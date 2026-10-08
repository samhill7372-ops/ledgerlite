# Development zones

## Zone 1 — Core logic (`src/lib`)
Pure TypeScript. Ported from the prototype. Must stay free of React and storage.

- `crypto/vault.ts` — DEK lifecycle, wrap/unwrap, encrypt/decrypt
- `crypto/recovery.ts` — recovery code generation and normalisation
- `ocr/extract.ts` — vendor/date/total heuristics on raw OCR text
- `ocr/categorize.ts` — keyword category guess
- `ocr/worker.ts` — Tesseract.js runner + image downscale (browser only)
- `budget/pace.ts` — month totals, projection, status
- `budget/alerts.ts` — threshold rules → Alert[]
- `money.ts`, `dates.ts`

Tests live next to the code (`*.test.ts`). Run `npm test`.

## Zone 2 — Data & backend (`supabase`, `src/data`, `src/auth`)
- `supabase/migrations/*.sql` — schema + RLS. Apply with `supabase db push`.
- `src/data/repo.ts` — interfaces (Contract B)
- `src/data/mockRepo.ts` — browser-only implementation (encrypted localStorage)
- `src/data/supabaseRepo.ts` — real implementation (encrypts before upsert)
- `src/auth/api.ts` — AuthApi interface + implementations

Acceptance test: sign up two users, write rows as each, confirm user A cannot
read user B via the anon key, and confirm the `payload` column is ciphertext.

## Zone 3 — Frontend / PWA (`src/features`, `src/components`, `src/store`, `src/styles`)
One folder per screen. Imports only `src/lib`, `src/data/repo.ts` (types) and the store.
Runs on `VITE_DATA_BACKEND=mock` until Zone 2 is ready.

## Integration
Switch `.env.local` to `VITE_DATA_BACKEND=supabase`, run the Zone 2 acceptance
test through the real UI, deploy to Vercel, invite testers.
