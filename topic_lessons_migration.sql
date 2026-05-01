-- 1. Alter existing subtopics table instead of topics
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.subtopics ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- 2. Create subtopic_points table
CREATE TABLE IF NOT EXISTS public.subtopic_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id uuid REFERENCES public.subtopics(id) ON DELETE CASCADE NOT NULL,
  content_html text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create subtopic_point_assets table
CREATE TABLE IF NOT EXISTS public.subtopic_point_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  point_id uuid REFERENCES public.subtopic_points(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  bucket text DEFAULT 'assets',
  storage_path text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Create subtopic_point_questions table
CREATE TABLE IF NOT EXISTS public.subtopic_point_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  point_id uuid REFERENCES public.subtopic_points(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.question_bank(id) ON DELETE CASCADE NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.subtopic_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopic_point_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopic_point_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on subtopic_points" ON public.subtopic_points FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on subtopic_point_assets" ON public.subtopic_point_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on subtopic_point_questions" ON public.subtopic_point_questions FOR ALL USING (auth.role() = 'service_role');
