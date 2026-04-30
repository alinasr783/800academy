-- ============================================
-- 800 Academy — Analytics V2 & Schema Cleanup
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Drop the unused user_subscriptions table 
-- (Assuming it was safe to drop as requested, since transactions handle everything)
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;

-- 2. Add ip_address and city columns to page_visits table
ALTER TABLE public.page_visits 
ADD COLUMN IF NOT EXISTS ip_address text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Unknown';

-- 3. Add an index for ip_address to quickly aggregate unique IPs
CREATE INDEX IF NOT EXISTS idx_page_visits_ip_address ON public.page_visits(ip_address);
