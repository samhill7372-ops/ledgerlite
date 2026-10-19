-- Discoverability: users appear in the "pick a user" dropdown. Default ON
-- (opt-out): everyone with a contact key is listed unless they switch it off.
-- (Existing rows get true automatically from the column default.)
alter table public.profiles add column discoverable boolean not null default true;

-- Directory for the dropdown: returns ONLY id, name and public key (never the
-- wrapped key columns) for opted-in users, excluding the caller. Login required.
create or replace function public.list_discoverable_users()
returns table (id uuid, name text, public_key text)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.name, p.public_key
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.discoverable = true and p.public_key is not null and p.id <> auth.uid()
    and u.email not like '%@ledgerlite-test.dev'   -- never surface automated-test accounts
  order by p.name
  limit 500;
$$;
revoke all on function public.list_discoverable_users() from public, anon;
grant execute on function public.list_discoverable_users() to authenticated;
