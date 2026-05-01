-- 1. Drop old tables created in the first migration
DROP TABLE IF EXISTS public.topic_point_questions CASCADE;
DROP TABLE IF EXISTS public.topic_point_assets CASCADE;
DROP TABLE IF EXISTS public.topic_points CASCADE;

-- 2. Remove columns added to the 'topics' table
ALTER TABLE public.topics DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.topics DROP COLUMN IF EXISTS category;
ALTER TABLE public.topics DROP COLUMN IF EXISTS is_free;

-- 3. Add the columns to 'subtopics' table instead
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- 4. Create subtopic_points table
CREATE TABLE IF NOT EXISTS public.subtopic_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id uuid REFERENCES public.subtopics(id) ON DELETE CASCADE NOT NULL,
  content_html text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create subtopic_point_assets table
CREATE TABLE IF NOT EXISTS public.subtopic_point_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  point_id uuid REFERENCES public.subtopic_points(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  bucket text DEFAULT 'assets',
  storage_path text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 6. Create subtopic_point_questions table
CREATE TABLE IF NOT EXISTS public.subtopic_point_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  point_id uuid REFERENCES public.subtopic_points(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.question_bank(id) ON DELETE CASCADE NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 7. RLS Policies (Admins only for modification, Public read for point content but auth handles access in app)
ALTER TABLE public.subtopic_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopic_point_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopic_point_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on subtopic_points" ON public.subtopic_points FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on subtopic_point_assets" ON public.subtopic_point_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on subtopic_point_questions" ON public.subtopic_point_questions FOR ALL USING (auth.role() = 'service_role');
