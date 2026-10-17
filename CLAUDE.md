# LedgerLite — project guide for Claude Code

LedgerLite is a mobile-first, end-to-end-encrypted personal expense tracker.
Users log expenses by hand or by photographing a bill (on-device OCR), set a
monthly budget, and see pacing alerts and month-by-month insights.
Target: ~100 users, zero running cost (Supabase free tier + Vercel free tier).

The approved prototype (single HTML file, all behaviour and the visual design)
is at `docs/prototype/ledgerlite-prototype.html`. When in doubt about how a
screen should look or behave, open it. This repo is a port of that prototype
into a maintainable structure; do not redesign the UI.

## Non-negotiables

1. **End-to-end encryption.** All user content (amount, category, date, note,
   OCR text) is AES-GCM encrypted on the device with a per-user data key (DEK)
   before it is stored anywhere. The server stores ciphertext only. The DEK is
   wrapped by a password-derived key (PBKDF2 210k, SHA-256) and separately by a
   recovery-code-derived key. The raw DEK lives only in memory; the only thing
   that may be persisted is a NON-EXTRACTABLE CryptoKey copy in IndexedDB
   (`src/auth/keystore.ts`, owner-approved 2026-10-17) so the device stays
   unlocked; its bytes are unreadable by any script and it never leaves the
   device. The project owner must never be able to read user data. See `src/lib/crypto/`.
2. **No backend server of our own.** The browser talks directly to Supabase
   under row-level security. Budget math, insights and OCR all run on the phone.
3. **Zero cost.** Do not add paid services. OCR stays on-device (Tesseract.js).
4. **Mobile first.** Phone width is the primary layout. 48px touch targets,
   16px input text (prevents iOS zoom), safe-area insets, bottom tab bar.

## The three zones

Work is split into three zones with two contracts between them. Each zone can
be built and tested independently.

| Zone | Folders | Deliverable | Done when |
|---|---|---|---|
| 1 Core logic | `src/lib/`, `src/types.ts` | Pure TS, no React, no storage | `npm test` green; every function has tests |
| 2 Data & backend | `supabase/`, `src/data/`, `src/auth/` | Repo implementations + migrations + RLS | Two users cannot see each other's rows; DB holds only ciphertext |
| 3 Frontend / PWA | `src/features/`, `src/components/`, `src/store/`, `src/styles/`, `public/` | Screens running on the mock repo | Every prototype flow works on a phone |

**Contract A** (Zone 1 → 3): the exported API of `src/lib/*` — see each `index.ts`.
**Contract B** (Zone 2 → 3): `src/data/repo.ts` (`ExpenseRepo`, `BudgetRepo`) and
`src/auth/api.ts` (`AuthApi`). The frontend only ever imports these interfaces
and gets an implementation from `src/data/index.ts` based on
`VITE_DATA_BACKEND` (`mock` | `supabase`).

Rules:
- `src/features/**` never imports from `src/data/supabaseRepo.ts` or `@supabase/*`.
- `src/lib/**` never imports React, the DOM (except Web Crypto / Worker), or `src/data`.
- Anything that touches money, dates or crypto gets a unit test in the same folder.

## Commands

```
npm install
npm run dev          # http://localhost:5173, runs on the mock backend
npm test             # vitest (Zone 1 + data contracts)
npm run build        # typecheck + production build
```

Supabase (Zone 2):
```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations
```

## Conventions

- TypeScript strict. Functional React with hooks. No class components.
- Styling: plain CSS with the design tokens in `src/styles/tokens.css`
  (the `:root` block from the prototype). No Tailwind, no CSS-in-JS.
- Money is stored as a number of major units (e.g. 250.00 INR) rounded to 2dp.
  Currency code stored per expense. Default currency INR, locale `en-IN`.
- Dates are ISO `YYYY-MM-DD` strings, month keys are `YYYY-MM`.
- IDs: `crypto.randomUUID()`.
- Categories: Food, Groceries, Travel, Bills, Shopping, Health, Other
  (custom categories are a planned feature; keep the list in `src/types.ts`).
- Keep each screen's state local; shared state (expenses, budget, session)
  lives in `src/store/`.
- Commit messages: imperative, prefixed by zone, e.g. `z1: add pace projection`.

## Roadmap (after the port)

Prototype parity first. Then, in order:
1. Search in Expenses; undo-delete toast; custom categories
2. Photo downscale before OCR; keep OCR corrections for accuracy tracking
3. Recurring expenses (rent, EMI, subscriptions)
4. Onboarding on first login (set budget → add expense → try scan)
5. PWA polish: install prompt, offline queue + sync
6. Android TWA via Bubblewrap → Play Store (closed test with 12 testers, 14 days)

## Things to tell the user plainly

- Losing both password and recovery code means the data is unrecoverable by design.
- The free Supabase project pauses after 7 days idle; a ping cron keeps it awake.
