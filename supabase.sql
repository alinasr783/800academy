-- ============================================
-- 800 Academy — Checkout & Payments Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Add original_price_cents to subject_offers (from previous migration)
ALTER TABLE public.subject_offers 
ADD COLUMN IF NOT EXISTS original_price_cents integer DEFAULT NULL;

-- 2. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number bigserial UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'EGP',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  type text DEFAULT 'subscription',
  metadata jsonb DEFAULT '{}',
  easykash_ref text,
  response_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by reference_number (used in callbacks)
CREATE INDEX IF NOT EXISTS idx_transactions_reference_number ON public.transactions(reference_number);
-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- 3. Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid NOT NULL,
  subject_offer_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_method text DEFAULT 'easykash', -- 'easykash' or 'whatsapp_manual'
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_manual')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for checking if a user has an active subscription for a subject
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_subject ON public.user_subscriptions(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

-- 4. Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can create own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access on transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Enable RLS on user_subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on subscriptions" ON public.user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
