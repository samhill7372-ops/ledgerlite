-- Profiles: one row per auth user. Holds the two wrapped copies of the user's
-- data-encryption key. The server never sees the key itself or the password.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null,
  by_password  jsonb not null,   -- { salt, iv, key } base64, wrapped by PBKDF2(password)
  by_recovery  jsonb not null,   -- { salt, iv, key } base64, wrapped by PBKDF2(recovery code)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner can insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner can update" on public.profiles for update using (auth.uid() = id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
