-- Recurring rules: one encrypted blob per user (same shape as budgets).
create table public.recurring (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  payload     text not null,           -- encrypted JSON of RecurringRule[]
  updated_at  timestamptz not null default now()
);

alter table public.recurring enable row level security;

create policy "recurring: owner select" on public.recurring for select using (auth.uid() = user_id);
create policy "recurring: owner insert" on public.recurring for insert with check (auth.uid() = user_id);
create policy "recurring: owner update" on public.recurring for update using (auth.uid() = user_id);

create trigger recurring_updated_at before update on public.recurring
  for each row execute function public.set_updated_at();
