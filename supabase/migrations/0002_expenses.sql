-- Expenses: ciphertext only. `payload` is the AES-GCM encrypted JSON of the
-- Expense object (amount, category, date, note, ocr text). Nothing readable
-- lives outside `payload` except what sync needs.
create table public.expenses (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     text not null,           -- "<iv b64>.<ciphertext b64>"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz              -- soft delete for sync
);

create index expenses_user_updated on public.expenses (user_id, updated_at desc);

alter table public.expenses enable row level security;

create policy "expenses: owner select" on public.expenses for select using (auth.uid() = user_id);
create policy "expenses: owner insert" on public.expenses for insert with check (auth.uid() = user_id);
create policy "expenses: owner update" on public.expenses for update using (auth.uid() = user_id);
create policy "expenses: owner delete" on public.expenses for delete using (auth.uid() = user_id);

create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
