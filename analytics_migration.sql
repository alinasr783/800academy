-- ============================================
-- 800 Academy — Analytics Tracking Schema
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.page_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_hash text NOT NULL,
  path text NOT NULL,
  country text DEFAULT 'Unknown',
  created_at timestamptz DEFAULT now()
);

-- Index for fast analytics grouping by date
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits(created_at);
-- Index to quickly find unique visitors
CREATE INDEX IF NOT EXISTS idx_page_visits_session_hash ON public.page_visits(session_hash);

-- Enable RLS
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (we will insert visits via server actions with service role)
CREATE POLICY "Service role full access on page_visits" ON public.page_visits
  FOR ALL USING (auth.role() = 'service_role');
