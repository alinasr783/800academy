-- ═══════════════════════════════════════════════════════════════
-- Brain Gym: Practice Sessions
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_ids uuid[] not null,
  total_questions integer not null,
  correct_questions integer not null,
  duration_seconds integer not null,
  target_accuracy integer not null,
  percent_correct integer not null,
  created_at timestamptz not null default now()
);

-- RLS Policies
alter table public.practice_sessions enable row level security;

drop policy if exists practice_sessions_select_own on public.practice_sessions;
create policy practice_sessions_select_own
on public.practice_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists practice_sessions_insert_own on public.practice_sessions;
create policy practice_sessions_insert_own
on public.practice_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

-- Helper index for history fetching
create index if not exists idx_practice_sessions_user_date on public.practice_sessions (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- RPC: get_random_questions_by_topics
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_random_questions_by_topics(
  p_topic_ids uuid[],
  p_limit integer
)
returns setof public.exam_questions
language sql
security definer
set search_path = public
as $$
  select *
  from exam_questions
  where topic_id = any(p_topic_ids)
  order by random()
  limit p_limit;
$$;
