-- Budgets: one encrypted blob per user.
create table public.budgets (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  payload     text not null,           -- encrypted JSON of Budget
  updated_at  timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "budgets: owner select" on public.budgets for select using (auth.uid() = user_id);
create policy "budgets: owner insert" on public.budgets for insert with check (auth.uid() = user_id);
create policy "budgets: owner update" on public.budgets for update using (auth.uid() = user_id);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
