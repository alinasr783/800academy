-- Migration to support Reference Blocks as a question type
-- This allows grouping questions under a parent content block

-- 1. Expand the type check constraint
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_type_check;
ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_type_check CHECK (type IN ('mcq', 'fill', 'reference_block'));

-- 2. Add parent_id for child questions
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.exam_questions(id) ON DELETE CASCADE;

-- 3. Add sort_order for children (optional but helpful if question_number is global)
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS child_sort_order INTEGER DEFAULT 0;

-- 4. Indices for performance
CREATE INDEX IF NOT EXISTS idx_exam_questions_parent_id ON public.exam_questions(parent_id);

-- 5. Comments for clarity
COMMENT ON COLUMN public.exam_questions.parent_id IS 'References the Reference Block question that contains this sub-question.';
COMMENT ON COLUMN public.exam_questions.type IS 'mcq, fill, or reference_block (container for sub-questions).';
