-- Opt-in discoverability: users who turn this on appear in the "pick a user"
-- dropdown. Off by default, so no name is exposed unless the person chooses it.
alter table public.profiles add column discoverable boolean not null default false;

-- Directory for the dropdown: returns ONLY id, name and public key (never the
-- wrapped key columns) for opted-in users, excluding the caller. Login required.
create or replace function public.list_discoverable_users()
returns table (id uuid, name text, public_key text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.public_key
  from public.profiles p
  where p.discoverable = true and p.public_key is not null and p.id <> auth.uid()
  order by p.name
  limit 500;
$$;
revoke all on function public.list_discoverable_users() from public, anon;
grant execute on function public.list_discoverable_users() to authenticated;
