-- ═══════════════════════════════════════════════════════════════
-- Migration: Add Passage-based questions (Reading Comprehension)
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the exam_passages table
CREATE TABLE IF NOT EXISTS public.exam_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text,
  body_html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add updated_at trigger
DROP TRIGGER IF EXISTS set_exam_passages_updated_at ON public.exam_passages;
CREATE TRIGGER set_exam_passages_updated_at
BEFORE UPDATE ON public.exam_passages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Enable RLS and setup Read policy
ALTER TABLE public.exam_passages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_passages_read_all ON public.exam_passages;
CREATE POLICY exam_passages_read_all
ON public.exam_passages
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = exam_passages.exam_id
      AND (
        e.is_free = true
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.entitlements ent
            WHERE ent.user_id = auth.uid()
              AND ent.subject_id = e.subject_id
              AND ent.access_expires_at >= now()
          )
        )
      )
  )
);

-- 4. Add passage_id column to exam_questions table
ALTER TABLE public.exam_questions
ADD COLUMN IF NOT EXISTS passage_id uuid REFERENCES public.exam_passages (id) ON DELETE SET NULL;
