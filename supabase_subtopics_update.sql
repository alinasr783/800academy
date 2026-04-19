-- 1. Create Subtopics Table
create table if not exists public.subtopics (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references public.topics(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now()
);

-- 2. Add subtopic_id to exam_questions
alter table public.exam_questions 
add column if not exists subtopic_id uuid references public.subtopics(id) on delete set null;

-- 3. Update practice_sessions for subtopic tracking
alter table public.practice_sessions 
add column if not exists subtopic_ids uuid[];

-- 4. RPC for fetching random questions by subtopics
create or replace function public.get_random_questions_by_subtopics(
  p_subtopic_ids uuid[],
  p_limit integer
)
returns setof public.exam_questions
language sql
security definer
set search_path = public
as $$
  select *
  from exam_questions
  where subtopic_id = any(p_subtopic_ids)
  order by random()
  limit p_limit;
$$;

-- 5. Helper migration: Create a "General" subtopic for each existing topic and move questions
do $$
declare
  t_row record;
  new_st_id uuid;
begin
  for t_row in select id, subject_id, title from public.topics loop
    -- Check if it already has a subtopic named General
    if not exists (select 1 from public.subtopics where topic_id = t_row.id and title = 'General') then
      insert into public.subtopics (topic_id, subject_id, title, description)
      values (t_row.id, t_row.subject_id, 'General', 'Default category for ' || t_row.title)
      returning id into new_st_id;
      
      -- Link current questions of this topic to this new General subtopic
      update public.exam_questions 
      set subtopic_id = new_st_id 
      where topic_id = t_row.id and subtopic_id is null;
    end if;
  end loop;
end $$;
