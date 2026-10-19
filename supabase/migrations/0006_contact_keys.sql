-- Contact keys + direct invites. Each profile publishes an ECDH public key
-- (safe to share) and keeps its private key wrapped by the DEK. To invite an
-- existing user we seal the space key to their public key; the server stores
-- only public keys and sealed boxes it cannot open.
alter table public.profiles add column public_key          text;
alter table public.profiles add column wrapped_private_key text;

-- Look up a user by exact email for an invite. SECURITY DEFINER so it can read
-- auth.users; returns only the public key + display name, and only once the
-- person has a contact key set up. Login required (authenticated role only).
create or replace function public.find_user_for_invite(lookup_email text)
returns table (id uuid, public_key text, name text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, p.public_key, p.name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(lookup_email))
    and p.public_key is not null
  limit 1;
$$;
revoke all on function public.find_user_for_invite(text) from public, anon;
grant execute on function public.find_user_for_invite(text) to authenticated;

-- Pending invites: `sealed` holds the space key + name, readable only by to_user.
create table public.space_invites (
  id         uuid primary key,
  space_id   uuid not null references public.spaces (id) on delete cascade,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  sealed     text not null,
  created_at timestamptz not null default now(),
  unique (space_id, to_user)
);

alter table public.space_invites enable row level security;

create policy "invites: member can send" on public.space_invites for insert
  with check (auth.uid() = from_user and public.is_space_member(space_id));
create policy "invites: sender or recipient reads" on public.space_invites for select
  using (auth.uid() = to_user or auth.uid() = from_user);
create policy "invites: sender or recipient deletes" on public.space_invites for delete
  using (auth.uid() = to_user or auth.uid() = from_user);
