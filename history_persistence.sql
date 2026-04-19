-- ═══════════════════════════════════════════════════════════════
-- Update practice_sessions to store detailed analysis
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.practice_sessions 
ADD COLUMN IF NOT EXISTS question_ids uuid[],
ADD COLUMN IF NOT EXISTS answers jsonb;

COMMENT ON COLUMN public.practice_sessions.question_ids IS 'Array of question UUIDs asked in this session';
COMMENT ON COLUMN public.practice_sessions.answers IS 'JSON object storing user answers { question_id: { selectedOptionIds: [], fillText: "" } }';
