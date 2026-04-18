-- ═══════════════════════════════════════════════════════════════
-- Link Topics to Subjects (Packages)
-- ═══════════════════════════════════════════════════════════════

-- Add subject_id column to topics table
alter table public.topics
add column if not exists subject_id uuid references public.subjects(id) on delete cascade;

-- Note: If you have existing topics, you should manually associate them 
-- with a subject or use a default one like this:
-- update public.topics set subject_id = (select id from public.subjects limit 1) where subject_id is null;

-- You can also make it NOT NULL after assigning subjects to all rows
-- alter table public.topics alter column subject_id set not null;
