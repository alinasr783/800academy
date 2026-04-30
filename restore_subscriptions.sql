-- Re-create user_subscriptions (run this if you dropped it earlier)
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

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_subject ON public.user_subscriptions(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on subscriptions" ON public.user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
