# Supabase (Zone 2)

1. Create a free project at https://supabase.com (no card needed).
2. Authentication → Providers → enable Email. Turn **off** "Confirm email" for the closed test, or configure SMTP.
3. `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`
4. Copy Project URL + anon key into `.env.local`, set `VITE_DATA_BACKEND=supabase`.

## What the admin can see
`profiles.name`, emails (in auth.users), timestamps, row counts. The `payload`
columns are AES-GCM ciphertext encrypted on the user's device; the key never
leaves the device.

## Acceptance test
Run `npm run test:isolation` (to be added in Zone 2) which signs up two users
through the anon key, writes a row as each, and asserts user A reads zero rows
of user B and that `payload` does not contain plaintext.

## Keep-alive
Free projects pause after 7 days without requests. Add a GitHub Actions cron
(`.github/workflows/keepalive.yml`) that hits `/rest/v1/` daily with the anon key.
