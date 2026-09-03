-- Admin role support for SomaLux
-- Run after 001_auth.sql in the same Supabase project.

-- 1) Ensure roles are supported properly
alter table public.profiles
  alter column role set default 'user';

-- 2) Add a safe helper to promote a user to admin
create or replace function public.promote_user_to_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'admin',
      updated_at = now()
  where id = p_user_id;

  return found;
end;
$$;

-- 3) Add helper to promote to moderator
create or replace function public.promote_user_to_moderator(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'moderator',
      updated_at = now()
  where id = p_user_id;

  return found;
end;
$$;

-- 4) Add helper to demote to user
create or replace function public.demote_user_to_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'user',
      updated_at = now()
  where id = p_user_id;

  return found;
end;
$$;

-- 5) Add admin-only RLS policies for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_admin_full_access'
  ) THEN
    CREATE POLICY "profiles_admin_full_access"
    ON public.profiles
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END $$;

-- 6) Allow admins to manage user_activity_log as needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_log'
      AND policyname = 'activity_admin_full_access'
  ) THEN
    CREATE POLICY "activity_admin_full_access"
    ON public.user_activity_log
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END $$;

-- 7) Add admin email seed example
-- Replace with actual admin email(s) after this migration is applied.
-- Example:
-- update public.profiles
-- set role = 'admin'
-- where email = 'admin@example.com';

-- 8) Backfill profiles for existing auth users so avatar + role data appears immediately
insert into public.profiles (
  id,
  email,
  full_name,
  display_name,
  avatar_url,
  role,
  subscription_tier,
  is_active,
  last_active_at,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  coalesce(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture'
  ),
  'user',
  'basic',
  true,
  now(),
  now(),
  now()
from auth.users u
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

-- 9) Promote the known admin accounts by email (case-insensitive)
update public.profiles
set role = 'admin',
    updated_at = now()
where lower(email) in (
  'campuslives254@gmail.com',
  'paltechsomalux@gmail.com',
  'eliblearning@gmail.com'
);

-- 10) Example: promote a specific user by auth user id
-- update public.profiles
-- set role = 'admin', updated_at = now()
-- where id = (select id from auth.users where email = 'eliblearning@gmail.com');
