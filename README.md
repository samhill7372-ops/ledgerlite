# LedgerLite

Mobile-first, end-to-end-encrypted expense tracker. Log spending by hand or by
scanning a bill, set a monthly budget, stay on track.

- Zero running cost: Supabase free tier + Vercel free tier, OCR on-device
- Your data is encrypted on your phone with a key only you hold
- Installs as a PWA; Android (Play Store) build planned via TWA

## Quick start

```bash
npm install
cp .env.example .env.local      # mock backend works without any keys
npm run dev
```

Open http://localhost:5173 on your phone (same Wi-Fi: use `npm run dev -- --host`).

## Project layout

See `CLAUDE.md` for the architecture, the three development zones, and the contracts between them.
The original approved prototype is in `docs/prototype/`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploy

Vercel: import the repo, framework = Vite, add the two `VITE_SUPABASE_*` env vars and
`VITE_DATA_BACKEND=supabase`. Every push to `main` deploys.
