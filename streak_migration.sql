-- Daily Streak System Migration

-- 1. Create activity log table to track which days user was active
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, activity_date)
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Policies for user_activities
CREATE POLICY "Users can view their own activity logs"
    ON public.user_activities FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Add streak columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_date DATE,
ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;

-- 3. Create a function to update streak logic (can be called via RPC or handle in API)
-- We will handle the logic in the API for better control over notifications, 
-- but we could also use a trigger. Let's keep it in the API for now as requested.

-- 4. Indices for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_date ON public.user_activities(user_id, activity_date);
