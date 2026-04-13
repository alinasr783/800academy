alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

create unique index if not exists admin_users_singleton_idx
on public.admin_users ((true));

create or replace function public.sync_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set is_admin = false where is_admin = true;
  update public.profiles set is_admin = true
  where id in (select user_id from public.admin_users);
  return null;
end;
$$;

drop trigger if exists admin_users_sync_insert on public.admin_users;
create trigger admin_users_sync_insert
after insert on public.admin_users
for each statement execute function public.sync_admin_flag();

drop trigger if exists admin_users_sync_delete on public.admin_users;
create trigger admin_users_sync_delete
after delete on public.admin_users
for each statement execute function public.sync_admin_flag();

drop policy if exists profiles_admin_select_all on public.profiles;
create policy profiles_admin_select_all
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  )
);

drop policy if exists profiles_admin_update_all on public.profiles;
create policy profiles_admin_update_all
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  )
);
