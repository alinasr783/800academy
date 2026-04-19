-- Create subtopics table
create table if not exists public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for subtopics
alter table public.subtopics enable row level security;

-- Policies for subtopics (Full access for admin implicitly via auth, Read for everyone)
drop policy if exists subtopics_read_all on public.subtopics;
create policy subtopics_read_all
on public.subtopics
for select
to anon, authenticated
using (true);

-- Add subtopic_id to exam_questions
alter table public.exam_questions
add column if not exists subtopic_id uuid references public.subtopics (id) on delete set null;

-- Migration: Create a "General" subtopic for each existing topic and link existing questions
do $$
declare
    t_record record;
    s_id uuid;
begin
    for t_record in select id, subject_id, title from public.topics loop
        -- Create a "General" subtopic for this topic
        insert into public.subtopics (topic_id, subject_id, title, description)
        values (t_record.id, t_record.subject_id, 'General (' || t_record.title || ')', 'Default subtopic for ' || t_record.title)
        returning id into s_id;

        -- Link existing questions of this topic to the new subtopic
        -- Note: We assume exam_questions has topic_id currently.
        update public.exam_questions
        set subtopic_id = s_id
        where topic_id = t_record.id;
    end loop;
end $$;

-- Optional: Drop topic_id from exam_questions after validation
-- alter table public.exam_questions drop column topic_id;
