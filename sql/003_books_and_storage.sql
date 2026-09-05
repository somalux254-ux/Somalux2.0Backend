-- SomaLux books, covers, uploads, and reading features
-- Run after 001_auth.sql and 002_admin_roles.sql.

create extension if not exists "pgcrypto";

-- Match the role values exposed by the admin dashboard.
alter table if exists public.profiles drop constraint if exists profiles_role_check;
alter table if exists public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'viewer', 'editor', 'admin', 'moderator', 'super_admin'));

alter table if exists public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table if exists public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('basic', 'premium', 'premium_pro', 'vip'));

-- Roles are checked through a security-definer function to avoid recursive
-- profiles RLS policies.
create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and role in ('admin', 'moderator', 'editor', 'super_admin') and is_active = true
  );
$$;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  description text not null default '',
  isbn text,
  year integer,
  language text,
  pages integer,
  publisher text,
  file_url text,
  file_path text,
  cover_image_url text,
  cover_path text,
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default true,
  views_count bigint not null default 0,
  downloads_count bigint not null default 0,
  likes_count bigint not null default 0,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  rating_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  description text not null default '',
  isbn text,
  year integer,
  language text,
  pages integer,
  publisher text,
  file_url text,
  file_path text,
  cover_url text,
  cover_path text,
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  website_url text not null default '',
  cover_image_url text,
  location text not null default '',
  established integer,
  student_count bigint not null default 0,
  views bigint not null default 0,
  likes_count bigint not null default 0,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists universities_name_idx on public.universities(name);
create index if not exists universities_status_idx on public.universities(status);
create index if not exists universities_created_at_idx on public.universities(created_at desc);

create table if not exists public.past_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  unit_code text not null default '',
  unit_name text not null default '',
  faculty text not null default '',
  university_id uuid references public.universities(id) on delete set null,
  file_url text,
  file_path text,
  year integer,
  semester text,
  exam_type text,
  downloads_count bigint not null default 0,
  views_count bigint not null default 0,
  views bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_likes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create table if not exists public.book_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text not null check (length(trim(comment)) > 0),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.book_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reply text not null check (length(trim(reply)) > 0),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.book_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table if not exists public.book_views (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  view_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.book_downloads (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  last_page integer,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, user_id)
);


create index if not exists books_uploaded_by_idx on public.books(uploaded_by);
create index if not exists past_papers_university_id_idx on public.past_papers(university_id);
create index if not exists past_papers_faculty_idx on public.past_papers(faculty);
create index if not exists past_papers_created_at_idx on public.past_papers(created_at desc);
create index if not exists past_papers_uploaded_by_idx on public.past_papers(uploaded_by);
create index if not exists books_created_at_idx on public.books(created_at desc);
create index if not exists books_published_idx on public.books(is_published);
create index if not exists book_submissions_status_idx on public.book_submissions(status, created_at desc);
create index if not exists book_submissions_uploaded_by_idx on public.book_submissions(uploaded_by);
create index if not exists book_likes_book_id_idx on public.book_likes(book_id);
create index if not exists book_comments_book_id_idx on public.book_comments(book_id, created_at desc);
create index if not exists book_views_book_id_idx on public.book_views(book_id, view_date desc);
create index if not exists book_downloads_book_id_idx on public.book_downloads(book_id, downloaded_at desc);
create index if not exists reading_history_user_id_idx on public.reading_history(user_id, last_read_at desc);

-- Keep aggregate counters consistent with feature rows.
create or replace function public.refresh_book_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.books
  set likes_count = (select count(*) from public.book_likes where book_id = coalesce(new.book_id, old.book_id)),
      updated_at = now()
  where id = coalesce(new.book_id, old.book_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists book_like_count_trigger on public.book_likes;
create trigger book_like_count_trigger
after insert or delete on public.book_likes
for each row execute function public.refresh_book_like_count();

create or replace function public.increment_book_views(p_book_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
begin
  update public.books set views_count = views_count + 1, updated_at = now()
  where id = p_book_id
  returning views_count into new_count;
  insert into public.book_views (book_id, user_id) values (p_book_id, auth.uid());
  return coalesce(new_count, 0);
end;
$$;

-- User avatars: authenticated users may manage only files in their own folder.
drop policy if exists "Allow authenticated upload to user-avatars" on storage.objects;
drop policy if exists "Authenticated users can upload to user-avatars" on storage.objects;
drop policy if exists "Allow public read user-avatars" on storage.objects;
drop policy if exists "Public can read user-avatars" on storage.objects;
drop policy if exists "Allow users to delete their own avatars" on storage.objects;
drop policy if exists "Authenticated users can delete from user-avatars" on storage.objects;

create policy "Authenticated users can upload own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Public can read user avatars"
on storage.objects for select
using (bucket_id = 'user-avatars');

create policy "Authenticated users can delete own avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.increment_book_downloads(p_book_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
begin
  update public.books set downloads_count = downloads_count + 1, updated_at = now()
  where id = p_book_id
  returning downloads_count into new_count;
  insert into public.book_downloads (book_id, user_id) values (p_book_id, auth.uid());
  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.is_content_admin() to anon, authenticated;
grant execute on function public.increment_book_views(uuid) to anon, authenticated;
grant execute on function public.increment_book_downloads(uuid) to anon, authenticated;

-- Public catalog reads; writes are authenticated and owner/admin controlled.
alter table public.books enable row level security;
alter table public.book_submissions enable row level security;
alter table public.past_papers enable row level security;
alter table public.book_likes enable row level security;
alter table public.book_comments enable row level security;
alter table public.book_replies enable row level security;
alter table public.book_comment_likes enable row level security;
alter table public.book_views enable row level security;
alter table public.book_downloads enable row level security;
alter table public.reading_history enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_admin_full_access on public.profiles;

create policy profiles_select_own_or_admin on public.profiles
for select using (id::text = auth.uid()::text or public.is_content_admin());
create policy profiles_update_own_or_admin on public.profiles
for update using (id::text = auth.uid()::text or public.is_content_admin())
with check (id::text = auth.uid()::text or public.is_content_admin());
create policy profiles_insert_own on public.profiles
for insert with check (id::text = auth.uid()::text);
create policy profiles_admin_full_access on public.profiles
for all using (public.is_content_admin()) with check (public.is_content_admin());

drop policy if exists books_public_read on public.books;
drop policy if exists books_owner_or_admin_insert on public.books;
drop policy if exists books_owner_or_admin_update on public.books;
drop policy if exists books_admin_delete on public.books;
drop policy if exists submissions_owner_read on public.book_submissions;
drop policy if exists submissions_owner_insert on public.book_submissions;
drop policy if exists submissions_admin_update on public.book_submissions;
drop policy if exists submissions_admin_delete on public.book_submissions;
drop policy if exists past_papers_public_read on public.past_papers;
drop policy if exists past_papers_owner_or_admin_insert on public.past_papers;
drop policy if exists past_papers_owner_or_admin_update on public.past_papers;
drop policy if exists past_papers_admin_delete on public.past_papers;
drop policy if exists likes_public_read on public.book_likes;
drop policy if exists likes_own_insert on public.book_likes;
drop policy if exists likes_own_delete on public.book_likes;
drop policy if exists comments_public_read on public.book_comments;
drop policy if exists comments_own_write on public.book_comments;
drop policy if exists replies_public_read on public.book_replies;
drop policy if exists replies_own_write on public.book_replies;
drop policy if exists comment_likes_public_read on public.book_comment_likes;
drop policy if exists comment_likes_own_write on public.book_comment_likes;
drop policy if exists views_public_read on public.book_views;
drop policy if exists downloads_public_read on public.book_downloads;
drop policy if exists history_own_access on public.reading_history;

create policy books_public_read on public.books for select using (is_published = true or public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy books_owner_or_admin_insert on public.books for insert with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy books_owner_or_admin_update on public.books for update using (public.is_content_admin() or uploaded_by::text = auth.uid()::text) with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy books_admin_delete on public.books for delete using (public.is_content_admin());

create policy submissions_owner_read on public.book_submissions for select using (uploaded_by::text = auth.uid()::text or public.is_content_admin());
create policy submissions_owner_insert on public.book_submissions for insert with check (auth.uid() is not null and uploaded_by::text = auth.uid()::text);
create policy submissions_admin_update on public.book_submissions for update using (public.is_content_admin()) with check (public.is_content_admin());
create policy submissions_admin_delete on public.book_submissions for delete using (public.is_content_admin());

create policy past_papers_public_read on public.past_papers for select using (true);
create policy past_papers_owner_or_admin_insert on public.past_papers for insert with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy past_papers_owner_or_admin_update on public.past_papers for update using (public.is_content_admin() or uploaded_by::text = auth.uid()::text) with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy past_papers_admin_delete on public.past_papers for delete using (public.is_content_admin());

create policy likes_public_read on public.book_likes for select using (true);
create policy likes_own_insert on public.book_likes for insert with check (auth.uid()::text = user_id::text);
create policy likes_own_delete on public.book_likes for delete using (auth.uid()::text = user_id::text or public.is_content_admin());


create policy comments_public_read on public.book_comments for select using (is_deleted = false or auth.uid()::text = user_id::text or public.is_content_admin());
create policy comments_own_write on public.book_comments for all using (auth.uid()::text = user_id::text or public.is_content_admin()) with check (auth.uid()::text = user_id::text or public.is_content_admin());
create policy replies_public_read on public.book_replies for select using (is_deleted = false or auth.uid()::text = user_id::text or public.is_content_admin());
create policy replies_own_write on public.book_replies for all using (auth.uid()::text = user_id::text or public.is_content_admin()) with check (auth.uid()::text = user_id::text or public.is_content_admin());
create policy comment_likes_public_read on public.book_comment_likes for select using (true);
create policy comment_likes_own_write on public.book_comment_likes for all using (auth.uid()::text = user_id::text or public.is_content_admin()) with check (auth.uid()::text = user_id::text or public.is_content_admin());

create policy views_public_read on public.book_views for select using (public.is_content_admin() or auth.uid()::text = user_id::text);
create policy downloads_public_read on public.book_downloads for select using (public.is_content_admin() or auth.uid()::text = user_id::text);
create policy history_own_access on public.reading_history for all using (auth.uid()::text = user_id::text or public.is_content_admin()) with check (auth.uid()::text = user_id::text or public.is_content_admin());

-- Public image/PDF reads and authenticated uploads. Paths should begin with auth.uid()
-- for user-owned uploads, or be written by an admin service/backend.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('elib-books', 'elib-books', true, 52428800),
  ('elib-covers', 'elib-covers', true, 10485760),
  ('book-files', 'book-files', true, 52428800),
  ('book-covers', 'book-covers', true, 10485760),
  ('past-papers', 'past-papers', true, 52428800),
  ('university-covers', 'university-covers', true, 10485760),
  ('user-avatars', 'user-avatars', true, 5242880)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists elib_books_public_read on storage.objects;
drop policy if exists elib_covers_public_read on storage.objects;
drop policy if exists elib_books_authenticated_upload on storage.objects;
drop policy if exists elib_covers_authenticated_upload on storage.objects;
drop policy if exists elib_books_owner_manage on storage.objects;
drop policy if exists elib_covers_owner_manage on storage.objects;
drop policy if exists elib_books_owner_delete on storage.objects;
drop policy if exists elib_covers_owner_delete on storage.objects;

create policy elib_books_public_read on storage.objects for select using (bucket_id = 'elib-books');
create policy elib_covers_public_read on storage.objects for select using (bucket_id = 'elib-covers');
create policy elib_books_authenticated_upload on storage.objects for insert to authenticated with check (bucket_id = 'elib-books');
create policy elib_covers_authenticated_upload on storage.objects for insert to authenticated with check (bucket_id = 'elib-covers');
create policy elib_books_owner_manage on storage.objects for update using (bucket_id = 'elib-books' and (owner_id::text = auth.uid()::text or public.is_content_admin())) with check (bucket_id = 'elib-books' and (owner_id::text = auth.uid()::text or public.is_content_admin()));
create policy elib_covers_owner_manage on storage.objects for update using (bucket_id = 'elib-covers' and (owner_id::text = auth.uid()::text or public.is_content_admin())) with check (bucket_id = 'elib-covers' and (owner_id::text = auth.uid()::text or public.is_content_admin()));
create policy elib_books_owner_delete on storage.objects for delete using (bucket_id = 'elib-books' and (owner_id::text = auth.uid()::text or public.is_content_admin()));
create policy elib_covers_owner_delete on storage.objects for delete using (bucket_id = 'elib-covers' and (owner_id::text = auth.uid()::text or public.is_content_admin()));

notify pgrst, 'reload schema';
