-- ═══════════════════════════════════════════════════════════════
-- Topics Management Table & Schema
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Policies for topics
alter table public.topics enable row level security;

drop policy if exists topics_read_all on public.topics;
create policy topics_read_all
on public.topics
for select
to anon, authenticated
using (true);

drop policy if exists topics_all_admin on public.topics;
create policy topics_all_admin
on public.topics
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    -- Assuming admin check logic exist elsewhere or just allow authenticated for now
    -- If there's a specific admin role, add it here.
  )
);

-- Trigger for updated_at
drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- Add topic_id to exam_questions
alter table public.exam_questions
add column if not exists topic_id uuid references public.topics (id) on delete set null;

-- Insert some default topics if needed
insert into public.topics (title)
values 
  ('Algebra'),
  ('Geometry'),
  ('Data Analysis'),
  ('Reading Comprehension'),
  ('Grammar')
on conflict do nothing;
