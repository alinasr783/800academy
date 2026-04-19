-- Add get_random_questions_by_subtopics RPC
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

-- Update practice_sessions table to store subtopic_ids
alter table public.practice_sessions 
add column if not exists subtopic_ids uuid[];
