-- ============================================
-- 800 Academy — Marketing Title Migration
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Add marketing_title column to subjects table
-- This is a promotional title shown on the subject detail page instead of the regular title.
-- Falls back to regular title if NULL.
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS marketing_title text DEFAULT NULL;

-- 2. Add a comment for documentation
COMMENT ON COLUMN public.subjects.marketing_title IS 'A promotional/marketing title shown on the subject detail page. Falls back to subjects.title if NULL.';
