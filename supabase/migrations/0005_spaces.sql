-- Shared spaces (family ledgers, trip groups). The space key never reaches the
-- server: `meta`/`profile` are ciphertext under the space key, `wrapped_key` is
-- the space key encrypted with that member's personal DEK.
create table public.spaces (
  id          uuid primary key,
  created_by  uuid not null references auth.users (id) on delete cascade,
  meta        text not null,            -- encrypted { name }
  created_at  timestamptz not null default now()
);

create table public.space_members (
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  wrapped_key text not null,            -- space key wrapped by the member's DEK
  profile     text not null,            -- encrypted { name } (display name in this space)
  created_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- SECURITY DEFINER avoids RLS recursion when policies check membership.
create or replace function public.is_space_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.space_members where space_id = s and user_id = auth.uid());
$$;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

create policy "spaces: member select"  on public.spaces for select using (public.is_space_member(id));
create policy "spaces: creator insert" on public.spaces for insert with check (auth.uid() = created_by);

create policy "members: member select" on public.space_members for select using (public.is_space_member(space_id));
create policy "members: self insert"   on public.space_members for insert with check (auth.uid() = user_id);
create policy "members: self update"   on public.space_members for update using (auth.uid() = user_id);
create policy "members: self delete"   on public.space_members for delete using (auth.uid() = user_id);

-- Expenses can now live in a space; any member can read/write those rows.
alter table public.expenses add column space_id uuid references public.spaces (id) on delete cascade;
create index expenses_space on public.expenses (space_id) where space_id is not null;

drop policy "expenses: owner select" on public.expenses;
drop policy "expenses: owner insert" on public.expenses;
drop policy "expenses: owner update" on public.expenses;
drop policy "expenses: owner delete" on public.expenses;

create policy "expenses: select" on public.expenses for select
  using (auth.uid() = user_id or (space_id is not null and public.is_space_member(space_id)));
create policy "expenses: insert" on public.expenses for insert
  with check (auth.uid() = user_id and (space_id is null or public.is_space_member(space_id)));
create policy "expenses: update" on public.expenses for update
  using (auth.uid() = user_id or (space_id is not null and public.is_space_member(space_id)));
create policy "expenses: delete" on public.expenses for delete
  using (auth.uid() = user_id or (space_id is not null and public.is_space_member(space_id)));
