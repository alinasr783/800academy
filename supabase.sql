-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_users (
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (user_id),
  CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.blocked_ips (
  ip_address text NOT NULL,
  reason text,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocked_ips_pkey PRIMARY KEY (ip_address)
);
CREATE TABLE public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_offer_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT cart_items_subject_offer_id_fkey FOREIGN KEY (subject_offer_id) REFERENCES public.subject_offers(id)
);
CREATE TABLE public.coupon_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid,
  discount_applied_cents integer NOT NULL,
  ip_address text,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT coupon_usages_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  discount_value numeric NOT NULL CHECK (discount_value > 0::numeric),
  min_order_cents integer DEFAULT 0,
  max_discount_cents integer,
  start_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  is_new_user_only boolean NOT NULL DEFAULT false,
  total_usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  subject_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id),
  CONSTRAINT coupons_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  access_expires_at timestamp with time zone NOT NULL,
  order_item_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_pkey PRIMARY KEY (id),
  CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT entitlements_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT entitlements_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
);
CREATE TABLE public.exam_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  storage_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bucket text NOT NULL DEFAULT 'assets'::text,
  url text,
  CONSTRAINT exam_assets_pkey PRIMARY KEY (id),
  CONSTRAINT exam_assets_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.exam_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 800),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  earned_points integer NOT NULL DEFAULT 0 CHECK (earned_points >= 0),
  total_points integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  percent_correct numeric NOT NULL DEFAULT 0 CHECK (percent_correct >= 0::numeric AND percent_correct <= 100::numeric),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT exam_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT exam_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT exam_attempts_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.exam_passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  title text,
  body_html text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'reading'::text CHECK (kind = ANY (ARRAY['reading'::text, 'reference'::text])),
  CONSTRAINT exam_passages_pkey PRIMARY KEY (id),
  CONSTRAINT exam_passages_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.exam_question_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  bucket text NOT NULL DEFAULT 'assets'::text,
  storage_path text,
  url text,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'prompt'::text,
  CONSTRAINT exam_question_assets_pkey PRIMARY KEY (id),
  CONSTRAINT exam_question_assets_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id)
);
CREATE TABLE public.exam_question_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_number integer NOT NULL CHECK (option_number >= 1),
  text text,
  bucket text NOT NULL DEFAULT 'assets'::text,
  storage_path text,
  url text,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exam_question_options_pkey PRIMARY KEY (id),
  CONSTRAINT exam_question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id)
);
CREATE TABLE public.exam_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  question_number integer NOT NULL CHECK (question_number >= 1),
  type text NOT NULL CHECK (type = ANY (ARRAY['mcq'::text, 'fill'::text, 'reference_block'::text])),
  prompt_text text,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  allow_multiple boolean NOT NULL DEFAULT false,
  correct_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  explanation_text text,
  passage_id uuid,
  topic_id uuid,
  subtopic_id uuid,
  parent_id uuid,
  child_sort_order integer DEFAULT 0,
  CONSTRAINT exam_questions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id),
  CONSTRAINT exam_questions_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES public.exam_passages(id),
  CONSTRAINT exam_questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT exam_questions_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id),
  CONSTRAINT exam_questions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.exam_questions(id)
);
CREATE TABLE public.exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  exam_number integer NOT NULL CHECK (exam_number >= 1),
  title text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_free boolean NOT NULL DEFAULT false,
  duration_seconds integer NOT NULL DEFAULT 2700 CHECK (duration_seconds > 0),
  pass_percent integer NOT NULL DEFAULT 60 CHECK (pass_percent >= 0 AND pass_percent <= 100),
  max_attempts integer CHECK (max_attempts IS NULL OR max_attempts >= 1),
  min_score integer NOT NULL DEFAULT 200 CHECK (min_score >= 0 AND min_score <= 800),
  total_points integer NOT NULL DEFAULT 600 CHECK (total_points > 0),
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.mistake_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  error_count integer NOT NULL DEFAULT 1 CHECK (error_count >= 1),
  difficulty_score numeric NOT NULL DEFAULT 0,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mistake_bank_pkey PRIMARY KEY (id),
  CONSTRAINT mistake_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT mistake_bank_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id)
);
CREATE TABLE public.notification_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_reads_pkey PRIMARY KEY (id),
  CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id),
  CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notification_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'campaign'::text,
  color text NOT NULL DEFAULT '#3e5e95'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type_id uuid,
  title text NOT NULL,
  body text NOT NULL DEFAULT ''::text,
  image_url text,
  target_user_id uuid,
  actions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.notification_types(id),
  CONSTRAINT notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  subject_offer_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  access_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_subject_offer_id_fkey FOREIGN KEY (subject_offer_id) REFERENCES public.subject_offers(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])),
  currency text NOT NULL DEFAULT 'EGP'::text,
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  provider text,
  provider_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  coupon_id uuid,
  discount_cents integer DEFAULT 0,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id)
);
CREATE TABLE public.page_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_hash text NOT NULL,
  path text NOT NULL,
  country text DEFAULT 'Unknown'::text,
  created_at timestamp with time zone DEFAULT now(),
  ip_address text DEFAULT 'unknown'::text,
  city text DEFAULT 'Unknown'::text,
  CONSTRAINT page_visits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.practice_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_ids ARRAY NOT NULL,
  total_questions integer NOT NULL,
  correct_questions integer NOT NULL,
  duration_seconds integer NOT NULL,
  target_accuracy integer NOT NULL,
  percent_correct integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  question_ids ARRAY,
  answers jsonb,
  subtopic_ids ARRAY,
  CONSTRAINT practice_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT practice_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  full_name text,
  phone text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,
  banned_until timestamp with time zone,
  ban_reason text,
  current_streak integer DEFAULT 0,
  last_activity_date date,
  longest_streak integer DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['mcq'::text, 'fill'::text, 'reference_block'::text])),
  prompt_text text,
  explanation_text text,
  points integer DEFAULT 1,
  allow_multiple boolean DEFAULT false,
  correct_text text,
  topic_id uuid,
  subtopic_id uuid,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_bank_pkey PRIMARY KEY (id),
  CONSTRAINT question_bank_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT question_bank_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id),
  CONSTRAINT question_bank_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.question_bank(id)
);
CREATE TABLE public.question_bank_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  bucket text DEFAULT 'assets'::text,
  storage_path text,
  url text,
  alt text,
  kind text CHECK (kind = ANY (ARRAY['prompt'::text, 'explanation'::text])),
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_bank_assets_pkey PRIMARY KEY (id),
  CONSTRAINT question_bank_assets_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id)
);
CREATE TABLE public.question_bank_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_number integer NOT NULL,
  text text,
  bucket text DEFAULT 'assets'::text,
  storage_path text,
  url text,
  is_correct boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_bank_options_pkey PRIMARY KEY (id),
  CONSTRAINT question_bank_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id)
);
CREATE TABLE public.subject_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  url text,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bucket text NOT NULL DEFAULT 'assets'::text,
  storage_path text,
  CONSTRAINT subject_assets_pkey PRIMARY KEY (id),
  CONSTRAINT subject_assets_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.subject_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  label text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'EGP'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  original_price_cents integer,
  CONSTRAINT subject_offers_pkey PRIMARY KEY (id),
  CONSTRAINT subject_offers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  track text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  card_description text,
  marketing_title text,
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subtopic_point_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  point_id uuid NOT NULL,
  url text NOT NULL,
  bucket text DEFAULT 'assets'::text,
  storage_path text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subtopic_point_assets_pkey PRIMARY KEY (id),
  CONSTRAINT subtopic_point_assets_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.subtopic_points(id)
);
CREATE TABLE public.subtopic_point_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  point_id uuid NOT NULL,
  question_id uuid NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subtopic_point_questions_pkey PRIMARY KEY (id),
  CONSTRAINT subtopic_point_questions_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.subtopic_points(id),
  CONSTRAINT subtopic_point_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id)
);
CREATE TABLE public.subtopic_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subtopic_id uuid NOT NULL,
  content_html text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subtopic_points_pkey PRIMARY KEY (id),
  CONSTRAINT subtopic_points_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id)
);
CREATE TABLE public.subtopics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  category text,
  is_free boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  CONSTRAINT subtopics_pkey PRIMARY KEY (id),
  CONSTRAINT subtopics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT subtopics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  subject_id uuid,
  CONSTRAINT topics_pkey PRIMARY KEY (id),
  CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reference_number bigint NOT NULL DEFAULT nextval('transactions_reference_number_seq'::regclass) UNIQUE,
  user_id uuid,
  amount numeric NOT NULL,
  currency text DEFAULT 'EGP'::text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'expired'::text])),
  type text DEFAULT 'subscription'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  easykash_ref text,
  response_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_activities_pkey PRIMARY KEY (id),
  CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  subject_offer_id uuid NOT NULL,
  transaction_id uuid,
  payment_method text DEFAULT 'easykash'::text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'pending_manual'::text])),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_subscriptions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);