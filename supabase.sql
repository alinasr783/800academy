create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  track text,
  card_description text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subjects
add column if not exists card_description text;

drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

alter table public.subjects enable row level security;

drop policy if exists subjects_read_all on public.subjects;
create policy subjects_read_all
on public.subjects
for select
to anon, authenticated
using (true);

create table if not exists public.subject_offers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  label text not null,
  expires_at timestamptz not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EGP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_subject_offers_updated_at on public.subject_offers;
create trigger set_subject_offers_updated_at
before update on public.subject_offers
for each row execute function public.set_updated_at();

alter table public.subject_offers enable row level security;

drop policy if exists subject_offers_read_all on public.subject_offers;
create policy subject_offers_read_all
on public.subject_offers
for select
to anon, authenticated
using (true);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_number integer not null check (exam_number >= 1),
  title text not null,
  is_free boolean not null default false,
  duration_seconds integer not null default 2700 check (duration_seconds > 0),
  pass_percent integer not null default 60 check (pass_percent >= 0 and pass_percent <= 100),
  max_attempts integer check (max_attempts is null or max_attempts >= 1),
  min_score integer not null default 200 check (min_score >= 0 and min_score <= 800),
  total_points integer not null default 600 check (total_points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, exam_number)
);

drop trigger if exists set_exams_updated_at on public.exams;
create trigger set_exams_updated_at
before update on public.exams
for each row execute function public.set_updated_at();

alter table public.exams enable row level security;

drop policy if exists exams_read_all on public.exams;
create policy exams_read_all
on public.exams
for select
to anon, authenticated
using (true);

create table if not exists public.exam_assets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  bucket text not null default 'assets',
  storage_path text,
  url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (exam_id, bucket, storage_path)
);

alter table public.exam_assets enable row level security;

drop policy if exists exam_assets_read_all on public.exam_assets;
create policy exam_assets_read_all
on public.exam_assets
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.exams e
    where e.id = exam_assets.exam_id
      and (
        e.is_free = true
        or (
          auth.uid() is not null
          and exists (
            select 1
            from public.entitlements ent
            where ent.user_id = auth.uid()
              and ent.subject_id = e.subject_id
              and ent.access_expires_at >= now()
          )
        )
      )
  )
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  question_number integer not null check (question_number >= 1),
  type text not null check (type in ('mcq','fill')),
  prompt_text text,
  explanation_text text,
  points integer not null default 0 check (points >= 0),
  allow_multiple boolean not null default false,
  correct_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, question_number)
);

alter table public.exam_questions
add column if not exists explanation_text text;

drop trigger if exists set_exam_questions_updated_at on public.exam_questions;
create trigger set_exam_questions_updated_at
before update on public.exam_questions
for each row execute function public.set_updated_at();

alter table public.exam_questions enable row level security;

drop policy if exists exam_questions_read_all on public.exam_questions;
create policy exam_questions_read_all
on public.exam_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.exams e
    where e.id = exam_questions.exam_id
      and (
        e.is_free = true
        or (
          auth.uid() is not null
          and exists (
            select 1
            from public.entitlements ent
            where ent.user_id = auth.uid()
              and ent.subject_id = e.subject_id
              and ent.access_expires_at >= now()
          )
        )
      )
  )
);

create table if not exists public.exam_question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  bucket text not null default 'assets',
  storage_path text,
  url text,
  alt text,
  kind text not null default 'prompt' check (kind in ('prompt','explanation')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, bucket, storage_path)
);

alter table public.exam_question_assets enable row level security;

alter table public.exam_question_assets
add column if not exists kind text not null default 'prompt';

update public.exam_question_assets
set kind = 'prompt'
where kind is null;

drop policy if exists exam_question_assets_read_all on public.exam_question_assets;
create policy exam_question_assets_read_all
on public.exam_question_assets
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    join public.exams e on e.id = q.exam_id
    where q.id = exam_question_assets.question_id
      and (
        e.is_free = true
        or (
          auth.uid() is not null
          and exists (
            select 1
            from public.entitlements ent
            where ent.user_id = auth.uid()
              and ent.subject_id = e.subject_id
              and ent.access_expires_at >= now()
          )
        )
      )
  )
);

create table if not exists public.exam_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  option_number integer not null check (option_number >= 1),
  text text,
  bucket text not null default 'assets',
  storage_path text,
  url text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, option_number)
);

alter table public.exam_question_options enable row level security;

drop policy if exists exam_question_options_read_all on public.exam_question_options;
create policy exam_question_options_read_all
on public.exam_question_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    join public.exams e on e.id = q.exam_id
    where q.id = exam_question_options.question_id
      and (
        e.is_free = true
        or (
          auth.uid() is not null
          and exists (
            select 1
            from public.entitlements ent
            where ent.user_id = auth.uid()
              and ent.subject_id = e.subject_id
              and ent.access_expires_at >= now()
          )
        )
      )
  )
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  score integer not null check (score >= 0 and score <= 800),
  duration_seconds integer not null check (duration_seconds >= 0),
  earned_points integer not null default 0 check (earned_points >= 0),
  total_points integer not null default 0 check (total_points >= 0),
  percent_correct numeric not null default 0 check (percent_correct >= 0 and percent_correct <= 100),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.exam_attempts enable row level security;

drop policy if exists exam_attempts_select_own on public.exam_attempts;
create policy exam_attempts_select_own
on public.exam_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists exam_attempts_insert_own on public.exam_attempts;
create policy exam_attempts_insert_own
on public.exam_attempts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.exams e
    where e.id = exam_attempts.exam_id
      and (
        e.is_free = true
        or exists (
          select 1
          from public.entitlements ent
          where ent.user_id = auth.uid()
            and ent.subject_id = e.subject_id
            and ent.access_expires_at >= now()
        )
      )
      and (
        e.max_attempts is null
        or (
          select count(1)
          from public.exam_attempts ea
          where ea.user_id = auth.uid()
            and ea.exam_id = e.id
        ) < e.max_attempts
      )
  )
);

create index if not exists exam_attempts_user_submitted_idx
on public.exam_attempts (user_id, submitted_at desc);

create index if not exists exam_attempts_exam_idx
on public.exam_attempts (exam_id);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_offer_id uuid not null references public.subject_offers (id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subject_offer_id)
);

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

alter table public.cart_items enable row level security;

drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own
on public.cart_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own
on public.cart_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
on public.cart_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
on public.cart_items
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  currency text not null default 'EGP',
  total_cents integer not null default 0 check (total_cents >= 0),
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists orders_update_own on public.orders;
create policy orders_update_own
on public.orders
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  subject_offer_id uuid not null references public.subject_offers (id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  access_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
on public.order_items
for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  access_expires_at timestamptz not null,
  order_item_id uuid references public.order_items (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own
on public.entitlements
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists entitlements_insert_own on public.entitlements;
create policy entitlements_insert_own
on public.entitlements
for insert
to authenticated
with check (auth.uid() = user_id);

insert into public.subjects (slug, title, track, description)
values
  ('est-1-math-core', 'EST 1 : Math Core', 'EST 1', 'Advanced algebraic concepts and data analysis modeled for the EST 1 environment.'),
  ('est-1-literacy', 'EST 1 : Literacy', 'EST 1', 'Reading comprehension and grammar modules designed for EST 1 mastery.'),
  ('est-2-math-level-1', 'EST 2 : Math Level 1', 'EST 2', 'Trigonometry, functions, and advanced geometric properties.'),
  ('est-2-biology-specialist', 'EST 2 : Biology Specialist', 'EST 2', 'Molecular biology, genetics, and ecology trials designed by subject experts.'),
  ('sat-literacy', 'SAT Literacy', 'DIGITAL SAT', 'Digital SAT Reading and Writing structure with an adaptive testing engine.'),
  ('sat-digital-math', 'SAT Digital Math', 'DIGITAL SAT', 'Master the Desmos calculator and digital interface tools for SAT success.')
on conflict (slug) do nothing;

with s as (
  select id, slug from public.subjects
),
nums as (
  select generate_series(1,20) as n
)
insert into public.exams (subject_id, exam_number, title)
select s.id, nums.n, 'Mock Exam ' || nums.n
from s
cross join nums
on conflict (subject_id, exam_number) do nothing;

alter table public.exams
add column if not exists is_free boolean not null default false;

update public.exams
set is_free = false;

update public.exams
set is_free = true
where exam_number = 1;

create table if not exists public.subject_assets (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  url text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, url)
);

alter table public.subject_assets
add column if not exists bucket text not null default 'assets';

alter table public.subject_assets
add column if not exists storage_path text;

alter table public.subject_assets
alter column url drop not null;

alter table public.subject_assets enable row level security;

drop policy if exists subject_assets_read_all on public.subject_assets;
create policy subject_assets_read_all
on public.subject_assets
for select
to anon, authenticated
using (true);

-- ═══════════════════════════════════════════════════════════════
-- Passage-based questions (Reading Comprehension)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.exam_passages (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  sort_order integer not null default 0,
  title text,
  body_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_exam_passages_updated_at on public.exam_passages;
create trigger set_exam_passages_updated_at
before update on public.exam_passages
for each row execute function public.set_updated_at();

alter table public.exam_passages enable row level security;

drop policy if exists exam_passages_read_all on public.exam_passages;
create policy exam_passages_read_all
on public.exam_passages
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.exams e
    where e.id = exam_passages.exam_id
      and (
        e.is_free = true
        or (
          auth.uid() is not null
          and exists (
            select 1
            from public.entitlements ent
            where ent.user_id = auth.uid()
              and ent.subject_id = e.subject_id
              and ent.access_expires_at >= now()
          )
        )
      )
  )
);

-- Link questions to passages (nullable FK)
alter table public.exam_questions
add column if not exists passage_id uuid references public.exam_passages (id) on delete set null;
