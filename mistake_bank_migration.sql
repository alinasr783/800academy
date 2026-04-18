-- ═══════════════════════════════════════════════════════════════
-- Mistake Bank Table & Schema
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.mistake_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  error_count integer not null default 1 check (error_count >= 1),
  difficulty_score numeric not null default 0,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

-- RLS Policies
alter table public.mistake_bank enable row level security;

drop policy if exists mistake_bank_select_own on public.mistake_bank;
create policy mistake_bank_select_own
on public.mistake_bank
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists mistake_bank_insert_own on public.mistake_bank;
create policy mistake_bank_insert_own
on public.mistake_bank
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists mistake_bank_update_own on public.mistake_bank;
create policy mistake_bank_update_own
on public.mistake_bank
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists mistake_bank_delete_own on public.mistake_bank;
create policy mistake_bank_delete_own
on public.mistake_bank
for delete
to authenticated
using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists set_mistake_bank_updated_at on public.mistake_bank;
create trigger set_mistake_bank_updated_at
  before update on public.mistake_bank
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- RPC: record_mistakes 
-- Inserts new mistakes or increments error_count for existing
-- ═══════════════════════════════════════════════════════════════

create or replace function public.record_mistakes(
  p_user_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q_id uuid;
begin
  -- Validate inputs
  if p_user_id is null or p_question_ids is null or array_length(p_question_ids, 1) = 0 then
    return;
  end if;

  -- Ensure user making request is the one inserting
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  -- Insert or increment error count
  foreach q_id in array p_question_ids loop
    insert into public.mistake_bank (user_id, question_id, error_count, added_at, updated_at)
    values (p_user_id, q_id, 1, now(), now())
    on conflict (user_id, question_id) do update
    set 
      error_count = public.mistake_bank.error_count + 1,
      updated_at = now();
  end loop;
end;
$$;
