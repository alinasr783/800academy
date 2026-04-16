-- ═══════════════════════════════════════════════════════════════
-- Migration: Add 'kind' column to exam_passages
-- Supports both "Reading Passages" and "Reference Blocks"
-- ═══════════════════════════════════════════════════════════════

-- 1. Add 'kind' column to exam_passages with a check constraint
ALTER TABLE public.exam_passages
ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'reading' CHECK (kind IN ('reading', 'reference'));

-- The default 'reading' ensures that all existing reading passages work perfectly without any issue.
-- The exam_questions.passage_id logic remains completely unchanged.
