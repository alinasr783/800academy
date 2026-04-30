-- ============================================================
-- Notification System Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Notification Types (templates/categories)
CREATE TABLE IF NOT EXISTS public.notification_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'campaign',          -- Material Symbol icon name
  color text NOT NULL DEFAULT '#3e5e95',           -- Hex color for the icon badge
  created_at timestamptz DEFAULT now()
);

-- 2. Notifications (actual sent notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type_id uuid REFERENCES public.notification_types(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,                                   -- Optional image
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = broadcast to all
  actions jsonb DEFAULT '[]'::jsonb,                -- [{label, href}, ...]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Notification Reads (tracks which user read which notification)
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)                 -- One read per user per notification
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_type_id ON public.notifications(type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_active_created ON public.notifications(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notif_user ON public.notification_reads(notification_id, user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- notification_types: readable by everyone, writable by service role
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification types"
  ON public.notification_types FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on notification_types"
  ON public.notification_types FOR ALL
  USING (auth.role() = 'service_role');

-- notifications: users can read their own (broadcast + targeted)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active notifications targeted to them or broadcast"
  ON public.notifications FOR SELECT
  USING (
    is_active = true
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
  );

CREATE POLICY "Service role full access on notifications"
  ON public.notifications FOR ALL
  USING (auth.role() = 'service_role');

-- notification_reads: users can read/write their own
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification reads"
  ON public.notification_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification reads"
  ON public.notification_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access on notification_reads"
  ON public.notification_reads FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Seed: Default notification types
-- ============================================================
INSERT INTO public.notification_types (name, icon, color) VALUES
  ('Announcement', 'campaign', '#3e5e95'),
  ('New Content', 'auto_awesome', '#10b981'),
  ('Special Offer', 'local_offer', '#f59e0b'),
  ('Reminder', 'alarm', '#ef4444'),
  ('Update', 'system_update', '#6366f1')
ON CONFLICT DO NOTHING;
