-- Minimal auth + profile schema for SomaLux
-- This creates only the tables required for authentication, profile tracking, and basic user identity.
-- Run in the new Supabase project before retrying login.

create extension if not exists "pgcrypto";

-- 1) Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  display_name text,
  role text default 'user' check (role in ('user','admin','moderator')),
  subscription_tier text default 'basic' check (subscription_tier in ('basic','premium','vip')),
  is_active boolean default true,
  last_active_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deactivated_at timestamptz
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_is_active_idx on public.profiles(is_active);

-- 2) Safe trigger to keep a profile row for each auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name, avatar_url, role, subscription_tier, is_active, last_active_at, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'user',
    'basic',
    true,
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 3) Optional user activity log table
create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists user_activity_log_user_id_idx on public.user_activity_log(user_id);
create index if not exists user_activity_log_event_type_idx on public.user_activity_log(event_type);

-- 4) RLS for profiles
alter table public.profiles enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own_or_admin'
  ) THEN
    CREATE POLICY "profiles_select_own_or_admin"
    ON public.profiles
    FOR SELECT
    USING (
      auth.uid() = id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_own_or_admin'
  ) THEN
    CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles
    FOR UPDATE
    USING (
      auth.uid() = id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
      )
    )
    WITH CHECK (
      auth.uid() = id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 5) RLS for user_activity_log
alter table public.user_activity_log enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_log'
      AND policyname = 'activity_select_own_or_admin'
  ) THEN
    CREATE POLICY "activity_select_own_or_admin"
    ON public.user_activity_log
    FOR SELECT
    USING (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_log'
      AND policyname = 'activity_insert_own'
  ) THEN
    CREATE POLICY "activity_insert_own"
    ON public.user_activity_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6: ensure trigger is installed for future users
-- The trigger will create a profile automatically after any new auth user is created.

-- 7: quick metadata note for app expectations
-- Apps like this often use profile fields such as:
-- id, email, full_name, display_name, avatar_url, role, subscription_tier, is_active, last_active_at

-- 8: make sure anon users are allowed to read public profile fields if needed, but keep authentication protected
-- If you later need public profile reads, you can add a public profile read policy separately.
