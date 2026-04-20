-- 1. Extend question types to support reference blocks
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'reference_block';

-- 2. Add parent_id for hierarchical questions
ALTER TABLE exam_questions 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES exam_questions(id) ON DELETE CASCADE;

-- 3. Update RLS policies (Optional, if you have specific ones for relationships)
-- Usually they inherit from the table level, but ensure SELECT/INSERT/UPDATE are open for admins

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_exam_questions_parent_id ON exam_questions(parent_id);

-- Note: No changes needed to the points logic in DB as sub-questions store their own points, 
-- and parents (blocks) will simply have 0 points or be ignored in sum by logic.
